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
