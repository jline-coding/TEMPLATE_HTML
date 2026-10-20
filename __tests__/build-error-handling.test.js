import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { resolve } from 'path';
import { existsSync } from 'fs';

vi.mock('../scripts/tools/config.js', async (importOriginal) => {
  const config = await importOriginal();
  const { mkdtempSync } = await import('fs');
  return {
    ...config,
    isWatch: false,
    isRenew: false,
    DIST: mkdtempSync(resolve(config.ROOT, 'test-sandbox-build-'))
  };
});
// Test orchestration and error aggregation without rebuilding the user's site.
vi.mock('../scripts/builders/ejs.js', () => ({ buildEjs: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../scripts/builders/scss.js', () => ({ buildScss: vi.fn().mockResolvedValue(undefined) }));
vi.mock('../scripts/builders/assets.js', () => ({
  buildGeneralCopy: vi.fn().mockResolvedValue(undefined),
  buildJs: vi.fn(), buildVendor: vi.fn(),
  buildImages: vi.fn().mockResolvedValue(undefined),
  buildVideos: vi.fn(), isHandledBySpecificBuilder: vi.fn()
}));
vi.mock('../scripts/builders/workbench.js', () => ({
  buildWorkbench: vi.fn(), cleanWorkbench: vi.fn(), buildWorkbenchScss: vi.fn()
}));
vi.mock('../scripts/sync-snippets.js', () => ({ syncSnippets: vi.fn() }));

import { DIST, ROOT } from '../scripts/tools/config.js';
import { safeRmDirSync } from '../scripts/tools/safety.js';
import * as assetsBuilder from '../scripts/builders/assets.js';
import * as workbenchBuilder from '../scripts/builders/workbench.js';
import { fullBuild } from '../scripts/build.js';
import * as scssBuilder from '../scripts/builders/scss.js';

const buildCallsOnImport = assetsBuilder.buildGeneralCopy.mock.calls.length;

describe('Production Build Architecture & Error Handling', () => {
  let originalExitCode;

  afterAll(() => {
    if (existsSync(DIST)) safeRmDirSync(DIST, ROOT);
  });

  beforeEach(() => {
    vi.clearAllMocks();
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    vi.restoreAllMocks();
  });

  it('does not run builders when the pipeline module is imported', () => {
    expect(buildCallsOnImport).toBe(0);
  });

  it('halts production build with process.exitCode = 1 and returns false when a builder throws', async () => {
    // Mock buildScss to simulate an SCSS compilation error
    vi.spyOn(scssBuilder, 'buildScss').mockRejectedValueOnce(
      new Error('Sass compilation error: Undefined variable $accent-color at style.scss:10')
    );

    const result = await fullBuild();

    expect(result).toBe(false);
    expect(process.exitCode).toBe(1);
  });

  it('aggregates multiple step failures into a single batch report before halting', async () => {
    const ejsBuilder = await import('../scripts/builders/ejs.js');
    vi.spyOn(ejsBuilder, 'buildEjs').mockRejectedValueOnce(new Error('EJS syntax error in index.ejs'));
    vi.spyOn(scssBuilder, 'buildScss').mockRejectedValueOnce(new Error('SCSS missing semicolon in top.scss'));

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const result = await fullBuild();

    expect(result).toBe(false);
    expect(process.exitCode).toBe(1);

    // Verify both errors were logged in summary
    const errorLogs = consoleErrorSpy.mock.calls.map(call => call.join(' ')).join('\n');
    expect(errorLogs).toContain('[ejs] EJS syntax error in index.ejs');
    expect(errorLogs).toContain('[scss] SCSS missing semicolon in top.scss');
  });

  it('completes successfully and returns true when no tasks fail', async () => {
    const result = await fullBuild();
    expect(result).toBe(true);
    expect(process.exitCode).toBeUndefined();
    expect(assetsBuilder.buildGeneralCopy).toHaveBeenCalledTimes(1);
    expect(scssBuilder.buildScss).toHaveBeenCalledTimes(1);
    expect(assetsBuilder.buildImages).toHaveBeenCalledTimes(1);
    expect(workbenchBuilder.cleanWorkbench).toHaveBeenCalledTimes(1);
  });
});
