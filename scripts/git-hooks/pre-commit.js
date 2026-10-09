import { execSync } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync } from 'fs';
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

function checkConflictMarkers() {
  try {
    const stagedFiles = run('git diff --cached --name-only').split('\n').map(f => f.trim()).filter(Boolean);
    const srcFiles = stagedFiles.filter(f => f.startsWith('src/'));

    const conflictPatterns = [/<<<<<<< HEAD/, /=======/, />>>>>>> /];

    for (const file of srcFiles) {
      const fullPath = resolve(ROOT, file);
      try {
        const content = readFileSync(fullPath, 'utf8');
        for (const pattern of conflictPatterns) {
          if (pattern.test(content)) {
            console.error(`\n❌ [pre-commit] PHÁT HIỆN CONFLICT MARKER CHƯA GIẢI QUYẾT:`);
            console.error(`   File: ${file}`);
            console.error(`   Vui lòng mở file và hoàn thành giải quyết conflict trước khi commit!\n`);
            process.exit(1);
          }
        }
      } catch {
        // Binary or deleted file, skip
      }
    }
  } catch (err) {
    if (err.status === 1) process.exit(1);
  }
}

function main() {
  ensureMergeDriver();

  // 1. Kiểm tra conflict markers trong staged files
  checkConflictMarkers();

  // 2. Tự động sao lưu an toàn src/ vào .git/src_backups/
  createSrcBackup('pre-commit');

  // 3. Kiểm tra xem có file nào trong src/ hoặc config đang được commit không
  let stagedFiles = [];
  try {
    stagedFiles = run('git diff --cached --name-only').split('\n').map(f => f.trim()).filter(Boolean);
  } catch {
    stagedFiles = [];
  }

  const watchedPrefixes = ['src/', 'deploy-config.json', 'package.json'];
  const hasSrcStaged = stagedFiles.some(file => watchedPrefixes.some(p => file.startsWith(p) || file === p));

  if (!hasSrcStaged) {
    return;
  }

  console.log('\n[pre-commit] 🔨 Tự động build public/ để gộp chung vào commit của bạn...');
  try {
    run('node scripts/build.js', { stdio: 'inherit' });
  } catch (err) {
    console.error('\n❌ [pre-commit] LỖI BIÊN DỊCH: Mã nguồn src/ đang có lỗi cú pháp!');
    console.error('   Vui lòng sửa lỗi trước khi commit.\n');
    process.exit(1);
  }

  // 4. Gộp toàn bộ public/ mới build vào chung commit này
  try {
    run('git add public');
    console.log('[pre-commit] ✅ Đã cập nhật bản build public/ mới nhất vào commit.\n');
  } catch (err) {
    console.warn('[pre-commit] ⚠️ Không thể tự động add public:', err.message);
  }
}

main();
