/**
 * scripts/save.js
 * Component Export Engine: src/ -> workbench/
 * 
 * Exports or updates components developed on the main client site (src/)
 * into the workbench template showroom with all related files:
 * - HTML/EJS template
 * - SCSS styles (auto-registered in workbench.scss)
 * - JS script interaction (if any)
 * 
 * Usage:
 *   node scripts/save.js                    # View list of components in src/ eligible to save
 *   node scripts/save.js accordion          # Save accordion to workbench
 *   node scripts/save.js header_02          # Save new header into workbench
 *   node scripts/save.js card --as custom-card  # Save with custom alias
 */

import { existsSync, readdirSync } from 'fs';
import { resolve, basename } from 'path';
import { fileURLToPath } from 'url';
import { saveComponent, normalizeName } from './tools/component-service.js';
import { CLIENT_COMPONENTS_DIR, CLIENT_SCSS_DIR, CLIENT_JS_DIR } from './tools/config.js';
import { buildWorkbench } from './builders/workbench.js';
import { syncSnippets } from './sync-snippets.js';

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

/**
 * Scan src/ to find all candidate components that can be exported
 */
function scanClientComponents() {
  const compMap = new Map();

  // Scan src/components/
  if (existsSync(CLIENT_COMPONENTS_DIR)) {
    const ejsFiles = readdirSync(CLIENT_COMPONENTS_DIR).filter(f => f.endsWith('.ejs'));
    ejsFiles.forEach(f => {
      const name = normalizeName(f);
      if (!compMap.has(name)) compMap.set(name, { name, ejs: f, scss: null, js: null });
      else compMap.get(name).ejs = f;
    });
  }

  // Scan src/pages/assets/scss/component/
  if (existsSync(CLIENT_SCSS_DIR)) {
    const scssFiles = readdirSync(CLIENT_SCSS_DIR).filter(f => f.endsWith('.scss') && f !== '_index.scss');
    scssFiles.forEach(f => {
      const name = normalizeName(f);
      if (!compMap.has(name)) compMap.set(name, { name, ejs: null, scss: f, js: null });
      else compMap.get(name).scss = f;
    });
  }

  // Scan src/pages/assets/js/component/
  if (existsSync(CLIENT_JS_DIR)) {
    const jsFiles = readdirSync(CLIENT_JS_DIR).filter(f => f.endsWith('.js'));
    jsFiles.forEach(f => {
      const name = normalizeName(f);
      if (!compMap.has(name)) compMap.set(name, { name, ejs: null, scss: null, js: f });
      else compMap.get(name).js = f;
    });
  }

  return Array.from(compMap.values());
}

/**
 * Display interactive catalog of components available in src/
 */
function showClientMenu() {
  const items = scanClientComponents();

  console.log(`\n${c.bold}${c.cyan}╔══════════════════════════════════════════════════════════════════╗${c.reset}`);
  console.log(`${c.bold}${c.cyan}║   JLINE TEMPLATE — EXPORT COMPONENT (src/ ➔ workbench/)         ║${c.reset}`);
  console.log(`${c.bold}${c.cyan}╚══════════════════════════════════════════════════════════════════╝${c.reset}\n`);

  if (items.length === 0) {
    console.log(`${c.yellow}⚠️  Chưa có component nào được tìm thấy trong src/components/ hoặc SCSS.${c.reset}`);
    return;
  }

  console.log(` ${c.bold}${'NAME'.padEnd(18)} ${'EJS (HTML)'.padEnd(22)} ${'SCSS STYLE'.padEnd(20)} ${'JS LOGIC'.padEnd(16)}${c.reset}`);
  console.log(` ${c.gray}${'─'.repeat(18)} ${'─'.repeat(22)} ${'─'.repeat(20)} ${'─'.repeat(16)}${c.reset}`);

  items.forEach(item => {
    const ejsStr = item.ejs ? `${c.green}✓ ${item.ejs}${c.reset}` : `${c.gray}(none)${c.reset}`;
    const scssStr = item.scss ? `${c.green}✓ ${item.scss}${c.reset}` : `${c.gray}(none)${c.reset}`;
    const jsStr = item.js ? `${c.green}✓ ${item.js}${c.reset}` : `${c.gray}(none)${c.reset}`;
    console.log(` ${c.bold}${c.white}${item.name.padEnd(18)}${c.reset} ${ejsStr.padEnd(30)} ${scssStr.padEnd(28)} ${jsStr}`);
  });

  console.log(`\n${c.bold}💡 Hướng dẫn lưu vào workbench template showroom:${c.reset}`);
  console.log(`   ${c.green}npm run save <name>${c.reset}                    → Lưu/cập nhật component vào workbench`);
  console.log(`   ${c.yellow}npm run save <name> --as <alias>${c.reset}       → Lưu với tên mới trong workbench\n`);
}

// ─────────────────────────────────────────────
// CLI Execution
// ─────────────────────────────────────────────
const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

if (isDirectRun) {
  const rawArgs = process.argv.slice(2);
  const force = rawArgs.includes('--force') || rawArgs.includes('-f');
  let asAlias = null;
  const asIdx = rawArgs.indexOf('--as');
  if (asIdx !== -1 && rawArgs[asIdx + 1]) {
    asAlias = rawArgs[asIdx + 1];
    rawArgs.splice(asIdx, 2);
  }
  const targets = rawArgs.filter(a => !['--force', '-f'].includes(a));

  if (targets.length === 0) {
    showClientMenu();
  } else {
    for (const target of targets) {
      console.log(`\n${c.cyan}📦 Exporting "${target}" từ src/ vào workbench/...${c.reset}`);
      const res = saveComponent(target, { as: asAlias, force });
      if (!res.success) {
        console.error(`  ${c.red}✖ ${res.message}${c.reset}`);
      } else {
        res.savedFiles.forEach(f => {
          console.log(`  ${c.green}✓${c.reset} ${f}`);
        });
        console.log(`\n${c.green}${c.bold}✔ ${res.message}${c.reset}`);
        
        // Rebuild Workbench and Snippets
        try {
          syncSnippets({ quiet: true });
          await buildWorkbench({ force: true });
          console.log(`  ${c.dim}→ Đã tự động cập nhật Catalog & Code Snippets${c.reset}\n`);
        } catch (e) {
          // ignore
        }
      }
    }
  }
}
