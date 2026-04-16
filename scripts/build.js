/**
 * build.js — Main build system for template_jline_html
 * Refactored into Modular Architecture (Phase 3)
 */

import { existsSync, unlinkSync, rmSync } from 'fs';
import { extname, relative, resolve, basename, dirname } from 'path';

import {
  MODE, OUTPUT_EXT, USE_PHP_INCLUDE, PROXY_URL, 
  isWatch, isRenew, DIST, SRC, PAGES_DIR, CSS_OUTPUT_REL,
  JS_DIR, IMAGES_DIR, VIDEOS_DIR, VENDOR_DIR, SCSS_DIR, RENEW_SCSS_DIRS
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
        if (!f.includes(CSS_OUTPUT_REL)) {
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
  const needsProxy = OUTPUT_EXT === '.php' || isRenew;

  if (PROXY_URL && needsProxy) {
    bsOptions.proxy = PROXY_URL;
    console.log(`[server] Proxy → http://${PROXY_URL}`);
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
          try { unlinkSync(resolve(DIST, rel)); removeEmptyDirs(DIST); } catch {}
          needsFullReload = true;
        }
        continue;
      }

      if (ext === '.scss' && !basename(fp).startsWith('_')) {
        const rel = relative(SCSS_DIR, fp);
        const cssOut = resolve(DIST, CSS_OUTPUT_REL, rel.replace(/\.scss$/, '.css'));
        try { unlinkSync(cssOut); unlinkSync(cssOut + '.map'); removeEmptyDirs(dirname(cssOut)); } catch {}
        needsScssReload = true;
      } else if (ext === '.ejs') {
        if (fp.includes(PAGES_DIR)) {
          const rel = relative(PAGES_DIR, fp);
          try { unlinkSync(resolve(DIST, rel.replace(/\.ejs$/, OUTPUT_EXT))); removeEmptyDirs(DIST); } catch {}
        }
        needsFullReload = true;
      } else if (isHandledBySpecificBuilder(fp)) {
        let destTarget = '';
        if (norm(fp).startsWith(norm(resolve(JS_DIR)))) destTarget = resolve(DIST, 'assets', 'js', relative(JS_DIR, fp));
        else if (norm(fp).startsWith(norm(resolve(VENDOR_DIR)))) destTarget = resolve(DIST, 'assets', 'vendor', relative(VENDOR_DIR, fp));
        else if (norm(fp).startsWith(norm(resolve(VIDEOS_DIR)))) destTarget = resolve(DIST, 'assets', 'videos', relative(VIDEOS_DIR, fp));
        else if (norm(fp).startsWith(norm(resolve(IMAGES_DIR)))) {
          const destDir = resolve(DIST, 'assets', 'images');
          const rel = relative(IMAGES_DIR, fp);
          destTarget = resolve(destDir, rel);
          try { unlinkSync(resolve(destDir, rel.replace(/\.(jpg|jpeg|png)$/i, '.webp'))); } catch {}
        }
        try { unlinkSync(destTarget); removeEmptyDirs(dirname(destTarget)); } catch {}
        needsFullReload = true;
      } else if (!['.map'].includes(ext)) {
        const destTarget = resolve(DIST, relative(PAGES_DIR, fp));
        try { unlinkSync(destTarget); removeEmptyDirs(dirname(destTarget)); } catch {}
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
