const fs = require('fs');
const path = require('path');
const ftp = require('basic-ftp');
const { execSync } = require('child_process');
const crypt = require('apache-crypt');
const crypto = require('crypto');
const https = require('https');
const http = require('http');

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Utilities
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

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
        errors.push('Thiáº¿u trÆ°á»ng "server" (string)');
    }
    if (!config.project_dir || typeof config.project_dir !== 'string') {
        errors.push('Thiáº¿u trÆ°á»ng "project_dir" (string)');
    }
    if (!config.source_folder || typeof config.source_folder !== 'string') {
        errors.push('Thiáº¿u trÆ°á»ng "source_folder" (string)');
    }
    if (!config.basic_auth || !config.basic_auth.username || !config.basic_auth.password) {
        errors.push('Thiáº¿u trÆ°á»ng "basic_auth" vá»›i "username" vÃ  "password"');
    }

    return errors;
}

/**
 * Táº¡o manifest (danh sÃ¡ch file â†’ MD5 hash) tá»« thÆ° má»¥c local.
 * DÃ¹ng Ä‘á»ƒ so sÃ¡nh file thá»±c táº¿ giá»¯a 2 láº§n deploy.
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
 * So sÃ¡nh 2 manifest, tráº£ vá» danh sÃ¡ch file thÃªm má»›i / sá»­a Ä‘á»•i / bá»‹ xÃ³a.
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FTP Upload (recursive directory)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Upload toÃ n bá»™ ná»™i dung cá»§a má»™t thÆ° má»¥c local lÃªn FTP (Ä‘á»‡ quy).
 * Giáº£i quyáº¿t lá»—i: client.uploadFrom() chá»‰ upload 1 file, KHÃ”NG upload thÆ° má»¥c.
 */
async function uploadDirectory(client, localDir, remoteDir, ftpRoot) {
    const files = walkDir(localDir);
    let uploadCount = 0;

    for (const relPath of files) {
        const localFilePath = path.join(localDir, relPath);
        const remoteFilePath = `${remoteDir}/${relPath}`;

        // Ensure remote directory exists
        const remoteFileDir = path.posix.dirname(remoteFilePath);
        await client.ensureDir(remoteFileDir);
        await client.cd(ftpRoot); // Reset CWD sau ensureDir

        await client.uploadFrom(localFilePath, remoteFilePath);
        uploadCount++;
        console.log(`   â¬†ï¸ ${relPath}`);
    }

    console.log(`   ðŸ“Š Tá»•ng cá»™ng: ${uploadCount} file Ä‘Ã£ upload.`);
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// ZIP Upload + PHP Extraction (Fast bulk deploy)
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Táº¡o ZIP tá»« thÆ° má»¥c local, upload lÃªn FTP, dÃ¹ng PHP giáº£i nÃ©n trÃªn server.
 * Nhanh hÆ¡n Ã—10-50 láº§n so vá»›i upload tá»«ng file qua FTP.
 * Tá»± Ä‘á»™ng fallback vá» uploadDirectory náº¿u tháº¥t báº¡i.
 */
async function uploadViaZip(client, localDir, remoteDir, ftpRoot, config, serverInfo) {
    const zipPath = '/tmp/_deploy_bundle.zip';
    const token = crypto.randomBytes(16).toString('hex');
    const phpFilename = `_extract_${token.substring(0, 8)}.php`;
    const phpRemotePath = `${remoteDir}/${phpFilename}`;

    try {
        // 1. Táº¡o ZIP file
        console.log('ðŸ“¦ Äang nÃ©n source thÃ nh ZIP...');
        try { fs.unlinkSync(zipPath); } catch { /* ignore */ }
        execSync(`cd "${localDir}" && zip -r "${zipPath}" . -x '.*'`, { stdio: 'pipe' });
        const zipSize = fs.statSync(zipPath).size;
        console.log(`   ðŸ“¦ ZIP size: ${(zipSize / 1024 / 1024).toFixed(2)} MB`);

        // 2. Upload ZIP
        console.log('â¬†ï¸ Äang upload ZIP lÃªn server...');
        await client.uploadFrom(zipPath, `${remoteDir}/_deploy_bundle.zip`);
        console.log('   âœ… Upload ZIP hoÃ n táº¥t.');

        // 3. Táº¡o vÃ  upload PHP extractor (tá»± xÃ³a sau khi cháº¡y)
        const phpContent = `<?php
// Auto-generated deploy extractor â€” self-destructs after use
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
        console.log('   âœ… PHP extractor Ä‘Ã£ upload.');

        // 4. Gá»i PHP qua HTTP Ä‘á»ƒ giáº£i nÃ©n
        // Tá»± derive URL tá»« config cÃ³ sáºµn (khÃ´ng cáº§n thÃªm site_url)
        // host: "ftp.example.com" â†’ domain: "example.com"
        // root_path: "/home/user/public_html/client/deploy" â†’ web path: "/client/deploy"
        const domain = serverInfo.host.replace(/^ftp\./i, '');
        const webPath = serverInfo.root_path.replace(/^.*?\/public_html\/?/, '/');
        const siteUrl = `https://${domain}${webPath}`;
        const extractUrl = `${siteUrl}/${config.project_dir}/${phpFilename}?token=${token}`;
        console.log(`ðŸ”— Gá»i PHP extractor: ${domain}${webPath}/${config.project_dir}/${phpFilename}`);

        const result = await httpGet(extractUrl, config.basic_auth);
        const parsed = JSON.parse(result);

        if (parsed.ok) {
            console.log(`   âœ… Giáº£i nÃ©n thÃ nh cÃ´ng: ${parsed.files} files.`);
        } else {
            throw new Error(`PHP extraction lá»—i: ${parsed.error}`);
        }

    } catch (err) {
        console.warn(`âš ï¸ ZIP deploy tháº¥t báº¡i: ${err.message}`);
        console.log('â„¹ï¸ Fallback: Upload tá»«ng file...');

        // Cleanup ZIP + PHP trÃªn server
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
 * HTTP GET request vá»›i Basic Auth + follow redirects.
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
            // Cháº¥p nháº­n self-signed cert (staging server)
            rejectUnauthorized: false,
        };

        if (basicAuth) {
            const creds = Buffer.from(`${basicAuth.username}:${basicAuth.password}`).toString('base64');
            options.headers['Authorization'] = `Basic ${creds}`;
        }

        const req = mod.request(options, (res) => {
            // Follow redirects (301, 302, 307, 308)
            if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
                const redirectUrl = new URL(res.headers.location, url).toString();
                console.log(`   â†ªï¸ Redirect â†’ ${redirectUrl}`);
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

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// FTP Connection with Retry
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/**
 * Káº¿t ná»‘i FTP vá»›i retry logic (tá»‘i Ä‘a 3 láº§n).
 */
async function connectWithRetry(client, serverInfo, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`ðŸ”— Äang káº¿t ná»‘i FTP (láº§n ${attempt}/${maxRetries})...`);
            await client.access({
                host: serverInfo.host,
                user: serverInfo.user,
                password: serverInfo.pass,
                secure: true,
                secureOptions: { rejectUnauthorized: false },
            });
            console.log(`âœ… Káº¿t ná»‘i FTP thÃ nh cÃ´ng: ${serverInfo.host}`);
            return;
        } catch (err) {
            console.error(`âš ï¸ Láº§n ${attempt} tháº¥t báº¡i: ${err.message}`);
            if (attempt === maxRetries) {
                throw new Error(`KhÃ´ng thá»ƒ káº¿t ná»‘i FTP sau ${maxRetries} láº§n thá»­: ${err.message}`);
            }
            // Chá» 3 giÃ¢y trÆ°á»›c khi thá»­ láº¡i
            await new Promise((resolve) => setTimeout(resolve, 3000));
        }
    }
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
// Main Deploy Logic
// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

async function runDeploy() {
    console.log('');
    console.log('â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—');
    console.log('â•‘   ðŸš€ Há»† THá»NG DEPLOY AN TOÃ€N â€” KHá»žI Äá»˜NG   â•‘');
    console.log('â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('');

    // â”€â”€â”€ Äá»c & validate config â”€â”€â”€
    if (!fs.existsSync('deploy-config.json')) {
        console.error('âŒ Lá»–I: KhÃ´ng tÃ¬m tháº¥y file deploy-config.json!');
        process.exit(1);
    }

    const rawConfig = JSON.parse(fs.readFileSync('deploy-config.json', 'utf8'));

    // â”€â”€â”€ XÃ¡c Ä‘á»‹nh mÃ´i trÆ°á»ng deploy â”€â”€â”€
    const deployEnv = process.env.DEPLOY_ENV || 'production';
    const branch = process.env.DEPLOY_BRANCH || '';
    console.log(`ðŸ“Œ NhÃ¡nh: ${branch || '(khÃ´ng rÃµ)'} â†’ MÃ´i trÆ°á»ng: ${deployEnv.toUpperCase()}`);

    // Láº¥y cáº¥u hÃ¬nh cá»§a mÃ´i trÆ°á»ng tÆ°Æ¡ng á»©ng
    const envConfig = rawConfig[deployEnv];
    if (!envConfig) {
        console.error(`âŒ Lá»–I: KhÃ´ng tÃ¬m tháº¥y cáº¥u hÃ¬nh mÃ´i trÆ°á»ng "${deployEnv}" trong deploy-config.json!`);
        console.error(`   Cáº§n cÃ³ khá»‘i "${deployEnv}" chá»©a: server, project_dir, basic_auth.`);
        process.exit(1);
    }

    // Gá»™p cáº¥u hÃ¬nh: pháº§n chung (gá»‘c) + pháº§n riÃªng (production/test)
    const config = {
        source_folder: rawConfig.source_folder,
        has_build_step: rawConfig.has_build_step,
        build_command: rawConfig.build_command,
        server: envConfig.server,
        project_dir: envConfig.project_dir,
        basic_auth: envConfig.basic_auth,
    };

    console.log(`   ðŸ–¥ï¸  Server: ${config.server}`);
    console.log(`   ðŸ“‚ ThÆ° má»¥c: ${config.project_dir}`);
    console.log('');

    // ðŸ›¡ï¸ VALIDATION: Kiá»ƒm tra cáº¥u trÃºc config
    const configErrors = validateConfig(config);
    if (configErrors.length > 0) {
        console.error('âŒ Lá»–I Cáº¤U HÃŒNH deploy-config.json:');
        configErrors.forEach((e) => console.error(`   â€¢ ${e}`));
        process.exit(1);
    }

    // ðŸ›¡ï¸ Lá»šP GIÃP 1: CHá»NG HACK ÄÆ¯á»œNG DáºªN (PATH TRAVERSAL)
    // NgÄƒn cháº·n rá»§i ro Dev gÃµ "../../../" lÃ m xÃ³a nháº§m há»‡ thá»‘ng server
    const isValidDir = /^[a-zA-Z0-9_-]+$/.test(config.project_dir);
    if (!isValidDir) {
        console.error(`âŒ Lá»–I NGHIÃŠM TRá»ŒNG: TÃªn dá»± Ã¡n "${config.project_dir}" KHÃ”NG Há»¢P Lá»†!`);
        console.error(`   Chá»‰ cho phÃ©p dÃ¹ng: Chá»¯ cÃ¡i, sá»‘, gáº¡ch ngang (-), gáº¡ch dÆ°á»›i (_).`);
        console.error(`   ðŸ›¡ï¸ Báº£o vá»‡ Server: ÄÃ£ tá»± Ä‘á»™ng ngáº¯t.`);
        process.exit(1);
    }

    // â”€â”€â”€ Kiá»ƒm tra source folder tá»“n táº¡i â”€â”€â”€
    if (!fs.existsSync(config.source_folder)) {
        console.error(`âŒ Lá»–I: ThÆ° má»¥c source "${config.source_folder}" khÃ´ng tá»“n táº¡i!`);
        console.error(`   Náº¿u dá»± Ã¡n cáº§n build, hÃ£y kiá»ƒm tra has_build_step: true trong deploy-config.json.`);
        process.exit(1);
    }

    // ðŸ›¡ï¸ Validate source_folder khÃ´ng chá»©a path traversal
    if (/\.\.\/|\.\.\\/.test(config.source_folder)) {
        console.error(`âŒ Lá»–I: source_folder "${config.source_folder}" chá»©a path traversal!`);
        process.exit(1);
    }

    // â”€â”€â”€ Kiá»ƒm tra Server Secret â”€â”€â”€
    if (!process.env.SERVER_SECRET_JSON) {
        console.error(`âŒ Lá»–I: KhÃ´ng tÃ¬m tháº¥y Secret cho server [${config.server}].`);
        console.error(`   HÃ£y táº¡o GitHub Secret tÃªn "${config.server}_CONFIG" chá»©a JSON cáº¥u hÃ¬nh FTP.`);
        process.exit(1);
    }

    const serverInfo = JSON.parse(process.env.SERVER_SECRET_JSON);
    const targetDir = `${serverInfo.ftp_dir}/${config.project_dir}`;

    console.log(`ðŸ“‹ Cáº¥u hÃ¬nh:`);
    console.log(`   â€¢ Server: ${serverInfo.host}`);
    console.log(`   â€¢ ThÆ° má»¥c FTP: ${targetDir}`);
    console.log(`   â€¢ Source: ${config.source_folder}/`);
    console.log('');

    // â”€â”€â”€ Káº¿t ná»‘i FTP â”€â”€â”€
    const client = new ftp.Client();
    client.ftp.verbose = false; // Äáº·t true Ä‘á»ƒ debug chi tiáº¿t

    try {
        await connectWithRetry(client, serverInfo);

        // LÆ°u FTP root path (sá»­a lá»—i: cd('/') cÃ³ thá»ƒ khÃ´ng Ä‘Ãºng)
        const ftpRoot = await client.pwd();

        // ðŸ›¡ï¸ Lá»šP GIÃP 2: KHÃ“A CHá»¦ QUYá»€N (CHá»NG GHI ÄÃˆ NHáº¦M Dá»° ÃN)
        let isFirstDeploy = false;
        try {
            await client.cd(targetDir);
            const lockFileLocal = '/tmp/.repo_lock';
            await client.downloadTo(lockFileLocal, '.repo_lock');
            const lockOwner = fs.readFileSync(lockFileLocal, 'utf8').trim();

            if (lockOwner !== process.env.GITHUB_REPO) {
                throw new Error(
                    `âŒ Cáº¢NH BÃO Báº¢O Máº¬T: ThÆ° má»¥c [${config.project_dir}] Ä‘ang thuá»™c vá» dá»± Ã¡n [${lockOwner}]. ` +
                    `Repo hiá»‡n táº¡i: [${process.env.GITHUB_REPO}]. Há»¦Y DEPLOY Äá»‚ TRÃNH GHI ÄÃˆ!`
                );
            }
            console.log('âœ… Khá»›p mÃ£ chá»§ quyá»n (.repo_lock) â€” an toÃ n.');
        } catch (err) {
            if (err.message.includes('Cáº¢NH BÃO Báº¢O Máº¬T')) throw err;
            isFirstDeploy = true;
            console.log('â„¹ï¸ PhÃ¡t hiá»‡n deploy láº§n Ä‘áº§u â€” sáº½ setup Ä‘áº§y Ä‘á»§.');
        }

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // CHáº¾ Äá»˜ 1: DEPLOY Láº¦N Äáº¦U TIÃŠN
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        if (isFirstDeploy) {
            console.log('');
            console.log('â”â”â” DEPLOY Láº¦N Äáº¦U: Táº¡o cáº¥u trÃºc & báº£o máº­t â”â”â”');

            // Táº¡o thÆ° má»¥c Ä‘Ã­ch
            await client.ensureDir(targetDir);
            await client.cd(ftpRoot); // Reset CWD sau ensureDir

            // 1. Táº¡o file khÃ³a chá»§ quyá»n
            console.log('ðŸ”’ Táº¡o .repo_lock...');
            fs.writeFileSync('/tmp/.repo_lock', process.env.GITHUB_REPO);
            await client.uploadFrom('/tmp/.repo_lock', `${targetDir}/.repo_lock`);

            // 2. Táº¡o .htpasswd (máº­t kháº©u mÃ£ hÃ³a)
            console.log('ðŸ” Táº¡o .htpasswd...');
            const hashedPass = crypt(config.basic_auth.password);
            fs.writeFileSync('/tmp/.htpasswd', `${config.basic_auth.username}:${hashedPass}`);
            await client.uploadFrom('/tmp/.htpasswd', `${targetDir}/.htpasswd`);

            // 3. Táº¡o .htaccess (báº£o vá»‡ truy cáº­p)
            console.log('ðŸ” Táº¡o .htaccess...');
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

            // 4. Upload toÃ n bá»™ source (ZIP nhanh hoáº·c file-by-file fallback)
            console.log(`ðŸ“¤ Upload toÃ n bá»™ thÆ° má»¥c ${config.source_folder}/...`);
            await uploadViaZip(client, config.source_folder, targetDir, ftpRoot, config, serverInfo);

            // 5. LÆ°u manifest (danh sÃ¡ch file + hash)
            console.log('ðŸ“‹ LÆ°u manifest...');
            const manifest = generateManifest(config.source_folder);
            fs.writeFileSync('/tmp/.deploy_manifest.json', JSON.stringify(manifest));
            await client.uploadFrom('/tmp/.deploy_manifest.json', `${targetDir}/.deploy_manifest.json`);
            console.log(`   ðŸ“Š Manifest: ${Object.keys(manifest).length} files.`);

            // 6. LÆ°u SHA commit Ä‘Ã£ deploy
            const currentSha = execSync('git rev-parse HEAD').toString().trim();
            fs.writeFileSync('/tmp/.deploy_sha', currentSha);
            await client.uploadFrom('/tmp/.deploy_sha', `${targetDir}/.deploy_sha`);
            console.log(`ðŸ“Œ ÄÃ£ lÆ°u SHA deploy: ${currentSha.substring(0, 8)}`);

            console.log('');
            console.log('âœ… HoÃ n thÃ nh Deploy láº§n Ä‘áº§u!');
        }

        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        // CHáº¾ Äá»˜ 2: Cáº¬P NHáº¬T THÃ”NG MINH (SO SÃNH MANIFEST)
        // Chá»‰ upload file thá»±c sá»± thay Ä‘á»•i, hoáº¡t Ä‘á»™ng cáº£ khi cÃ³ build step
        // â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
        else {
            console.log('');
            console.log('â”â”â” Cáº¬P NHáº¬T: So sÃ¡nh manifest file â”â”â”');

            // Quay vá» FTP root trÆ°á»›c khi thao tÃ¡c tiáº¿p
            await client.cd(ftpRoot);

            // ðŸ”„ Re-sync .htpasswd & .htaccess (Ä‘á»“ng bá»™ khi dev Ä‘á»•i credentials)
            console.log('ðŸ” Äá»“ng bá»™ .htpasswd & .htaccess...');
            const hashedPass = crypt(config.basic_auth.password);
            fs.writeFileSync('/tmp/.htpasswd', `${config.basic_auth.username}:${hashedPass}`);
            await client.uploadFrom('/tmp/.htpasswd', `${targetDir}/.htpasswd`);

            const htaccessContent = [
                '<Files ~ "^\\\\.">',
                'Deny from all',
                '</Files>',
                'AuthType Basic',
                'AuthName "Restricted Area"',
                `AuthUserFile ${serverInfo.root_path}/${config.project_dir}/.htpasswd`,
                'Require valid-user',
            ].join('\n');
            fs.writeFileSync('/tmp/.htaccess', htaccessContent);
            await client.uploadFrom('/tmp/.htaccess', `${targetDir}/.htaccess`);
            console.log('âœ… .htpasswd & .htaccess Ä‘Ã£ Ä‘á»“ng bá»™.');

            // ðŸ“Œ Kiá»ƒm tra SHA â€” bá» qua nhanh náº¿u khÃ´ng cÃ³ thay Ä‘á»•i
            let lastDeployedSha = '';
            try {
                await client.downloadTo('/tmp/.deploy_sha', `${targetDir}/.deploy_sha`);
                const rawSha = fs.readFileSync('/tmp/.deploy_sha', 'utf8').trim();
                if (/^[0-9a-f]{40}$/i.test(rawSha)) {
                    lastDeployedSha = rawSha;
                    console.log(`ðŸ“Œ SHA deploy trÆ°á»›c: ${lastDeployedSha.substring(0, 8)}`);
                }
            } catch (e) {
                console.log('â„¹ï¸ KhÃ´ng tÃ¬m tháº¥y .deploy_sha.');
            }

            const currentSha = execSync('git rev-parse HEAD').toString().trim();
            console.log(`ðŸ“Œ SHA hiá»‡n táº¡i:      ${currentSha.substring(0, 8)}`);

            if (lastDeployedSha === currentSha) {
                console.log('â„¹ï¸ SHA trÃ¹ng khá»›p â€” khÃ´ng cÃ³ gÃ¬ cáº§n cáº­p nháº­t.');
                return;
            }

            // â”€â”€â”€ Táº¡o manifest hiá»‡n táº¡i tá»« source Ä‘Ã£ build â”€â”€â”€
            console.log('ðŸ“‹ Äang quÃ©t file hiá»‡n táº¡i...');
            const currentManifest = generateManifest(config.source_folder);
            const totalFiles = Object.keys(currentManifest).length;
            console.log(`   ðŸ“Š Tá»•ng cá»™ng: ${totalFiles} files.`);

            // â”€â”€â”€ Táº£i manifest cÅ© tá»« server â”€â”€â”€
            let oldManifest = null;
            try {
                await client.downloadTo('/tmp/.deploy_manifest.json', `${targetDir}/.deploy_manifest.json`);
                oldManifest = JSON.parse(fs.readFileSync('/tmp/.deploy_manifest.json', 'utf8'));
                console.log('ðŸ“‹ ÄÃ£ táº£i manifest cÅ© tá»« server.');
            } catch (e) {
                console.log('â„¹ï¸ KhÃ´ng tÃ¬m tháº¥y manifest cÅ© â€” sáº½ upload toÃ n bá»™.');
            }

            // ðŸ›¡ï¸ Lá»šP GIÃP 3: Báº¢O Vá»† FILE Há»† THá»NG
            const PROTECTED_FILES = ['.repo_lock', '.htaccess', '.htpasswd', '.deploy_sha', '.deploy_manifest.json'];

            if (!oldManifest) {
                // â”€â”€â”€ KhÃ´ng cÃ³ manifest cÅ© â†’ Upload toÃ n bá»™ báº±ng ZIP â”€â”€â”€
                console.log('â„¹ï¸ Chuyá»ƒn sang upload toÃ n bá»™ source (ZIP)...');
                await uploadViaZip(client, config.source_folder, targetDir, ftpRoot, config, serverInfo);
            } else {
                // â”€â”€â”€ So sÃ¡nh manifest â†’ Chá»‰ upload file thay Ä‘á»•i â”€â”€â”€
                const diff = diffManifest(oldManifest, currentManifest);
                const changedCount = diff.added.length + diff.modified.length + diff.deleted.length;

                if (changedCount === 0) {
                    console.log('â„¹ï¸ KhÃ´ng cÃ³ file nÃ o thay Ä‘á»•i (manifest trÃ¹ng khá»›p).');
                } else {
                    console.log(`ðŸ“Š PhÃ¡t hiá»‡n: ${diff.added.length} file má»›i, ${diff.modified.length} file sá»­a, ${diff.deleted.length} file xÃ³a.`);
                    console.log('');

                    // Upload file má»›i + file sá»­a
                    for (const relPath of [...diff.added, ...diff.modified]) {
                        if (PROTECTED_FILES.includes(relPath)) continue;
                        const localFilePath = path.join(config.source_folder, relPath);
                        const ftpFilePath = `${targetDir}/${relPath}`;
                        const remoteFileDir = path.posix.dirname(ftpFilePath);
                        await client.ensureDir(remoteFileDir);
                        await client.cd(ftpRoot);
                        await client.uploadFrom(localFilePath, ftpFilePath);
                        console.log(`   â¬†ï¸ ${relPath}`);
                    }

                    // XÃ³a file Ä‘Ã£ bá»‹ xÃ³a
                    for (const relPath of diff.deleted) {
                        if (PROTECTED_FILES.includes(relPath)) continue;
                        const ftpFilePath = `${targetDir}/${relPath}`;
                        try {
                            await client.remove(ftpFilePath);
                            console.log(`   ðŸ—‘ï¸ ${relPath}`);
                        } catch (e) { /* file cÃ³ thá»ƒ khÃ´ng tá»“n táº¡i */ }
                    }

                    console.log('');
                    console.log(`ðŸ“Š Káº¿t quáº£: ${diff.added.length + diff.modified.length} upload, ${diff.deleted.length} xÃ³a.`);
                }
            }

            // â”€â”€â”€ LÆ°u manifest + SHA má»›i â”€â”€â”€
            fs.writeFileSync('/tmp/.deploy_manifest.json', JSON.stringify(currentManifest));
            await client.uploadFrom('/tmp/.deploy_manifest.json', `${targetDir}/.deploy_manifest.json`);

            fs.writeFileSync('/tmp/.deploy_sha', currentSha);
            await client.uploadFrom('/tmp/.deploy_sha', `${targetDir}/.deploy_sha`);
            console.log(`ðŸ“Œ ÄÃ£ cáº­p nháº­t SHA + manifest: ${currentSha.substring(0, 8)}`);
            console.log('âœ… HoÃ n thÃ nh Cáº­p nháº­t!');
        }
    } catch (error) {
        console.error('');
        console.error('â•”â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•—');
        console.error('â•‘         âŒ Lá»–I Há»† THá»NG             â•‘');
        console.error('â•šâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
        console.error(error.message);
        process.exit(1);
    } finally {
        client.close();
        console.log('');
        console.log('ðŸ”Œ ÄÃ£ ngáº¯t káº¿t ná»‘i FTP.');
    }
}

runDeploy();
