import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

import { ROOT, WORKBENCH_DIR, WORKBENCH_COMPONENTS_DIR, WORKBENCH_SCSS_DIR, WORKBENCH_LAYOUT_DIR, WORKBENCH_OUT_DIR } from '../scripts/tools/config.js';
import { cleanWorkbench, buildWorkbenchScss, buildWorkbench } from '../scripts/builders/workbench.js';
import { syncSnippets } from '../scripts/sync-snippets.js';

describe('Dual-Environment Workbench System', () => {
  afterAll(async () => {
    try {
      await buildWorkbench({ force: true });
    } catch {}
  });
  it('should have isolated workbench/ directories', () => {
    expect(existsSync(WORKBENCH_DIR)).toBe(true);
    expect(existsSync(WORKBENCH_COMPONENTS_DIR)).toBe(true);
    expect(existsSync(WORKBENCH_SCSS_DIR)).toBe(true);
    expect(existsSync(WORKBENCH_LAYOUT_DIR)).toBe(true);
  });

  it('should compile workbench SCSS with full component preview', async () => {
    await buildWorkbenchScss();
    const cssPath = resolve(WORKBENCH_OUT_DIR, 'workbench.css');
    expect(existsSync(cssPath)).toBe(true);
    const cssContent = readFileSync(cssPath, 'utf8');
    expect(cssContent.length).toBeGreaterThan(5000);
  });

  it('should cleanly remove __workbench in cleanWorkbench() for production', () => {
    cleanWorkbench();
    expect(existsSync(WORKBENCH_OUT_DIR)).toBe(false);
  });

  it('should generate snippets from workbench/components/', () => {
    const snippets = syncSnippets({ quiet: true });
    expect(snippets).toBeDefined();
    const keys = Object.keys(snippets);
    expect(Array.isArray(keys)).toBe(true);
  });

  it('should generate valid Showroom HTML with sidebar navigation and CSS isolation guard', async () => {
    await buildWorkbench({ force: true });
    const htmlPath = resolve(WORKBENCH_OUT_DIR, 'index.html');
    const cssPath = resolve(WORKBENCH_OUT_DIR, 'workbench.css');

    expect(existsSync(htmlPath)).toBe(true);
    expect(existsSync(cssPath)).toBe(true);

    const html = readFileSync(htmlPath, 'utf8');
    const css = readFileSync(cssPath, 'utf8');

    // Structural assertions
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('class="cs-sidebar"');
    expect(html).toContain('id="cs-filter-input"');
    expect(html).toContain('class="cs-nav"');

    // Isolation guard in Showroom CSS
    expect(css).toContain('display: none !important');
  });
});
