import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fullBuild } from '../scripts/build.js';
import * as scssBuilder from '../scripts/builders/scss.js';

describe('Production Build Architecture & Error Handling', () => {
  let originalExitCode;

  beforeEach(() => {
    originalExitCode = process.exitCode;
    process.exitCode = undefined;
  });

  afterEach(() => {
    process.exitCode = originalExitCode;
    vi.restoreAllMocks();
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
  });
});
