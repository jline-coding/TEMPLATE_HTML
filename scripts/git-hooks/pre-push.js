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

function hasChangesInSrc() {
  let changedFiles = [];

  try {
    const upstream = run('git rev-parse --abbrev-ref --symbolic-full-name @{u}').trim();
    if (upstream) {
      const diffOutput = run(`git diff --name-only ${upstream}...HEAD`);
      changedFiles.push(...diffOutput.split('\n').map(f => f.trim()).filter(Boolean));
    }
  } catch {
    try {
      const baseBranch = run('git show-ref --verify --quiet refs/remotes/origin/staging') ? 'origin/staging' : 'origin/master';
      const diffOutput = run(`git diff --name-only ${baseBranch}...HEAD`);
      changedFiles.push(...diffOutput.split('\n').map(f => f.trim()).filter(Boolean));
    } catch {
      try {
        const diffOutput = run('git diff --name-only HEAD~1...HEAD');
        changedFiles.push(...diffOutput.split('\n').map(f => f.trim()).filter(Boolean));
      } catch {
        return true;
      }
    }
  }

  const watchedPrefixes = ['src/', 'deploy-config.json', 'package.json'];
  return changedFiles.some(file => watchedPrefixes.some(prefix => file.startsWith(prefix) || file === prefix));
}

function main() {
  ensureMergeDriver();
  console.log('\n[pre-push] 🔍 Đang kiểm tra mã nguồn trước khi push...');

  // 1. Tự động sao lưu an toàn src/ vào .git/src_backups/
  createSrcBackup('pre-push');

  const needsRebuild = hasChangesInSrc();

  if (!needsRebuild) {
    console.log('[pre-push] ⚡ Mã nguồn src/ đã đồng bộ. Sẵn sàng push!\n');
    process.exit(0);
  }

  // 2. Chạy build kiểm tra
  console.log('[pre-push] 📦 Kiểm tra và đồng bộ bản build public/ mới nhất...');
  try {
    run('node scripts/build.js', { stdio: 'inherit' });
  } catch (err) {
    console.error('\n❌ [pre-push] LỖI BIÊN DỊCH: Mã nguồn src/ đang có lỗi!');
    console.error('   Vui lòng sửa lỗi trước khi push.\n');
    process.exit(1);
  }

  // 3. Nếu public/ có cập nhật, tự động gộp vào commit hiện tại mà KHÔNG chặn lệnh push
  try {
    const publicStatus = run('git status --porcelain public').trim();
    if (publicStatus) {
      run('git add public');

      // Kiểm tra xem commit HEAD hiện tại đã được push lên remote chưa
      let isHeadUnpushed = false;
      try {
        const upstream = run('git rev-parse --abbrev-ref --symbolic-full-name @{u}').trim();
        if (upstream) {
          const aheadCount = parseInt(run(`git rev-list --count ${upstream}..HEAD`).trim(), 10);
          isHeadUnpushed = aheadCount > 0;
        } else {
          isHeadUnpushed = true;
        }
      } catch {
        isHeadUnpushed = true;
      }

      if (isHeadUnpushed) {
        // Gộp thẳng vào commit vừa tạo của người dùng (giữ nguyên tên commit của người dùng!)
        run('git commit --amend --no-edit');
        console.log('[pre-push] ✅ Đã tự động đồng bộ bản build public/ mới nhất vào commit của bạn.');
      } else {
        run('git commit -m "chore: sync public build"');
        console.log('[pre-push] ✅ Đã đồng bộ bản build public/.');
      }
    } else {
      console.log('[pre-push] ✅ Thư mục public/ đã đồng bộ hoàn toàn với src/.');
    }
  } catch (err) {
    console.warn('[pre-push] ⚠️ Lưu ý khi kiểm tra git status public:', err.message);
  }

  console.log('[pre-push] 🚀 Sẵn sàng push lên repository!\n');
  process.exit(0);
}

main();
