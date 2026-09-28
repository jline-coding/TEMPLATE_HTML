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
    expect(cssContent.length).toBeGreaterThan(10000);
  });

  it('should cleanly remove __workbench in cleanWorkbench() for production', () => {
    cleanWorkbench();
    expect(existsSync(WORKBENCH_OUT_DIR)).toBe(false);
  });

  it('should generate snippets from workbench/components/', () => {
    const snippets = syncSnippets({ quiet: true });
    expect(snippets).toBeDefined();
    const keys = Object.keys(snippets);
    expect(keys.length).toBeGreaterThanOrEqual(10);
    expect(keys.some(k => k.includes('c-accordion') || k.includes('c-btn'))).toBe(true);
  });
});
