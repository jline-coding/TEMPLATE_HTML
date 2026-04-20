import { resolve, dirname, basename, extname, relative, posix } from 'path';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import ejs from 'ejs';
import matter from 'gray-matter';
import beautify from 'js-beautify';
import prettier from 'prettier';
import * as phpPlugin from '@prettier/plugin-php';

import {
  isWatch, skipFormat, OUTPUT_EXT, USE_PHP_INCLUDE, SITE_URL,
  INCLUDE_DIRS, PAGES_DIR, LAYOUTS_DIR, DIST, refreshIncludeDirs
} from '../tools/config.js';
import { norm, ensureDir, walkSync } from '../tools/utils.js';

const beautifyOptions = {
  indent_size: 4,
  indent_char: ' ',
  max_preserve_newlines: 1,
  preserve_newlines: true,
  indent_inner_html: false,
  extra_liners: []
};

export async function formatCode(code, destExt) {
  if (isWatch || skipFormat) return code;
  
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

export async function buildEjs(changedFile) {
  // Re-scan include dirs to detect runtime changes (rename, add, delete)
  refreshIncludeDirs();
  if (OUTPUT_EXT === '.php' && USE_PHP_INCLUDE) {
    try {
      const transpileEjsToPhp = (str, relToRoot) => {
        let rootPrefix = '';
        if (relToRoot) {
            const depth = relToRoot.replace(/\\/g, '/').split('/').length - 1;
            for(let i=0; i<depth; i++) rootPrefix += '../';
        }
        return str
          .replace(/<%\s*=\s*assetsDir\s*%>/g, '<?php echo $assetsDir ?? "./"; ?>')
          .replace(/<%=\s*file(?:\?\.|\.)data(?:\?\.|\.)([a-zA-Z0-9_]+)\s*%>/g, "<?php echo $$$1 ?? ''; ?>")
          .replace(/<% if\s*\(\s*file(?:\?\.|\.)data(?:\?\.|\.)([a-zA-Z0-9_]+)\s*(!==|!==|===|==)\s*(['"])(.*?)\3\s*\)\s*{%>/g, "<?php if(isset($$$1) && $$$1 $2 '$4'): ?>")
          .replace(/<% }\s*else\s*if\s*\(\s*file(?:\?\.|\.)data(?:\?\.|\.)([a-zA-Z0-9_]+)\s*(!==|===|==)\s*(['"])(.*?)\3\s*\)\s*{%>/g, "<?php elseif(isset($$$1) && $$$1 $2 '$4'): ?>")
          .replace(/<%\s*}\s*else\s*{\s*%>/g, "<?php else: ?>")
          .replace(/<%\s*}\s*%>/g, "<?php endif; ?>")
          .replace(/<%-?\s*includeComponent\(\s*(['"])(.*?)\1\s*\)\s*%>/gi, `<?php include __DIR__ . '/${rootPrefix}$2.php'; ?>`);
      };

      for (const [dirName, dirPath] of Object.entries(INCLUDE_DIRS)) {
        if (!existsSync(dirPath)) continue;
        const partialFiles = walkSync(dirPath, (f) => basename(f).startsWith('_') && extname(f) === '.ejs');
        let extractedCount = 0;
        for (const file of partialFiles) {
          const rel = relative(dirPath, file);
          const contentStr = readFileSync(file, 'utf8');
          const transpiled = transpileEjsToPhp(contentStr, rel);
          const dir = dirname(rel);
          const base = basename(rel).replace(/^_/, '').replace(/\.ejs$/, '.php');
          const outName = dir === '.' ? base : posix.join(dir.split(/\\|\//).join('/'), base);
          const outPath = resolve(DIST, dirName, outName);
          ensureDir(dirname(outPath));
          writeFileSync(outPath, await formatCode(transpiled, '.php'));
          extractedCount++;
        }
        if (extractedCount > 0) {
          console.log(`[ejs] Extracted ${extractedCount} PHP partials → ${dirName}/`);
        }
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

  if (changedFile) {
    const changedNorm = norm(changedFile);
    const changedBase = basename(changedFile);
    const isInIncludeDir = Object.keys(INCLUDE_DIRS).some(name => changedNorm.includes(`/${name}/`));
    const isPartialOrLayout = changedBase.startsWith('_') || changedNorm.includes('/layouts/') || isInIncludeDir;

    if (!isPartialOrLayout && changedNorm.includes('/pages/')) {
      await renderEjsFile(changedFile);
      return;
    }
  }

  for (const file of ejsFiles) {
    await renderEjsFile(file);
  }
}

async function renderEjsFile(filePath) {
  try {
    const raw = readFileSync(filePath, 'utf8');
    const { data: frontData, content } = matter(raw);

    const relPath = norm(relative(PAGES_DIR, filePath));
    const depth = relPath.split('/').length - 1;
    let assetsDir = './';
    for (let i = 0; i < depth; i++) {
      assetsDir += '../';
    }

    const layoutName = frontData.layout || '_default';
    const layoutPath = resolve(LAYOUTS_DIR, `${layoutName}.ejs`);
    let layoutContent = '';
    if (existsSync(layoutPath)) {
      layoutContent = readFileSync(layoutPath, 'utf8');
    } else {
      layoutContent = '<%- contents %>'; // fallback
    }

    function includeComponent(compName) {
      // Support: includeComponent('header') → auto-find in all include dirs
      //          includeComponent('components/header') → explicit dir
      const parts = compName.split('/');
      let targetDirName, targetDirPath, innerPath;

      if (parts.length >= 2 && INCLUDE_DIRS[parts[0]]) {
        // Explicit directory: includeComponent('components/header')
        targetDirName = parts[0];
        targetDirPath = INCLUDE_DIRS[targetDirName];
        innerPath = parts.slice(1).join('/');
      } else {
        // Auto-find: search all include dirs for matching file
        const compDir = dirname(compName);
        const compBase = basename(compName);
        const found = Object.entries(INCLUDE_DIRS).find(([, dirPath]) => {
          const tryPath = resolve(dirPath, compDir === '.' ? '' : compDir, `_${compBase}.ejs`);
          return existsSync(tryPath);
        });
        if (found) {
          [targetDirName, targetDirPath] = found;
        } else {
          const firstKey = Object.keys(INCLUDE_DIRS)[0];
          targetDirName = firstKey || 'components';
          targetDirPath = INCLUDE_DIRS[targetDirName] || null;
        }
        innerPath = compName;
      }

      if (OUTPUT_EXT === '.php' && USE_PHP_INCLUDE) {
        const prefix = assetsDir.startsWith("./") ? assetsDir.slice(2) : assetsDir;
        return `<?php include __DIR__ . '/${prefix}${targetDirName}/${innerPath}.php'; ?>`;
      } else {
        if (!targetDirPath) return `<!-- Component ${compName} not found -->`;
        const compDir = dirname(innerPath);
        const compBase = basename(innerPath);
        const compPath = resolve(targetDirPath, compDir === '.' ? '' : compDir, `_${compBase}.ejs`);
        if (!existsSync(compPath)) return `<!-- Component _${compBase}.ejs not found in ${targetDirName}/ -->`;
        const compContent = readFileSync(compPath, 'utf8');
        return ejs.render(compContent, {
          file: { data: frontData, path: filePath },
          assetsDir,
          layoutsDir: LAYOUTS_DIR,
          componentsDir: targetDirPath,
          componentsDirName: targetDirName,
          includeDirs: INCLUDE_DIRS,
          ext: OUTPUT_EXT,
          phpInclude: USE_PHP_INCLUDE,
          siteUrl: SITE_URL,
          includeComponent
        }, { filename: compPath });
      }
    }

    const firstIncludeDirName = INCLUDE_DIRS['components'] ? 'components' : (Object.keys(INCLUDE_DIRS)[0] || 'components');
    const firstIncludeDirPath = INCLUDE_DIRS[firstIncludeDirName] || '';

    const pageHtml = ejs.render(content, {
      file: { data: frontData, path: filePath },
      assetsDir,
      layoutsDir: LAYOUTS_DIR,
      componentsDir: firstIncludeDirPath,
      componentsDirName: firstIncludeDirName,
      includeDirs: INCLUDE_DIRS,
      ext: OUTPUT_EXT,
      phpInclude: USE_PHP_INCLUDE,
      siteUrl: SITE_URL,
      includeComponent,
    }, {
      filename: filePath,
    });

    const fullHtml = ejs.render(layoutContent, {
      file: { data: frontData, path: filePath },
      contents: pageHtml,
      assetsDir,
      layoutsDir: LAYOUTS_DIR,
      componentsDir: firstIncludeDirPath,
      componentsDirName: firstIncludeDirName,
      includeDirs: INCLUDE_DIRS,
      ext: OUTPUT_EXT,
      phpInclude: USE_PHP_INCLUDE,
      siteUrl: SITE_URL,
      includeComponent,
    }, {
      filename: layoutPath,
    });

    const outPath = resolve(DIST, relPath.replace(/\.ejs$/, OUTPUT_EXT));
    ensureDir(dirname(outPath));
    const finalFormattedHtml = await formatCode(fullHtml, OUTPUT_EXT);
    writeFileSync(outPath, finalFormattedHtml, 'utf8');
    console.log(`[ejs] ${relPath} → ${norm(relative(DIST, outPath))}`);
  } catch (err) {
    console.error(`[ejs] Error processing ${filePath}:`, err.message);
  }
}
