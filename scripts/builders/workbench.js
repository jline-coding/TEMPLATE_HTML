/**
 * scripts/builders/workbench.js
 * Dedicated Workbench Showcase Builder
 * Isolates all Developer Showcase logic from the Client Build Pipeline.
 * 
 * In watch/dev mode: Generates DIST/__workbench/index.html and workbench.css
 * In production build: Guaranteed ZERO presence in DIST/
 */

import { existsSync, readFileSync, writeFileSync, rmSync, copyFileSync, readdirSync } from 'fs';
import { resolve } from 'path';
import ejs from 'ejs';
import * as sass from 'sass-embedded';

import {
  ROOT, DIST, isWatch, OUTPUT_EXT, SITE_URL, LAYOUTS_DIR,
  WORKBENCH_DIR, WORKBENCH_CATALOG_DIR, WORKBENCH_COMPONENTS_DIR, WORKBENCH_OUT_DIR, WORKBENCH_JS_DIR
} from '../tools/config.js';
import { ensureDir } from '../tools/utils.js';
import { syncSnippets } from '../sync-snippets.js';
import { getRegistry } from '../tools/component-service.js';

const CATALOG_EJS = resolve(WORKBENCH_CATALOG_DIR, 'catalog.ejs');
const CATALOG_CSS = resolve(WORKBENCH_CATALOG_DIR, 'catalog.css');
const CATALOG_JS = resolve(WORKBENCH_CATALOG_DIR, 'catalog.js');
const WORKBENCH_SCSS = resolve(WORKBENCH_DIR, 'workbench.scss');

/**
 * Remove any workbench remnants from DIST (Production Guard)
 */
export function cleanWorkbench() {
  if (existsSync(WORKBENCH_OUT_DIR)) {
    try {
      rmSync(WORKBENCH_OUT_DIR, { recursive: true, force: true });
    } catch (e) {
      // Ignore
    }
  }
}

/**
 * Compile Workbench SCSS preview
 */
export async function buildWorkbenchScss() {
  if (!existsSync(WORKBENCH_SCSS)) return;
  try {
    const result = await sass.compileAsync(WORKBENCH_SCSS, {
      loadPaths: [WORKBENCH_DIR, resolve(ROOT, 'src/pages/assets/scss')],
      style: 'expanded',
      sourceMap: false
    });
    ensureDir(WORKBENCH_OUT_DIR);
    writeFileSync(resolve(WORKBENCH_OUT_DIR, 'workbench.css'), result.css, 'utf8');
  } catch (err) {
    console.error('[workbench] SCSS build error:', err.message);
  }
}

/**
 * Build Full Workbench Showcase HTML & Assets
 */
export async function buildWorkbench(options = {}) {
  // Only build workbench in watch / dev mode unless explicitly forced!
  if (!isWatch && !options.force) {
    cleanWorkbench();
    return;
  }

  if (!existsSync(CATALOG_EJS) || !existsSync(WORKBENCH_COMPONENTS_DIR)) {
    return;
  }

  ensureDir(WORKBENCH_OUT_DIR);

  // 1. Compile Workbench SCSS
  await buildWorkbenchScss();

  // 2. Discover and render all components in workbench/components/ using registry
  const categoryOrder = { 'header': 1, 'footer': 2, 'layout': 3, 'component': 4 };
  const subOrder = ['header', 'header_01', 'footer', 'footer_01', 'sidebar', 'mv', 'grids', 'flexs', 'tbls', 'loading', 'bread', 'titles', 'texts', 'btns', 'links', 'lists', 'accordion', 'other'];

  const rawRegistry = getRegistry();
  const componentModules = rawRegistry
    .sort((a, b) => {
      const catA = categoryOrder[a.category] || 99;
      const catB = categoryOrder[b.category] || 99;
      if (catA !== catB) return catA - catB;

      const idxA = subOrder.indexOf(a.name);
      const idxB = subOrder.indexOf(b.name);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
      if (idxA !== -1) return -1;
      if (idxB !== -1) return 1;
      return a.name.localeCompare(b.name);
    })
    .map(item => {
      const ejsPath = resolve(WORKBENCH_COMPONENTS_DIR, item.ejsFile);
      const raw = existsSync(ejsPath) ? readFileSync(ejsPath, 'utf8') : '';
      let renderedContent = raw;

      const mockFile = {
        data: {
          page: 'top',
          title: item.title,
          description: '',
          isTop: true
        },
        path: ejsPath
      };

      try {
        renderedContent = ejs.render(raw, {
          file: mockFile,
          data: mockFile.data,
          assetsDir: '../',
          layoutsDir: LAYOUTS_DIR,
          componentsDir: WORKBENCH_COMPONENTS_DIR,
          ext: OUTPUT_EXT,
          siteUrl: SITE_URL,
          includeComponent: (name) => {
            const cand = [
              resolve(WORKBENCH_COMPONENTS_DIR, `_${name}.ejs`),
              resolve(WORKBENCH_COMPONENTS_DIR, `${name}.ejs`)
            ];
            for (const c of cand) {
              if (existsSync(c)) {
                try {
                  return ejs.render(readFileSync(c, 'utf8'), {
                    file: mockFile,
                    data: mockFile.data,
                    assetsDir: '../',
                    ext: OUTPUT_EXT,
                    siteUrl: SITE_URL,
                    includeComponent: () => ''
                  });
                } catch {
                  return '';
                }
              }
            }
            return '';
          }
        });
      } catch (err) {
        console.error(`[workbench] Error rendering component "${item.name}":`, err.message);
        renderedContent = raw;
      }

      return {
        ...item,
        file: item.ejsFile,
        isLayout: item.category === 'layout',
        content: renderedContent,
        rawContent: raw,
        renderedContent
      };
    });

  // 3. Auto-extract Font links from site layout (_default.ejs) so Workbench inherits site fonts!
  const defaultLayoutPath = resolve(LAYOUTS_DIR, '_default.ejs');
  let siteFontLinks = '';
  if (existsSync(defaultLayoutPath)) {
    const layoutContent = readFileSync(defaultLayoutPath, 'utf8');
    const matches = layoutContent.match(/<link\b[^>]*?(?:fonts\.googleapis\.com|fonts\.gstatic\.com|use\.typekit\.net|adobe)[^>]*?>/gi);
    if (matches && matches.length > 0) {
      siteFontLinks = matches.join('\n  ');
    }
  }
  if (!siteFontLinks) {
    siteFontLinks = `<link rel="preconnect" href="https://fonts.googleapis.com">\n  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n  <link href="https://fonts.googleapis.com/css2?family=Barlow:wght@400;500;700&family=Noto+Sans+JP:wght@400;500;700&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet">`;
  }

  // 4. Render catalog.ejs
  try {
    const catalogTemplate = readFileSync(CATALOG_EJS, 'utf8');
    const html = ejs.render(catalogTemplate, {
      componentModules,
      siteFontLinks,
      assetsDir: '../assets/',
      siteUrl: SITE_URL
    }, {
      filename: CATALOG_EJS
    });

    ensureDir(WORKBENCH_OUT_DIR);
    writeFileSync(resolve(WORKBENCH_OUT_DIR, 'index.html'), html, 'utf8');

    // 5. Copy Workbench UI assets (catalog.css, catalog.js)
    if (existsSync(CATALOG_CSS)) {
      copyFileSync(CATALOG_CSS, resolve(WORKBENCH_OUT_DIR, 'catalog.css'));
    }
    if (existsSync(CATALOG_JS)) {
      copyFileSync(CATALOG_JS, resolve(WORKBENCH_OUT_DIR, 'catalog.js'));
    }

    // 5b. Bundle interactive Component JS from workbench/js/
    if (existsSync(WORKBENCH_JS_DIR)) {
      const jsFiles = readdirSync(WORKBENCH_JS_DIR).filter(f => f.endsWith('.js'));
      let bundledJs = '/* Workbench Interactive Component Scripts */\n';
      for (const jsFile of jsFiles) {
        try {
          const content = readFileSync(resolve(WORKBENCH_JS_DIR, jsFile), 'utf8');
          bundledJs += `\n/* --- ${jsFile} --- */\n` + content + '\n';
        } catch {}
      }
      ensureDir(WORKBENCH_OUT_DIR);
      writeFileSync(resolve(WORKBENCH_OUT_DIR, 'components.js'), bundledJs, 'utf8');
    }

    const port = options.port || 8686;
    console.log(`[workbench] ✓ Showcase ready: http://localhost:${port}/__workbench/ (${componentModules.length} modules)`);
  } catch (err) {
    console.error('[workbench] Error rendering catalog.ejs:', err.message);
  }

  // 6. Keep snippets synced
  try {
    syncSnippets({ quiet: true });
  } catch {}
}
