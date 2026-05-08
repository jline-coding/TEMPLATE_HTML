import { resolve, relative, dirname, extname } from 'path';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import sharp from 'sharp';

import {
  isRenew, PAGES_DIR, DIST, JS_DIR, VENDOR_DIR, IMAGES_DIR, VIDEOS_DIR,
  JS_OUT_DIRS, VENDOR_OUT_DIRS, IMAGES_OUT_DIRS, VIDEOS_OUT_DIRS, ASSETS_OUT_PREFIXES, PAGE_OUT_PREFIXES
} from '../tools/config.js';
import { norm, ensureDir, isNewer, walkSync, removeStaleFiles } from '../tools/utils.js';

export function isHandledBySpecificBuilder(filepath) {
  if (isRenew) return false;

  const ext = extname(filepath).toLowerCase();
  const abs = resolve(filepath);
  
  if (ext === '.js' && norm(abs).startsWith(norm(resolve(JS_DIR)))) return true;
  
  const copyImgExts = ['.gif', '.svg', '.ico', '.webp'];
  const convertExts = ['.jpg', '.jpeg', '.png'];
  if ((copyImgExts.includes(ext) || convertExts.includes(ext)) && norm(abs).startsWith(norm(resolve(IMAGES_DIR)))) return true;
  
  const vidExts = ['.mp4', '.webm', '.ogg'];
  if (vidExts.includes(ext) && norm(abs).startsWith(norm(resolve(VIDEOS_DIR)))) return true;
  
  const vendorExts = ['.png', '.jpg', '.scss', '.css', '.js', '.svg', '.woff', '.woff2', '.ttf', '.eot'];
  if (vendorExts.includes(ext) && norm(abs).startsWith(norm(resolve(VENDOR_DIR)))) return true;

  return false;
}

export function buildGeneralCopy(changedFile) {
  if (!existsSync(PAGES_DIR)) return;

  const skipExts = ['.scss', '.ejs', '.map'];

  function shouldCopy(f) {
    if (skipExts.includes(extname(f).toLowerCase())) return false;
    if (isHandledBySpecificBuilder(f)) return false;
    return true;
  }

  if (changedFile) {
    if (!shouldCopy(changedFile)) return;

    let baseRel = relative(PAGES_DIR, changedFile);
    let afterAssets = baseRel;
    let isAsset = false;
    if (baseRel.startsWith('assets\\') || baseRel.startsWith('assets/')) {
      afterAssets = baseRel.substring(7);
      isAsset = true;
    }
    
    if (isAsset) {
      for (const prefix of ASSETS_OUT_PREFIXES) {
        const rel = prefix ? `${prefix}/${afterAssets}` : afterAssets;
        const dest = resolve(DIST, rel);
        ensureDir(dirname(dest));
        writeFileSync(dest, readFileSync(changedFile));
        console.log(`[copy] ${norm(rel)}`);
      }
    } else {
      for (const prefix of PAGE_OUT_PREFIXES) {
        const dest = resolve(DIST, prefix, baseRel);
        ensureDir(dirname(dest));
        writeFileSync(dest, readFileSync(changedFile));
        console.log(`[copy] ${norm(relative(DIST, dest))}`);
      }
    }
    return;
  }

  const allFiles = walkSync(PAGES_DIR, shouldCopy);

  for (const file of allFiles) {
    let baseRel = relative(PAGES_DIR, file);
    let afterAssets = baseRel;
    let isAsset = false;
    if (baseRel.startsWith('assets\\') || baseRel.startsWith('assets/')) {
      afterAssets = baseRel.substring(7);
      isAsset = true;
    }
    
    if (isAsset) {
      for (const prefix of ASSETS_OUT_PREFIXES) {
        const rel = prefix ? `${prefix}/${afterAssets}` : afterAssets;
        const dest = resolve(DIST, rel);
        if (isNewer(file, dest)) {
          ensureDir(dirname(dest));
          writeFileSync(dest, readFileSync(file));
          console.log(`[copy] ${norm(rel)}`);
        }
      }
    } else {
      for (const prefix of PAGE_OUT_PREFIXES) {
        const dest = resolve(DIST, prefix, baseRel);
        if (isNewer(file, dest)) {
          ensureDir(dirname(dest));
          writeFileSync(dest, readFileSync(file));
          console.log(`[copy] ${norm(relative(DIST, dest))}`);
        }
      }
    }
  }
}

export function buildJs(changedFile) {
  if (changedFile) {
    const rel = relative(JS_DIR, changedFile);
    const src = readFileSync(changedFile);
    for (const destDir of JS_OUT_DIRS) {
      const dest = resolve(destDir, rel);
      ensureDir(dirname(dest));
      writeFileSync(dest, src);
      console.log(`[js] ${norm(relative(DIST, dest))}`);
    }
    return;
  }

  const files = walkSync(JS_DIR, (f) => extname(f) === '.js');
  for (const file of files) {
    const rel = relative(JS_DIR, file);
    const src = readFileSync(file);
    for (const destDir of JS_OUT_DIRS) {
      const dest = resolve(destDir, rel);
      if (isNewer(file, dest)) {
        ensureDir(dirname(dest));
        writeFileSync(dest, src);
        console.log(`[js] ${norm(relative(DIST, dest))}`);
      }
    }
  }
  for (const destDir of JS_OUT_DIRS) removeStaleFiles(JS_DIR, destDir);
}

export function buildVendor(changedFile) {
  const vendorExts = ['.png', '.jpg', '.scss', '.css', '.js', '.svg', '.woff', '.woff2', '.ttf', '.eot'];

  if (changedFile) {
    const rel = relative(VENDOR_DIR, changedFile);
    const src = readFileSync(changedFile);
    for (const destDir of VENDOR_OUT_DIRS) {
      const dest = resolve(destDir, rel);
      ensureDir(dirname(dest));
      writeFileSync(dest, src);
      console.log(`[vendor] ${norm(relative(DIST, dest))}`);
    }
    return;
  }

  const files = walkSync(VENDOR_DIR, (f) => {
    const ext = extname(f).toLowerCase();
    return vendorExts.includes(ext);
  });

  for (const file of files) {
    const rel = relative(VENDOR_DIR, file);
    const src = readFileSync(file);
    for (const destDir of VENDOR_OUT_DIRS) {
      const dest = resolve(destDir, rel);
      if (isNewer(file, dest)) {
        ensureDir(dirname(dest));
        writeFileSync(dest, src);
        console.log(`[vendor] ${norm(relative(DIST, dest))}`);
      }
    }
  }
  for (const destDir of VENDOR_OUT_DIRS) removeStaleFiles(VENDOR_DIR, destDir);
}

export async function buildImages(changedFile) {
  for (const destDir of IMAGES_OUT_DIRS) ensureDir(destDir);

  const copyExts = ['.gif', '.svg', '.ico', '.webp'];
  const convertExts = ['.jpg', '.jpeg', '.png'];

  if (changedFile) {
    const ext = extname(changedFile).toLowerCase();
    const rel = relative(IMAGES_DIR, changedFile);

    if (copyExts.includes(ext)) {
      for (const destDir of IMAGES_OUT_DIRS) {
        const dest = resolve(destDir, rel);
        ensureDir(dirname(dest));
        copyFileSync(changedFile, dest);
        console.log(`[images] copy: ${norm(relative(DIST, dest))}`);
      }
    } else if (convertExts.includes(ext)) {
      const webpRel = rel.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      const buffer = readFileSync(changedFile);
      const processed = await sharp(buffer).webp({ quality: 90 }).toBuffer();
      for (const destDir of IMAGES_OUT_DIRS) {
        const dest = resolve(destDir, webpRel);
        ensureDir(dirname(dest));
        writeFileSync(dest, processed);
        console.log(`[images] webp: ${norm(relative(DIST, dest))}`);
      }
    }
    return;
  }

  const allFiles = walkSync(IMAGES_DIR);

  for (const file of allFiles) {
    const ext = extname(file).toLowerCase();
    const rel = relative(IMAGES_DIR, file);

    if (copyExts.includes(ext)) {
      for (const destDir of IMAGES_OUT_DIRS) {
        const dest = resolve(destDir, rel);
        if (isNewer(file, dest)) {
          ensureDir(dirname(dest));
          copyFileSync(file, dest);
          console.log(`[images] copy: ${norm(relative(DIST, dest))}`);
        }
      }
    } else if (convertExts.includes(ext)) {
      const webpRel = rel.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      let processed = null;
      for (const destDir of IMAGES_OUT_DIRS) {
        const dest = resolve(destDir, webpRel);
        if (isNewer(file, dest)) {
          ensureDir(dirname(dest));
          if (!processed) {
            const buffer = readFileSync(file);
            processed = await sharp(buffer).webp({ quality: 90 }).toBuffer();
          }
          writeFileSync(dest, processed);
          console.log(`[images] webp: ${norm(relative(DIST, dest))}`);
        }
      }
    }
  }

  for (const destDir of IMAGES_OUT_DIRS) {
    removeStaleFiles(IMAGES_DIR, destDir, {
      transformExt: { from: ['.jpg', '.jpeg', '.png'], to: '.webp' },
    });
  }
}

export function buildVideos(changedFile) {
  const videoExts = ['.mp4', '.webm', '.ogg'];

  if (!existsSync(VIDEOS_DIR)) return;

  if (changedFile) {
    const rel = relative(VIDEOS_DIR, changedFile);
    for (const destDir of VIDEOS_OUT_DIRS) {
      const dest = resolve(destDir, rel);
      ensureDir(dirname(dest));
      copyFileSync(changedFile, dest);
      console.log(`[videos] ${norm(relative(DIST, dest))}`);
    }
    return;
  }

  const files = walkSync(VIDEOS_DIR, (f) => {
    const ext = extname(f).toLowerCase();
    return videoExts.includes(ext);
  });

  for (const file of files) {
    const rel = relative(VIDEOS_DIR, file);
    for (const destDir of VIDEOS_OUT_DIRS) {
      const dest = resolve(destDir, rel);
      if (isNewer(file, dest)) {
        ensureDir(dirname(dest));
        copyFileSync(file, dest);
        console.log(`[videos] ${norm(relative(DIST, dest))}`);
      }
    }
  }
  for (const destDir of VIDEOS_OUT_DIRS) removeStaleFiles(VIDEOS_DIR, destDir);
}
