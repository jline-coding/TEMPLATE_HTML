import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { resolve } from 'path';
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import { ROOT, WORKBENCH_COMPONENTS_DIR, WORKBENCH_SCSS_DIR, WORKBENCH_JS_DIR } from '../scripts/tools/config.js';
import {
  parseComponentHtml,
  extractTagBlockFromFile,
  findComponentScssInSite,
  findComponentJsInSite,
  exportSelectionToWorkbench
} from '../scripts/tools/selection-exporter.js';

describe('Selection Exporter Engine (VS Code to Workbench)', () => {
  let tempHeaderCreated = false;
  let tempScssCreated = false;
  let tempJsModified = false;
  let originalCommonJs = '';

  beforeAll(() => {
    const compDir = resolve(ROOT, 'src/components');
    const scssDir = resolve(ROOT, 'src/pages/assets/scss/component');
    const jsDir = resolve(ROOT, 'src/pages/assets/js');
    if (!existsSync(compDir)) mkdirSync(compDir, { recursive: true });
    if (!existsSync(scssDir)) mkdirSync(scssDir, { recursive: true });
    if (!existsSync(jsDir)) mkdirSync(jsDir, { recursive: true });

    const headerFile = resolve(compDir, '_header.ejs');
    const scssFile = resolve(scssDir, '_header.scss');
    const jsFile = resolve(jsDir, 'common.js');

    if (!existsSync(headerFile)) {
      writeFileSync(headerFile, '<header class="c-header"><div class="c-header__inner">Logo</div></header>', 'utf8');
      tempHeaderCreated = true;
    }
    if (!existsSync(scssFile)) {
      writeFileSync(scssFile, '.c-header { display: block; }\n', 'utf8');
      tempScssCreated = true;
    }
    if (existsSync(jsFile)) {
      originalCommonJs = readFileSync(jsFile, 'utf8');
      if (!originalCommonJs.includes('[Component: header]')) {
        writeFileSync(jsFile, originalCommonJs + '\n/* ==========================================================================\n   [Component: header]\n   ========================================================================== */\n$(\'.c-header\').show();\n', 'utf8');
        tempJsModified = true;
      }
    }
  });

  afterAll(() => {
    const headerFile = resolve(ROOT, 'src/components/_header.ejs');
    const scssFile = resolve(ROOT, 'src/pages/assets/scss/component/_header.scss');
    const jsFile = resolve(ROOT, 'src/pages/assets/js/common.js');

    if (tempHeaderCreated && existsSync(headerFile)) {
      try { rmSync(headerFile, { force: true }); } catch {}
    }
    if (tempScssCreated && existsSync(scssFile)) {
      try { rmSync(scssFile, { force: true }); } catch {}
    }
    if (tempJsModified && originalCommonJs) {
      try { writeFileSync(jsFile, originalCommonJs, 'utf8'); } catch {}
    }
  });
  it('accurately parses component class, name, and category from HTML snippet', () => {
    const html1 = '<div class="c-accordion"><button class="c-accordion__head">Title</button></div>';
    const parsed1 = parseComponentHtml(html1);
    expect(parsed1).toBeDefined();
    expect(parsed1.rootClass).toBe('c-accordion');
    expect(parsed1.compName).toBe('accordion');
    expect(parsed1.category).toBe('component');
    expect(parsed1.allClasses).toContain('c-accordion');
    expect(parsed1.allClasses).toContain('c-accordion__head');

    const html2 = '<div class="l-flex l-flex--middle"><div class="l-flex__left">L</div></div>';
    const parsed2 = parseComponentHtml(html2);
    expect(parsed2).toBeDefined();
    expect(parsed2.compName).toBe('flexs');
    expect(parsed2.category).toBe('layout');
    expect(parsed2.allClasses).toContain('l-flex');
    expect(parsed2.allClasses).toContain('l-flex--middle');
    expect(parsed2.allClasses).toContain('l-flex__left');

    const html3 = '<header class="c-header"><div class="c-header__inner">Logo</div></header>';
    const parsed3 = parseComponentHtml(html3);
    expect(parsed3).toBeDefined();
    expect(parsed3.compName).toBe('header');
    expect(parsed3.category).toBe('header');

    // Completely arbitrary / new component names
    const html4 = '<div class="c-pricing-table"><div class="c-pricing-table__plan">Pro</div></div>';
    const parsed4 = parseComponentHtml(html4);
    expect(parsed4).toBeDefined();
    expect(parsed4.compName).toBe('pricing-table');
    expect(parsed4.category).toBe('component');

    const html5 = '<section class="l-hero-banner"><div class="l-hero-banner__inner">Title</div></section>';
    const parsed5 = parseComponentHtml(html5);
    expect(parsed5).toBeDefined();
    expect(parsed5.compName).toBe('hero-banner');
    expect(parsed5.category).toBe('layout');
  });

  it('accurately extracts balanced HTML tag block around cursor line in file', () => {
    const headerFile = resolve(ROOT, 'src/components/_header.ejs');
    const extracted = extractTagBlockFromFile(headerFile, 1);
    expect(extracted).toBeDefined();
    expect(extracted).toContain('class="c-header"');
    expect(extracted.startsWith('<header class="c-header">')).toBe(true);
    expect(extracted.endsWith('</header>')).toBe(true);
  });

  it('locates matching SCSS in site for component even in shared files', () => {
    const scss = findComponentScssInSite('header');
    expect(scss).toBeDefined();
    expect(scss.fileName).toBe('_header.scss');
    expect(scss.content).toContain('.c-header');

    const js = findComponentJsInSite('header', 'c-header');
    expect(js).toBeDefined();
    expect(js.fileName).toBe('common.js');
    expect(js.content).toContain('.c-header');
  });

  it('exports component from file selection into workbench showroom cleanly', async () => {
    const destEjs = resolve(WORKBENCH_COMPONENTS_DIR, '_header.ejs');
    const destJs = resolve(WORKBENCH_JS_DIR, 'common.js');
    const destScss = resolve(WORKBENCH_SCSS_DIR, '_header.scss');
    const originalEjs = existsSync(destEjs) ? readFileSync(destEjs, 'utf8') : null;
    const originalJs = existsSync(destJs) ? readFileSync(destJs, 'utf8') : null;
    const originalScss = existsSync(destScss) ? readFileSync(destScss, 'utf8') : null;

    try {
      const headerFile = resolve(ROOT, 'src/components/_header.ejs');
      const result = await exportSelectionToWorkbench({
        filePath: headerFile,
        lineNumber: 1
      });

      expect(result.success).toBe(true);
      expect(result.name).toBe('header');
      expect(result.hasScss).toBe(true);
      expect(result.hasJs).toBe(true);

      expect(existsSync(destEjs)).toBe(true);
      expect(existsSync(destScss)).toBe(true);
      expect(existsSync(destJs)).toBe(true);

      const ejsContent = readFileSync(destEjs, 'utf8');
      const scssContent = readFileSync(destScss, 'utf8');
      const jsContent = readFileSync(destJs, 'utf8');

      expect(ejsContent).toContain('c-header');
      expect(scssContent).toContain('.c-header');
      expect(jsContent).toContain('header');
    } finally {
      try {
        if (originalEjs !== null) writeFileSync(destEjs, originalEjs, 'utf8');
        else if (existsSync(destEjs)) rmSync(destEjs, { force: true, maxRetries: 5, retryDelay: 100 });
        if (originalScss !== null) writeFileSync(destScss, originalScss, 'utf8');
        else if (existsSync(destScss)) rmSync(destScss, { force: true, maxRetries: 5, retryDelay: 100 });
        if (originalJs !== null) writeFileSync(destJs, originalJs, 'utf8');
        else if (existsSync(destJs)) rmSync(destJs, { force: true, maxRetries: 5, retryDelay: 100 });
      } catch {}
    }
  });
});
