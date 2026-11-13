import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { existsSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const state = vi.hoisted(() => ({
  dip: true,
  renew: false,
  watchers: [],
  reload: vi.fn()
}));

vi.mock('../scripts/tools/config.js', async importOriginal => {
  const config = await importOriginal();
  const { mkdtempSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const sandbox = mkdtempSync(resolve(config.ROOT, 'test-sandbox-dip-watch-'));
  return {
    ...config,
    ROOT: sandbox,
    SRC: resolve(sandbox, 'src'),
    DIST: resolve(sandbox, 'public'),
    WORKBENCH_DIR: resolve(sandbox, 'missing-workbench'),
    isWatch: true,
    get isRenew() { return state.renew; },
    get DIP() { return state.dip && !state.renew; },
    DIP_PO: 'op611432'
  };
});
vi.mock('chokidar', () => ({
  watch: (paths, options) => {
    const watcher = {
      paths, options, handlers: {},
      on(event, handler) { this.handlers[event] = handler; return this; }
    };
    state.watchers.push(watcher);
    return watcher;
  }
}));
vi.mock('browser-sync', () => ({
  default: { create: () => ({ init: vi.fn(), reload: state.reload }) }
}));
vi.mock('net', () => ({
  createServer: () => ({
    once(event, callback) { this[event] = callback; return this; },
    listen() { this.listening(); },
    close() {}
  })
}));
vi.mock('../scripts/tools/install-extension.js', () => ({ installExtension: vi.fn() }));
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

import { startWatch } from '../scripts/build.js';
import { buildEjs } from '../scripts/builders/ejs.js';
import { buildGeneralCopy } from '../scripts/builders/assets.js';
import { DIST, ROOT, SRC } from '../scripts/tools/config.js';
import { PROJECT_ROOT, safeRmDirSync } from '../scripts/tools/safety.js';

beforeEach(() => {
  vi.useFakeTimers();
  vi.clearAllMocks();
  state.dip = true;
  state.renew = false;
  state.watchers.length = 0;
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
afterAll(() => {
  if (existsSync(ROOT)) safeRmDirSync(ROOT, PROJECT_ROOT);
});

describe('DIP config live reload isolation', () => {
  it.each(['change', 'add', 'unlink'])('rebuilds pages on config %s without copying or deleting other output', async event => {
    await startWatch();
    const watcher = state.watchers[0];
    const configPath = resolve(ROOT, 'dip-config.js');
    expect(watcher.paths).toEqual(['.', configPath]);
    vi.clearAllMocks();
    watcher.handlers[event](relative(SRC, configPath));
    await vi.advanceTimersByTimeAsync(500);
    expect(buildEjs).toHaveBeenCalledExactlyOnceWith();
    expect(buildGeneralCopy).not.toHaveBeenCalled();
    expect(state.reload).toHaveBeenCalledOnce();
    expect(existsSync(DIST)).toBe(true);
  });

  it.each(['disabled', 'renew'])('keeps the original source-only watcher for %s mode', async mode => {
    if (mode === 'disabled') state.dip = false;
    else state.renew = true;
    await startWatch();
    expect(state.watchers[0].paths).toBe('.');
    if (mode === 'renew') expect(buildEjs).not.toHaveBeenCalled();
  });

  it('keeps watching after a config build error and reloads after the next successful edit', async () => {
    await startWatch();
    vi.clearAllMocks();
    const watcher = state.watchers[0];
    const configPath = relative(SRC, resolve(ROOT, 'dip-config.js'));
    buildEjs.mockRejectedValueOnce(new Error('Invalid DIP config'));
    watcher.handlers.change(configPath);
    await vi.advanceTimersByTimeAsync(500);
    expect(state.reload).not.toHaveBeenCalled();
    watcher.handlers.change(configPath);
    await vi.advanceTimersByTimeAsync(500);
    expect(state.reload).toHaveBeenCalledOnce();
  });
});
