import { describe, it, expect } from 'vitest';
import { resolve } from 'path';
import { existsSync, readFileSync, writeFileSync, rmSync } from 'fs';
import { ROOT, WORKBENCH_COMPONENTS_DIR, WORKBENCH_SCSS_DIR, WORKBENCH_JS_DIR } from '../scripts/tools/config.js';
import {
  parseComponentHtml,
  extractTagBlockFromFile,
  findComponentScssInSite,
  findComponentJsInSite,
  exportSelectionToWorkbench
} from '../scripts/tools/selection-exporter.js';

describe('Selection Exporter Engine (VS Code to Workbench)', () => {
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
    // Line 43 in _header.ejs contains c-toggle
    const extracted = extractTagBlockFromFile(headerFile, 43);
    expect(extracted).toBeDefined();
    expect(extracted).toContain('class="c-toggle"');
    expect(extracted).toContain('c-toggle__line');
    expect(extracted.startsWith('<div class="c-toggle">')).toBe(true);
    expect(extracted.endsWith('</div>')).toBe(true);
  });

  it('locates matching SCSS in site for component even in shared files', () => {
    const scss = findComponentScssInSite('toggle');
    expect(scss).toBeDefined();
    expect(scss.fileName).toBe('_btn.scss');
    expect(scss.content).toContain('.c-toggle');

    // Scanning with multiple block classes
    const scssFromClasses = findComponentScssInSite('toggle', ['c-header-btns', 'c-toggle', 'c-toggle__line']);
    expect(scssFromClasses).toBeDefined();
    expect(scssFromClasses.fileName).toBe('_btn.scss');

    const js = findComponentJsInSite('toggle', 'c-toggle');
    expect(js).toBeDefined();
    expect(js.fileName).toBe('common.js');
    expect(js.content).toContain('.c-toggle');

    const jsFromClasses = findComponentJsInSite('toggle', ['c-toggle__line', 'c-toggle']);
    expect(jsFromClasses).toBeDefined();
    expect(jsFromClasses.fileName).toBe('common.js');
  });

  it('exports component from file selection into workbench showroom cleanly', async () => {
    const destEjs = resolve(WORKBENCH_COMPONENTS_DIR, '_toggle.ejs');
    const destJs = resolve(WORKBENCH_JS_DIR, 'common.js');
    const destScss = resolve(WORKBENCH_SCSS_DIR, '_btn.scss');

    try {
      const headerFile = resolve(ROOT, 'src/components/_header.ejs');
      const result = await exportSelectionToWorkbench({
        filePath: headerFile,
        lineNumber: 43
      });

      expect(result.success).toBe(true);
      expect(result.name).toBe('toggle');
      expect(result.hasScss).toBe(true);
      expect(result.hasJs).toBe(true);

      expect(existsSync(destEjs)).toBe(true);
      expect(existsSync(destScss)).toBe(true);
      expect(existsSync(destJs)).toBe(true);

      const ejsContent = readFileSync(destEjs, 'utf8');
      const scssContent = readFileSync(destScss, 'utf8');
      const jsContent = readFileSync(destJs, 'utf8');

      expect(ejsContent).toContain('c-toggle');
      expect(ejsContent).toContain('scss: _btn.scss');
      expect(ejsContent).toContain('js: common.js');
      expect(scssContent).toContain('.c-toggle');
      expect(scssContent).not.toContain('.c-totop');
      expect(jsContent).toContain('.c-toggle');
    } finally {
      try {
        if (existsSync(destEjs)) rmSync(destEjs, { force: true, maxRetries: 5, retryDelay: 100 });
        if (existsSync(destScss)) rmSync(destScss, { force: true, maxRetries: 5, retryDelay: 100 });
        if (existsSync(destJs)) rmSync(destJs, { force: true, maxRetries: 5, retryDelay: 100 });
      } catch {}
    }
  });
});
