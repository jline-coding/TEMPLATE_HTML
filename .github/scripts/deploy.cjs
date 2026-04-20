const fs = require('fs');
const path = require('path');
const os = require('os');
const ftp = require('basic-ftp');
const { execSync } = require('child_process');
const crypt = require('apache-crypt');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

// Unique temp directory per deploy run to prevent race conditions
const DEPLOY_ID = crypto.randomBytes(4).toString('hex');
const TMP_DIR = path.join(os.tmpdir(), `deploy_${DEPLOY_ID}`);
fs.mkdirSync(TMP_DIR, { recursive: true });

/**
 * Hash password using apr1 (MD5-APR1) algorithm for .htpasswd.
 * Tries openssl first (strong), falls back to apache-crypt (DES) for compatibility.
 */
function hashPassword(password) {
    try {
        return execSync(`openssl passwd -apr1 "${password.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim();
    } catch {
        console.warn('[WARN] openssl not available, falling back to DES hash (weaker)');
        return crypt(password);
    }
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────

/**
 * Walk a local directory recursively, returning all file paths (relative to dir).
 */
function walkDir(dir, baseDir = dir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...walkDir(fullPath, baseDir));
        } else {
            results.push(path.relative(baseDir, fullPath).replace(/\\/g, '/'));
        }
    }
    return results;
}

/**
 * Try downloading a file from multiple remote paths (fallback chain).
 * Returns true if any path succeeds, false otherwise.
 */
async function tryDownloadFrom(client, localPath, remotePaths, ftpRoot, targetDir) {
    for (const remotePath of remotePaths) {
        try {
            // If path starts with ftpRoot context, navigate there first
            if (remotePath.startsWith(ftpRoot) || remotePath.includes('/')) {
                await client.cd(ftpRoot);
            }
            await client.downloadTo(localPath, remotePath);
            await client.cd(targetDir);
            return true;
        } catch {
            // Try next path
        }
    }
    // Ensure we're back at targetDir even if all failed
    try { await client.cd(targetDir); } catch {}
    return false;
}

/**
 * Validate deploy-config.json structure.
 * Returns an array of error messages (empty = valid).
 */
function validateConfig(config) {
    const errors = [];

    if (!config.server || typeof config.server !== 'string') {
        errors.push('Thieu truong "server" (string)');
    }
    if (!config.project_dir || typeof config.project_dir !== 'string') {
        errors.push('Thieu truong "project_dir" (string)');
    }
    if (!config.source_folder || typeof config.source_folder !== 'string') {
        errors.push('Thieu truong "source_folder" (string)');
    }
    if (config.basic_auth) {
        if (!config.basic_auth.username || !config.basic_auth.password) {
            errors.push('Truong "basic_auth" neu co thi phai chua "username" va "password"');
        }
    }

    return errors;
}

/**
 * Generate manifest (file list with MD5 hashes) from a local directory.
 * Used to compare actual files between deploys.
 */
function generateManifest(dir) {
    const manifest = {};
    const files = walkDir(dir);
    for (const relPath of files) {
        const fullPath = path.join(dir, relPath);
        const hash = crypto.createHash('md5').update(fs.readFileSync(fullPath)).digest('hex');
        manifest[relPath] = hash;
    }
    return manifest;
}

/**
 * Compare 2 manifests, return lists of added / modified / deleted files.
 */
function diffManifest(oldManifest, newManifest) {
    const added = [];
    const modified = [];
    const deleted = [];

    for (const file of Object.keys(newManifest)) {
        if (!(file in oldManifest)) {
            added.push(file);
        } else if (oldManifest[file] !== newManifest[file]) {
            modified.push(file);
        }
    }

    for (const file of Object.keys(oldManifest)) {
        if (!(file in newManifest)) {
            deleted.push(file);
        }
    }

    return { added, modified, deleted };
}

// ─────────────────────────────────────────────
// FTP Upload (recursive directory)
// ─────────────────────────────────────────────

/**
 * Upload all files from a local directory to FTP (recursive).
 */
async function uploadDirectory(client, localDir, remoteDir, ftpRoot) {
    const files = walkDir(localDir);
    let uploadCount = 0;

    for (const relPath of files) {
        const localFilePath = path.join(localDir, relPath);
        const remoteFilePath = `${remoteDir}/${relPath}`;

        const remoteFileDir = path.posix.dirname(remoteFilePath);
        await client.cd(ftpRoot);
        await client.ensureDir(remoteFileDir);
        await client.cd(ftpRoot);

        await client.uploadFrom(localFilePath, remoteFilePath);
        uploadCount++;
        console.log(`   >> ${relPath}`);
    }

    console.log(`   Total: ${uploadCount} files uploaded.`);
}

// ─────────────────────────────────────────────
// ZIP Upload + PHP Extraction (Fast bulk deploy)
// ─────────────────────────────────────────────

/**
 * Create ZIP from local dir, upload to FTP, extract via PHP on server.
 * ~10-50x faster than uploading individual files.
 * Auto-fallback to uploadDirectory if failed.
 */
async function uploadViaZip(client, localDir, remoteDir, ftpRoot, config, serverInfo) {
    const zipPath = path.join(TMP_DIR, '_deploy_bundle.zip');
    const token = crypto.randomBytes(16).toString('hex');
    const filenameToken = crypto.randomBytes(16).toString('hex');
    const phpFilename = `_extract_${filenameToken}.php`;
    const phpRemotePath = `${remoteDir}/${phpFilename}`;

    try {
        // 1. Create ZIP
        console.log('Dang nen source thanh ZIP...');
        try { fs.unlinkSync(zipPath); } catch { /* ignore */ }
        execSync(`cd "${localDir}" && zip -r "${zipPath}" . -x '.*'`, { stdio: 'pipe' });
        const zipSize = fs.statSync(zipPath).size;
        console.log(`   ZIP size: ${(zipSize / 1024 / 1024).toFixed(2)} MB`);

        // 2. Upload ZIP
        console.log('Dang upload ZIP len server...');
        await client.uploadFrom(zipPath, `${remoteDir}/_deploy_bundle.zip`);
        console.log('   [OK] Upload ZIP hoan tat.');

        // 3. Create and upload PHP extractor (self-destructs after use, expires 5min)
        const phpContent = `<?php
// Auto-generated deploy extractor - self-destructs after use
header('Content-Type: application/json');

// Auto-expire after 5 minutes
if (time() - filemtime(__FILE__) > 300) {
    @unlink(__DIR__ . '/_deploy_bundle.zip');
    @unlink(__FILE__);
    http_response_code(410);
    echo json_encode(['ok' => false, 'error' => 'Expired']);
    exit;
}

if (!isset($_SERVER['HTTP_X_DEPLOY_TOKEN']) || $_SERVER['HTTP_X_DEPLOY_TOKEN'] !== '${token}') {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Invalid token']);
    exit;
}

$zip = new ZipArchive;
$zipFile = __DIR__ . '/_deploy_bundle.zip';

if (!file_exists($zipFile)) {
    echo json_encode(['ok' => false, 'error' => 'ZIP not found']);
    exit;
}

if ($zip->open($zipFile) === TRUE) {
    $zip->extractTo(__DIR__);
    $count = $zip->numFiles;
    $zip->close();
    unlink($zipFile);
    unlink(__FILE__);
    echo json_encode(['ok' => true, 'files' => $count]);
} else {
    echo json_encode(['ok' => false, 'error' => 'Extract failed']);
}
?>`;
        fs.writeFileSync(path.join(TMP_DIR, '_extractor.php'), phpContent);
        await client.uploadFrom(path.join(TMP_DIR, '_extractor.php'), phpRemotePath);
        console.log('   [OK] PHP extractor da upload.');

        // 4. Call PHP via HTTP to extract
        const domain = serverInfo.host.replace(/^ftp\./i, '');
        const webPath = serverInfo.root_path.replace(/^.*?\/public_html\/?/, '/');
        const siteUrl = `https://${domain}${webPath}`;
        const extractUrl = `${siteUrl}/${config.project_dir}/${phpFilename}`;
        console.log(`Goi PHP extractor (Header-Auth): ${domain}${webPath}/${config.project_dir}/_extract_***.php`);

        const result = await httpGet(extractUrl, {
            'X-Deploy-Token': token
        }, config.basic_auth);
        const parsed = JSON.parse(result);

        if (parsed.ok) {
            console.log(`   [OK] Giai nen thanh cong: ${parsed.files} files.`);
        } else {
            throw new Error(`PHP extraction loi: ${parsed.error}`);
        }

    } catch (err) {
        console.warn(`[WARN] ZIP deploy that bai: ${err.message}`);
        console.log('Fallback: Upload tung file...');

        // Cleanup ZIP + PHP on server
        try { await client.remove(`${remoteDir}/_deploy_bundle.zip`); } catch { /* ignore */ }
        try { await client.remove(phpRemotePath); } catch { /* ignore */ }

        // Fallback
        await uploadDirectory(client, localDir, remoteDir, ftpRoot);
    } finally {
        // Cleanup local
        try { fs.unlinkSync(zipPath); } catch { /* ignore */ }
        try { fs.unlinkSync(path.join(TMP_DIR, '_extractor.php')); } catch { /* ignore */ }
    }
}

/**
 * HTTP GET request with custom headers, Basic Auth + follow redirects.
 */
function httpGet(url, customHeaders = {}, basicAuth = null, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) {
            return reject(new Error('Too many redirects'));
        }

        const urlObj = new URL(url);
        const mod = urlObj.protocol === 'https:' ? https : http;
        
        if (urlObj.protocol !== 'https:') {
            console.warn('⚠️  [SECURITY WARNING] Dang goi file giai nen qua HTTP (khong phai HTTPS). Nguy co bi nghen hoac intercept du lieu!');
        }

        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: { ...customHeaders },
            rejectUnauthorized: false, // WARNING: SSL verification disabled for compatibility
        };

        if (basicAuth) {
            const creds = Buffer.from(`${basicAuth.username}:${basicAuth.password}`).toString('base64');
            options.headers['Authorization'] = `Basic ${creds}`;
        }

        const req = mod.request(options, (res) => {
            if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
                const redirectUrl = new URL(res.headers.location, url).toString();
                console.log(`   -> Redirect: ${redirectUrl}`);
                return httpGet(redirectUrl, customHeaders, basicAuth, maxRedirects - 1).then(resolve, reject);
            }

            let data = '';
            res.on('data', (chunk) => { data += chunk; });
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    resolve(data);
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${data.substring(0, 200)}`));
                }
            });
        });

        req.on('error', reject);
        req.setTimeout(60000, () => {
            req.destroy();
            reject(new Error('HTTP request timeout (60s)'));
        });
        req.end();
    });
}

// ─────────────────────────────────────────────
// FTP Connection with Retry
// ─────────────────────────────────────────────

/**
 * Connect to FTP with retry logic (max 3 attempts).
 */
async function connectWithRetry(client, serverInfo, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Dang ket noi FTP (lan ${attempt}/${maxRetries})...`);
            await client.access({
                host: serverInfo.host,
                user: serverInfo.user,
                password: serverInfo.pass,
                secure: true,
                secureOptions: { rejectUnauthorized: false }, // WARNING: SSL verification disabled for compatibility
            });
            console.log(`[OK] Ket noi FTP thanh cong: ${serverInfo.host}`);
            return;
        } catch (err) {
            console.error(`[WARN] Lan ${attempt} that bai: ${err.message}`);
            if (attempt === maxRetries) {
                throw new Error(`Khong the ket noi FTP sau ${maxRetries} lan thu: ${err.message}`);
            }
            await new Promise((resolve) => setTimeout(resolve, 3000));
        }
    }
}

// ─────────────────────────────────────────────
// Main Deploy Logic
// ─────────────────────────────────────────────

async function runDeploy() {
    console.log('');
    console.log('================================================');
    console.log('   HE THONG DEPLOY AN TOAN - KHOI DONG');
    console.log('================================================');
    console.log('');

    // --- Read & validate config ---
    if (!fs.existsSync('deploy-config.json')) {
        console.error('[ERROR] Khong tim thay file deploy-config.json!');
        process.exit(1);
    }

    const rawConfig = JSON.parse(fs.readFileSync('deploy-config.json', 'utf8'));

    // --- Detect deploy environment ---
    const deployEnv = process.env.DEPLOY_ENV || 'production';
    const branch = process.env.DEPLOY_BRANCH || '';
    console.log(`Branch: ${branch || '(unknown)'} -> Environment: ${deployEnv.toUpperCase()}`);

    const envConfig = rawConfig[deployEnv];
    if (!envConfig) {
        console.error(`[ERROR] Khong tim thay config "${deployEnv}" trong deploy-config.json!`);
        console.error(`   Can co khoi "${deployEnv}" chua: server, project_dir, basic_auth.`);
        process.exit(1);
    }

    // Merge shared + environment config
    const config = {
        source_folder: (rawConfig.source_folder && rawConfig.source_folder.trim() !== "") ? rawConfig.source_folder : "public",
        build_command: rawConfig.build_command,
        server: envConfig.server,
        project_dir: envConfig.project_dir || rawConfig.project_dir,
        basic_auth: envConfig.basic_auth,
    };

    // Helper to mask project directory to prevent leaking server structure
    const maskedDir = config.project_dir.length > 5 
        ? config.project_dir.substring(0, 3) + '***' + config.project_dir.slice(-2)
        : '***';

    console.log(`   Server: ${config.server}`);
    console.log(`   Directory: ${maskedDir}`);
    console.log('');

    // VALIDATION
    const configErrors = validateConfig(config);
    if (configErrors.length > 0) {
        console.error('[ERROR] Invalid deploy-config.json:');
        configErrors.forEach((e) => console.error(`   - ${e}`));
        process.exit(1);
    }

    // SECURITY LAYER 1: PATH TRAVERSAL PROTECTION
    const isValidDir = /^[a-zA-Z0-9_.-]+$/.test(config.project_dir);
    if (!isValidDir) {
        console.error(`[ERROR] CRITICAL: project_dir "${config.project_dir}" is INVALID!`);
        console.error(`   Only alphanumeric, dot (.), dash (-), underscore (_) allowed.`);
        console.error(`   Server protection: auto-terminated.`);
        process.exit(1);
    }

    if (!fs.existsSync(config.source_folder)) {
        console.error(`[ERROR] Source folder "${config.source_folder}" does not exist!`);
        console.error(`   Vui long chac chan ban da build source hoac kiem tra lai ten source_folder.`);
        process.exit(1);
    }

    // Validate source_folder has no path traversal
    if (/\.\.\/|\.\.\\/.test(config.source_folder)) {
        console.error(`[ERROR] source_folder "${config.source_folder}" contains path traversal!`);
        process.exit(1);
    }

    // Đọc server config từ biến môi trường đã được bóc tách
    const serverInfo = {
        host: process.env.SSH_HOST || '',
        user: process.env.SSH_USER || '',
        pass: process.env.SSH_PASS || '',
        root_path: process.env.ROOT_PATH || '',
        ftp_dir: process.env.FTP_DIR || '',
        ftp_git: process.env.FTP_GIT || null,
        ssh_port: process.env.SSH_PORT || '22'
    };
    const targetDir = `${serverInfo.ftp_dir}/${config.project_dir}`;
    
    let remoteMetaDir;
    if (serverInfo.ftp_git) {
        remoteMetaDir = `${serverInfo.ftp_git}/.deploy/${config.project_dir}`;
    } else {
        remoteMetaDir = `${targetDir}/.deploy`;
    }

    console.log(`Config:`);
    console.log(`   Server: ${serverInfo.host}`);
    console.log(`   FTP Dir: ${targetDir}`);
    console.log(`   Meta Dir: ${remoteMetaDir}`);
    console.log(`   Source: ${config.source_folder}/`);
    console.log('');

    // --- FTP Connect ---
    const client = new ftp.Client();
    client.ftp.verbose = false;

    try {
        await connectWithRetry(client, serverInfo);

        const ftpRoot = await client.pwd();

        // SECURITY LAYER 2: REPO LOCK (prevent accidental overwrite)
        // Lock ID = repo + environment (e.g. "user/repo:production")
        // Prevents staging from overwriting production even with same repo
        const lockId = `${process.env.GITHUB_REPO}:${deployEnv}`;
        let isFirstDeploy = false;
        let dirExists = true;

        try {
            await client.cd(targetDir);
        } catch (e) {
            // Directory does not exist -> safe for first deploy
            dirExists = false;
        }

        if (dirExists) {
            // Directory exists -> MUST have matching .repo_lock
            try {
                const lockFileLocal = path.join(TMP_DIR, '.repo_lock');
                try {
                    await client.cd(ftpRoot);
                    await client.downloadTo(lockFileLocal, `${remoteMetaDir}/.repo_lock`);
                    await client.cd(targetDir);
                } catch (e1) {
                    try {
                        await client.cd(targetDir); // Phục hồi lại đường dẫn targetDir sau khi e1 lỗi
                        await client.downloadTo(lockFileLocal, '.deploy/.repo_lock');
                    } catch (e2) {
                        await client.downloadTo(lockFileLocal, '.repo_lock'); // Fallback
                    }
                }
                const lockOwner = fs.readFileSync(lockFileLocal, 'utf8').trim();

                // Tương thích ngược: Nếu lockOwner là bản cũ (không có :env) nhưng đúng repo, thì cho qua
                if (lockOwner !== lockId && lockOwner !== process.env.GITHUB_REPO) {
                    throw new Error(
                        `[SECURITY] Directory [${config.project_dir}] belongs to [${lockOwner}]. ` +
                        `Current: [${lockId}]. DEPLOY CANCELLED!`
                    );
                }
                console.log(`[OK] Repo lock matched [${lockOwner}] - safe to proceed.`);
            } catch (err) {
                if (err.message.includes('[SECURITY]')) throw err;

                // Directory exists but NO .repo_lock -> BLOCK
                console.error('========================================');
                console.error('   [ERROR] DIRECTORY ALREADY EXISTS');
                console.error('========================================');
                console.error(`Directory [${config.project_dir}] already exists on server but has no .repo_lock file.`);
                console.error('This means it was created manually or by another system.');
                console.error('');
                console.error('Options:');
                console.error('  1. Delete the directory on server manually, then re-deploy.');
                console.error('  2. Add .repo_lock file manually with content: ' + lockId);
                console.error('');
                console.error('DEPLOY CANCELLED to prevent data loss.');
                process.exit(1);
            }
        } else {
            isFirstDeploy = true;
            console.log('[INFO] Directory does not exist - first deploy.');
        }

        // ════════════════════════════════════════
        // MODE 1: FIRST DEPLOY
        // ════════════════════════════════════════
        if (isFirstDeploy) {
            console.log('');
            console.log('--- FIRST DEPLOY: Setup structure & security ---');

            await client.cd(ftpRoot);
            await client.ensureDir(targetDir);
            await client.cd(ftpRoot);
            await client.ensureDir(remoteMetaDir);
            await client.cd(ftpRoot);

            // 1. Create repo lock
            console.log('Creating .repo_lock...');
            fs.writeFileSync(path.join(TMP_DIR, '.repo_lock'), lockId);
            await client.uploadFrom(path.join(TMP_DIR, '.repo_lock'), `${remoteMetaDir}/.repo_lock`);

            // 2 & 3. Create .htpasswd & .htaccess
            if (config.basic_auth) {
                console.log('Creating .htpasswd & .htaccess...');
                const hashedPass = hashPassword(config.basic_auth.password);
                fs.writeFileSync(path.join(TMP_DIR, '.htpasswd'), `${config.basic_auth.username}:${hashedPass}`);
                await client.uploadFrom(path.join(TMP_DIR, '.htpasswd'), `${targetDir}/.htpasswd`);

                const htaccessLines = [
                    '<Files ~ "^\\.">',
                    'Deny from all',
                    '</Files>',
                    'AuthType Basic',
                    'AuthName "Restricted Area"',
                    `AuthUserFile ${serverInfo.root_path}/${config.project_dir}/.htpasswd`,
                    'Require valid-user'
                ];
                fs.writeFileSync(path.join(TMP_DIR, '.htaccess'), htaccessLines.join('\n'));
                await client.uploadFrom(path.join(TMP_DIR, '.htaccess'), `${targetDir}/.htaccess`);
            } else {
                console.log('--- Removing basic_auth (if exists) ---');
                try { await client.remove(`${targetDir}/.htpasswd`); } catch (e) {}
                try { await client.remove(`${targetDir}/.htaccess`); } catch (e) {}
                console.log('[INFO] basic_auth omitted - removed any old .htaccess/.htpasswd.');
            }

            // 4. Upload all source (ZIP fast or file-by-file fallback)
            console.log(`Uploading all files from ${config.source_folder}/...`);
            await uploadViaZip(client, config.source_folder, targetDir, ftpRoot, config, serverInfo);

            // 5. Save manifest (file list + hashes)
            console.log('Saving manifest...');
            const manifest = generateManifest(config.source_folder);
            fs.writeFileSync(path.join(TMP_DIR, '.deploy_manifest.json'), JSON.stringify(manifest));
            await client.uploadFrom(path.join(TMP_DIR, '.deploy_manifest.json'), `${remoteMetaDir}/.deploy_manifest.json`);
            console.log(`   Manifest: ${Object.keys(manifest).length} files.`);

            // 6. Save deploy SHA
            const currentSha = execSync('git rev-parse HEAD').toString().trim();
            fs.writeFileSync(path.join(TMP_DIR, '.deploy_sha'), currentSha);
            await client.uploadFrom(path.join(TMP_DIR, '.deploy_sha'), `${remoteMetaDir}/.deploy_sha`);
            console.log(`SHA saved: ${currentSha.substring(0, 8)}`);

            console.log('');
            console.log('[OK] First deploy completed!');
        }

        // ════════════════════════════════════════
        // MODE 2: SMART UPDATE (MANIFEST COMPARISON)
        // Only upload actually changed files, works with build step
        // ════════════════════════════════════════
        else {
            console.log('');
            console.log('--- UPDATE: Comparing manifest files ---');

            await client.cd(ftpRoot);
            await client.ensureDir(remoteMetaDir);
            await client.cd(ftpRoot);

            // Re-sync .htpasswd & .htaccess
            if (config.basic_auth) {
                console.log('Syncing .htpasswd & .htaccess...');
                const hashedPass = hashPassword(config.basic_auth.password);
                fs.writeFileSync(path.join(TMP_DIR, '.htpasswd'), `${config.basic_auth.username}:${hashedPass}`);
                await client.uploadFrom(path.join(TMP_DIR, '.htpasswd'), `${targetDir}/.htpasswd`);

                const htaccessLinesUpdate = [
                    '<Files ~ "^\\.">',
                    'Deny from all',
                    '</Files>',
                    'AuthType Basic',
                    'AuthName "Restricted Area"',
                    `AuthUserFile ${serverInfo.root_path}/${config.project_dir}/.htpasswd`,
                    'Require valid-user'
                ];
                fs.writeFileSync(path.join(TMP_DIR, '.htaccess'), htaccessLinesUpdate.join('\n'));
                await client.uploadFrom(path.join(TMP_DIR, '.htaccess'), `${targetDir}/.htaccess`);
                console.log('[OK] .htpasswd & .htaccess synced.');
            } else {
                console.log('--- Removing basic_auth (if exists) ---');
                try { await client.remove(`${targetDir}/.htpasswd`); } catch (e) {}
                try { await client.remove(`${targetDir}/.htaccess`); } catch (e) {}
                console.log('[INFO] basic_auth omitted - removed any old .htaccess/.htpasswd.');
            }

            // Check SHA - quick skip if no changes
            let lastDeployedSha = '';
            const shaLocalPath = path.join(TMP_DIR, '.deploy_sha');
            const shaFound = await tryDownloadFrom(client, shaLocalPath, [
                `${remoteMetaDir}/.deploy_sha`,
                '.deploy/.deploy_sha',
                '.deploy_sha'
            ], ftpRoot, targetDir);

            if (shaFound) {
                const rawSha = fs.readFileSync(shaLocalPath, 'utf8').trim();
                if (/^[0-9a-f]{40}$/i.test(rawSha)) {
                    lastDeployedSha = rawSha;
                    console.log(`Previous SHA: ${lastDeployedSha.substring(0, 8)}`);
                }
            } else {
                console.log('[INFO] .deploy_sha not found.');
            }

            const currentSha = execSync('git rev-parse HEAD').toString().trim();
            console.log(`Current SHA:  ${currentSha.substring(0, 8)}`);

            if (lastDeployedSha === currentSha) {
                console.log('[INFO] SHA matched - nothing to update.');
                return;
            }

            // --- Generate current manifest from built source ---
            console.log('Scanning current files...');
            const currentManifest = generateManifest(config.source_folder);
            const totalFiles = Object.keys(currentManifest).length;
            console.log(`   Total: ${totalFiles} files.`);

            // --- Download old manifest from server ---
            let oldManifest = null;
            const manifestLocalPath = path.join(TMP_DIR, '.deploy_manifest.json');
            const manifestFound = await tryDownloadFrom(client, manifestLocalPath, [
                `${remoteMetaDir}/.deploy_manifest.json`,
                '.deploy/.deploy_manifest.json',
                '.deploy_manifest.json'
            ], ftpRoot, targetDir);

            if (manifestFound) {
                try {
                    oldManifest = JSON.parse(fs.readFileSync(manifestLocalPath, 'utf8'));
                    console.log('Old manifest downloaded from server.');
                } catch {
                    console.log('[WARN] Old manifest corrupted - will upload all.');
                }
            } else {
                console.log('[INFO] Old manifest not found - will upload all.');
            }

            // SECURITY LAYER 3: PROTECTED FILES
            const PROTECTED_FILES = ['.repo_lock', '.htaccess', '.htpasswd', '.deploy_sha', '.deploy_manifest.json'];

            if (!oldManifest) {
                // --- No old manifest -> Full ZIP upload ---
                console.log('Switching to full source upload (ZIP)...');
                await uploadViaZip(client, config.source_folder, targetDir, ftpRoot, config, serverInfo);
            } else {
                // --- Compare manifests -> Only upload changed files ---
                const diff = diffManifest(oldManifest, currentManifest);
                const changedCount = diff.added.length + diff.modified.length + diff.deleted.length;

                if (changedCount === 0) {
                    console.log('[INFO] No file changes detected (manifest matched).');
                } else {
                    console.log(`Found: ${diff.added.length} new, ${diff.modified.length} modified, ${diff.deleted.length} deleted.`);
                    console.log('');

                    // Upload new + modified files
                    for (const relPath of [...diff.added, ...diff.modified]) {
                        if (PROTECTED_FILES.includes(relPath) || relPath.startsWith('.deploy/')) continue;
                        const localFilePath = path.join(config.source_folder, relPath);
                        const ftpFilePath = `${targetDir}/${relPath}`;
                        const remoteFileDir = path.posix.dirname(ftpFilePath);
                        await client.cd(ftpRoot);
                        await client.ensureDir(remoteFileDir);
                        await client.cd(ftpRoot);
                        await client.uploadFrom(localFilePath, ftpFilePath);
                        console.log(`   >> ${relPath}`);
                    }

                    // Delete removed files
                    const dirsToCheck = new Set();
                    for (const relPath of diff.deleted) {
                        if (PROTECTED_FILES.includes(relPath) || relPath.startsWith('.deploy/')) continue;
                        const ftpFilePath = `${targetDir}/${relPath}`;
                        try {
                            await client.remove(ftpFilePath);
                            console.log(`   XX ${relPath}`);
                            
                            // Collect parent dir for potential cleanup
                            let dir = path.posix.dirname(relPath);
                            while (dir && dir !== '.') {
                                dirsToCheck.add(dir);
                                dir = path.posix.dirname(dir);
                            }
                        } catch (e) { /* file might not exist */ }
                    }

                    // Cleanup empty directories (bottom-up)
                    if (dirsToCheck.size > 0) {
                        const sortedDirs = Array.from(dirsToCheck).sort((a, b) => b.split('/').length - a.split('/').length);
                        for (const dir of sortedDirs) {
                            try {
                                await client.removeDir(`${targetDir}/${dir}`);
                                console.log(`   XX [Dir] ${dir}`);
                            } catch (e) {
                                // Ignore: dir is not empty or doesn't exist
                            }
                        }
                    }

                    console.log('');
                    console.log(`Result: ${diff.added.length + diff.modified.length} uploaded, ${diff.deleted.length} deleted.`);
                }
            }

            // Cleanup old orphaned files from root if transitioning to .deploy
            try { await client.remove(`${targetDir}/.repo_lock`); } catch(e) {}
            try { await client.remove(`${targetDir}/.deploy_sha`); } catch(e) {}
            try { await client.remove(`${targetDir}/.deploy_manifest.json`); } catch(e) {}
            try { await client.removeDir(`${targetDir}/.deploy`); } catch(e) {} // Clean up old .deploy folder

            // --- Save new manifest + SHA ---
            fs.writeFileSync(path.join(TMP_DIR, '.deploy_manifest.json'), JSON.stringify(currentManifest));
            await client.uploadFrom(path.join(TMP_DIR, '.deploy_manifest.json'), `${remoteMetaDir}/.deploy_manifest.json`);

            fs.writeFileSync(path.join(TMP_DIR, '.deploy_sha'), currentSha);
            await client.uploadFrom(path.join(TMP_DIR, '.deploy_sha'), `${remoteMetaDir}/.deploy_sha`);
            console.log(`SHA + manifest updated: ${currentSha.substring(0, 8)}`);
            console.log('[OK] Update completed!');
        }
    } catch (error) {
        console.error('');
        console.error('========================================');
        console.error('   [ERROR] SYSTEM ERROR');
        console.error('========================================');
        console.error(error.message);
        process.exit(1);
    } finally {
        client.close();
        console.log('');
        console.log('FTP connection closed.');
    }
}

runDeploy();
