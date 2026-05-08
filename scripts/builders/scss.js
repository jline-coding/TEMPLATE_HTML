import { resolve, basename, extname, dirname, join, relative } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { compileString } from 'sass-embedded';
import postcss from 'postcss';
import autoprefixer from 'autoprefixer';
import cssnano from 'cssnano';
import sortMediaQueries from 'postcss-sort-media-queries';

import {
  isWatch, isRenew, RENEW_SCSS_DIRS, SCSS_DIR, DIST, getScssDirsInfo
} from '../tools/config.js';
import { norm, ensureDir, walkSync } from '../tools/utils.js';

const postcssPlugins = isWatch
  ? [autoprefixer({ cascade: false })]
  : [sortMediaQueries({ sort: 'mobile-first' }), autoprefixer({ cascade: false }), cssnano()];

export async function buildScss(changedFile) {
  let entryFiles = [];

  if (changedFile) {
    const changedAbs = resolve(changedFile);
    const changedBase = basename(changedFile);

    if (changedBase.startsWith('_')) {
      entryFiles = findDependentEntries(changedAbs);
    } else {
      entryFiles = [changedAbs];
    }
  } else {
    const targetDirs = isRenew ? RENEW_SCSS_DIRS : [SCSS_DIR];
    for (const dir of targetDirs) {
      if (!existsSync(dir)) continue;
      const files = walkSync(dir, (f) =>
        extname(f) === '.scss' && !basename(f).startsWith('_')
      );
      entryFiles.push(...files);
    }
  }

  for (const entry of entryFiles) {
    await compileScssFile(entry);
  }
}

async function compileScssFile(filePath) {
  try {
    const source = readFileSync(filePath, 'utf8');
    if (!source.trim() || /^{\\rtf/i.test(source)) return;

    const { scssDir, cssRels } = getScssDirsInfo(filePath);

    const result = compileString(source, {
      url: new URL(`file:///${norm(filePath)}`),
      loadPaths: [scssDir],
      style: 'expanded',
      sourceMap: isWatch,
    });

    const rel = relative(scssDir, filePath);

    for (const cssRel of cssRels) {
      const cssPath = resolve(DIST, cssRel, rel.replace(/\.scss$/, '.css'));

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
      console.log(`[scss] ${norm(rel)} → ${norm(relative(DIST, cssPath))}`);
    }
  } catch (err) {
    console.error(`[scss] Error compiling ${filePath}:`, err.message);
  }
}

function findDependentEntries(changedPartial) {
  const { scssDir } = getScssDirsInfo(changedPartial);
  if (!existsSync(scssDir)) return [];
  const allFiles = walkSync(scssDir, (f) => extname(f) === '.scss');
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
    memo.set(key, false);
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

  return allFiles.filter(f => !basename(f).startsWith('_') && dependsOn(f, changedPartial));
}
