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
  WORKBENCH_DIR, WORKBENCH_CATALOG_DIR, WORKBENCH_COMPONENTS_DIR, WORKBENCH_OUT_DIR, WORKBENCH_JS_DIR,
  WORKBENCH_SCSS_DIR, WORKBENCH_LAYOUT_DIR,
  CLIENT_SCSS_DIR, CLIENT_LAYOUT_DIR
} from '../tools/config.js';
import { ensureDir } from '../tools/utils.js';
import { safeRmDirSync, getDevSessionToken } from '../tools/safety.js';
import { syncSnippets } from '../sync-snippets.js';
import { getRegistry, parseComponentMetadata } from '../tools/component-service.js';

const CATALOG_EJS = resolve(WORKBENCH_CATALOG_DIR, 'catalog.ejs');
const CATALOG_CSS = resolve(WORKBENCH_CATALOG_DIR, 'catalog.css');
const CATALOG_JS = resolve(WORKBENCH_CATALOG_DIR, 'catalog.js');
const INVIEW_EJS = resolve(WORKBENCH_CATALOG_DIR, 'inview.ejs');
const INVIEW_CSS = resolve(WORKBENCH_CATALOG_DIR, 'inview.css');
const INVIEW_JS = resolve(WORKBENCH_CATALOG_DIR, 'inview.js');
const WORKBENCH_SCSS = resolve(WORKBENCH_DIR, 'workbench.scss');

/**
 * Remove any workbench remnants from DIST (Production Guard)
 */
export function cleanWorkbench() {
  if (existsSync(WORKBENCH_OUT_DIR)) {
    try {
      safeRmDirSync(WORKBENCH_OUT_DIR, ROOT);
    } catch (e) {
      // Ignore
    }
  }
}

/**
 * Compile Workbench SCSS preview
 * Smart Priority: Prioritizes customized site SCSS (src/) if it has real rules,
 * and seamlessly falls back to workbench/ templates for uninstalled/stub components.
 */
export async function buildWorkbenchScss() {
  try {
    let dynamicScss = `@use "sass:math";\n`;
    dynamicScss += `@use "scss/global" as *;\n`;
    dynamicScss += `@use "scss/foundation";\n`;
    dynamicScss += `@use "scss/utilities";\n`;
    dynamicScss += `@use "scss/layout/container";\n`;

    const registry = getRegistry();
    const scssImports = [];

    // Strictly compile from canonical workbench/ repository (Pure Design System Sandbox)
    for (const item of registry) {
      if (item.scssFile) {
        const inLayout = existsSync(resolve(WORKBENCH_LAYOUT_DIR, item.scssFile));
        const cleanName = item.scssFile.replace(/^_/, '').replace(/\.scss$/, '');
        if (cleanName === 'container') continue;
        const relPath = `scss/${inLayout ? 'layout' : 'component'}/${cleanName}`;
        scssImports.push(`@use "${relPath}";`);
      }
    }

    dynamicScss += '\n/* Canonical Component & Layout Modules */\n' + Array.from(new Set(scssImports)).join('\n') + '\n';

    const result = await sass.compileStringAsync(dynamicScss, {
      loadPaths: [WORKBENCH_DIR],
      style: 'expanded',
      sourceMap: false
    });
    ensureDir(WORKBENCH_OUT_DIR);
    writeFileSync(resolve(WORKBENCH_OUT_DIR, 'workbench.css'), result.css, 'utf8');

    // Compile inview.scss directly importing site global, reset, base, inview (only if inview component is installed)
    const INVIEW_SCSS = resolve(WORKBENCH_DIR, 'scss/inview.scss');
    const inviewDepExists = existsSync(resolve(ROOT, 'src/pages/assets/scss/component/_inview.scss')) ||
                            existsSync(resolve(WORKBENCH_DIR, 'scss/component/_inview.scss'));
    if (existsSync(INVIEW_SCSS) && inviewDepExists) {
      try {
        const inviewResult = await sass.compileAsync(INVIEW_SCSS, {
          loadPaths: [WORKBENCH_DIR, resolve(ROOT, 'src/pages/assets/scss')],
          style: 'expanded',
          sourceMap: false
        });
        writeFileSync(resolve(WORKBENCH_OUT_DIR, 'inview.css'), inviewResult.css, 'utf8');
      } catch (inviewErr) {
        console.warn('[workbench] Optional inview.scss build skipped:', inviewErr.message);
      }
    }
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

  // 2. Discover and render all components in workbench/components/ using registry (auto-sorted by design system hierarchy)
  const componentModules = getRegistry()
    .map(item => {
      const ejsPath = resolve(WORKBENCH_COMPONENTS_DIR, item.ejsFile);
      const raw = existsSync(ejsPath) ? readFileSync(ejsPath, 'utf8') : '';
      const { content: cleanRaw } = parseComponentMetadata(raw);
      let renderedContent = cleanRaw;

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
        renderedContent = ejs.render(cleanRaw, {
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
      siteUrl: SITE_URL,
      devToken: getDevSessionToken()
    }, {
      filename: CATALOG_EJS
    });

    ensureDir(WORKBENCH_OUT_DIR);
    writeFileSync(resolve(WORKBENCH_OUT_DIR, 'index.html'), html, 'utf8');

    // 4b. Render inview.ejs -> inview.html (Dedicated Inview Motion Showcase & Guide)
    if (existsSync(INVIEW_EJS)) {
      try {
        const inviewTemplate = readFileSync(INVIEW_EJS, 'utf8');
        const inviewHtml = ejs.render(inviewTemplate, {
          siteFontLinks,
          assetsDir: '../assets/',
          siteUrl: SITE_URL,
          devToken: getDevSessionToken()
        }, {
          filename: INVIEW_EJS
        });
        writeFileSync(resolve(WORKBENCH_OUT_DIR, 'inview.html'), inviewHtml, 'utf8');
      } catch (err) {
        console.error('[workbench] Error rendering inview.ejs:', err.message);
      }
    }

    // 5. Copy Workbench UI assets (catalog.css, catalog.js)
    if (existsSync(CATALOG_CSS)) {
      copyFileSync(CATALOG_CSS, resolve(WORKBENCH_OUT_DIR, 'catalog.css'));
    }
    if (existsSync(CATALOG_JS)) {
      copyFileSync(CATALOG_JS, resolve(WORKBENCH_OUT_DIR, 'catalog.js'));
    }

    // 5a. Copy Inview UI controller (inview.js)
    if (existsSync(INVIEW_JS)) {
      copyFileSync(INVIEW_JS, resolve(WORKBENCH_OUT_DIR, 'inview.js'));
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
