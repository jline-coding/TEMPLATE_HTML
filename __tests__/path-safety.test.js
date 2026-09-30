import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { resolve } from 'path';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import {
  assertSafeOutputDir,
  safeRmDirSync,
  safeRmDir,
  isPathInside,
  resolveSafePath,
  assertSafePathInside,
  PROJECT_ROOT
} from '../scripts/tools/safety.js';
import { appendJsToTargetFile } from '../scripts/tools/component-service.js';
import { readFileSync } from 'fs';

describe('P0 Path Safety & Confinement Guards', () => {
  const dummyRoot = resolve(PROJECT_ROOT, 'test-sandbox-root');

  beforeEach(() => {
    if (!existsSync(dummyRoot)) {
      mkdirSync(dummyRoot, { recursive: true });
    }
  });

  afterEach(() => {
    if (existsSync(dummyRoot)) {
      rmSync(dummyRoot, { recursive: true, force: true });
    }
  });

  describe('assertSafeOutputDir()', () => {
    it('allows valid subdirectories intended for build output', () => {
      expect(assertSafeOutputDir(resolve(dummyRoot, 'public'), dummyRoot)).toBe(true);
      expect(assertSafeOutputDir(resolve(dummyRoot, 'dist'), dummyRoot)).toBe(true);
      expect(assertSafeOutputDir(resolve(dummyRoot, 'build/output'), dummyRoot)).toBe(true);
    });

    it('blocks deletion when target is exactly equal to project root', () => {
      expect(() => assertSafeOutputDir(dummyRoot, dummyRoot)).toThrow(/equal to Project Root/i);
      expect(() => assertSafeOutputDir(resolve(dummyRoot, '.'), dummyRoot)).toThrow(/equal to Project Root/i);
    });

    it('blocks directory traversal outside project root (e.g. "..", "../sibling")', () => {
      expect(() => assertSafeOutputDir(resolve(dummyRoot, '..'), dummyRoot)).toThrow(/outside Project Root/i);
      expect(() => assertSafeOutputDir(resolve(dummyRoot, '../../'), dummyRoot)).toThrow(/outside Project Root/i);
      expect(() => assertSafeOutputDir(resolve(dummyRoot, '../other-project'), dummyRoot)).toThrow(/outside Project Root/i);
    });

    it('blocks attempts to delete drive roots (e.g. "/", "C:\\", "D:\\")', () => {
      const driveRoot = resolve('/');
      expect(() => assertSafeOutputDir(driveRoot, dummyRoot)).toThrow(/filesystem drive\/root/i);
    });

    it('blocks protected core source directories (src, scripts, .git, node_modules)', () => {
      expect(() => assertSafeOutputDir(resolve(dummyRoot, 'src'), dummyRoot)).toThrow(/protected project folder "src"/i);
      expect(() => assertSafeOutputDir(resolve(dummyRoot, 'scripts'), dummyRoot)).toThrow(/protected project folder "scripts"/i);
      expect(() => assertSafeOutputDir(resolve(dummyRoot, '.git'), dummyRoot)).toThrow(/protected project folder "\.git"/i);
      expect(() => assertSafeOutputDir(resolve(dummyRoot, 'node_modules'), dummyRoot)).toThrow(/protected project folder "node_modules"/i);
      expect(() => assertSafeOutputDir(resolve(dummyRoot, 'workbench'), dummyRoot)).toThrow(/protected project folder "workbench"/i);
    });

    it('detects sneaky traversal tricks like "public/../src"', () => {
      expect(() => assertSafeOutputDir(resolve(dummyRoot, 'public/../src'), dummyRoot)).toThrow(/protected project folder "src"/i);
      expect(() => assertSafeOutputDir(resolve(dummyRoot, 'public/../../'), dummyRoot)).toThrow(/outside Project Root/i);
    });
  });

  describe('safeRmDirSync() and safeRmDir()', () => {
    it('safely deletes an existing safe output directory', async () => {
      const safeDir = resolve(dummyRoot, 'public');
      mkdirSync(safeDir, { recursive: true });
      writeFileSync(resolve(safeDir, 'test.txt'), 'hello');

      expect(existsSync(safeDir)).toBe(true);

      safeRmDirSync(safeDir, dummyRoot);
      expect(existsSync(safeDir)).toBe(false);

      // Async version
      mkdirSync(safeDir, { recursive: true });
      expect(existsSync(safeDir)).toBe(true);

      await safeRmDir(safeDir, dummyRoot);
      expect(existsSync(safeDir)).toBe(false);
    });

    it('aborts deletion and throws Security Error when attempting to delete an unsafe target', async () => {
      const unsafeTarget = resolve(dummyRoot, 'src');
      mkdirSync(unsafeTarget, { recursive: true });
      writeFileSync(resolve(unsafeTarget, 'keep-me.js'), 'important code');

      expect(() => safeRmDirSync(unsafeTarget, dummyRoot)).toThrow(/protected project folder/i);
      expect(existsSync(unsafeTarget)).toBe(true); // Verification: File was NOT touched!

      await expect(safeRmDir(unsafeTarget, dummyRoot)).rejects.toThrow(/protected project folder/i);
      expect(existsSync(unsafeTarget)).toBe(true); // Verification: File remains safe!
    });
  });

  describe('Path Traversal Prevention: isPathInside() & resolveSafePath()', () => {
    const allowedBase = resolve(dummyRoot, 'src/pages/assets/js');

    it('correctly validates safe subpaths inside allowed root', () => {
      expect(isPathInside('top.js', allowedBase)).toBe(true);
      expect(isPathInside('common.js', allowedBase)).toBe(true);
      expect(isPathInside('sub/nested.js', allowedBase)).toBe(true);

      const safePath = resolveSafePath(allowedBase, 'top.js', 'targetJsFile');
      expect(safePath).toBe(resolve(allowedBase, 'top.js'));
    });

    it('blocks directory traversal escaping allowed root (e.g. "../../package.json")', () => {
      expect(isPathInside('../../package.json', allowedBase)).toBe(false);
      expect(isPathInside('../../../something.js', allowedBase)).toBe(false);
      expect(isPathInside('sub/../../outside.js', allowedBase)).toBe(false);

      expect(() => resolveSafePath(allowedBase, '../../package.json', 'targetJsFile')).toThrow(/Path Traversal bị chặn/i);
      expect(() => resolveSafePath(allowedBase, '../../../something.js', 'targetJsFile')).toThrow(/Path Traversal bị chặn/i);
    });

    it('blocks absolute paths pointing outside allowed directory', () => {
      const outsideAbs = resolve(PROJECT_ROOT, 'package.json');
      expect(isPathInside(outsideAbs, allowedBase)).toBe(false);
      expect(() => resolveSafePath(allowedBase, outsideAbs, 'targetJsFile')).toThrow(/Path Traversal bị chặn/i);
    });

    it('blocks poison null bytes in paths', () => {
      expect(isPathInside('safe.js\0.exe', allowedBase)).toBe(false);
      expect(() => resolveSafePath(allowedBase, 'safe.js\0.exe', 'targetJsFile')).toThrow(/Poison Null Byte/i);
    });
  });

  describe('appendJsToTargetFile() Security Guard', () => {
    it('strictly refuses to write outside assets/js when path traversal input is passed', () => {
      const pkgPath = resolve(PROJECT_ROOT, 'package.json');
      const originalPkgContent = readFileSync(pkgPath, 'utf8');

      // Attempt attack: targetJsFile pointing to ../../package.json
      const result = appendJsToTargetFile('../../package.json', 'exploit', 'alert("hacked")');

      expect(result.success).toBe(false);
      expect(result.message).toContain('[SECURITY] Path Traversal bị chặn');

      // VERIFY: package.json remains 100% untouched!
      const currentPkgContent = readFileSync(pkgPath, 'utf8');
      expect(currentPkgContent).toBe(originalPkgContent);
      expect(currentPkgContent).not.toContain('exploit');
      expect(currentPkgContent).not.toContain('alert("hacked")');
    });

    it('strictly refuses when path traversal uses subpath escape', () => {
      const result = appendJsToTargetFile('common.js/../../readme.md', 'exploit', 'alert("hacked")');
      expect(result.success).toBe(false);
      expect(result.message).toContain('[SECURITY] Path Traversal bị chặn');
    });
  });
});
