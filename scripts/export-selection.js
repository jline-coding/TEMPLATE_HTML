/**
 * scripts/export-selection.js
 * CLI / VS Code Task Runner for Exporting Selected Components to Workbench
 * 
 * Usage:
 *   node scripts/export-selection.js                     # Auto-reads from clipboard
 *   node scripts/export-selection.js <file> <line>       # Auto-extracts from active file at line
 *   node scripts/export-selection.js <file> <line> --as custom-name
 */

import { exportSelectionToWorkbench } from './tools/selection-exporter.js';

const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
  white: '\x1b[37m'
};

async function main() {
  const args = process.argv.slice(2);
  let filePath = '';
  let lineNumber = '';
  let customName = '';

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--as' && args[i + 1]) {
      customName = args[i + 1];
      i++;
    } else if (!filePath) {
      filePath = args[i];
    } else if (!lineNumber) {
      lineNumber = args[i];
    }
  }

  console.log(`\n${c.bold}${c.cyan}⚡ [Workbench Exporter] Đang xử lý component từ vùng chọn VS Code...${c.reset}`);

  try {
    const result = await exportSelectionToWorkbench({
      filePath,
      lineNumber,
      name: customName
    });

    if (result.success) {
      console.log(`\n${c.bold}${c.green}╔══════════════════════════════════════════════════════════════════╗${c.reset}`);
      console.log(`${c.bold}${c.green}║  ✓ ĐÃ ĐƯA COMPONENT "${result.name.toUpperCase()}" VÀO WORKBENCH SHOWROOM!       ║${c.reset}`);
      console.log(`${c.bold}${c.green}╚══════════════════════════════════════════════════════════════════╝${c.reset}\n`);

      console.log(`  ${c.bold}Tên Component:${c.reset} ${c.cyan}${result.name}${c.reset} (${result.category})`);
      console.log(`  ${c.bold}Các file đã tạo/đồng bộ:${c.reset}`);
      result.savedFiles.forEach(f => {
        console.log(`    ${c.green}✓${c.reset} ${f}`);
      });

      console.log(`\n  ${c.bold}Snippet VS Code:${c.reset} Gõ ${c.yellow}c-${result.name}${c.reset} để chèn nhanh.`);
      console.log(`  ${c.bold}Showroom URL:${c.reset}    ${c.cyan}http://localhost:8686/__workbench/#sec-${result.name}${c.reset}\n`);
    } else {
      console.log(`\n${c.yellow}⚠️  ${result.message}${c.reset}`);
      console.log(`${c.gray}Mẹo: Hãy quét khối thẻ HTML component hoặc đặt con trỏ vào bên trong thẻ trong VS Code rồi chạy lại task!${c.reset}\n`);
    }
  } catch (err) {
    console.error(`\n${c.red}❌ Lỗi khi xuất component:${c.reset}`, err.message);
  }
}

main();
