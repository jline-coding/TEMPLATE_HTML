import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync, readdirSync } from 'fs';

export const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '../..');
export const SRC = resolve(ROOT, 'src');

let configData = null;
try {
  const configPath = resolve(ROOT, 'deploy-config.json');
  if (existsSync(configPath)) {
    configData = JSON.parse(readFileSync(configPath, 'utf8'));
  }
} catch (e) { /* ignore */ }

export const SOURCE_FOLDER = (configData && configData.source_folder) ? configData.source_folder : 'public';
export const DIST = resolve(ROOT, SOURCE_FOLDER);
export const LAYOUTS_DIR = resolve(SRC, 'layouts');

// Auto-discover include directories (all dirs in src/ except pages, layouts)
const RESERVED_DIRS = new Set(['pages', 'layouts']);
export const INCLUDE_DIRS = {};

export function refreshIncludeDirs() {
  // Clear existing entries
  for (const key of Object.keys(INCLUDE_DIRS)) {
    delete INCLUDE_DIRS[key];
  }
  // Re-scan src/ for include directories
  if (existsSync(SRC)) {
    for (const entry of readdirSync(SRC, { withFileTypes: true })) {
      if (entry.isDirectory() && !RESERVED_DIRS.has(entry.name)) {
        INCLUDE_DIRS[entry.name] = resolve(SRC, entry.name);
      }
    }
  }
}

// Initial scan at startup
refreshIncludeDirs();

// Backward compatibility
export const COMPONENTS_DIR = INCLUDE_DIRS['components'] || Object.values(INCLUDE_DIRS)[0] || resolve(SRC, 'components');

export let MODE = 'new';
export let OUTPUT_EXT = '.html';
export let PROXY_URL = '';
export let USE_PHP_INCLUDE = false;
export let SITE_URL = '';
export let RENEW_SCSS_DIR = '';
export let RENEW_CSS_DIR = '';
export let DIP = false;
export let DIP_PO = '';

export const isWatch = process.argv.includes('--watch');
export const skipFormat = process.argv.includes('--no-format');

if (configData && configData.env) {
  if (configData.env.MODE) MODE = configData.env.MODE.toLowerCase();
  if (configData.env.OUTPUT_EXT) {
    const v = configData.env.OUTPUT_EXT.toLowerCase();
    OUTPUT_EXT = v.startsWith('.') ? v : `.${v}`;
  }
  if (configData.env.PROXY_URL) PROXY_URL = configData.env.PROXY_URL;
  if (configData.env.USE_PHP_INCLUDE === true || configData.env.USE_PHP_INCLUDE === 'true') USE_PHP_INCLUDE = true;
  if (configData.env.RENEW_SCSS_DIR) RENEW_SCSS_DIR = configData.env.RENEW_SCSS_DIR.replace(/\\/g, '/');
  if (configData.env.RENEW_CSS_DIR) RENEW_CSS_DIR = configData.env.RENEW_CSS_DIR.replace(/\\/g, '/');
  if (configData.env.SITE_URL) SITE_URL = configData.env.SITE_URL;
  if (configData.env.DIP === true || configData.env.DIP === 'true') DIP = true;
  if (configData.env.DIP_PO) DIP_PO = configData.env.DIP_PO;
}

try {
  const envPath = resolve(ROOT, '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const parts = trimmed.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        if (!value) return;
        if (key === 'PROXY_URL') PROXY_URL = value;
        if (key === 'OUTPUT_EXT') OUTPUT_EXT = value.toLowerCase().startsWith('.') ? value.toLowerCase() : `.${value.toLowerCase()}`;
        if (key === 'USE_PHP_INCLUDE') USE_PHP_INCLUDE = value.toLowerCase() === 'true';
        if (key === 'DIP') DIP = value.toLowerCase() === 'true';
        if (key === 'DIP_PO') DIP_PO = value;
      }
    });
  }
} catch (e) {
  // Ignore error
}

// Auto-compute PROXY_URL from project_dir if not explicitly set
if (!PROXY_URL && configData && configData.project_dir) {
  PROXY_URL = `${configData.project_dir}.test`;
}

export const isRenew = MODE === 'renew';

if (isRenew) {
  DIP = false;
  DIP_PO = '';
}

(function validateConfig() {
  if (isRenew && USE_PHP_INCLUDE) {
    console.warn('⚠️ [config] MODE=renew → USE_PHP_INCLUDE=true bị bỏ qua (renew không dùng EJS pipeline)');
  }
  if (OUTPUT_EXT === '.html' && USE_PHP_INCLUDE && !isRenew) {
    console.warn('⚠️ [config] OUTPUT_EXT=html + USE_PHP_INCLUDE=true → PHP include bị bỏ qua (chỉ hoạt động khi OUTPUT_EXT=php)');
  }
})();

export let PAGES_DIR = resolve(SRC, 'pages');
export let ASSETS_DIR = resolve(PAGES_DIR, 'assets');
export let SCSS_DIR = resolve(ASSETS_DIR, 'scss');
export const JS_DIR = resolve(ASSETS_DIR, 'js');
export const IMAGES_DIR = resolve(ASSETS_DIR, 'images');
export const VIDEOS_DIR = resolve(ASSETS_DIR, 'videos');
export const VENDOR_DIR = resolve(ASSETS_DIR, 'vendor');
export const CSS_DIR = resolve(ASSETS_DIR, 'css');

export let CSS_OUTPUT_RELS = (DIP && DIP_PO) ? [`pc/${DIP_PO}/css`, `sp/${DIP_PO}/css`] : (DIP ? ['css'] : ['assets/css']);
export const ASSETS_OUT_PREFIXES = (DIP && DIP_PO) ? [`pc/${DIP_PO}`, `sp/${DIP_PO}`] : (DIP ? [''] : ['assets']);
export const PAGE_OUT_PREFIXES = (DIP && DIP_PO) ? [`pc/${DIP_PO}`, `sp/${DIP_PO}`] : [''];

export const JS_OUT_DIRS = ASSETS_OUT_PREFIXES.map(p => resolve(DIST, p, 'js'));
export const IMAGES_OUT_DIRS = ASSETS_OUT_PREFIXES.map(p => resolve(DIST, p, 'images'));
export const VIDEOS_OUT_DIRS = ASSETS_OUT_PREFIXES.map(p => resolve(DIST, p, 'videos'));
export const VENDOR_OUT_DIRS = ASSETS_OUT_PREFIXES.map(p => resolve(DIST, p, 'vendor'));
export let RENEW_SCSS_DIRS = [];
export let RENEW_CSS_DIRS = [];

function parseDirList(str, defaultVal) {
  if (!str) return [defaultVal];
  return str.split(',').map(s => s.trim()).filter(Boolean);
}

if (isRenew) {
  PAGES_DIR = SRC;
  const scssArr = parseDirList(RENEW_SCSS_DIR, 'assets/scss');
  const cssArr = parseDirList(RENEW_CSS_DIR, 'assets/css');
  
  RENEW_SCSS_DIRS = scssArr.map(p => resolve(SRC, p));
  RENEW_CSS_DIRS = scssArr.map((_, i) => cssArr[i] || cssArr[0] || 'assets/css');
  
  SCSS_DIR = RENEW_SCSS_DIRS[0];
  CSS_OUTPUT_RELS = [RENEW_CSS_DIRS[0]];
}

export function getScssDirsInfo(filePath) {
  if (isRenew && RENEW_SCSS_DIRS.length > 0) {
    const absPath = resolve(filePath);
    for (let i = 0; i < RENEW_SCSS_DIRS.length; i++) {
        const target = RENEW_SCSS_DIRS[i];
        if (absPath === target || absPath.startsWith(target + '/') || absPath.startsWith(target + '\\')) {
            return {
                scssDir: RENEW_SCSS_DIRS[i],
                cssRel: RENEW_CSS_DIRS[i]
            };
        }
    }
    return { scssDir: RENEW_SCSS_DIRS[0], cssRels: [RENEW_CSS_DIRS[0]] };
  }
  return { scssDir: SCSS_DIR, cssRels: CSS_OUTPUT_RELS };
}
