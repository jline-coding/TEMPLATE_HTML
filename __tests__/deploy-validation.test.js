import { describe, it, expect, vi } from 'vitest';
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { runInNewContext } from 'node:vm';
import { spawnSync } from 'node:child_process';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const ftpScript = readFileSync(resolve(root, '.github/scripts/deploy.cjs'), 'utf8');
const sshScript = resolve(root, '.github/scripts/deploy-rsync.sh');
const bash = process.platform === 'win32'
  ? resolve(process.env.ProgramFiles || 'C:/Program Files', 'Git/bin/bash.exe')
  : 'bash';
const canRunBash = process.platform !== 'win32' || existsSync(bash);

async function checkFtp(projectDir) {
  const connection = vi.fn(function () { throw new Error('FTP connection boundary'); });
  const error = vi.fn();
  const config = {
    source_folder: 'public', project_dir: projectDir,
    production: { server: 'TEST', deploy_method: 'ftp' }
  };
  const context = {
    console: { log: vi.fn(), warn: vi.fn(), error },
    process: {
      env: { DEPLOY_ENV: 'production' },
      cwd: () => root,
      exit: code => { throw new Error(`exit:${code}`); }
    },
    require: name => {
      if (name === 'basic-ftp') return { Client: connection };
      if (name === 'apache-crypt') return vi.fn();
      if (name === 'fs') return {
        mkdirSync: vi.fn(), existsSync: () => true,
        readFileSync: () => JSON.stringify(config)
      };
      return require(name);
    }
  };
  // Load the real deploy entry point with filesystem/network boundaries replaced.
  runInNewContext(ftpScript.replace(/runDeploy\(\);\s*$/, 'globalThis.deploy = runDeploy;'), context);
  let failure;
  try { await context.deploy(); } catch (e) { failure = e.message; }
  return { connection, failure, errors: error.mock.calls.flat().join('\n') };
}

describe('Deploy target directory validation', () => {
  it.each(['.', '..', '../other', 'nested/site', 'site;echo'])('FTP rejects unsafe target %s before connecting', async name => {
    const result = await checkFtp(name);
    expect(result.connection).not.toHaveBeenCalled();
    expect(result.failure).toBe('exit:1');
    expect(result.errors).toContain('INVALID');
  });

  it.each(['template_test_html', 'site-v1.0', '.preview'])('FTP preserves valid target %s', async name => {
    const result = await checkFtp(name);
    expect(result.connection).toHaveBeenCalledTimes(1);
    expect(result.failure).toBe('FTP connection boundary');
  });

  it.skipIf(!canRunBash).each(['.', '..', '../other', 'nested/site', 'site;echo', 'template_test_html', 'site-v1.0', '.preview'])(
    'SSH validates target %s before connecting', name => {
      const sandbox = mkdtempSync(resolve(root, 'test-sandbox-deploy-'));
      try {
        mkdirSync(resolve(sandbox, 'public'));
        writeFileSync(resolve(sandbox, 'deploy-config.json'), '{}');
        const result = spawnSync(bash, ['-c', `
jq() {
  case "$*" in
    *source_folder*) printf '%s\\n' public ;;
    *project_dir*) printf '%s\\n' "$TEST_PROJECT_DIR" ;;
    *) printf '\\n' ;;
  esac
}
ssh() { printf 'UNEXPECTED_NETWORK_CONNECTION\\n'; return 97; }
source "$TEST_SSH_SCRIPT"
`], {
          cwd: sandbox, encoding: 'utf8', timeout: 15000,
          env: { ...process.env, TEST_PROJECT_DIR: name, TEST_SSH_SCRIPT: sshScript.replaceAll('\\', '/'), SSH_HOST: '', SSH_USER: '', ROOT_PATH: '', FTP_GIT: '' }
        });
        const output = (result.stdout || '') + (result.stderr || '');
        expect(result.status).toBe(1);
        expect(output).not.toContain('UNEXPECTED_NETWORK_CONNECTION');
        if (['template_test_html', 'site-v1.0', '.preview'].includes(name)) {
          expect(output).toContain('Server Secret thieu thong tin');
        } else {
          expect(output).toContain('project_dir');
          expect(output).toContain('NGUY HIEM');
        }
      } finally {
        if (dirname(sandbox) !== root) throw new Error('Unsafe test cleanup path');
        rmSync(sandbox, { recursive: true, force: true });
      }
    }
  );
});

function loadFtpHelpers(fsOverrides = {}, cwd = root) {
  const context = {
    console: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    process: {
      env: {},
      cwd: () => cwd,
      exit: code => { throw new Error(`exit:${code}`); }
    },
    require: name => {
      if (name === 'basic-ftp') return { Client: vi.fn() };
      if (name === 'apache-crypt') return (pw) => `crypt_${pw}`;
      if (name === 'child_process') return { execSync: () => '$apr1$mock$hash' };
      if (name === 'fs') return { ...require('node:fs'), ...fsOverrides };
      return require(name);
    }
  };
  runInNewContext(
    ftpScript.replace(
      /runDeploy\(\);\s*$/,
      'globalThis.helpers = { resolveHtaccessConfig, syncHtaccessFtp, stripAutoBasicAuth, composeHtaccess, buildBasicAuthBlock, runDeploy };'
    ),
    context
  );
  return context.helpers;
}

function createMockFtpClient(initialFiles = {}) {
  const remoteFiles = new Map(Object.entries(initialFiles));
  const operations = [];
  return {
    remoteFiles,
    operations,
    cd: vi.fn(async () => {}),
    downloadTo: vi.fn(async (localPath, remotePath) => {
      if (!remoteFiles.has(remotePath)) throw new Error(`ENOENT: ${remotePath}`);
      writeFileSync(localPath, remoteFiles.get(remotePath), 'utf8');
    }),
    uploadFrom: vi.fn(async (localPath, remotePath) => {
      const content = readFileSync(localPath, 'utf8');
      remoteFiles.set(remotePath, content);
      operations.push({ op: 'upload', remotePath });
    }),
    remove: vi.fn(async (remotePath) => {
      remoteFiles.delete(remotePath);
      operations.push({ op: 'remove', remotePath });
    }),
  };
}

describe('Flexible .htaccess configuration (FTP & SSH)', () => {
  it.each(['../.htaccess', '/etc/passwd', '.env', '.env.local', '.git/config', 'node_modules/x', '.htpasswd', 'foo;rm', 'missing.htaccess'])(
    'FTP rejects unsafe or missing htaccess config "%s" before connecting',
    async badValue => {
      const sandbox = mkdtempSync(resolve(root, 'test-sandbox-ht-ftp-'));
      try {
        mkdirSync(resolve(sandbox, 'public'));
        const connection = vi.fn(function () { throw new Error('FTP connection boundary'); });
        const error = vi.fn();
        const config = {
          source_folder: 'public',
          project_dir: 'site_demo',
          production: { server: 'TEST', deploy_method: 'ftp', htaccess: badValue }
        };
        writeFileSync(resolve(sandbox, 'deploy-config.json'), JSON.stringify(config));
        const context = {
          console: { log: vi.fn(), warn: vi.fn(), error },
          process: {
            env: { DEPLOY_ENV: 'production' },
            cwd: () => sandbox,
            exit: code => { throw new Error(`exit:${code}`); }
          },
          require: name => {
            if (name === 'basic-ftp') return { Client: connection };
            if (name === 'apache-crypt') return vi.fn();
            if (name === 'fs') {
              const realFs = require('node:fs');
              return {
                ...realFs,
                existsSync: (p) => realFs.existsSync(resolve(sandbox, p)),
                readFileSync: (p, enc) => realFs.readFileSync(resolve(sandbox, p), enc),
                statSync: (p) => realFs.statSync(resolve(sandbox, p)),
                realpathSync: (p) => realFs.realpathSync(resolve(sandbox, p)),
              };
            }
            return require(name);
          }
        };
        runInNewContext(ftpScript.replace(/runDeploy\(\);\s*$/, 'globalThis.deploy = runDeploy;'), context);
        let failure;
        try { await context.deploy(); } catch (e) { failure = e.message; }
        expect(connection).not.toHaveBeenCalled();
        expect(failure).toBe('exit:1');
        expect(error.mock.calls.flat().join('\n')).toMatch(/htaccess|path traversal|Khong tim thay/i);
      } finally {
        if (dirname(sandbox) !== root) throw new Error('Unsafe test cleanup path');
        rmSync(sandbox, { recursive: true, force: true });
      }
    }
  );

  it('FTP supports merge (CRLF->LF + idempotent), basic_auth_only, preserve, and custom env file', async () => {
    const sandbox = mkdtempSync(resolve(root, 'test-sandbox-ht-ftp-modes-'));
    try {
      mkdirSync(resolve(sandbox, 'public'));
      writeFileSync(resolve(sandbox, 'public/.htaccess'), 'ErrorDocument 404 /404.html\r\nRewriteEngine On\r\n');
      writeFileSync(resolve(sandbox, '.htaccess.test'), 'ErrorDocument 404 /staging/404.html\r\n');

      const { resolveHtaccessConfig, syncHtaccessFtp } = loadFtpHelpers({}, sandbox);
      const serverInfo = { root_path: '/var/www/html' };
      const baseCfg = { project_dir: 'demo', source_folder: 'public' };

      // 1. merge + basic_auth ON -> combines marker block + public/.htaccess (LF only)
      const ftp1 = createMockFtpClient();
      const resMerge = resolveHtaccessConfig('merge', 'public', sandbox);
      await syncHtaccessFtp(ftp1, '/', '/demo', { ...baseCfg, basic_auth: { username: 'u', password: 'p' } }, serverInfo, resMerge);
      const merged = ftp1.remoteFiles.get('/demo/.htaccess');
      expect(merged).not.toContain('\r');
      expect(merged).toContain('# BEGIN AUTO BASIC AUTH');
      expect(merged).toContain('AuthUserFile /var/www/html/demo/.htpasswd');
      expect(merged).toContain('# END AUTO BASIC AUTH\n\nErrorDocument 404 /404.html\nRewriteEngine On\n');
      expect(ftp1.remoteFiles.get('/demo/.htpasswd')).toBe('u:$apr1$mock$hash\n');

      // 2. merge + basic_auth OFF + public/.htaccess present -> uploads clean source rules & deletes .htpasswd
      const ftp2 = createMockFtpClient({ '/demo/.htpasswd': 'old' });
      await syncHtaccessFtp(ftp2, '/', '/demo', { ...baseCfg, basic_auth: null }, serverInfo, resMerge);
      expect(ftp2.remoteFiles.get('/demo/.htaccess')).toBe('ErrorDocument 404 /404.html\nRewriteEngine On\n');
      expect(ftp2.remoteFiles.has('/demo/.htpasswd')).toBe(false);

      // 3. basic_auth_only + basic_auth ON -> ignores public/.htaccess
      const ftp3 = createMockFtpClient();
      const resAuthOnly = resolveHtaccessConfig('basic_auth_only', 'public', sandbox);
      await syncHtaccessFtp(ftp3, '/', '/demo', { ...baseCfg, basic_auth: { username: 'u', password: 'p' } }, serverInfo, resAuthOnly);
      expect(ftp3.remoteFiles.get('/demo/.htaccess')).not.toContain('ErrorDocument');
      expect(ftp3.remoteFiles.get('/demo/.htaccess')).toContain('Require valid-user');

      // 4. preserve + basic_auth OFF on server with existing unmarked rules -> untouched!
      const existingServerRules = 'AddHandler fcgid-script .php\nHeader set X-Frame-Options SAMEORIGIN\n';
      const ftp4 = createMockFtpClient({ '/demo/.htaccess': existingServerRules });
      const resPreserve = resolveHtaccessConfig('preserve', 'public', sandbox);
      await syncHtaccessFtp(ftp4, '/', '/demo', { ...baseCfg, basic_auth: null }, serverInfo, resPreserve);
      expect(ftp4.remoteFiles.get('/demo/.htaccess')).toBe(existingServerRules);
      expect(ftp4.operations.filter(o => o.remotePath === '/demo/.htaccess')).toHaveLength(0);

      // 5. preserve + basic_auth ON -> prepends marker block & keeps server rules; idempotent on 2nd run
      await syncHtaccessFtp(ftp4, '/', '/demo', { ...baseCfg, basic_auth: { username: 'u', password: 'p' } }, serverInfo, resPreserve);
      const once = ftp4.remoteFiles.get('/demo/.htaccess');
      expect(once).toContain('# BEGIN AUTO BASIC AUTH');
      expect(once).toContain(existingServerRules);
      await syncHtaccessFtp(ftp4, '/', '/demo', { ...baseCfg, basic_auth: { username: 'u', password: 'p' } }, serverInfo, resPreserve);
      expect(ftp4.remoteFiles.get('/demo/.htaccess')).toBe(once);

      // 6. preserve + basic_auth OFF after marker was added -> strips ONLY marker block, keeps server rules
      await syncHtaccessFtp(ftp4, '/', '/demo', { ...baseCfg, basic_auth: null }, serverInfo, resPreserve);
      expect(ftp4.remoteFiles.get('/demo/.htaccess')).toBe(existingServerRules);
      expect(ftp4.remoteFiles.has('/demo/.htpasswd')).toBe(false);

      // 7. custom file path ".htaccess.test" + basic_auth ON
      const ftp5 = createMockFtpClient();
      const resFile = resolveHtaccessConfig('.htaccess.test', 'public', sandbox);
      await syncHtaccessFtp(ftp5, '/', '/demo', { ...baseCfg, basic_auth: { username: 'u', password: 'p' } }, serverInfo, resFile);
      expect(ftp5.remoteFiles.get('/demo/.htaccess')).toContain('ErrorDocument 404 /staging/404.html');
      expect(ftp5.remoteFiles.get('/demo/.htaccess')).not.toContain('RewriteEngine On');
      expect(ftp5.remoteFiles.get('/demo/.htaccess')).toContain('# BEGIN AUTO BASIC AUTH');

      // 8. merge + basic_auth OFF + no public/.htaccess -> deletes .htaccess (backward compatibility)
      rmSync(resolve(sandbox, 'public/.htaccess'));
      const ftp6 = createMockFtpClient({ '/demo/.htaccess': 'old', '/demo/.htpasswd': 'old' });
      await syncHtaccessFtp(ftp6, '/', '/demo', { ...baseCfg, basic_auth: null }, serverInfo, resMerge);
      expect(ftp6.remoteFiles.has('/demo/.htaccess')).toBe(false);
      expect(ftp6.remoteFiles.has('/demo/.htpasswd')).toBe(false);
    } finally {
      if (dirname(sandbox) !== root) throw new Error('Unsafe test cleanup path');
      rmSync(sandbox, { recursive: true, force: true });
    }
  });

  it.skipIf(!canRunBash).each(['../.htaccess', '/etc/passwd', '.env', '.git/config', 'foo;rm', 'missing.htaccess'])(
    'SSH rejects unsafe or missing htaccess config "%s" before connecting',
    badValue => {
      const sandbox = mkdtempSync(resolve(root, 'test-sandbox-ht-ssh-sec-'));
      try {
        mkdirSync(resolve(sandbox, 'public'));
        writeFileSync(resolve(sandbox, 'deploy-config.json'), '{}');
        const result = spawnSync(bash, ['-c', `
jq() {
  case "$*" in
    *source_folder*) printf '%s\\n' public ;;
    *project_dir*) printf '%s\\n' demo_site ;;
    *htaccess*) printf '%s\\n' "$TEST_HTACCESS" ;;
    *) printf '\\n' ;;
  esac
}
ssh() { printf 'UNEXPECTED_NETWORK_CONNECTION\\n'; return 97; }
source "$TEST_SSH_SCRIPT"
`], {
          cwd: sandbox, encoding: 'utf8', timeout: 15000,
          env: {
            ...process.env,
            TEST_HTACCESS: badValue,
            TEST_SSH_SCRIPT: sshScript.replaceAll('\\', '/'),
            SSH_HOST: 'example.com', SSH_USER: 'user', ROOT_PATH: '/var/www', FTP_GIT: ''
          }
        });
        const output = (result.stdout || '') + (result.stderr || '');
        expect(result.status).toBe(1);
        expect(output).not.toContain('UNEXPECTED_NETWORK_CONNECTION');
        expect(output).toMatch(/htaccess|path traversal|Khong tim thay/i);
      } finally {
        if (dirname(sandbox) !== root) throw new Error('Unsafe test cleanup path');
        rmSync(sandbox, { recursive: true, force: true });
      }
    }
  );

  it.skipIf(!canRunBash)('SSH end-to-end supports merge, basic_auth_only, preserve, custom file & anchors root exclude', () => {
    const sandbox = mkdtempSync(resolve(root, 'test-sandbox-ht-ssh-e2e-'));
    try {
      const remoteRoot = resolve(sandbox, 'remote_server');
      const targetDir = resolve(remoteRoot, 'demo_site');
      mkdirSync(resolve(sandbox, 'public/sub'), { recursive: true });
      mkdirSync(remoteRoot, { recursive: true });
      writeFileSync(resolve(sandbox, 'deploy-config.json'), '{}');
      writeFileSync(resolve(sandbox, 'public/index.html'), '<h1>ok</h1>');
      writeFileSync(resolve(sandbox, 'public/.htaccess'), 'ErrorDocument 404 /404.html\r\nRewriteEngine On\r\n');
      writeFileSync(resolve(sandbox, 'public/sub/.htaccess'), 'Options -Indexes\n');
      writeFileSync(resolve(sandbox, '.htaccess.staging'), 'ErrorDocument 404 /demo_site/404.html\r\n');

      const excludeCapture = resolve(sandbox, 'captured-exclude.txt');

      const runSsh = ({ htaccess, user = '', pass = '', sha = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }) => {
        const res = spawnSync(bash, ['-c', `
jq() {
  case "$*" in
    *source_folder*) printf '%s\\n' public ;;
    *project_dir*) printf '%s\\n' demo_site ;;
    *basic_auth.username*) printf '%s\\n' "$TEST_AUTH_USER" ;;
    *basic_auth.password*) printf '%s\\n' "$TEST_AUTH_PASS" ;;
    *htaccess*) printf '%s\\n' "$TEST_HTACCESS" ;;
    *) printf '\\n' ;;
  esac
}
git() { printf '%s\\n' "$TEST_SHA"; }
openssl() { printf '%s\\n' '$apr1$mock$hash'; }
ssh() {
  for arg in "$@"; do
    if [ "$arg" = "-O" ]; then return 0; fi
  done
  local cmd="\${@: -1}"
  bash -c "$cmd"
}
rsync() {
  for arg in "$@"; do
    case "$arg" in
      --exclude-from=*) cp "\${arg#--exclude-from=}" "$TEST_EXCLUDE_CAPTURE" ;;
    esac
  done
  return 0
}
source "$TEST_SSH_SCRIPT"
`], {
          cwd: sandbox, encoding: 'utf8', timeout: 15000,
          env: {
            ...process.env,
            TEST_HTACCESS: htaccess,
            TEST_AUTH_USER: user,
            TEST_AUTH_PASS: pass,
            TEST_SHA: sha,
            TEST_EXCLUDE_CAPTURE: excludeCapture.replaceAll('\\', '/'),
            TEST_SSH_SCRIPT: sshScript.replaceAll('\\', '/'),
            GITHUB_REPO: 'jline/demo',
            DEPLOY_ENV: 'test',
            SSH_HOST: 'example.com',
            SSH_USER: 'tester',
            ROOT_PATH: remoteRoot.replaceAll('\\', '/'),
            FTP_GIT: ''
          }
        });
        if (res.status !== 0) {
          throw new Error(`SSH script failed (${res.status}):\n${res.stdout}\n${res.stderr}`);
        }
      };

      // 1. First deploy with merge + basic_auth ON
      runSsh({ htaccess: 'merge', user: 'test', pass: 'secret', sha: '1111111111111111111111111111111111111111' });
      const excluded = readFileSync(excludeCapture, 'utf8');
      expect(excluded).toContain('/.htaccess');
      expect(excluded).not.toMatch(/^\.htaccess$/m);
      const ht1 = readFileSync(resolve(targetDir, '.htaccess'), 'utf8');
      expect(ht1).not.toContain('\r');
      expect(ht1).toContain('# BEGIN AUTO BASIC AUTH');
      expect(ht1).toContain('# END AUTO BASIC AUTH\n\nErrorDocument 404 /404.html\nRewriteEngine On\n');
      expect(readFileSync(resolve(targetDir, '.htpasswd'), 'utf8')).toBe('test:$apr1$mock$hash\n');

      // 2. Update with basic_auth_only + basic_auth ON -> strips custom source rules
      runSsh({ htaccess: 'basic_auth_only', user: 'test', pass: 'secret', sha: '2222222222222222222222222222222222222222' });
      const ht2 = readFileSync(resolve(targetDir, '.htaccess'), 'utf8');
      expect(ht2).toContain('# BEGIN AUTO BASIC AUTH');
      expect(ht2).not.toContain('ErrorDocument');

      // 3. Update with custom file ".htaccess.staging" + basic_auth OFF
      runSsh({ htaccess: '.htaccess.staging', sha: '3333333333333333333333333333333333333333' });
      expect(readFileSync(resolve(targetDir, '.htaccess'), 'utf8')).toBe('ErrorDocument 404 /demo_site/404.html\n');
      expect(existsSync(resolve(targetDir, '.htpasswd'))).toBe(false);

      // 4. Simulate server-managed .htaccess, then deploy with preserve + basic_auth ON -> merges & keeps server rules
      const serverManaged = 'AddHandler x-httpd-php82 .php\n';
      writeFileSync(resolve(targetDir, '.htaccess'), serverManaged);
      runSsh({ htaccess: 'preserve', user: 'test', pass: 'secret', sha: '4444444444444444444444444444444444444444' });
      const ht4 = readFileSync(resolve(targetDir, '.htaccess'), 'utf8');
      expect(ht4).toContain('# BEGIN AUTO BASIC AUTH');
      expect(ht4).toContain(serverManaged);

      // 5. Deploy with preserve + basic_auth OFF -> removes ONLY auto block, keeps server rules
      runSsh({ htaccess: 'preserve', sha: '5555555555555555555555555555555555555555' });
      expect(readFileSync(resolve(targetDir, '.htaccess'), 'utf8')).toBe(serverManaged);
      expect(existsSync(resolve(targetDir, '.htpasswd'))).toBe(false);

      // 6. Deploy with preserve + basic_auth OFF again (no marker) -> leaves server .htaccess untouched
      runSsh({ htaccess: 'preserve', sha: '6666666666666666666666666666666666666666' });
      expect(readFileSync(resolve(targetDir, '.htaccess'), 'utf8')).toBe(serverManaged);
    } finally {
      if (dirname(sandbox) !== root) throw new Error('Unsafe test cleanup path');
      rmSync(sandbox, { recursive: true, force: true });
    }
  }, 30000);
});
