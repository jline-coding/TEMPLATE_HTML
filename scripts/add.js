/**
 * scripts/add.js
 * Professional Component Scaffolding & Registry CLI Engine
 * 
 * Usage:
 *   node scripts/add.js                     # List all available components & their status
 *   node scripts/add.js accordion           # Install accordion to client project
 *   node scripts/add.js btns tbls           # Install multiple components
 *   node scripts/add.js --remove accordion  # Remove component from client project
 */

import { fileURLToPath } from 'url';
import {
  getRegistry,
  installComponent as svcInstall,
  removeComponent as svcRemove
} from './tools/component-service.js';
import { syncSnippets } from './sync-snippets.js';

// Re-export core functions for programmatic usage
export { getRegistry } from './tools/component-service.js';
export { installComponent, removeComponent };

// Colors for terminal (ANSI)
const c = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  magenta: '\x1b[35m',
  gray: '\x1b[90m',
  white: '\x1b[37m'
};

/**
 * Print list of all components (Catalog Menu)
 */
export function printCatalog() {
  const registry = getRegistry();
  console.log(`\n${c.bold}${c.cyan}╔══════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bold}${c.cyan}║   JLINE TEMPLATE — COMPONENT REGISTRY & SCAFFOLDING ENGINE       ║${c.reset}`);
  console.log(`${c.bold}${c.cyan}╚══════════════════════════════════════════════════════════════════╝${c.reset}\n`);

  if (registry.length === 0) {
    console.log(`${c.yellow}⚠️  No components found in workbench/components/${c.reset}`);
    return;
  }

  console.log(` ${c.bold}${'NAME'.padEnd(16)} ${'GROUP'.padEnd(20)} ${'STATUS'.padEnd(16)} ${'SCSS STYLE'.padEnd(18)} ${'JS LOGIC'.padEnd(16)}${c.reset}`);
  console.log(` ${c.gray}${'─'.repeat(16)} ${'─'.repeat(20)} ${'─'.repeat(16)} ${'─'.repeat(18)} ${'─'.repeat(16)}${c.reset}`);

  registry.forEach(item => {
    const status = item.isInstalled 
      ? `${c.green}● [Installed]${c.reset}` 
      : `${c.gray}○ [Available]${c.reset}`;
    const scss = item.scssFile || `${c.gray}(none)${c.reset}`;
    const js = item.jsFile ? `${c.cyan}✓ ${item.jsFile}${c.reset}` : `${c.gray}(none)${c.reset}`;

    const groupStr = `${item.categoryIcon} ${item.categoryLabel}`;
    console.log(` ${c.bold}${c.white}${item.name.padEnd(16)}${c.reset} ${groupStr.padEnd(20)} ${status.padEnd(25)} ${scss.padEnd(26)} ${js}`);
  });

  console.log(`\n${c.bold}💡 Hướng dẫn lệnh CLI:${c.reset}`);
  console.log(`   ${c.green}npm run add <name>${c.reset}               → Cài đặt SCSS (+ JS nếu có) vào site`);
  console.log(`   ${c.yellow}npm run add <name> --as <alias>${c.reset}    → Cài đặt với tên đổi mới (tránh trùng code)`);
  console.log(`   ${c.yellow}npm run add <name> --force${c.reset}         → Ghi đè file nếu đã tồn tại`);
  console.log(`   ${c.red}npm run add --remove <name>${c.reset}       → Gỡ bỏ component khỏi site`);
  console.log(`   ${c.cyan}npm run save <name>${c.reset}              → Xuất component từ src/ sang workbench\n`);
}

/**
 * Install a single component
 */
function installComponent(targetName, options = {}) {
  console.log(`\n${c.cyan}⚙ Đang cài đặt component: ${c.bold}${targetName}${c.reset}...`);
  const res = svcInstall(targetName, options);
  if (!res.success) {
    console.error(`  ${c.red}✖ ${res.message}${c.reset}`);
    return false;
  }

  res.files.forEach(f => {
    console.log(`  ${c.green}✓${c.reset} ${f}`);
  });

  console.log(`\n${c.green}${c.bold}✔ Đã cài đặt thành công component "${res.name}"!${c.reset}`);
  if (res.installedDependencies && res.installedDependencies.length > 0) {
    console.log(`${c.magenta}  📦 Tự động cài đặt dependencies: ${c.bold}${res.installedDependencies.join(', ')}${c.reset}`);
  }
  console.log(`${c.dim}  🎨 SCSS: Tự động @use trong src/pages/assets/scss/component/_index.scss${c.reset}`);
  if (res.hasJs) {
    console.log(`${c.yellow}  ⚡ JS: File logic đã nằm tại src/pages/assets/js/component/${res.name}.js (thêm vào frontmatter: js: ['component/${res.name}'])${c.reset}`);
  }
  console.log(`${c.cyan}  📋 HTML: Gõ snippet trong file .ejs (ví dụ "c-${res.name.replace(/s$/, '')}") hoặc copy từ Workbench!${c.reset}\n`);

  try { syncSnippets({ quiet: true }); } catch {}
  return true;
}

/**
 * Remove a single component
 */
function removeComponent(targetName) {
  console.log(`\n${c.yellow}🗑 Đang gỡ bỏ component: ${c.bold}${targetName}${c.reset}...`);
  const res = svcRemove(targetName);
  if (!res.success) {
    console.error(`  ${c.red}✖ ${res.message}${c.reset}`);
    return false;
  }

  res.removedFiles.forEach(f => {
    console.log(`  ${c.red}✗${c.reset} Đã xóa: ${f}`);
  });

  console.log(`\n${c.green}✔ Đã gỡ bỏ sạch sẽ "${res.name}" khỏi site.${c.reset}\n`);
  try { syncSnippets({ quiet: true }); } catch {}
  return true;
}

// ─────────────────────────────────────────────
// CLI Arguments Parsing
// ─────────────────────────────────────────────
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  const rawArgs = process.argv.slice(2);
  const isRemove = rawArgs.includes('--remove') || rawArgs.includes('-r');
  const force = rawArgs.includes('--force') || rawArgs.includes('-f');
  
  let asAlias = null;
  const asIdx = rawArgs.indexOf('--as');
  if (asIdx !== -1 && rawArgs[asIdx + 1]) {
    asAlias = rawArgs[asIdx + 1];
    rawArgs.splice(asIdx, 2);
  }

  const targets = rawArgs.filter(a => !['--remove', '-r', '--force', '-f'].includes(a));

  if (targets.length === 0) {
    printCatalog();
  } else {
    for (const target of targets) {
      if (isRemove) {
        removeComponent(target);
      } else {
        installComponent(target, { as: asAlias, force });
      }
    }
  }
}
