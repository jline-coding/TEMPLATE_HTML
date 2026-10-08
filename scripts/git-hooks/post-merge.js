/**
 * post-merge.js — Hook tự động tái sinh public/ sau khi git merge hoặc git pull
 * Đảm bảo: Sau khi merge code src/, public/ luôn được biên dịch lại 100% chính xác,
 * triệt tiêu hoàn toàn conflict trong thư mục public/.
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

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
  try {
    // Lấy danh sách các file thay đổi bởi lệnh merge vừa xong (so sánh ORIG_HEAD với HEAD)
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

    // Tự động add public/
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
