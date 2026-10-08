/**
 * pre-push.js — Hook kiểm tra và tự động build public/ trước khi git push
 * Đảm bảo: NHANH (bỏ qua nếu không sửa src), AN TOÀN (chặn nếu build lỗi), CHÍNH XÁC (tự commit public mới)
 */

import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');

function run(cmd, options = {}) {
  return execSync(cmd, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], ...options });
}

function hasChangesInSrc() {
  let changedFiles = [];

  // 1. Kiểm tra diff giữa local commits chuẩn bị push và upstream/remote
  try {
    const upstream = run('git rev-parse --abbrev-ref --symbolic-full-name @{u}').trim();
    if (upstream) {
      const diffOutput = run(`git diff --name-only ${upstream}...HEAD`);
      changedFiles.push(...diffOutput.split('\n').map(f => f.trim()).filter(Boolean));
    }
  } catch {
    // Nếu chưa có upstream (nhánh mới tạo chưa push lần nào)
    try {
      // So sánh với nhánh gốc origin/staging hoặc origin/master
      const baseBranch = run('git show-ref --verify --quiet refs/remotes/origin/staging') ? 'origin/staging' : 'origin/master';
      const diffOutput = run(`git diff --name-only ${baseBranch}...HEAD`);
      changedFiles.push(...diffOutput.split('\n').map(f => f.trim()).filter(Boolean));
    } catch {
      // Fallback: Kiểm tra commit gần nhất
      try {
        const diffOutput = run('git diff --name-only HEAD~1...HEAD');
        changedFiles.push(...diffOutput.split('\n').map(f => f.trim()).filter(Boolean));
      } catch {
        return true;
      }
    }
  }

  // 2. Kiểm tra nếu có thay đổi trong src/ hoặc config liên quan đến build
  const watchedPrefixes = ['src/', 'deploy-config.json', 'package.json'];
  return changedFiles.some(file => watchedPrefixes.some(prefix => file.startsWith(prefix) || file === prefix));
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
  console.log('\n[pre-push] 🔍 Đang kiểm tra thay đổi trước khi push...');

  const needsRebuild = hasChangesInSrc();

  if (!needsRebuild) {
    console.log('[pre-push] ⚡ Không có thay đổi trong src/ -> Bỏ qua bước build (Push ngay lập tức).\n');
    process.exit(0);
  }

  console.log('[pre-push] 📦 Phát hiện thay đổi trong mã nguồn src/ -> Đang tự động build lại public/...');

  try {
    // Chạy build
    run('node scripts/build.js', { stdio: 'inherit' });
  } catch (err) {
    console.error('\n❌ [pre-push] LỖI BIÊN DỊCH: Quá trình build thất bại!');
    console.error('   Vui lòng kiểm tra và sửa lỗi cú pháp trong src/ trước khi push.\n');
    process.exit(1);
  }

  // Kiểm tra xem public/ có thay đổi sau khi build không
  try {
    const publicStatus = run('git status --porcelain public').trim();
    if (publicStatus) {
      console.log('\n[pre-push] 💾 Phát hiện public/ có file cập nhật -> Đang tự động tạo commit bổ sung...');
      run('git add public');
      run('git commit -m "chore: auto-build public before push [skip ci]"');
      console.log('✅ [pre-push] Đã tự động commit bản build public/ mới nhất.');
      console.log('👉 [QUAN TRỌNG] Vui lòng bấm phím Mũi tên Lên (↑) và gõ lại "git push" để gửi cả mã nguồn và bản build lên repo!\n');
      process.exit(1); // Chặn lệnh push hiện tại để Git nhận commit mới vừa tạo
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
