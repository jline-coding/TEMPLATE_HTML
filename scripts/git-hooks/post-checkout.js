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

  // process.argv: [node, script, prevHead, newHead, isBranchCheckout]
  const isBranchCheckout = process.argv[4] === '1';

  if (!isBranchCheckout) {
    return;
  }

  console.log('\n[post-checkout] 🔀 Đã chuyển nhánh -> Đang tự động rebuild lại public/ để đồng bộ 100%...');
  try {
    run('node scripts/build.js', { stdio: 'inherit' });
    console.log('[post-checkout] ✅ Thư mục public/ đã được cập nhật mới nhất cho nhánh này.\n');
  } catch (err) {
    console.warn('[post-checkout] ⚠️ Lỗi khi tự động build public sau khi chuyển nhánh:', err.message);
  }
}

main();
