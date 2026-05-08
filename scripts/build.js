/**
 * build.js — Main build system for template_jline_html
 * Refactored into Modular Architecture (Phase 3)
 */

import { existsSync, unlinkSync, rmSync } from 'fs';
import { extname, relative, resolve, basename, dirname } from 'path';

import {
  MODE, OUTPUT_EXT, USE_PHP_INCLUDE, PROXY_URL, 
  isWatch, isRenew, DIST, SRC, PAGES_DIR, CSS_OUTPUT_RELS,
  JS_DIR, IMAGES_DIR, VIDEOS_DIR, VENDOR_DIR, SCSS_DIR, RENEW_SCSS_DIRS,
  LAYOUTS_DIR,
  JS_OUT_DIRS, VENDOR_OUT_DIRS, VIDEOS_OUT_DIRS, IMAGES_OUT_DIRS, PAGE_OUT_PREFIXES
} from './tools/config.js';

import { norm, ensureDir, walkSync, removeEmptyDirs } from './tools/utils.js';

import { buildEjs } from './builders/ejs.js';
import { buildScss } from './builders/scss.js';
import {
  buildGeneralCopy, buildJs, buildVendor, buildImages, buildVideos,
  isHandledBySpecificBuilder
} from './builders/assets.js';

// ─────────────────────────────────────────────
// Full Build Pipeline
// ─────────────────────────────────────────────
async function fullBuild() {
  const modeLabel = isRenew ? 'RENEW' : 'NEW';
  console.log('\n╔══════════════════════════════════════╗');
  console.log(`║ [${modeLabel}] Building template_jline_html   ║`);
  console.log('╚══════════════════════════════════════╝');
  console.log(`[config] Mode: ${MODE} | Output: ${OUTPUT_EXT} | PHP Include: ${USE_PHP_INCLUDE}${PROXY_URL ? ` | Proxy: ${PROXY_URL}` : ''}`);
  console.log('');

  const start = Date.now();

  // Clean output
  if (existsSync(DIST)) {
    if (!isWatch) {
      rmSync(DIST, { recursive: true, force: true });
    } else {
      for (const f of walkSync(DIST, (f) => extname(f) === '.map')) {
        let shouldKeep = false;
        for (const cssRel of CSS_OUTPUT_RELS) {
          if (f.includes(cssRel)) shouldKeep = true;
        }
        if (!shouldKeep) {
          try { unlinkSync(f); } catch { /* ignore */ }
        }
      }
    }
  }
  ensureDir(DIST);

  // Run tasks
  const errors = [];
  if (isRenew) {
    try { buildGeneralCopy(); } catch (e) { errors.push(['generalCopy', e]); }
    try { await buildScss(); } catch (e) { errors.push(['scss', e]); }
  } else {
    try { buildGeneralCopy(); } catch (e) { errors.push(['generalCopy', e]); }
    try { await buildEjs(); } catch (e) { errors.push(['ejs', e]); }
    try { await buildScss(); } catch (e) { errors.push(['scss', e]); }
    try { buildJs(); } catch (e) { errors.push(['js', e]); }
    try { buildVendor(); } catch (e) { errors.push(['vendor', e]); }
    try { await buildImages(); } catch (e) { errors.push(['images', e]); }
    try { buildVideos(); } catch (e) { errors.push(['videos', e]); }
  }

  if (errors.length > 0) {
    console.error(`\n⚠️ Build completed with ${errors.length} error(s):`);
    errors.forEach(([step, err]) => console.error(`  [${step}] ${err.message}`));
  }

  const elapsed = Date.now() - start;
  console.log(`\n✓ Build complete in ${elapsed}ms\n`);
}

// ─────────────────────────────────────────────
// Watch Mode (Single routing watcher - Fixes H2)
// ─────────────────────────────────────────────
async function startWatch() {
  await fullBuild();

  const { watch: chokidarWatch } = await import('chokidar');
  const browserSync = (await import('browser-sync')).default.create();
  const net = await import('net');
  const DEFAULT_PORT = 8686;

  function isPortFree(port) {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.once('listening', () => { server.close(); resolve(true); });
      server.listen(port, '127.0.0.1');
    });
  }

  async function findFreePort(startPort, maxTries = 20) {
    for (let i = 0; i < maxTries; i++) {
      const port = startPort + i;
      if (await isPortFree(port)) return port;
    }
    return startPort;
  }

  const chosenPort = await findFreePort(DEFAULT_PORT);
  if (chosenPort !== DEFAULT_PORT) {
    console.log(`[server] ⚠️  Port ${DEFAULT_PORT} đang sử dụng → chuyển sang ${chosenPort}`);
  }

  const bsOptions = { port: chosenPort, open: true, notify: false, ui: false };
  if (PAGE_OUT_PREFIXES && PAGE_OUT_PREFIXES[0]) {
    bsOptions.startPath = '/' + PAGE_OUT_PREFIXES[0];
  }
  const needsProxy = OUTPUT_EXT === '.php';

  if (PROXY_URL && needsProxy) {
    const proxyHost = PROXY_URL.replace(/^https?:\/\//, '');
    bsOptions.proxy = `http://${proxyHost}`;
    console.log(`[server] Proxy → http://${proxyHost}`);
  } else if (PROXY_URL && !needsProxy) {
    bsOptions.server = { baseDir: DIST };
    console.log(`[server] Static server (PROXY_URL bỏ qua — output: ${OUTPUT_EXT})`);
  } else {
    bsOptions.server = { baseDir: DIST };
    if (OUTPUT_EXT === '.php') {
      console.log(`[server] ⚠️  Static (thiếu PROXY_URL — .php hiển thị như HTML)`);
      bsOptions.server.middleware = [
        function (req, res, next) {
          if (req.url.includes('.php')) res.setHeader('Content-Type', 'text/html; charset=UTF-8');
          next();
        }
      ];
    } else {
      console.log(`[server] Static server`);
    }
  }

  browserSync.init(bsOptions);

  function getAbs(filepath) { return resolve(SRC, filepath); }

  // Batch debounce to avoid multiple rebuilds on parallel events
  function batchDebounceRouter(wait = 300) {
    let timer;
    let pendingChanged = new Set();
    let pendingAdded = new Set();
    let pendingUnlinked = new Set();

    return {
      add: (type, fp) => {
        if (type === 'change') pendingChanged.add(fp);
        if (type === 'add') pendingAdded.add(fp);
        if (type === 'unlink') pendingUnlinked.add(fp);
        
        clearTimeout(timer);
        timer = setTimeout(async () => {
          const changed = Array.from(pendingChanged);
          const added = Array.from(pendingAdded);
          const unlinked = Array.from(pendingUnlinked);
          
          pendingChanged.clear();
          pendingAdded.clear();
          pendingUnlinked.clear();
          
          await routeEvents(changed, added, unlinked);
        }, wait);
      }
    };
  }

  const router = batchDebounceRouter();

  const watchOpts = {
    cwd: SRC,
    ignoreInitial: true,
    awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 },
  };

  const watcher = chokidarWatch('.', watchOpts);
  watcher.on('change', (fp) => router.add('change', getAbs(fp)));
  watcher.on('add', (fp) => router.add('add', getAbs(fp)));
  watcher.on('unlink', (fp) => router.add('unlink', getAbs(fp)));

  // Directory-level changes: rebuild EJS to re-scan include dirs
  watcher.on('addDir', (fp) => {
    if (fp === '.') return;
    router.add('change', getAbs(fp + '/__dir_trigger__.ejs'));
  });
  watcher.on('unlinkDir', (fp) => {
    if (fp === '.') return;
    router.add('change', getAbs(fp + '/__dir_trigger__.ejs'));
  });

  async function routeEvents(changed, added, unlinked) {
    let needsScssReload = false;
    let needsFullReload = false;

    // Handle Adds + Changes
    for (const fp of [...added, ...changed]) {
      const ext = extname(fp).toLowerCase();
      
      if (isRenew) {
        if (ext === '.scss') { await buildScss(fp); needsScssReload = true; }
        else if (ext !== '.ejs' && ext !== '.map') { buildGeneralCopy(fp); needsFullReload = true; }
        continue;
      }

      if (ext === '.scss') {
        await buildScss(fp);
        needsScssReload = true;
      } else if (ext === '.ejs') {
        await buildEjs(fp);
        needsFullReload = true;
      } else if (isHandledBySpecificBuilder(fp)) {
        if (norm(fp).startsWith(norm(resolve(JS_DIR)))) buildJs(fp);
        else if (norm(fp).startsWith(norm(resolve(VENDOR_DIR)))) buildVendor(fp);
        else if (norm(fp).startsWith(norm(resolve(IMAGES_DIR)))) await buildImages(fp);
        else if (norm(fp).startsWith(norm(resolve(VIDEOS_DIR)))) buildVideos(fp);
        needsFullReload = true;
      } else if (!['.map'].includes(ext)) {
        buildGeneralCopy(fp);
        needsFullReload = true;
      }
    }

    // Handle Unlinks
    for (const fp of unlinked) {
      const ext = extname(fp).toLowerCase();
      
      if (isRenew) {
        if (ext === '.scss') {
          // Simplified cleanup for renew SCSS
          needsScssReload = true;
        } else if (ext !== '.ejs' && ext !== '.map') {
          const rel = relative(PAGES_DIR, fp);
          const dest = resolve(DIST, rel);
          if (existsSync(dest)) try { unlinkSync(dest); } catch {}
          try { removeEmptyDirs(DIST); } catch {}
          needsFullReload = true;
        }
        continue;
      }

      if (ext === '.scss' && !basename(fp).startsWith('_')) {
        const rel = relative(SCSS_DIR, fp);
        for (const cssRel of CSS_OUTPUT_RELS) {
          const cssOut = resolve(DIST, cssRel, rel.replace(/\.scss$/, '.css'));
          if (existsSync(cssOut)) try { unlinkSync(cssOut); } catch {}
          if (existsSync(cssOut + '.map')) try { unlinkSync(cssOut + '.map'); } catch {}
          try { removeEmptyDirs(dirname(cssOut)); } catch {}
        }
        needsScssReload = true;
      } else if (ext === '.ejs') {
        if (fp.includes(PAGES_DIR)) {
          const rel = relative(PAGES_DIR, fp);
          for (const prefix of PAGE_OUT_PREFIXES) {
            const dest = resolve(DIST, prefix, rel.replace(/\.ejs$/, OUTPUT_EXT));
            if (existsSync(dest)) try { unlinkSync(dest); } catch {}
          }
          try { removeEmptyDirs(DIST); } catch {}
        } else if (OUTPUT_EXT === '.php' && USE_PHP_INCLUDE && !fp.includes(LAYOUTS_DIR) && basename(fp).startsWith('_')) {
          // Xóa file PHP partial tương ứng trong thư mục public
          const rel = relative(SRC, fp);
          const outPath = resolve(DIST, rel.replace(/_([^\\/]+)\.ejs$/, '$1.php'));
          if (existsSync(outPath)) try { unlinkSync(outPath); } catch {}
          try { removeEmptyDirs(DIST); } catch {}
        }
        needsFullReload = true;
      } else if (isHandledBySpecificBuilder(fp)) {
        if (norm(fp).startsWith(norm(resolve(JS_DIR)))) {
          for (const d of JS_OUT_DIRS) {
            const destTarget = resolve(d, relative(JS_DIR, fp));
            if (existsSync(destTarget)) try { unlinkSync(destTarget); } catch {}
            try { removeEmptyDirs(dirname(destTarget)); } catch {}
          }
        } else if (norm(fp).startsWith(norm(resolve(VENDOR_DIR)))) {
          for (const d of VENDOR_OUT_DIRS) {
            const destTarget = resolve(d, relative(VENDOR_DIR, fp));
            if (existsSync(destTarget)) try { unlinkSync(destTarget); } catch {}
            try { removeEmptyDirs(dirname(destTarget)); } catch {}
          }
        } else if (norm(fp).startsWith(norm(resolve(VIDEOS_DIR)))) {
          for (const d of VIDEOS_OUT_DIRS) {
            const destTarget = resolve(d, relative(VIDEOS_DIR, fp));
            if (existsSync(destTarget)) try { unlinkSync(destTarget); } catch {}
            try { removeEmptyDirs(dirname(destTarget)); } catch {}
          }
        } else if (norm(fp).startsWith(norm(resolve(IMAGES_DIR)))) {
          const rel = relative(IMAGES_DIR, fp);
          for (const destDir of IMAGES_OUT_DIRS) {
            const destTarget = resolve(destDir, rel);
            const webpPath = resolve(destDir, rel.replace(/\.(jpg|jpeg|png)$/i, '.webp'));
            if (existsSync(destTarget)) try { unlinkSync(destTarget); } catch {}
            if (existsSync(webpPath)) try { unlinkSync(webpPath); } catch {}
            try { removeEmptyDirs(dirname(destTarget)); } catch {}
          }
        }
        needsFullReload = true;
      } else if (!['.map'].includes(ext)) {
        for (const prefix of PAGE_OUT_PREFIXES) {
          const destTarget = resolve(DIST, prefix, relative(PAGES_DIR, fp));
          if (existsSync(destTarget)) try { unlinkSync(destTarget); } catch {}
          try { removeEmptyDirs(dirname(destTarget)); } catch {}
        }
        needsFullReload = true;
      }
    }

    if (needsScssReload && !needsFullReload) browserSync.reload('*.css');
    else if (needsFullReload) browserSync.reload();
  }

  console.log('╔══════════════════════════════════════╗');
  console.log(`║   Watching for changes on :${chosenPort}...   ║`);
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
