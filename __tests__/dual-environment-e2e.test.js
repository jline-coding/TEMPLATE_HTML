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

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'fs';
import { resolve } from 'path';
import * as sass from 'sass-embedded';
import {
  getRegistry,
  installComponent,
  saveComponent,
  findMatchingEjs,
  findMatchingScss,
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

    // Fixed fixtures keep these workflows independent of the user's component library.
    const scssRoot = resolve(sandboxDir, 'src/pages/assets/scss');
    const jsDir = resolve(sandboxDir, 'src/pages/assets/js');
    for (const name of ['global', 'foundation']) {
      mkdirSync(resolve(scssRoot, name), { recursive: true });
      writeFileSync(resolve(scssRoot, name, '_index.scss'), '// Test foundation\n', 'utf8');
    }
    const fixtures = [
      { name: 'btns', scss: 'btn', html: '<a class="c-btn">Button</a>', css: '.c-btn { display: inline-block; }' },
      { name: 'header', html: '<header class="c-header">Header</header>', css: '.c-header { display: block; padding: 20px; }', js: 'console.log("header");' },
      { name: 'bread', html: '<nav class="c-bread">Breadcrumb</nav>', css: '.c-bread { display: flex; }' },
      { name: 'titles', html: '<h2 class="c-title">Title</h2>', css: '.c-title { font-size: 24px; }' },
      { name: 'mv', html: '<section class="c-mv">Main visual</section>', css: '.c-mv { min-height: 200px; }' },
      { name: 'slider', html: '<div class="c-slider">Slider</div>', css: '.c-slider { overflow: hidden; }', js: 'console.log("slider");' },
      { name: 'grids', category: 'layout', html: '<div class="l-grid">Grid</div>', css: '.l-grid { display: grid; }' }
    ];
    for (const fixture of fixtures) {
      writeFileSync(resolve(sandboxPaths.wbComponentsDir, `_${fixture.name}.ejs`), fixture.html, 'utf8');
      const scssDir = fixture.category === 'layout' ? sandboxPaths.wbLayoutDir : sandboxPaths.wbScssDir;
      writeFileSync(resolve(scssDir, `_${fixture.scss || fixture.name}.scss`), fixture.css, 'utf8');
      if (fixture.js) writeFileSync(resolve(sandboxPaths.wbJsDir, `${fixture.name}.js`), fixture.js, 'utf8');
    }

    // Initialize empty client indexes and initial common.js
    writeFileSync(resolve(sandboxPaths.clientScssDir, '_index.scss'), '// Client Component SCSS Index\n', 'utf8');
    writeFileSync(resolve(sandboxPaths.clientLayoutDir, '_index.scss'), '// Client Layout SCSS Index\n', 'utf8');
    writeFileSync(resolve(jsDir, 'common.js'), `'use strict';\n// Initial common.js\n`, 'utf8');
  }

  beforeEach(() => {
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
    expect(registry).toHaveLength(7);

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
    // Prepare this round-trip independently of other tests.
    const originalRegistry = getRegistry(sandboxPaths);
    for (const comp of originalRegistry) {
      const result = installComponent(comp.name, { includeEjs: true, force: true }, sandboxPaths);
      expect(result.success).toBe(true);
    }

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

    // Export every installed fixture, including layout and JavaScript modules
    const componentsToExport = originalRegistry.map(comp => comp.name);

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
    expect(existsSync(resolve(sandboxPaths.wbLayoutDir, '_grids.scss'))).toBe(true);
    expect(existsSync(resolve(sandboxPaths.wbJsDir, 'header.js'))).toBe(true);
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
