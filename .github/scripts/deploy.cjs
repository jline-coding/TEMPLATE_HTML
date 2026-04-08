const fs = require('fs');
const path = require('path');
const ftp = require('basic-ftp');
const { execSync } = require('child_process');
const crypt = require('apache-crypt');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

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
    if (!config.basic_auth || !config.basic_auth.username || !config.basic_auth.password) {
        errors.push('Thieu truong "basic_auth" voi "username" va "password"');
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
    const zipPath = '/tmp/_deploy_bundle.zip';
    const token = crypto.randomBytes(16).toString('hex');
    const phpFilename = `_extract_${token.substring(0, 8)}.php`;
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

        // 3. Create and upload PHP extractor (self-destructs after use)
        const phpContent = `<?php
// Auto-generated deploy extractor - self-destructs after use
header('Content-Type: application/json');

if (!isset($_GET['token']) || $_GET['token'] !== '${token}') {
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
        fs.writeFileSync('/tmp/_extractor.php', phpContent);
        await client.uploadFrom('/tmp/_extractor.php', phpRemotePath);
        console.log('   [OK] PHP extractor da upload.');

        // 4. Call PHP via HTTP to extract
        const domain = serverInfo.host.replace(/^ftp\./i, '');
        const webPath = serverInfo.root_path.replace(/^.*?\/public_html\/?/, '/');
        const siteUrl = `https://${domain}${webPath}`;
        const extractUrl = `${siteUrl}/${config.project_dir}/${phpFilename}?token=${token}`;
        console.log(`Goi PHP extractor: ${domain}${webPath}/${config.project_dir}/${phpFilename}`);

        const result = await httpGet(extractUrl, config.basic_auth);
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
        try { fs.unlinkSync('/tmp/_extractor.php'); } catch { /* ignore */ }
    }
}

/**
 * HTTP GET request with Basic Auth + follow redirects.
 */
function httpGet(url, basicAuth, maxRedirects = 5) {
    return new Promise((resolve, reject) => {
        if (maxRedirects <= 0) {
            return reject(new Error('Too many redirects'));
        }

        const urlObj = new URL(url);
        const mod = urlObj.protocol === 'https:' ? https : http;
        const options = {
            hostname: urlObj.hostname,
            port: urlObj.port || (urlObj.protocol === 'https:' ? 443 : 80),
            path: urlObj.pathname + urlObj.search,
            method: 'GET',
            headers: {},
            rejectUnauthorized: false,
        };

        if (basicAuth) {
            const creds = Buffer.from(`${basicAuth.username}:${basicAuth.password}`).toString('base64');
            options.headers['Authorization'] = `Basic ${creds}`;
        }

        const req = mod.request(options, (res) => {
            if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
                const redirectUrl = new URL(res.headers.location, url).toString();
                console.log(`   -> Redirect: ${redirectUrl}`);
                return httpGet(redirectUrl, basicAuth, maxRedirects - 1).then(resolve, reject);
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
                secureOptions: { rejectUnauthorized: false },
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
        source_folder: rawConfig.source_folder,
        has_build_step: rawConfig.has_build_step,
        build_command: rawConfig.build_command,
        server: envConfig.server,
        project_dir: envConfig.project_dir,
        basic_auth: envConfig.basic_auth,
    };

    console.log(`   Server: ${config.server}`);
    console.log(`   Directory: ${config.project_dir}`);
    console.log('');

    // VALIDATION
    const configErrors = validateConfig(config);
    if (configErrors.length > 0) {
        console.error('[ERROR] Invalid deploy-config.json:');
        configErrors.forEach((e) => console.error(`   - ${e}`));
        process.exit(1);
    }

    // SECURITY LAYER 1: PATH TRAVERSAL PROTECTION
    const isValidDir = /^[a-zA-Z0-9_-]+$/.test(config.project_dir);
    if (!isValidDir) {
        console.error(`[ERROR] CRITICAL: project_dir "${config.project_dir}" is INVALID!`);
        console.error(`   Only alphanumeric, dash (-), underscore (_) allowed.`);
        console.error(`   Server protection: auto-terminated.`);
        process.exit(1);
    }

    // Check source folder exists
    if (!fs.existsSync(config.source_folder)) {
        console.error(`[ERROR] Source folder "${config.source_folder}" does not exist!`);
        console.error(`   Check has_build_step: true in deploy-config.json.`);
        process.exit(1);
    }

    // Validate source_folder has no path traversal
    if (/\.\.\/|\.\.\\/.test(config.source_folder)) {
        console.error(`[ERROR] source_folder "${config.source_folder}" contains path traversal!`);
        process.exit(1);
    }

    // Check Server Secret
    if (!process.env.SERVER_SECRET_JSON) {
        console.error(`[ERROR] Secret for server [${config.server}] not found.`);
        console.error(`   Create GitHub Secret named "${config.server}_CONFIG" with FTP JSON config.`);
        process.exit(1);
    }

    const serverInfo = JSON.parse(process.env.SERVER_SECRET_JSON);
    const targetDir = `${serverInfo.ftp_dir}/${config.project_dir}`;

    console.log(`Config:`);
    console.log(`   Server: ${serverInfo.host}`);
    console.log(`   FTP Dir: ${targetDir}`);
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
                const lockFileLocal = '/tmp/.repo_lock';
                try {
                    await client.downloadTo(lockFileLocal, '.deploy/.repo_lock');
                } catch (e) {
                    await client.downloadTo(lockFileLocal, '.repo_lock'); // Fallback cho version cu
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
            await client.ensureDir(`${targetDir}/.deploy`);
            await client.cd(ftpRoot);

            // 1. Create repo lock
            console.log('Creating .repo_lock...');
            fs.writeFileSync('/tmp/.repo_lock', lockId);
            await client.uploadFrom('/tmp/.repo_lock', `${targetDir}/.deploy/.repo_lock`);

            // 2. Create .htpasswd (cùng cấp với .htaccess)
            console.log('Creating .htpasswd...');
            const hashedPass = crypt(config.basic_auth.password);
            fs.writeFileSync('/tmp/.htpasswd', `${config.basic_auth.username}:${hashedPass}`);
            await client.uploadFrom('/tmp/.htpasswd', `${targetDir}/.htpasswd`);

            // 3. Create .htaccess (MUST stay in root to protect all children)
            console.log('Creating .htaccess...');
            const htaccessContent = [
                '<Files ~ "^\\.">',
                'Deny from all',
                '</Files>',
                'AuthType Basic',
                'AuthName "Restricted Area"',
                `AuthUserFile ${serverInfo.root_path}/${config.project_dir}/.htpasswd`,
                'Require valid-user',
            ].join('\n');
            fs.writeFileSync('/tmp/.htaccess', htaccessContent);
            await client.uploadFrom('/tmp/.htaccess', `${targetDir}/.htaccess`);

            // 4. Upload all source (ZIP fast or file-by-file fallback)
            console.log(`Uploading all files from ${config.source_folder}/...`);
            await uploadViaZip(client, config.source_folder, targetDir, ftpRoot, config, serverInfo);

            // 5. Save manifest (file list + hashes)
            console.log('Saving manifest...');
            const manifest = generateManifest(config.source_folder);
            fs.writeFileSync('/tmp/.deploy_manifest.json', JSON.stringify(manifest));
            await client.uploadFrom('/tmp/.deploy_manifest.json', `${targetDir}/.deploy/.deploy_manifest.json`);
            console.log(`   Manifest: ${Object.keys(manifest).length} files.`);

            // 6. Save deploy SHA
            const currentSha = execSync('git rev-parse HEAD').toString().trim();
            fs.writeFileSync('/tmp/.deploy_sha', currentSha);
            await client.uploadFrom('/tmp/.deploy_sha', `${targetDir}/.deploy/.deploy_sha`);
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
            await client.ensureDir(`${targetDir}/.deploy`);
            await client.cd(ftpRoot);

            // Re-sync .htpasswd & .htaccess
            console.log('Syncing .htpasswd & .htaccess...');
            const hashedPass = crypt(config.basic_auth.password);
            fs.writeFileSync('/tmp/.htpasswd', `${config.basic_auth.username}:${hashedPass}`);
            await client.uploadFrom('/tmp/.htpasswd', `${targetDir}/.htpasswd`);

            const htaccessContent = [
                '<Files ~ "^\\.">',
                'Deny from all',
                '</Files>',
                'AuthType Basic',
                'AuthName "Restricted Area"',
                `AuthUserFile ${serverInfo.root_path}/${config.project_dir}/.htpasswd`,
                'Require valid-user',
            ].join('\n');
            fs.writeFileSync('/tmp/.htaccess', htaccessContent);
            await client.uploadFrom('/tmp/.htaccess', `${targetDir}/.htaccess`);
            console.log('[OK] .htpasswd & .htaccess synced.');

            // Check SHA - quick skip if no changes
            let lastDeployedSha = '';
            try {
                try {
                    await client.downloadTo('/tmp/.deploy_sha', `${targetDir}/.deploy/.deploy_sha`);
                } catch(e) {
                    await client.downloadTo('/tmp/.deploy_sha', `${targetDir}/.deploy_sha`);
                }
                const rawSha = fs.readFileSync('/tmp/.deploy_sha', 'utf8').trim();
                if (/^[0-9a-f]{40}$/i.test(rawSha)) {
                    lastDeployedSha = rawSha;
                    console.log(`Previous SHA: ${lastDeployedSha.substring(0, 8)}`);
                }
            } catch (e) {
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
            try {
                try {
                    await client.downloadTo('/tmp/.deploy_manifest.json', `${targetDir}/.deploy/.deploy_manifest.json`);
                } catch(e) {
                    await client.downloadTo('/tmp/.deploy_manifest.json', `${targetDir}/.deploy_manifest.json`);
                }
                oldManifest = JSON.parse(fs.readFileSync('/tmp/.deploy_manifest.json', 'utf8'));
                console.log('Old manifest downloaded from server.');
            } catch (e) {
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
                    for (const relPath of diff.deleted) {
                        if (PROTECTED_FILES.includes(relPath) || relPath.startsWith('.deploy/')) continue;
                        const ftpFilePath = `${targetDir}/${relPath}`;
                        try {
                            await client.remove(ftpFilePath);
                            console.log(`   XX ${relPath}`);
                        } catch (e) { /* file might not exist */ }
                    }

                    console.log('');
                    console.log(`Result: ${diff.added.length + diff.modified.length} uploaded, ${diff.deleted.length} deleted.`);
                }
            }

            // Cleanup old orphaned files from root if transitioning to .deploy
            try { await client.remove(`${targetDir}/.repo_lock`); } catch(e) {}
            try { await client.remove(`${targetDir}/.deploy_sha`); } catch(e) {}
            try { await client.remove(`${targetDir}/.deploy_manifest.json`); } catch(e) {}
            try { await client.remove(`${targetDir}/.deploy/.htpasswd`); } catch(e) {} // Clean up old .htpasswd inside .deploy if previously generated

            // --- Save new manifest + SHA ---
            fs.writeFileSync('/tmp/.deploy_manifest.json', JSON.stringify(currentManifest));
            await client.uploadFrom('/tmp/.deploy_manifest.json', `${targetDir}/.deploy/.deploy_manifest.json`);

            fs.writeFileSync('/tmp/.deploy_sha', currentSha);
            await client.uploadFrom('/tmp/.deploy_sha', `${targetDir}/.deploy/.deploy_sha`);
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
