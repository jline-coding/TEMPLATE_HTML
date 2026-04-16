import { join, relative, extname } from 'path';
import { mkdirSync, statSync, existsSync, readdirSync, unlinkSync, rmSync } from 'fs';
import { DIST } from './config.js';

/** Normalize path to use posix separators */
export const norm = (p) => p.replace(/\\/g, '/');

/** Ensure directory exists */
export function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
}

/** Check if a file is newer than another */
export function isNewer(src, dest) {
  try {
    const srcStat = statSync(src);
    const destStat = statSync(dest);
    return srcStat.mtimeMs > destStat.mtimeMs;
  } catch {
    return true; // dest doesn't exist
  }
}

/** Walk a directory recursively, returning file paths */
export function walkSync(dir, filter) {
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
export function removeStaleFiles(srcDir, destDir, opts = {}) {
  if (!existsSync(destDir)) return;
  const { transformExt } = opts;

  const srcFiles = new Set();
  for (const f of walkSync(srcDir)) {
    const rel = norm(relative(srcDir, f));
    const ext = extname(rel);
    
    if (transformExt && transformExt.from.includes(ext.toLowerCase())) {
      const safeExt = ext.replace(/\./g, '\\.');
      srcFiles.add(rel.replace(new RegExp(`${safeExt}$`, 'i'), transformExt.to));
    } else {
      srcFiles.add(rel);
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
export function removeEmptyDirs(dir) {
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
