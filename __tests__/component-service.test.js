import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { existsSync, readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'fs';
import { resolve } from 'path';
import {
  getRegistry,
  installComponent,
  removeComponent,
  saveComponent,
  getComponentCategory,
  updateClientScssIndex,
  updateWorkbenchScss,
  sliceScssForClasses,
  mergeVariantScss,
  isVariantInstalled,
  installVariant,
  COMPONENT_DEPENDENCIES,
  COMPONENT_SCHEMA_VERSION,
  generateComponentId,
  getAvailableJsFiles,
  appendJsToTargetFile,
  normalizeCodeForDiff,
  createSnapshotBackup,
  deleteWorkbenchComponent,
  deleteWorkbenchVariant,
  parseEjsComponentCards,
  removeVariantFromEjs,
  parseComponentMetadata,
  formatComponentMetadata,
  InstallTransaction
} from '../scripts/tools/component-service.js';
import { safeRmDirSync, PROJECT_ROOT } from '../scripts/tools/safety.js';

describe('Component Engine (Isolated Fixture Testing & Specification)', () => {
  // Purely isolated sandbox directory: REAL src/ and workbench/ are NEVER touched!
  const sandboxDir = resolve(PROJECT_ROOT, 'test-sandbox-component');
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

  const accordionScssPath = resolve(sandboxPaths.clientScssDir, '_accordion.scss');
  const accordionJsPath = resolve(sandboxPaths.clientJsDir, 'accordion.js');
  const scssIndexPath = resolve(sandboxPaths.clientScssDir, '_index.scss');

  const fixtureFiles = [
    { dir: sandboxPaths.wbComponentsDir, file: '_accordion.ejs', content: '<!--\n---\nid: "c-accordion"\nversion: "1.2.0"\nschemaVersion: "1.0.0"\n---\n-->\n<div class="c-accordion">Sample Accordion</div>' },
    { dir: sandboxPaths.wbScssDir, file: '_accordion.scss', content: '@use "../global" as *;\n.c-accordion { display: block; }\n.c-accordion--bordered { border: 1px solid #ccc; }' },
    { dir: sandboxPaths.wbJsDir, file: 'accordion.js', content: 'console.log("c-accordion");' },
    { dir: sandboxPaths.wbComponentsDir, file: '_header.ejs', content: '<!--\n---\nid: "c-header"\nversion: "2.0.0"\ndependencies: ["gnavi", "btns"]\n---\n-->\n<header class="c-header">Header</header>' },
    { dir: sandboxPaths.wbScssDir, file: '_header.scss', content: '@use "../global" as *;\n.c-header { display: block; }' },
    { dir: sandboxPaths.wbComponentsDir, file: '_gnavi.ejs', content: '<nav class="c-gnavi">Gnavi</nav>' },
    { dir: sandboxPaths.wbScssDir, file: '_gnavi.scss', content: '@use "../global" as *;\n.c-gnavi { display: block; }' },
    { dir: sandboxPaths.wbJsDir, file: 'gnavi.js', content: 'console.log("gnavi");' },
    { dir: sandboxPaths.wbComponentsDir, file: '_btns.ejs', content: '<a class="c-btn">Btn</a>' },
    { dir: sandboxPaths.wbScssDir, file: '_btn.scss', content: '@use "../global" as *;\n.c-btn { display: inline-block; }' },
    { dir: sandboxPaths.wbComponentsDir, file: '_flexs.ejs', content: '<div class="l-flex">Flex</div>' },
    { dir: sandboxPaths.wbLayoutDir, file: '_flexs.scss', content: '@use "../global" as *;\n.l-flex { display: flex; }' },
    { dir: sandboxPaths.wbComponentsDir, file: '_grids.ejs', content: '<div class="l-grid">Grid</div>' },
    { dir: sandboxPaths.wbLayoutDir, file: '_grids.scss', content: '@use "../global" as *;\n.l-grid { display: grid; }' }
  ];

  function setupSandbox() {
    Object.values(sandboxPaths).forEach(d => {
      if (!existsSync(d)) mkdirSync(d, { recursive: true });
    });
    // Write index files
    writeFileSync(resolve(sandboxPaths.wbScssDir, '_index.scss'), '// Component SCSS\n', 'utf8');
    writeFileSync(resolve(sandboxPaths.wbLayoutDir, '_index.scss'), '// Layout SCSS\n', 'utf8');
    writeFileSync(scssIndexPath, '// Client SCSS\n', 'utf8');

    for (const f of fixtureFiles) {
      writeFileSync(resolve(f.dir, f.file), f.content, 'utf8');
    }
  }

  beforeAll(() => {
    setupSandbox();
  });

  afterAll(() => {
    // Clean up entire isolated test sandbox
    if (existsSync(sandboxDir)) {
      try {
        safeRmDirSync(sandboxDir, PROJECT_ROOT);
      } catch {}
    }
  });

  describe('Component Sharing & Specification (ID, Version, Schema, Dependencies)', () => {
    it('standardizes component id, version, schemaVersion and dependencies in parseComponentMetadata', () => {
      const ejs = `<!--\n---\nid: "c-card"\nversion: "1.1.0"\ndependencies: ["c-btn"]\n---\n-->\n<div class="c-card">Card</div>`;
      const { meta, content } = parseComponentMetadata(ejs);

      expect(meta.id).toBe('c-card');
      expect(meta.version).toBe('1.1.0');
      expect(meta.schemaVersion).toBe(COMPONENT_SCHEMA_VERSION);
      expect(meta.dependencies).toEqual(['c-btn']);
      expect(content).toBe('<div class="c-card">Card</div>');
    });

    it('generates standard component ID from name and category', () => {
      expect(generateComponentId('header', 'header')).toBe('c-header');
      expect(generateComponentId('btn', 'component')).toBe('c-btn');
      expect(generateComponentId('flexs', 'layout')).toBe('l-flexs');
      expect(generateComponentId('c-card', 'component')).toBe('c-card');
    });

    it('correctly serializes metadata in formatComponentMetadata', () => {
      const formatted = formatComponentMetadata({
        id: 'c-hero',
        version: '1.0.0',
        category: 'component',
        dependencies: ['c-btn']
      }, '<div class="c-hero">Hero</div>');

      expect(formatted).toContain('id: "c-hero"');
      expect(formatted).toContain('version: "1.0.0"');
      expect(formatted).toContain('schemaVersion: "1.0.0"');
      expect(formatted).toContain('<div class="c-hero">Hero</div>');
    });
  });

  describe('Categorization & Dual Environment Paths', () => {
    it('correctly categorizes components into header, footer, layout, component', () => {
      expect(getComponentCategory('header')).toBe('header');
      expect(getComponentCategory('gnavi')).toBe('header');
      expect(getComponentCategory('footer')).toBe('footer');
      expect(getComponentCategory('flexs')).toBe('layout');
      expect(getComponentCategory('grids')).toBe('layout');
      expect(getComponentCategory('tbls')).toBe('layout');
      expect(getComponentCategory('sidebar')).toBe('layout');
      expect(getComponentCategory('accordion')).toBe('component');
      expect(getComponentCategory('btns')).toBe('component');
    });
  });

  describe('Transactional Component Installation & Automatic Rollback on Failure', () => {
    it('installs component cleanly when no errors occur', () => {
      const result = installComponent('accordion', { force: true }, sandboxPaths);

      expect(result.success).toBe(true);
      expect(existsSync(accordionScssPath)).toBe(true);
      expect(existsSync(accordionJsPath)).toBe(true);

      const scssIndex = readFileSync(scssIndexPath, 'utf8');
      expect(scssIndex).toContain('@use "accordion";');
    });

    it('automatically rolls back all filesystem modifications when an install step fails midway', () => {
      // Setup initial state: clean accordion files
      if (existsSync(accordionScssPath)) unlinkSync(accordionScssPath);
      if (existsSync(accordionJsPath)) unlinkSync(accordionJsPath);
      writeFileSync(scssIndexPath, '// Clean State\n', 'utf8');

      // Intentional failure: pass an invalid targetJsFile with path traversal
      const result = installComponent('accordion', {
        force: true,
        targetJsFile: '../../outside.js'
      }, sandboxPaths);

      expect(result.success).toBe(false);
      expect(result.rolledBack).toBe(true);

      // VERIFY ROLLBACK: SCSS file was cleaned up and not left orphaned!
      expect(existsSync(accordionScssPath)).toBe(false);
      expect(existsSync(accordionJsPath)).toBe(false);

      // VERIFY ROLLBACK: _index.scss was restored to original clean state!
      const scssIndex = readFileSync(scssIndexPath, 'utf8');
      expect(scssIndex).not.toContain('@use "accordion";');
      expect(scssIndex).toBe('// Clean State\n');
    });

    it('automatically installs prerequisite dependencies (Component Dependencies map)', () => {
      const result = installComponent('header', { force: true }, sandboxPaths);

      expect(result.success).toBe(true);
      expect(result.installedDependencies).toContain('gnavi');
      expect(result.installedDependencies).toContain('btns');

      // Header, Gnavi, and Btns should all be present in sandbox
      expect(existsSync(resolve(sandboxPaths.clientScssDir, '_header.scss'))).toBe(true);
      expect(existsSync(resolve(sandboxPaths.clientScssDir, '_gnavi.scss'))).toBe(true);
      expect(existsSync(resolve(sandboxPaths.clientScssDir, '_btn.scss'))).toBe(true);
    });
  });

  describe('Registry, Status Calculation & Diff Details', () => {
    it('computes installed, latestVersion, and diffDetails in getRegistry()', () => {
      installComponent('accordion', { force: true }, sandboxPaths);
      const registry = getRegistry(sandboxPaths);
      expect(Array.isArray(registry)).toBe(true);

      const acc = registry.find(r => r.name === 'accordion');
      expect(acc).toBeDefined();
      expect(acc.id).toBe('c-accordion');
      expect(acc.version).toBe('1.2.0');
      expect(acc.isInstalled).toBe(true);
      expect(acc.syncStatus).toBe('synced');
      expect(acc.diffDetails).toBeDefined();
      expect(acc.diffDetails.scssDiff).toBe(false);
    });

    it('detects diverged status when client SCSS is modified (Drift Detection)', () => {
      // Modify client SCSS
      writeFileSync(accordionScssPath, '.c-accordion { display: flex; color: red; }', 'utf8');

      const registry = getRegistry(sandboxPaths);
      const acc = registry.find(r => r.name === 'accordion');

      expect(acc.isInstalled).toBe(true);
      expect(acc.syncStatus).toBe('diverged');
      expect(acc.diffDetails.scssDiff).toBe(true);
    });
  });

  describe('Variant Extraction & SCSS Slicing', () => {
    it('slices only the active variant modifier from full SCSS', () => {
      const full = `.c-accordion {\n  display: block;\n  &--bordered {\n    border: 1px solid #000;\n  }\n  &--rounded {\n    border-radius: 8px;\n  }\n}`;
      const sliced = sliceScssForClasses(full, 'c-accordion c-accordion--bordered');

      expect(sliced).toContain('&--bordered');
      expect(sliced).not.toContain('&--rounded');
    });

    it('merges new variant into existing SCSS without duplicate base rules', () => {
      const existing = `.c-accordion {\n    display: block;\n}\n`;
      const incoming = `.c-accordion {\n    display: block;\n    &--dark {\n        background: #000;\n    }\n}\n`;
      const merged = mergeVariantScss(existing, incoming, 'c-accordion--dark');

      expect(merged).toContain('&--dark');
      // Should not duplicate .c-accordion root block
      const count = (merged.match(/\.c-accordion/g) || []).length;
      expect(count).toBe(1);
    });
  });

  describe('Safe Removal & Conflict Guard', () => {
    it('blocks accidental deletion without --force when client has customized edits', () => {
      // Client has custom edits from earlier test
      const result = removeComponent('accordion', { force: false }, sandboxPaths);

      expect(result.success).toBe(false);
      expect(result.conflict).toBe(true);
      expect(existsSync(accordionScssPath)).toBe(true); // Verifies file is saved!
    });

    it('removes component cleanly when --force is provided', () => {
      const result = removeComponent('accordion', { force: true }, sandboxPaths);

      expect(result.success).toBe(true);
      expect(existsSync(accordionScssPath)).toBe(false);

      const scssIndex = readFileSync(scssIndexPath, 'utf8');
      expect(scssIndex).not.toContain('@use "accordion";');
    });
  });

  describe('Snapshot Backup Engine', () => {
    it('creates automatic timestamped backup in .backup directory', () => {
      const backupDir = createSnapshotBackup('accordion', 'test_run', sandboxPaths);

      expect(backupDir).toBeTruthy();
      expect(existsSync(backupDir)).toBe(true);
      expect(existsSync(resolve(backupDir, '_accordion.ejs'))).toBe(true);
      expect(existsSync(resolve(backupDir, '_accordion.scss'))).toBe(true);
    });
  });
});
