/**
 * build.js — Main build system for template_jline_html
 *
 * Features:
 *   - EJS + front-matter + layout → HTML
 *   - SCSS → CSS (with dependency graph, incremental compile)
 *   - JS copy (incremental)
 *   - Vendor copy (incremental)
 *   - Images: svg/gif/ico/webp copy, jpg/png → webp conversion
 *   - Videos: copy mp4/webm/ogg
 *   - Stale file removal
 *   - BrowserSync dev server (--watch mode)
 *   - Cross-platform paths (posix-normalized)
 */

import { resolve, dirname, basename, extname, relative, join, posix } from 'path';
import { fileURLToPath } from 'url';
import {
  readFileSync, writeFileSync, mkdirSync, existsSync,
  readdirSync, statSync, unlinkSync, rmSync,
} from 'fs';
import { readFile, writeFile, mkdir, cp, rm, stat } from 'fs/promises';
import ejs from 'ejs';
import matter from 'gray-matter';
import { compileString } from 'sass-embedded';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import sortMediaQueries from 'postcss-sort-media-queries';
import sharp from 'sharp';
import beautify from 'js-beautify';
import prettier from 'prettier';
import * as phpPlugin from '@prettier/plugin-php';

const beautifyOptions = {
  indent_size: 4,
  indent_char: ' ',
  max_preserve_newlines: 1,
  preserve_newlines: true,
  indent_inner_html: false,
  extra_liners: []
};

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');
const SRC = resolve(ROOT, 'src');
let PAGES_DIR = resolve(SRC, 'pages');
const DIST = resolve(ROOT, 'public');
const LAYOUTS_DIR = resolve(SRC, 'layouts');
const COMPONENTS_DIR = resolve(SRC, 'components');
let ASSETS_DIR = resolve(PAGES_DIR, 'assets');
let SCSS_DIR = resolve(ASSETS_DIR, 'scss');
const JS_DIR = resolve(ASSETS_DIR, 'js');
const IMAGES_DIR = resolve(ASSETS_DIR, 'images');
const VIDEOS_DIR = resolve(ASSETS_DIR, 'videos');
const VENDOR_DIR = resolve(ASSETS_DIR, 'vendor');
const CSS_DIR = resolve(ASSETS_DIR, 'css');


const isWatch = process.argv.includes('--watch');

async function formatCode(code, destExt) {
  if (isWatch) return code;
  
  // Format HTML structure first (js-beautify treats PHP tags as opaque blocks)
  let formatted = beautify.html(code, beautifyOptions);
  
  // If PHP, let Prettier format the inner PHP logic
  if (destExt === '.php') {
    formatted = await prettier.format(formatted, {
      parser: 'php',
      plugins: [phpPlugin],
      tabWidth: 4,
      printWidth: 1000
    });
  }
  return formatted;
}

// ─────────────────────────────────────────────
// Read Configuration (deploy-config.json → .env override)
// ─────────────────────────────────────────────
let MODE = 'new';
let OUTPUT_EXT = '.html';
let PROXY_URL = '';
let SERVER_TYPE = '';
let USE_PHP_INCLUDE = false;
let RENEW_SCSS_DIR = '';   // relative to src/ (e.g. PC/asb/scss)
let RENEW_CSS_DIR = '';    // relative to public/ (e.g. PC/asb/css)

// 1) Read defaults from deploy-config.json → env block
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
      if (config.env.SERVER_TYPE) SERVER_TYPE = config.env.SERVER_TYPE;
      if (config.env.USE_PHP_INCLUDE === true) USE_PHP_INCLUDE = true;
      if (config.env.RENEW_SCSS_DIR) RENEW_SCSS_DIR = config.env.RENEW_SCSS_DIR.replace(/\\/g, '/');
      if (config.env.RENEW_CSS_DIR) RENEW_CSS_DIR = config.env.RENEW_CSS_DIR.replace(/\\/g, '/');
    }
  }
} catch (e) {
  // Ignore error
}

// 2) Override with .env file (local machine settings take priority)
try {
  const envPath = resolve(ROOT, '.env');
  if (existsSync(envPath)) {
    const envContent = readFileSync(envPath, 'utf8');
    const lines = envContent.split('\n');
    lines.forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const value = parts.slice(1).join('=').trim().replace(/^['"]|['"]$/g, '');
        if (key === 'MODE') MODE = value.toLowerCase();
        if (key === 'OUTPUT_EXT') OUTPUT_EXT = value.toLowerCase().startsWith('.') ? value.toLowerCase() : `.${value.toLowerCase()}`;
        if (key === 'PROXY_URL') PROXY_URL = value;
        if (key === 'SERVER_TYPE') SERVER_TYPE = value;
        if (key === 'USE_PHP_INCLUDE') USE_PHP_INCLUDE = value.toLowerCase() === 'true';
        if (key === 'RENEW_SCSS_DIR') RENEW_SCSS_DIR = value.replace(/\\/g, '/');
        if (key === 'RENEW_CSS_DIR') RENEW_CSS_DIR = value.replace(/\\/g, '/');
      }
    });
  }
} catch (e) {
  // Ignore error if .env doesn't exist
}

// Auto-generate PROXY_URL from SERVER_TYPE if not explicitly set
// Skip when OUTPUT_EXT=html (no local server needed for static HTML)
const needsProxy = OUTPUT_EXT !== '.html';
if (!PROXY_URL && SERVER_TYPE && needsProxy) {
  const projectName = basename(ROOT);
  const type = SERVER_TYPE.toLowerCase();
  if (type === 'laragon' || type === 'xampp' || type === 'apache') {
    PROXY_URL = `http://localhost/${projectName}`;
  } else if (type === 'mamp') {
    PROXY_URL = `http://localhost:8888/${projectName}`;
  } else if (type === 'valet') {
    PROXY_URL = `http://${projectName}.test`;
  }
}

const isRenew = MODE === 'renew';

// CSS output directory relative to DIST (used by SCSS compiler)
let CSS_OUTPUT_REL = 'assets/css';

// Renew mode: use src/ directly as source root (client structure)
if (isRenew) {
  PAGES_DIR = SRC;
  // Custom SCSS/CSS paths from .env, or defaults
  SCSS_DIR = resolve(SRC, RENEW_SCSS_DIR || 'assets/scss');
  if (RENEW_CSS_DIR) CSS_OUTPUT_REL = RENEW_CSS_DIR;
}

// ─────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────
/** Normalize path to use posix separators */
const norm = (p) => p.replace(/\\/g, '/');

/** Ensure directory exists */
function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

/** Check if a file is newer than another */
function isNewer(src, dest) {
  try {
    const srcStat = statSync(src);
    const destStat = statSync(dest);
    return srcStat.mtimeMs > destStat.mtimeMs;
  } catch {
    return true; // dest doesn't exist
  }
}

/** Walk a directory recursively, returning file paths */
function walkSync(dir, filter) {
  const results = [];
  if (!existsSync(dir)) return results;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkSync(fullPath, filter));
    } else if (!filter || filter(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

/** Remove stale files in dest that don't have a corresponding source */
function removeStaleFiles(srcDir, destDir, opts = {}) {
  if (!existsSync(destDir)) return;
  const { transformExt } = opts;

  const srcFiles = new Set();
  for (const f of walkSync(srcDir)) {
    const rel = norm(relative(srcDir, f));
    srcFiles.add(rel);
    // Also add without extension for webp matching
    if (transformExt) {
      const ext = extname(rel);
      if (transformExt.from.includes(ext)) {
        srcFiles.add(rel.replace(ext, transformExt.to));
      }
    }
  }

  for (const f of walkSync(destDir)) {
    const rel = norm(relative(destDir, f));
    if (!srcFiles.has(rel)) {
      try {
        unlinkSync(f);
        console.log(`[clean] removed stale: ${rel}`);
      } catch { /* ignore */ }
    }
  }

  // Remove empty directories
  removeEmptyDirs(destDir);
}

/** Recursively remove empty directories */
function removeEmptyDirs(dir) {
  if (!existsSync(dir)) return;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      removeEmptyDirs(join(dir, entry.name));
    }
  }
  // Re-check after cleaning subdirectories
  if (readdirSync(dir).length === 0 && dir !== DIST) {
    try {
      rmSync(dir, { force: true });
    } catch { /* ignore */ }
  }
}

// ─────────────────────────────────────────────
// 0. Renew Mode — Universal Copy
// ─────────────────────────────────────────────
/**
 * Copy ALL files from src → public, except:
 *  - .scss files (anywhere — never needed in production)
 *  - .ejs files (template-only)
 *  - .map files (client source maps are not useful, our SCSS generates its own)
 * SCSS in assets/scss/ is compiled by buildScss() separately.
 */
function buildRenewCopy(changedFile) {
  if (!existsSync(PAGES_DIR)) return;

  const skipExts = ['.scss', '.ejs', '.map'];

  if (changedFile) {
    const ext = extname(changedFile).toLowerCase();
    if (skipExts.includes(ext)) return;

    const rel = relative(PAGES_DIR, changedFile);
    const dest = resolve(DIST, rel);
    ensureDir(dirname(dest));
    writeFileSync(dest, readFileSync(changedFile));
    console.log(`[renew] copy: ${norm(rel)}`);
    return;
  }

  // Full copy — walk all files, skip .scss and .ejs
  const allFiles = walkSync(PAGES_DIR, (f) => {
    const ext = extname(f).toLowerCase();
    return !skipExts.includes(ext);
  });

  for (const file of allFiles) {
    const rel = relative(PAGES_DIR, file);
    const dest = resolve(DIST, rel);
    if (isNewer(file, dest)) {
      ensureDir(dirname(dest));
      writeFileSync(dest, readFileSync(file));
      console.log(`[renew] copy: ${norm(rel)}`);
    }
  }
}

// ─────────────────────────────────────────────
// 1. EJS Templates
// ─────────────────────────────────────────────
async function buildEjs(changedFile) {
  if (OUTPUT_EXT === '.php' && USE_PHP_INCLUDE) {
    try {
      const transpileEjsToPhp = (str, relToRoot) => {
        let rootPrefix = '';
        if (relToRoot) {
            const depth = relToRoot.replace(/\\/g, '/').split('/').length - 1;
            for(let i=0; i<depth; i++) rootPrefix += '../';
        }
        return str
          .replace(/<%=\s*assetsDir\s*%>/g, '<?php echo $assetsDir ?? "./"; ?>')
          .replace(/<%=\s*file(?:\?\.|\.)data(?:\?\.|\.)([a-zA-Z0-9_]+)\s*%>/g, "<?php echo $$$1 ?? ''; ?>")
          .replace(/<%\s*if\s*\(\s*file(?:\?\.|\.)data(?:\?\.|\.)([a-zA-Z0-9_]+)\s*(===|==)\s*(['"])(.*?)\3\s*\)\s*{%>/g, "<?php if(isset($$$1) && $$$1 $2 '$4'): ?>")
          .replace(/<%\s*}\s*else\s*if\s*\(\s*file(?:\?\.|\.)data(?:\?\.|\.)([a-zA-Z0-9_]+)\s*(===|==)\s*(['"])(.*?)\3\s*\)\s*{%>/g, "<?php elseif(isset($$$1) && $$$1 $2 '$4'): ?>")
          .replace(/<%\s*}\s*else\s*{\s*%>/g, "<?php else: ?>")
          .replace(/<%\s*}\s*%>/g, "<?php endif; ?>")
          .replace(/<%-?\s*includeComponent\(\s*(['"])(.*?)\1\s*\)\s*%>/gi, `<?php include __DIR__ . '/${rootPrefix}$2.php'; ?>`);
      };

      if (existsSync(COMPONENTS_DIR)) {
        const componentFiles = walkSync(COMPONENTS_DIR, (f) => basename(f).startsWith('_') && extname(f) === '.ejs');
        let extractedCount = 0;
        for (const file of componentFiles) {
          const rel = relative(COMPONENTS_DIR, file);
          const contentStr = readFileSync(file, 'utf8');
          const transpiled = transpileEjsToPhp(contentStr, rel);
          const dir = dirname(rel);
          const base = basename(rel).replace(/^_/, '').replace(/\.ejs$/, '.php');
          const outName = dir === '.' ? base : posix.join(dir.split(/\\|\//).join('/'), base);
          const outPath = resolve(DIST, 'components', outName);
          ensureDir(dirname(outPath));
          writeFileSync(outPath, await formatCode(transpiled, '.php'));
          extractedCount++;
        }
        console.log(`[ejs] Extracted ${extractedCount} PHP components`);
      }
    } catch (err) {
      console.error(`[ejs] Error extracting PHP header/footer:`, err.message);
    }
  }

  if (!existsSync(PAGES_DIR)) return;

  const ejsFiles = walkSync(PAGES_DIR, (f) => {
    const ext = extname(f);
    const name = basename(f);
    const relPath = norm(relative(PAGES_DIR, f));
    return ext === '.ejs' && !name.startsWith('_') && !relPath.startsWith('assets/');
  });

  // If a specific file changed and it's not a partial/layout, only rebuild that file
  if (changedFile) {
    const changedNorm = norm(changedFile);
    const changedBase = basename(changedFile);
    const isPartialOrLayout = changedBase.startsWith('_') || changedNorm.includes('/layouts/') || changedNorm.includes('/components/');

    if (!isPartialOrLayout && changedNorm.includes('/pages/')) {
      // Only rebuild the changed file
      await renderEjsFile(changedFile);
      return;
    }
    // If partial/layout changed, rebuild all
  }

  for (const file of ejsFiles) {
    await renderEjsFile(file);
  }
}

async function renderEjsFile(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const { data: frontData, content } = matter(raw);

    // Calculate assetsDir (relative path to ROOT of public, not pages)
    const relPath = norm(relative(PAGES_DIR, filePath));
    const depth = relPath.split('/').length - 1;
    let assetsDir = './';
    for (let i = 0; i < depth; i++) {
      assetsDir += '../';
    }

    // Read layout
    const layoutName = frontData.layout || '_default';
    const layoutPath = resolve(LAYOUTS_DIR, `${layoutName}.ejs`);
    const layoutContent = readFileSync(layoutPath, 'utf8');

    function includeComponent(compName) {
      if (OUTPUT_EXT === '.php' && USE_PHP_INCLUDE) {
        const prefix = assetsDir.startsWith("./") ? assetsDir.slice(2) : assetsDir;
        return `<?php include __DIR__ . '/${prefix}components/${compName}.php'; ?>`;
      } else {
        const compDir = dirname(compName);
        const compBase = basename(compName);
        const compPath = resolve(COMPONENTS_DIR, compDir, `_${compBase}.ejs`);
        if (!existsSync(compPath)) return `<!-- Component _${compBase}.ejs not found -->`;
        const compContent = readFileSync(compPath, 'utf8');
        return ejs.render(compContent, {
          file: { data: frontData, path: filePath },
          assetsDir,
          layoutsDir: LAYOUTS_DIR,
          componentsDir: COMPONENTS_DIR,
          ext: OUTPUT_EXT,
          phpInclude: USE_PHP_INCLUDE,
          includeComponent
        }, { filename: compPath });
      }
    }

    // Render the page content first (inner EJS)
    const pageHtml = ejs.render(content, {
      file: { data: frontData, path: filePath },
      assetsDir,
      layoutsDir: LAYOUTS_DIR,
      componentsDir: COMPONENTS_DIR,
      ext: OUTPUT_EXT,
      phpInclude: USE_PHP_INCLUDE,
      includeComponent,
    }, {
      filename: filePath,
    });

    // Render the layout with the page content inserted
    const fullHtml = ejs.render(layoutContent, {
      file: { data: frontData, path: filePath },
      contents: pageHtml,
      assetsDir,
      layoutsDir: LAYOUTS_DIR,
      componentsDir: COMPONENTS_DIR,
      ext: OUTPUT_EXT,
      phpInclude: USE_PHP_INCLUDE,
      includeComponent,
    }, {
      filename: layoutPath,
    });

    // Write output
    const outPath = resolve(DIST, relPath.replace(/\.ejs$/, OUTPUT_EXT));
    ensureDir(dirname(outPath));
    const finalFormattedHtml = await formatCode(fullHtml, OUTPUT_EXT);
    writeFileSync(outPath, finalFormattedHtml, 'utf8');
    console.log(`[ejs] ${relPath} → ${norm(relative(DIST, outPath))}`);
  } catch (err) {
    console.error(`[ejs] Error processing ${filePath}:`, err.message);
  }
}

// ─────────────────────────────────────────────
// 2. SCSS → CSS
// ─────────────────────────────────────────────
const postcssPlugins = isWatch
  ? [autoprefixer({ cascade: false })]
  : [sortMediaQueries({ sort: 'mobile-first' }), autoprefixer({ cascade: false }), cssnano()];

async function buildScss(changedFile) {
  // Find all SCSS entry files (non-partial)
  let entryFiles;

  if (changedFile) {
    const changedAbs = resolve(changedFile);
    const changedBase = basename(changedFile);

    if (changedBase.startsWith('_')) {
      // Partial changed — find which entries depend on it
      entryFiles = findDependentEntries(changedAbs);
    } else {
      entryFiles = [changedAbs];
    }
  } else {
    entryFiles = walkSync(SCSS_DIR, (f) =>
      extname(f) === '.scss' && !basename(f).startsWith('_')
    );
  }

  for (const entry of entryFiles) {
    await compileScssFile(entry);
  }
}

async function compileScssFile(filePath) {
  try {
    const source = readFileSync(filePath, 'utf8');
    if (!source.trim() || /^{\\rtf/i.test(source)) return;

    const result = compileString(source, {
      url: new URL(`file:///${norm(filePath)}`),
      loadPaths: [SCSS_DIR],
      style: 'expanded',
      sourceMap: isWatch,
    });

    const rel = relative(SCSS_DIR, filePath);
    const cssPath = resolve(DIST, CSS_OUTPUT_REL, rel.replace(/\.scss$/, '.css'));

    // PostCSS processing
    const processed = await postcss(postcssPlugins).process(result.css, {
      from: filePath,
      to: cssPath,
      map: isWatch ? { inline: false, prev: result.sourceMap, annotation: true } : false,
    });
    const mapPath = cssPath + '.map';
    ensureDir(dirname(cssPath));

    writeFileSync(cssPath, processed.css, 'utf8');
    if (isWatch && processed.map) {
      writeFileSync(mapPath, processed.map.toString(), 'utf8');
    }
    console.log(`[scss] ${norm(rel)} → ${basename(cssPath)}`);
  } catch (err) {
    console.error(`[scss] Error compiling ${filePath}:`, err.message);
  }
}

/** Find SCSS entry files that depend on a given partial */
function findDependentEntries(changedPartial) {
  const allFiles = walkSync(SCSS_DIR, (f) => extname(f) === '.scss');
  const importRegex = /@(use|import|forward)\s+['"]([^'"]+)['"]/g;

  function resolveImport(importPath, fromDir) {
    const clean = importPath.replace(/\.(scss|sass)$/, '');
    const base = resolve(fromDir, clean);
    const candidates = [];

    for (const ext of ['.scss', '.sass']) {
      candidates.push(base + ext);
      candidates.push(join(dirname(base), '_' + basename(base) + ext));
    }
    candidates.push(join(base, '_index.scss'));
    candidates.push(join(base, 'index.scss'));

    for (const c of candidates) {
      if (existsSync(c)) return resolve(c);
    }
    return null;
  }

  function parseImports(filePath) {
    try {
      const content = readFileSync(filePath, 'utf8');
      const imports = [];
      let match;
      importRegex.lastIndex = 0;
      while ((match = importRegex.exec(content)) !== null) {
        const imp = match[2];
        if (/^(sass:|http:|https:|url\()/i.test(imp)) continue;
        imports.push(imp);
      }
      return imports
        .map((p) => resolveImport(p, dirname(filePath)))
        .filter(Boolean);
    } catch {
      return [];
    }
  }

  const memo = new Map();
  function dependsOn(file, target) {
    const key = `${file}|${target}`;
    if (memo.has(key)) return memo.get(key);
    memo.set(key, false); // prevent circular
    const imports = parseImports(file);
    if (imports.some((imp) => resolve(imp) === resolve(target))) {
      memo.set(key, true);
      return true;
    }
    for (const imp of imports) {
      if (dependsOn(imp, target)) {
        memo.set(key, true);
        return true;
      }
    }
    return false;
  }

  const entries = [];
  for (const file of allFiles) {
    if (!basename(file).startsWith('_')) {
      if (resolve(file) === resolve(changedPartial) || dependsOn(file, changedPartial)) {
        entries.push(file);
      }
    }
  }
  memo.clear();
  return entries;
}

// ─────────────────────────────────────────────
// 3. JS Copy
// ─────────────────────────────────────────────
function buildJs(changedFile) {
  const destDir = resolve(DIST, 'assets', 'js');

  if (changedFile) {
    const rel = relative(JS_DIR, changedFile);
    const dest = resolve(destDir, rel);
    ensureDir(dirname(dest));
    const src = readFileSync(changedFile);
    writeFileSync(dest, src);
    console.log(`[js] ${norm(rel)}`);
    return;
  }

  const files = walkSync(JS_DIR, (f) => extname(f) === '.js');
  for (const file of files) {
    const rel = relative(JS_DIR, file);
    const dest = resolve(destDir, rel);
    if (isNewer(file, dest)) {
      ensureDir(dirname(dest));
      writeFileSync(dest, readFileSync(file));
      console.log(`[js] ${norm(rel)}`);
    }
  }
  removeStaleFiles(JS_DIR, destDir);
}

// ─────────────────────────────────────────────
// 4. Vendor Copy
// ─────────────────────────────────────────────
function buildVendor(changedFile) {
  const destDir = resolve(DIST, 'assets', 'vendor');
  const vendorExts = ['.png', '.jpg', '.scss', '.css', '.js', '.svg', '.woff', '.woff2', '.ttf', '.eot'];

  if (changedFile) {
    const rel = relative(VENDOR_DIR, changedFile);
    const dest = resolve(destDir, rel);
    ensureDir(dirname(dest));
    writeFileSync(dest, readFileSync(changedFile));
    console.log(`[vendor] ${norm(rel)}`);
    return;
  }

  const files = walkSync(VENDOR_DIR, (f) => {
    const ext = extname(f).toLowerCase();
    return vendorExts.includes(ext);
  });

  for (const file of files) {
    const rel = relative(VENDOR_DIR, file);
    const dest = resolve(destDir, rel);
    if (isNewer(file, dest)) {
      ensureDir(dirname(dest));
      writeFileSync(dest, readFileSync(file));
      console.log(`[vendor] ${norm(rel)}`);
    }
  }
  removeStaleFiles(VENDOR_DIR, destDir);
}

// ─────────────────────────────────────────────
// 5. Images (copy + WebP conversion)
// ─────────────────────────────────────────────
async function buildImages(changedFile) {
  const destDir = resolve(DIST, 'assets', 'images');
  ensureDir(destDir);

  const copyExts = ['.gif', '.svg', '.ico', '.webp'];
  const convertExts = ['.jpg', '.jpeg', '.png'];

  if (changedFile) {
    const ext = extname(changedFile).toLowerCase();
    const rel = relative(IMAGES_DIR, changedFile);

    if (copyExts.includes(ext)) {
      const dest = resolve(destDir, rel);
      ensureDir(dirname(dest));
      writeFileSync(dest, readFileSync(changedFile));
      console.log(`[images] copy: ${norm(rel)}`);
    } else if (convertExts.includes(ext)) {
      const webpRel = rel.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      const dest = resolve(destDir, webpRel);
      ensureDir(dirname(dest));
      const buf = readFileSync(changedFile);
      await sharp(buf).webp({ quality: 90 }).toFile(dest);
      console.log(`[images] webp: ${norm(rel)} → ${norm(webpRel)}`);
    }
    return;
  }

  // Full build
  const allFiles = walkSync(IMAGES_DIR);

  for (const file of allFiles) {
    const ext = extname(file).toLowerCase();
    const rel = relative(IMAGES_DIR, file);

    if (copyExts.includes(ext)) {
      const dest = resolve(destDir, rel);
      if (isNewer(file, dest)) {
        ensureDir(dirname(dest));
        writeFileSync(dest, readFileSync(file));
        console.log(`[images] copy: ${norm(rel)}`);
      }
    } else if (convertExts.includes(ext)) {
      const webpRel = rel.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      const dest = resolve(destDir, webpRel);
      if (isNewer(file, dest)) {
        ensureDir(dirname(dest));
        const buf = readFileSync(file);
        await sharp(buf).webp({ quality: 90 }).toFile(dest);
        console.log(`[images] webp: ${norm(rel)} → ${norm(webpRel)}`);
      }
    }
  }

  removeStaleFiles(IMAGES_DIR, destDir, {
    transformExt: { from: ['.jpg', '.jpeg', '.png'], to: '.webp' },
  });
}

// ─────────────────────────────────────────────
// 6. Videos Copy
// ─────────────────────────────────────────────
function buildVideos(changedFile) {
  const destDir = resolve(DIST, 'assets', 'videos');
  const videoExts = ['.mp4', '.webm', '.ogg'];

  if (!existsSync(VIDEOS_DIR)) return;

  if (changedFile) {
    const rel = relative(VIDEOS_DIR, changedFile);
    const dest = resolve(destDir, rel);
    ensureDir(dirname(dest));
    writeFileSync(dest, readFileSync(changedFile));
    console.log(`[videos] ${norm(rel)}`);
    return;
  }

  const files = walkSync(VIDEOS_DIR, (f) => {
    const ext = extname(f).toLowerCase();
    return videoExts.includes(ext);
  });

  for (const file of files) {
    const rel = relative(VIDEOS_DIR, file);
    const dest = resolve(destDir, rel);
    if (isNewer(file, dest)) {
      ensureDir(dirname(dest));
      writeFileSync(dest, readFileSync(file));
      console.log(`[videos] ${norm(rel)}`);
    }
  }
  removeStaleFiles(VIDEOS_DIR, destDir);
}


// ─────────────────────────────────────────────
// Full Build
// ─────────────────────────────────────────────
async function fullBuild() {
  const modeLabel = isRenew ? 'RENEW' : 'NEW';
  console.log('\n╔══════════════════════════════════════╗');
  console.log(`║ [${modeLabel}] Building template_jline_html   ║`);
  console.log('╚══════════════════════════════════════╝\n');

  const start = Date.now();

  // Clean output (full clean only for production build)
  if (existsSync(DIST)) {
    if (!isWatch) {
      rmSync(DIST, { recursive: true, force: true });
    } else {
      // In watch mode, clean stale .map files from previous production builds
      for (const f of walkSync(DIST, (f) => extname(f) === '.map')) {
        // Keep map files that are in CSS_OUTPUT_REL (generated by SCSS in watch mode)
        if (!f.includes(CSS_OUTPUT_REL)) {
          try { unlinkSync(f); } catch { /* ignore */ }
        }
      }
    }
  }
  ensureDir(DIST);

  // Run tasks
  if (isRenew) {
    // RENEW: copy all source files + compile SCSS
    buildRenewCopy();
    await buildScss();
  } else {
    // NEW: full pipeline (EJS, SCSS, JS, Images, Vendor, Videos)
    await buildEjs();
    await buildScss();
    buildJs();
    buildVendor();
    await buildImages();
    buildVideos();
  }


  const elapsed = Date.now() - start;
  console.log(`\n✓ Build complete in ${elapsed}ms\n`);
}

// ─────────────────────────────────────────────
// Watch Mode
// ─────────────────────────────────────────────
async function startWatch() {
  // Full build first
  await fullBuild();

  // Dynamic import chokidar and browser-sync
  const { watch: chokidarWatch } = await import('chokidar');
  const browserSync = (await import('browser-sync')).default.create();

  const bsOptions = {
    port: 8080,
    open: true,
    notify: false,
    ui: false,
  };

  if (PROXY_URL) {
    bsOptions.proxy = PROXY_URL;
  } else {
    bsOptions.server = { baseDir: DIST };
    
    // Serve .php files as text/html when no proxy (for both PHP output and renew mode)
    if (OUTPUT_EXT === '.php' || isRenew) {
      bsOptions.server.middleware = [
        function (req, res, next) {
          if (req.url.includes('.php')) {
            res.setHeader('Content-Type', 'text/html; charset=UTF-8');
          }
          next();
        }
      ];
    }
  }

  browserSync.init(bsOptions);

  // Debounce helper (for single-file events like SCSS partial → rebuild all)
  function debounce(fn, wait = 200) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  // Batch debounce helper (collects all files during wait period, processes all)
  function batchDebounce(fn, wait = 300) {
    let timer;
    const queue = [];
    return (...args) => {
      queue.push(args);
      clearTimeout(timer);
      timer = setTimeout(async () => {
        const batch = queue.splice(0);
        for (const a of batch) {
          await fn(...a);
        }
      }, wait);
    };
  }

  const watchOpts = {
    cwd: ROOT,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
  };

  function getAbs(filepath) {
    return resolve(ROOT, filepath);
  }

  // ─────────────────────────────────────────
  // RENEW Mode Watchers (early return)
  // ─────────────────────────────────────────
  if (isRenew) {
    const skipExts = ['.scss', '.ejs', '.map'];

    // Universal watcher — all files (except .scss/.ejs handled separately)
    const renewWatcher = chokidarWatch(PAGES_DIR, watchOpts);

    renewWatcher.on('change', batchDebounce((filepath) => {
      const abs = getAbs(filepath);
      if (skipExts.includes(extname(filepath).toLowerCase())) return;
      console.log(`[watch:renew] changed: ${norm(filepath)}`);
      buildRenewCopy(abs);
      if (filepath.endsWith('.css')) {
        browserSync.reload('*.css');
      } else {
        browserSync.reload();
      }
    }));

    renewWatcher.on('add', batchDebounce((filepath) => {
      const abs = getAbs(filepath);
      if (skipExts.includes(extname(filepath).toLowerCase())) return;
      console.log(`[watch:renew] added: ${norm(filepath)}`);
      buildRenewCopy(abs);
      browserSync.reload();
    }));

    renewWatcher.on('unlink', (filepath) => {
      const abs = getAbs(filepath);
      if (skipExts.includes(extname(filepath).toLowerCase())) return;
      const rel = relative(PAGES_DIR, abs);
      const dest = resolve(DIST, rel);
      try {
        if (existsSync(dest)) {
          unlinkSync(dest);
          console.log(`[watch:renew] removed: ${norm(rel)}`);
          removeEmptyDirs(DIST);
        }
      } catch (err) {
        console.log(`[watch:renew] remove failed: ${norm(rel)} — ${err.message}`);
      }
    });

    // SCSS watcher (renew mode)
    const scssWatcher = chokidarWatch(SCSS_DIR, watchOpts);

    scssWatcher.on('change', debounce(async (filepath) => {
      if (!filepath.endsWith('.scss')) return;
      console.log(`[watch:scss] changed: ${norm(filepath)}`);
      await buildScss(getAbs(filepath));
      browserSync.reload('*.css');
    }));
    scssWatcher.on('add', debounce(async (filepath) => {
      if (!filepath.endsWith('.scss')) return;
      console.log(`[watch:scss] added: ${norm(filepath)}`);
      await buildScss(getAbs(filepath));
      browserSync.reload('*.css');
    }));
    scssWatcher.on('unlink', (filepath) => {
      if (!filepath.endsWith('.scss')) return;
      const rel = relative(SCSS_DIR, getAbs(filepath));
      const name = basename(filepath);
      if (!name.startsWith('_')) {
        const cssFile = resolve(DIST, CSS_OUTPUT_REL, rel.replace(/\.scss$/, '.css'));
        const mapFile = cssFile + '.map';
        try { unlinkSync(cssFile); } catch { /* ignore */ }
        try { unlinkSync(mapFile); } catch { /* ignore */ }
        console.log(`[watch:scss] removed CSS: ${basename(cssFile)}`);
      }
      removeEmptyDirs(resolve(DIST, CSS_OUTPUT_REL));
    });

    console.log('╔══════════════════════════════════════╗');
    console.log('║ [RENEW] Watching for changes :8080   ║');
    console.log('╚══════════════════════════════════════╝\n');
    return;
  }

  // ─────────────────────────────────────────
  // NEW Mode Watchers
  // ─────────────────────────────────────────
  // EJS watcher
  const ejsWatcher = chokidarWatch(SRC, watchOpts);

  ejsWatcher.on('change', debounce((filepath) => {
    if (!filepath.endsWith('.ejs')) return;
    console.log(`[watch:ejs] changed: ${norm(filepath)}`);
    buildEjs(getAbs(filepath));
    browserSync.reload();
  }));
  ejsWatcher.on('add', debounce((filepath) => {
    if (!filepath.endsWith('.ejs')) return;
    console.log(`[watch:ejs] added: ${norm(filepath)}`);
    buildEjs(getAbs(filepath));
    browserSync.reload();
  }));
  ejsWatcher.on('unlink', debounce((filepath) => {
    if (!filepath.endsWith('.ejs')) return;
    const absPath = getAbs(filepath);
    if (!absPath.includes(PAGES_DIR)) return;
    
    const rel = relative(PAGES_DIR, absPath);
    const htmlPath = resolve(DIST, rel.replace(/\.ejs$/, OUTPUT_EXT));
    try {
      unlinkSync(htmlPath);
      console.log(`[watch:ejs] removed: ${norm(rel)}`);
    } catch { /* ignore */ }
    removeEmptyDirs(DIST);
  }));

  // SCSS watcher
  const scssWatcher = chokidarWatch(SCSS_DIR, watchOpts);

  scssWatcher.on('change', debounce(async (filepath) => {
    if (!filepath.endsWith('.scss')) return;
    console.log(`[watch:scss] changed: ${norm(filepath)}`);
    await buildScss(getAbs(filepath));
    browserSync.reload('*.css');
  }));
  scssWatcher.on('add', debounce(async (filepath) => {
    if (!filepath.endsWith('.scss')) return;
    console.log(`[watch:scss] added: ${norm(filepath)}`);
    await buildScss(getAbs(filepath));
    browserSync.reload('*.css');
  }));
  scssWatcher.on('unlink', (filepath) => {
    if (!filepath.endsWith('.scss')) return;
    const rel = relative(SCSS_DIR, getAbs(filepath));
    const name = basename(filepath);
    if (!name.startsWith('_')) {
      const cssFile = resolve(DIST, CSS_OUTPUT_REL, rel.replace(/\.scss$/, '.css'));
      const mapFile = cssFile + '.map';
      try { unlinkSync(cssFile); } catch { /* ignore */ }
      try { unlinkSync(mapFile); } catch { /* ignore */ }
      console.log(`[watch:scss] removed CSS: ${basename(cssFile)}`);
    }
    removeEmptyDirs(resolve(DIST, CSS_OUTPUT_REL));
  });

  // JS watcher
  const jsWatcher = chokidarWatch(JS_DIR, watchOpts);

  jsWatcher.on('change', batchDebounce((filepath) => {
    if (!filepath.endsWith('.js')) return;
    console.log(`[watch:js] changed: ${norm(filepath)}`);
    buildJs(getAbs(filepath));
    browserSync.reload();
  }));
  jsWatcher.on('add', batchDebounce((filepath) => {
    if (!filepath.endsWith('.js')) return;
    console.log(`[watch:js] added: ${norm(filepath)}`);
    buildJs(getAbs(filepath));
    browserSync.reload();
  }));
  jsWatcher.on('unlink', batchDebounce((filepath) => {
    if (!filepath.endsWith('.js')) return;
    const rel = relative(JS_DIR, getAbs(filepath));
    const dest = resolve(DIST, 'assets', 'js', rel);
    try { unlinkSync(dest); } catch { /* ignore */ }
    console.log(`[watch:js] removed: ${norm(rel)}`);
    removeEmptyDirs(resolve(DIST, 'assets', 'js'));
  }));

  // Vendor watcher
  const vendorWatcher = chokidarWatch(VENDOR_DIR, watchOpts);

  const vendorExts = ['.php', '.png', '.jpg', '.scss', '.css', '.js', '.svg', '.woff', '.woff2', '.ttf', '.eot'];
  function isVendor(f) { return vendorExts.includes(extname(f).toLowerCase()); }

  vendorWatcher.on('change', batchDebounce((filepath) => {
    if (!isVendor(filepath)) return;
    console.log(`[watch:vendor] changed: ${norm(filepath)}`);
    buildVendor(getAbs(filepath));
    browserSync.reload();
  }));
  vendorWatcher.on('add', batchDebounce((filepath) => {
    if (!isVendor(filepath)) return;
    console.log(`[watch:vendor] added: ${norm(filepath)}`);
    buildVendor(getAbs(filepath));
    browserSync.reload();
  }));
  vendorWatcher.on('unlink', batchDebounce((filepath) => {
    if (!isVendor(filepath)) return;
    const rel = relative(VENDOR_DIR, getAbs(filepath));
    const dest = resolve(DIST, 'assets', 'vendor', rel);
    try { unlinkSync(dest); } catch { /* ignore */ }
    console.log(`[watch:vendor] removed: ${norm(rel)}`);
    removeEmptyDirs(resolve(DIST, 'assets', 'vendor'));
  }));

  // Images watcher
  const imgWatcher = chokidarWatch(IMAGES_DIR, {
    cwd: ROOT,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
  });

  const copyExts = ['.gif', '.svg', '.ico', '.webp'];
  const convertExts = ['.jpg', '.jpeg', '.png'];
  function isImage(f) { const e = extname(f).toLowerCase(); return copyExts.includes(e) || convertExts.includes(e); }

  imgWatcher.on('change', batchDebounce(async (filepath) => {
    if (!isImage(filepath)) return;
    console.log(`[watch:images] changed: ${norm(filepath)}`);
    await buildImages(getAbs(filepath));
    browserSync.reload();
  }));
  imgWatcher.on('add', batchDebounce(async (filepath) => {
    if (!isImage(filepath)) return;
    console.log(`[watch:images] added: ${norm(filepath)}`);
    await buildImages(getAbs(filepath));
    browserSync.reload();
  }));
  imgWatcher.on('unlink', batchDebounce((filepath) => {
    if (!isImage(filepath)) return;
    const rel = relative(IMAGES_DIR, getAbs(filepath));
    const destDir = resolve(DIST, 'assets', 'images');
    // Try removing both original and webp versions
    const dest = resolve(destDir, rel);
    const webpDest = resolve(destDir, rel.replace(/\.(jpg|jpeg|png)$/i, '.webp'));
    try { unlinkSync(dest); } catch { /* ignore */ }
    try { unlinkSync(webpDest); } catch { /* ignore */ }
    console.log(`[watch:images] removed: ${norm(rel)}`);
    removeEmptyDirs(destDir);
  }));

  // Videos watcher (only if directory exists)
  if (existsSync(VIDEOS_DIR)) {
    const videoWatcher = chokidarWatch(VIDEOS_DIR, {
      cwd: ROOT,
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 100 },
    });

    const videoExts = ['.mp4', '.webm', '.ogg'];
    function isVideo(f) { return videoExts.includes(extname(f).toLowerCase()); }

    videoWatcher.on('change', debounce((filepath) => {
      if (!isVideo(filepath)) return;
      console.log(`[watch:videos] changed: ${norm(filepath)}`);
      buildVideos(getAbs(filepath));
      browserSync.reload();
    }));
    videoWatcher.on('add', debounce((filepath) => {
      if (!isVideo(filepath)) return;
      console.log(`[watch:videos] added: ${norm(filepath)}`);
      buildVideos(getAbs(filepath));
      browserSync.reload();
    }));
    videoWatcher.on('unlink', debounce((filepath) => {
      if (!isVideo(filepath)) return;
      const rel = relative(VIDEOS_DIR, getAbs(filepath));
      const dest = resolve(DIST, 'assets', 'videos', rel);
      try { unlinkSync(dest); } catch { /* ignore */ }
      console.log(`[watch:videos] removed: ${norm(rel)}`);
      removeEmptyDirs(resolve(DIST, 'assets', 'videos'));
    }));
  }

  console.log('╔══════════════════════════════════════╗');
  console.log('║   Watching for changes on :8080...   ║');
  console.log('╚══════════════════════════════════════╝\n');
}

// ─────────────────────────────────────────────
// Entry Point
// ─────────────────────────────────────────────
if (isWatch) {
  startWatch();
} else {
  fullBuild();
}
