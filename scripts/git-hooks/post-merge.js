import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { createSrcBackup } from './backup-helper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

function run(cmd, options = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], ...options });
}

function ensureMergeDriver() {
  try {
    const driver = run('git config --get merge.ours.driver').trim();
    if (!driver) run('git config --local merge.ours.driver true');
  } catch {
    try { run('git config --local merge.ours.driver true'); } catch { /* ignore */ }
  }
}

function main() {
  ensureMergeDriver();

  // 1. Tự động sao lưu an toàn src/ vào .git/src_backups/ trước khi merge ảnh hưởng
  createSrcBackup('post-merge');

  try {
    let changedFiles = [];
    try {
      const output = run('git diff-tree -r --name-only --no-commit-id ORIG_HEAD HEAD');
      changedFiles = output.split('\n').map(f => f.trim()).filter(Boolean);
    } catch {
      return;
    }

    const watchedPrefixes = ['src/', 'deploy-config.json', 'package.json'];
    const hasSrcChanges = changedFiles.some(file => watchedPrefixes.some(prefix => file.startsWith(prefix) || file === prefix));

    if (!hasSrcChanges) {
      return;
    }

    console.log('\n[post-merge] 🔄 Đã cập nhật mã nguồn src/ sau khi merge -> Đang tự động rebuild lại public/...');
    run('node scripts/build.js', { stdio: 'inherit' });

    const publicStatus = run('git status --porcelain public').trim();
    if (publicStatus) {
      run('git add public');
      console.log('[post-merge] ✅ Đã tự động tái sinh public/ đồng bộ 100% với src/ vừa merge.\n');
    }
  } catch (err) {
    console.error('[post-merge] ⚠️ Có lỗi khi tự động rebuild public sau merge:', err.message);
  }
}

main();
