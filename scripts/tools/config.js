import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, existsSync } from 'fs';

export const __dirname = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(__dirname, '../..');
export const SRC = resolve(ROOT, 'src');
export const DIST = resolve(ROOT, 'public');
export const LAYOUTS_DIR = resolve(SRC, 'layouts');
export const COMPONENTS_DIR = resolve(SRC, 'components');

export let MODE = 'new';
export let OUTPUT_EXT = '.html';
export let PROXY_URL = '';
export let USE_PHP_INCLUDE = false;
export let SITE_URL = 'https://example.com';
export let RENEW_SCSS_DIR = '';
export let RENEW_CSS_DIR = '';

export const isWatch = process.argv.includes('--watch');
export const skipFormat = process.argv.includes('--no-format');

try {
  const configPath = resolve(ROOT, 'deploy-config.json');
  if (existsSync(configPath)) {
    const config = JSON.parse(readFileSync(configPath, 'utf8'));
    if (config.env) {
      if (config.env.MODE) MODE = config.env.MODE.toLowerCase();
      if (config.env.OUTPUT_EXT) {
        const v = config.env.OUTPUT_EXT.toLowerCase();
        OUTPUT_EXT = v.startsWith('.') ? v : `.${v}`;
      }
      if (config.env.PROXY_URL) PROXY_URL = config.env.PROXY_URL;
      if (config.env.USE_PHP_INCLUDE === true || config.env.USE_PHP_INCLUDE === 'true') USE_PHP_INCLUDE = true;
      if (config.env.RENEW_SCSS_DIR) RENEW_SCSS_DIR = config.env.RENEW_SCSS_DIR.replace(/\\/g, '/');
      if (config.env.RENEW_CSS_DIR) RENEW_CSS_DIR = config.env.RENEW_CSS_DIR.replace(/\\/g, '/');
    }
  }
} catch (e) {
  // Ignore error
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
        if (key === 'SITE_URL') SITE_URL = value;
        if (key === 'OUTPUT_EXT') OUTPUT_EXT = value.toLowerCase().startsWith('.') ? value.toLowerCase() : `.${value.toLowerCase()}`;
        if (key === 'USE_PHP_INCLUDE') USE_PHP_INCLUDE = value.toLowerCase() === 'true';
      }
    });
  }
} catch (e) {
  // Ignore error
}

export const isRenew = MODE === 'renew';

(function validateConfig() {
  if (isRenew && USE_PHP_INCLUDE) {
    console.warn('⚠️ [config] MODE=renew → USE_PHP_INCLUDE=true bị bỏ qua (renew không dùng EJS pipeline)');
  }
  if (isRenew && OUTPUT_EXT !== '.html') {
    console.warn(`⚠️ [config] MODE=renew → OUTPUT_EXT=${OUTPUT_EXT} bị bỏ qua (renew copy tất cả file nguyên bản)`);
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

export let CSS_OUTPUT_REL = 'assets/css';
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
  CSS_OUTPUT_REL = RENEW_CSS_DIRS[0];
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
    return { scssDir: RENEW_SCSS_DIRS[0], cssRel: RENEW_CSS_DIRS[0] };
  }
  return { scssDir: SCSS_DIR, cssRel: CSS_OUTPUT_REL };
}
