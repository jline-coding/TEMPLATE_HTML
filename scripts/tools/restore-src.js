import { existsSync, cpSync, rmSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';
import { listSrcBackups } from '../git-hooks/backup-helper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../..');
const SRC_DIR = resolve(ROOT, 'src');

async function main() {
  console.log('\n==============================================================');
  console.log('  🛡️ JLINE SOURCE RESTORE TOOL — Khôi phục mã nguồn src/');
  console.log('==============================================================\n');

  const backups = listSrcBackups();

  if (backups.length === 0) {
    console.log('❌ Hiện chưa có bản sao lưu tự động nào trong .git/src_backups/\n');
    process.exit(0);
  }

  console.log(`Tìm thấy ${backups.length} bản sao lưu gần nhất:\n`);
  backups.forEach((b, idx) => {
    const formatted = b.date.toLocaleString('vi-VN');
    console.log(`  [${idx + 1}] ${b.name} (${formatted})`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question('\n👉 Nhập số thứ tự bản sao lưu muốn khôi phục [1-' + backups.length + '] (hoặc bấm q để thoát): ', (ans) => {
    rl.close();

    const trimmed = (ans || '').trim().toLowerCase();
    if (!trimmed || trimmed === 'q') {
      console.log('\nĐã hủy thao tác khôi phục.\n');
      process.exit(0);
    }

    const index = parseInt(trimmed, 10) - 1;
    if (isNaN(index) || index < 0 || index >= backups.length) {
      console.error('\n❌ Số thứ tự không hợp lệ!\n');
      process.exit(1);
    }

    const selected = backups[index];
    console.log(`\n⏳ Đang khôi phục src/ từ: ${selected.name}...`);

    try {
      if (existsSync(SRC_DIR)) {
        rmSync(SRC_DIR, { recursive: true, force: true });
      }
      cpSync(selected.path, SRC_DIR, { recursive: true });
      console.log('✅ ĐÃ KHÔI PHỤC THÀNH CÔNG 100% THƯ MỤC src/!\n');
    } catch (err) {
      console.error('❌ Lỗi khi khôi phục:', err.message, '\n');
      process.exit(1);
    }
  });
}

main();
