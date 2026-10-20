import { describe, it, expect, beforeEach, afterEach, afterAll, vi } from 'vitest';
import { existsSync, readFileSync, mkdirSync, writeFileSync } from 'fs';
import { resolve } from 'path';

// Build into a unique sandbox, even while the real dev server is running.
vi.mock('../scripts/tools/config.js', async (importOriginal) => {
  const config = await importOriginal();
  const { mkdtempSync } = await import('fs');
  const output = mkdtempSync(resolve(config.ROOT, 'test-sandbox-workbench-'));
  return { ...config, WORKBENCH_OUT_DIR: output };
});

import { WORKBENCH_DIR, WORKBENCH_COMPONENTS_DIR, WORKBENCH_SCSS_DIR, WORKBENCH_LAYOUT_DIR, WORKBENCH_OUT_DIR } from '../scripts/tools/config.js';
import { cleanWorkbench, buildWorkbenchScss, buildWorkbench } from '../scripts/builders/workbench.js';
import * as componentService from '../scripts/tools/component-service.js';
import { syncSnippets } from '../scripts/sync-snippets.js';

describe('Dual-Environment Workbench System', () => {
  beforeEach(() => cleanWorkbench());
  afterEach(() => vi.restoreAllMocks());
  afterAll(() => cleanWorkbench());
  it('should have isolated workbench/ directories', () => {
    expect(existsSync(WORKBENCH_DIR)).toBe(true);
    expect(existsSync(WORKBENCH_COMPONENTS_DIR)).toBe(true);
    expect(existsSync(WORKBENCH_SCSS_DIR)).toBe(true);
    expect(existsSync(WORKBENCH_LAYOUT_DIR)).toBe(true);
  });

  it('should compile workbench SCSS with its base layout', async () => {
    cleanWorkbench();
    await buildWorkbenchScss();
    const cssPath = resolve(WORKBENCH_OUT_DIR, 'workbench.css');
    expect(existsSync(cssPath)).toBe(true);
    const cssContent = readFileSync(cssPath, 'utf8');
    expect(cssContent).toContain('.l-container');
  });

  it('should cleanly remove __workbench in cleanWorkbench() for production', () => {
    mkdirSync(WORKBENCH_OUT_DIR, { recursive: true });
    writeFileSync(resolve(WORKBENCH_OUT_DIR, 'index.html'), '<!DOCTYPE html>');
    expect(existsSync(WORKBENCH_OUT_DIR)).toBe(true);
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

  it('should build an empty showroom without requiring library components', async () => {
    vi.spyOn(componentService, 'getRegistry').mockReturnValue([]);
    cleanWorkbench();

    await buildWorkbench({ force: true });

    const html = readFileSync(resolve(WORKBENCH_OUT_DIR, 'index.html'), 'utf8');
    const css = readFileSync(resolve(WORKBENCH_OUT_DIR, 'workbench.css'), 'utf8');
    expect(html).toContain('class="cs-empty-state"');
    expect(html).not.toContain('class="cs-section"');
    expect(css).toContain('.l-container');
  });

});
