/**
 * __tests__/dual-environment-e2e.test.js
 * End-to-End Regression Test Suite for Dual-Environment Architecture
 * 
 * Verifies complete two-way round-trip workflows in a 100% isolated sandbox:
 * 1. Round-Trip A (Purge Site & Import from Workbench) -> Full SCSS Compilation
 * 2. Round-Trip B (Purge Workbench & Export from Site) -> Catalog Integrity
 * 3. Singular / Plural Name Resilience (btn vs btns, tbl vs tbls)
 * 4. Vendor Dependency Emitted Notice & Metadata
 * 5. Transaction Safety & Clean Rollback on Failure
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, rmSync } from 'fs';
import { resolve } from 'path';
import * as sass from 'sass-embedded';
import {
  getRegistry,
  installComponent,
  removeComponent,
  saveComponent,
  resolveComponentVendors,
  findMatchingEjs,
  findMatchingScss,
  findMatchingJs,
  InstallTransaction
} from '../scripts/tools/component-service.js';
import { safeRmDirSync, PROJECT_ROOT } from '../scripts/tools/safety.js';

describe('Dual-Environment End-to-End Round-Trip (Site ⇄ Workbench)', () => {
  const sandboxDir = resolve(PROJECT_ROOT, 'test-sandbox-dual-e2e');
  const sandboxPaths = {
    root: sandboxDir,
    wbDir: resolve(sandboxDir, 'workbench'),
    wbComponentsDir: resolve(sandboxDir, 'workbench/components'),
    wbScssDir: resolve(sandboxDir, 'workbench/scss/component'),
    wbLayoutDir: resolve(sandboxDir, 'workbench/scss/layout'),
    wbJsDir: resolve(sandboxDir, 'workbench/js'),
    clientComponentsDir: resolve(sandboxDir, 'src/components'),
    clientScssDir: resolve(sandboxDir, 'src/pages/assets/scss/component'),
    clientLayoutDir: resolve(sandboxDir, 'src/pages/assets/scss/layout'),
    clientJsDir: resolve(sandboxDir, 'src/pages/assets/js/component')
  };

  function setupIsolatedSandbox() {
    if (existsSync(sandboxDir)) {
      safeRmDirSync(sandboxDir, PROJECT_ROOT);
    }

    Object.values(sandboxPaths).forEach(d => mkdirSync(d, { recursive: true }));

    // Setup global, foundation, utilities SCSS
    const globalDir = resolve(sandboxDir, 'src/pages/assets/scss/global');
    const foundDir = resolve(sandboxDir, 'src/pages/assets/scss/foundation');
    const utilDir = resolve(sandboxDir, 'src/pages/assets/scss/utilities');
    const jsDir = resolve(sandboxDir, 'src/pages/assets/js');
    [globalDir, foundDir, utilDir, jsDir].forEach(d => mkdirSync(d, { recursive: true }));

    // Copy globals and foundations from real workspace
    const realGlobal = resolve(PROJECT_ROOT, 'src/pages/assets/scss/global');
    if (existsSync(realGlobal)) {
      readdirSync(realGlobal).forEach(f => {
        writeFileSync(resolve(globalDir, f), readFileSync(resolve(realGlobal, f)));
      });
    }

    const realFound = resolve(PROJECT_ROOT, 'src/pages/assets/scss/foundation');
    if (existsSync(realFound)) {
      readdirSync(realFound).forEach(f => {
        writeFileSync(resolve(foundDir, f), readFileSync(resolve(realFound, f)));
      });
    }

    const realUtil = resolve(PROJECT_ROOT, 'src/pages/assets/scss/utilities');
    if (existsSync(realUtil)) {
      readdirSync(realUtil).forEach(f => {
        writeFileSync(resolve(utilDir, f), readFileSync(resolve(realUtil, f)));
      });
    }

    // Copy workbench templates from canonical backup or real workspace
    const wbSourceDir = (existsSync(resolve(PROJECT_ROOT, 'workbench__backup/components')) && readdirSync(resolve(PROJECT_ROOT, 'workbench__backup/components')).length >= 20)
      ? resolve(PROJECT_ROOT, 'workbench__backup')
      : resolve(PROJECT_ROOT, 'workbench');

    const srcWbComp = resolve(wbSourceDir, 'components');
    if (existsSync(srcWbComp)) {
      readdirSync(srcWbComp).forEach(f => {
        writeFileSync(resolve(sandboxPaths.wbComponentsDir, f), readFileSync(resolve(srcWbComp, f)));
      });
    }

    const srcWbScssComp = resolve(wbSourceDir, 'scss/component');
    if (existsSync(srcWbScssComp)) {
      readdirSync(srcWbScssComp).forEach(f => {
        writeFileSync(resolve(sandboxPaths.wbScssDir, f), readFileSync(resolve(srcWbScssComp, f)));
      });
    }

    const srcWbScssLayout = resolve(wbSourceDir, 'scss/layout');
    if (existsSync(srcWbScssLayout)) {
      readdirSync(srcWbScssLayout).forEach(f => {
        writeFileSync(resolve(sandboxPaths.wbLayoutDir, f), readFileSync(resolve(srcWbScssLayout, f)));
      });
    }

    const srcWbJs = resolve(wbSourceDir, 'js');
    if (existsSync(srcWbJs)) {
      readdirSync(srcWbJs).forEach(f => {
        writeFileSync(resolve(sandboxPaths.wbJsDir, f), readFileSync(resolve(srcWbJs, f)));
      });
    }

    // Initialize empty client indexes and initial common.js
    writeFileSync(resolve(sandboxPaths.clientScssDir, '_index.scss'), '// Client Component SCSS Index\n', 'utf8');
    writeFileSync(resolve(sandboxPaths.clientLayoutDir, '_index.scss'), '// Client Layout SCSS Index\n', 'utf8');
    writeFileSync(resolve(jsDir, 'common.js'), `'use strict';\n// Initial common.js\n`, 'utf8');
  }

  beforeAll(() => {
    setupIsolatedSandbox();
  });

  afterAll(async () => {
    await new Promise(r => setTimeout(r, 100));
    if (existsSync(sandboxDir)) {
      try {
        safeRmDirSync(sandboxDir, PROJECT_ROOT);
      } catch {
        try {
          rmSync(sandboxDir, { recursive: true, force: true });
        } catch {}
      }
    }
  });

  // ─────────────────────────────────────────────────────────────
  // 1. ROUND-TRIP A: PURGE SITE & IMPORT FROM WORKBENCH -> SITE
  // ─────────────────────────────────────────────────────────────
  it('Round-Trip A: installs all components from Workbench into empty Site and compiles SCSS cleanly', async () => {
    const registry = getRegistry(sandboxPaths);
    expect(registry.length).toBeGreaterThanOrEqual(1);

    // Install every component into the empty site
    for (const comp of registry) {
      const res = installComponent(
        comp.name,
        { includeEjs: true, targetJsFile: 'common.js', force: true },
        sandboxPaths
      );

      expect(res.success).toBe(true);
      expect(res.name).toBeDefined();

      // If slider, verify vendor requirements are emitted
      if (comp.name === 'slider') {
        expect(res.vendors).toBeDefined();
        expect(res.vendors.css).toContain('slick/slick');
        expect(res.vendors.js).toContain('slick/slick.min');
        expect(res.message).toContain("vendorcss: ['slick/slick']");
      }
    }

    // Compile client SCSS to verify 100% build integrity
    const testScssCode = `
      @use "sass:math";
      @use "global" as *;
      @use "foundation";
      @use "component";
      @use "layout";
    `;

    const compileResult = await sass.compileStringAsync(testScssCode, {
      loadPaths: [
        resolve(sandboxDir, 'src/pages/assets/scss')
      ],
      style: 'expanded'
    });

    expect(compileResult.css).toBeDefined();
    expect(compileResult.css.length).toBeGreaterThan(100);
    expect(compileResult.css).toContain('.c-header');
    expect(compileResult.css).toContain('.c-title');
  });

  // ─────────────────────────────────────────────────────────────
  // 2. SINGULAR / PLURAL RESOLUTION TEST
  // ─────────────────────────────────────────────────────────────
  it('handles singular and plural component names gracefully during installation and discovery', () => {
    // bread vs breads
    const ejsBread = findMatchingEjs('bread', sandboxPaths.wbComponentsDir);
    const ejsBreads = findMatchingEjs('breads', sandboxPaths.wbComponentsDir);
    expect(ejsBread).toBe('_bread.ejs');
    expect(ejsBreads).toBe('_bread.ejs');

    const scssHeader = findMatchingScss('header', sandboxPaths.wbScssDir);
    const scssHeaders = findMatchingScss('headers', sandboxPaths.wbScssDir);
    expect(scssHeader).toBe('_header.scss');
    expect(scssHeaders).toBe('_header.scss');

    const scssTitle = findMatchingScss('title', sandboxPaths.wbScssDir);
    const scssTitles = findMatchingScss('titles', sandboxPaths.wbScssDir);
    expect(scssTitle).toBe('_titles.scss');
    expect(scssTitles).toBe('_titles.scss');
  });

  // ─────────────────────────────────────────────────────────────
  // 3. ROUND-TRIP B: PURGE WORKBENCH & EXPORT FROM SITE -> WORKBENCH
  // ─────────────────────────────────────────────────────────────
  it('Round-Trip B: exports all installed components from Site back to empty Workbench showroom', () => {
    // Purge sandbox workbench completely
    safeRmDirSync(sandboxPaths.wbComponentsDir, PROJECT_ROOT);
    safeRmDirSync(sandboxPaths.wbScssDir, PROJECT_ROOT);
    safeRmDirSync(sandboxPaths.wbLayoutDir, PROJECT_ROOT);
    safeRmDirSync(sandboxPaths.wbJsDir, PROJECT_ROOT);

    mkdirSync(sandboxPaths.wbComponentsDir, { recursive: true });
    mkdirSync(sandboxPaths.wbScssDir, { recursive: true });
    mkdirSync(sandboxPaths.wbLayoutDir, { recursive: true });
    mkdirSync(sandboxPaths.wbJsDir, { recursive: true });

    // Initialize workbench SCSS indexes
    writeFileSync(resolve(sandboxPaths.wbScssDir, '_index.scss'), '// WB Component SCSS\n', 'utf8');
    writeFileSync(resolve(sandboxPaths.wbLayoutDir, '_index.scss'), '// WB Layout SCSS\n', 'utf8');

    // List of components that were installed in Round-Trip A
    const componentsToExport = ['header', 'bread', 'titles', 'mv'];

    let successCount = 0;
    for (const compName of componentsToExport) {
      const res = saveComponent(compName, { force: true }, sandboxPaths);
      if (res.success) {
        successCount++;
      }
    }

    expect(successCount).toBe(componentsToExport.length);

    // Verify workbench discovery finds exported components
    const restoredRegistry = getRegistry(sandboxPaths);
    expect(restoredRegistry.length).toBeGreaterThanOrEqual(componentsToExport.length);

    const exportedTitles = restoredRegistry.find(r => r.name === 'titles');
    expect(exportedTitles).toBeDefined();
    expect(exportedTitles.scssFile).toBe('_titles.scss');
  });

  // ─────────────────────────────────────────────────────────────
  // 4. TRANSACTION ATOMICITY & ROLLBACK GUARD
  // ─────────────────────────────────────────────────────────────
  it('Transaction Guard: rolls back all modifications cleanly if a step or dependency fails', () => {
    const tx = new InstallTransaction();
    const testFile = resolve(sandboxPaths.clientScssDir, '_temp_tx_test.scss');

    tx.recordCreated(testFile);
    writeFileSync(testFile, '/* Temporary */', 'utf8');
    expect(existsSync(testFile)).toBe(true);

    // Rollback
    tx.rollback();
    expect(existsSync(testFile)).toBe(false);
  });
});
