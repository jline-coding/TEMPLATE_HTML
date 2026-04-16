import { resolve, relative, dirname, extname } from 'path';
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'fs';
import sharp from 'sharp';

import {
  isRenew, PAGES_DIR, DIST, JS_DIR, VENDOR_DIR, IMAGES_DIR, VIDEOS_DIR
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

    const rel = relative(PAGES_DIR, changedFile);
    const dest = resolve(DIST, rel);
    ensureDir(dirname(dest));
    writeFileSync(dest, readFileSync(changedFile));
    console.log(`[copy] ${norm(rel)}`);
    return;
  }

  const allFiles = walkSync(PAGES_DIR, shouldCopy);

  for (const file of allFiles) {
    const rel = relative(PAGES_DIR, file);
    const dest = resolve(DIST, rel);
    if (isNewer(file, dest)) {
      ensureDir(dirname(dest));
      writeFileSync(dest, readFileSync(file));
      console.log(`[copy] ${norm(rel)}`);
    }
  }
}

export function buildJs(changedFile) {
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

export function buildVendor(changedFile) {
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

export async function buildImages(changedFile) {
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
      copyFileSync(changedFile, dest);
      console.log(`[images] copy: ${norm(rel)}`);
    } else if (convertExts.includes(ext)) {
      const webpRel = rel.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      const dest = resolve(destDir, webpRel);
      ensureDir(dirname(dest));
      const buffer = readFileSync(changedFile);
      await sharp(buffer).webp({ quality: 90 }).toFile(dest);
      console.log(`[images] webp: ${norm(rel)} → ${norm(webpRel)}`);
    }
    return;
  }

  const allFiles = walkSync(IMAGES_DIR);

  for (const file of allFiles) {
    const ext = extname(file).toLowerCase();
    const rel = relative(IMAGES_DIR, file);

    if (copyExts.includes(ext)) {
      const dest = resolve(destDir, rel);
      if (isNewer(file, dest)) {
        ensureDir(dirname(dest));
        copyFileSync(file, dest);
        console.log(`[images] copy: ${norm(rel)}`);
      }
    } else if (convertExts.includes(ext)) {
      const webpRel = rel.replace(/\.(jpg|jpeg|png)$/i, '.webp');
      const dest = resolve(destDir, webpRel);
      if (isNewer(file, dest)) {
        ensureDir(dirname(dest));
        const buffer = readFileSync(file);
        await sharp(buffer).webp({ quality: 90 }).toFile(dest);
        console.log(`[images] webp: ${norm(rel)} → ${norm(webpRel)}`);
      }
    }
  }

  removeStaleFiles(IMAGES_DIR, destDir, {
    transformExt: { from: ['.jpg', '.jpeg', '.png'], to: '.webp' },
  });
}

export function buildVideos(changedFile) {
  const destDir = resolve(DIST, 'assets', 'videos');
  const videoExts = ['.mp4', '.webm', '.ogg'];

  if (!existsSync(VIDEOS_DIR)) return;

  if (changedFile) {
    const rel = relative(VIDEOS_DIR, changedFile);
    const dest = resolve(destDir, rel);
    ensureDir(dirname(dest));
    copyFileSync(changedFile, dest);
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
      copyFileSync(file, dest);
      console.log(`[videos] ${norm(rel)}`);
    }
  }
  removeStaleFiles(VIDEOS_DIR, destDir);
}
