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
  mergeComponentScss,
  findMatchingJs,
  findMatchingEjs,
  isVariantInstalled,
  installVariant,
  COMPONENT_DEPENDENCIES,
  COMPONENT_SCHEMA_VERSION,
  resolveComponentDependencies,
  resolveComponentVendors,
  COMPONENT_VENDORS,
  generateComponentId,
  getAvailableJsFiles,
  appendJsToTargetFile,
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
    { dir: sandboxPaths.wbLayoutDir, file: '_grids.scss', content: '@use "../global" as *;\n.l-grid { display: grid; }' },
    { dir: sandboxPaths.wbComponentsDir, file: '_slider.ejs', content: '<!--\n---\nid: "c-slider"\nversion: "1.0.0"\nvendors:\n  css: ["slick/slick"]\n  js: ["slick/slick.min"]\n---\n-->\n<div class="c-slider">Slider</div>' },
    { dir: sandboxPaths.wbScssDir, file: '_slider.scss', content: '@use "../global" as *;\n.c-slider { display: block; }' }
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

    it('intelligently resolves dependencies across 3 tiers (Frontmatter > Auto-detection > Fallback)', () => {
      // Tier 1: Explicit Frontmatter overrides everything
      const explicitMeta = { dependencies: ['popup', 'slider'] };
      expect(resolveComponentDependencies('custom', explicitMeta, '<a class="c-btn">Btn</a>')).toEqual(['popup', 'slider']);

      // Tier 1: Explicit empty array means NO dependencies even if classes exist
      const emptyMeta = { dependencies: [] };
      expect(resolveComponentDependencies('header', emptyMeta, '<a class="c-btn">Btn</a>')).toEqual([]);

      // Tier 2: Auto-detect classes from HTML content when not declared in frontmatter
      const autoHtml = '<header class="c-header"><a class="c-btn">Contact</a><div class="c-header-gnavi"></div></header>';
      expect(resolveComponentDependencies('header', {}, autoHtml)).toEqual(['btns']);

      // Tier 2: Auto-detect multiple classes
      const multiHtml = '<div class="c-banner"><a class="c-btn">Click</a><div class="c-modal">Popup</div></div>';
      expect(resolveComponentDependencies('banner', {}, multiHtml)).toEqual(['btns', 'popup']);

      // Tier 3: Fallback from dictionary when no frontmatter and no auto-detected classes
      expect(resolveComponentDependencies('footer', {}, '<footer>Plain</footer>')).toEqual(['btns']);
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

  describe('Registry & Installation Status', () => {
    it('computes isInstalled and metadata in getRegistry()', () => {
      installComponent('accordion', { force: true }, sandboxPaths);
      const registry = getRegistry(sandboxPaths);
      expect(Array.isArray(registry)).toBe(true);

      const acc = registry.find(r => r.name === 'accordion');
      expect(acc).toBeDefined();
      expect(acc.id).toBe('c-accordion');
      expect(acc.version).toBe('1.2.0');
      expect(acc.isInstalled).toBe(true);
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

  describe('Non-Destructive SCSS & JS Safe Import Engine', () => {
    it('mergeComponentScss preserves existing @use and header banner and appends incoming rules cleanly', () => {
      const userStub = `@use "sass:math";\n@use "../global" as *;\n\n/*!\ncomponent > header\n------------------------------\n*/\n`;
      const incomingScss = `@use "sass:math";\n@use "../global" as *;\n\n.c-header {\n    background: #fff;\n}\n`;

      const result = mergeComponentScss(userStub, incomingScss, 'header');

      expect(result).toContain('@use "sass:math";');
      expect(result).toContain('@use "../global" as *;');
      expect(result).toContain('component > header');
      expect(result).toContain('.c-header {');
      expect(result.trim().endsWith('}'));
    });

    it('mergeComponentScss generates required @use and banner when target file is brand new', () => {
      const incomingScss = `.c-card {\n    padding: 10px;\n}\n`;
      const result = mergeComponentScss('', incomingScss, 'card');

      expect(result).toContain('@use "sass:math";');
      expect(result).toContain('@use "../global" as *;');
      expect(result).toContain('component > card');
      expect(result).toContain('.c-card {');
    });

    it('mergeComponentScss appends to existing custom code without overwriting it', () => {
      const existing = `@use "sass:math";\n@use "../global" as *;\n\n.my-custom-style {\n    color: red;\n}\n`;
      const incoming = `.c-badge {\n    font-size: 12px;\n}\n`;

      const result = mergeComponentScss(existing, incoming, 'badge');

      expect(result).toContain('.my-custom-style');
      expect(result).toContain('.c-badge');
      expect(result.indexOf('.my-custom-style')).toBeLessThan(result.indexOf('.c-badge'));
    });

    it('findMatchingJs discovers component marker inside shared common.js', () => {
      const testJsDir = resolve(sandboxDir, 'test-js');
      mkdirSync(testJsDir, { recursive: true });
      writeFileSync(resolve(testJsDir, 'common.js'), `/* [Component: header] */\nconsole.log('header');`, 'utf8');

      const matched = findMatchingJs('header', testJsDir);
      expect(matched).toBe('common.js');
    });

    it('appendJsToTargetFile appends component JS logic cleanly to target file', () => {
      const jsDir = resolve(sandboxPaths.root, 'src/pages/assets/js');
      mkdirSync(jsDir, { recursive: true });
      const commonPath = resolve(jsDir, 'common.js');
      writeFileSync(commonPath, `// Initial site JS\nconsole.log('init');\n`, 'utf8');

      const appendRes = appendJsToTargetFile('common.js', 'header', `$('.c-header').show();`, sandboxPaths);
      expect(appendRes.success).toBe(true);

      const updated = readFileSync(commonPath, 'utf8');
      expect(updated).toContain('// Initial site JS');
      expect(updated).toContain('[Component: header]');
      expect(updated).toContain("$('.c-header').show();");
    });

    it('findMatchingEjs discovers singular and plural file names correctly', () => {
      const testEjsDir = resolve(sandboxDir, 'test-ejs');
      mkdirSync(testEjsDir, { recursive: true });
      writeFileSync(resolve(testEjsDir, '_btn.ejs'), '<div>Btn</div>', 'utf8');
      writeFileSync(resolve(testEjsDir, '_tbls.ejs'), '<table>Tbls</table>', 'utf8');

      expect(findMatchingEjs('btn', testEjsDir)).toBe('_btn.ejs');
      expect(findMatchingEjs('btns', testEjsDir)).toBe('_btn.ejs');
      expect(findMatchingEjs('tbls', testEjsDir)).toBe('_tbls.ejs');
      expect(findMatchingEjs('tbl', testEjsDir)).toBe('_tbls.ejs');
      expect(findMatchingEjs('nonexistent', testEjsDir)).toBeNull();
    });

    it('verifies workbench _container.scss and _titles.scss integrity', () => {
      const containerPath = resolve(PROJECT_ROOT, 'workbench/scss/layout/_container.scss');
      const containerContent = readFileSync(containerPath, 'utf8');
      expect(containerContent).not.toContain('@forward "../../../src/pages');
      expect(containerContent).toContain('.l-container');

      const titlesPath = existsSync(resolve(PROJECT_ROOT, 'workbench__backup/scss/component/_titles.scss'))
        ? resolve(PROJECT_ROOT, 'workbench__backup/scss/component/_titles.scss')
        : resolve(PROJECT_ROOT, 'workbench/scss/component/_titles.scss');
      if (existsSync(titlesPath)) {
        const titlesContent = readFileSync(titlesPath, 'utf8');
        expect(titlesContent).toContain('.c-title');
        expect(titlesContent).toContain('.c-ttl20');
        expect(titlesContent).toContain('.c-ttl24');
        expect(titlesContent).toContain('.c-ttl30');
      }
    });

    it('resolveComponentVendors resolves slider external vendor requirements', () => {
      const vendors = resolveComponentVendors('slider');
      expect(vendors.css).toContain('slick/slick');
      expect(vendors.js).toContain('slick/slick.min');

      const customVendors = resolveComponentVendors('custom', {
        vendors: { css: ['custom/style'], js: ['custom/lib'] }
      });
      expect(customVendors.css).toContain('custom/style');
      expect(customVendors.js).toContain('custom/lib');
    });

    it('installComponent includes vendor requirement warning in return message', () => {
      const res = installComponent('slider', { targetJsFile: '__skip__' }, sandboxPaths);
      expect(res.success).toBe(true);
      expect(res.vendors).toBeDefined();
      expect(res.vendors.css).toContain('slick/slick');
      expect(res.vendors.js).toContain('slick/slick.min');
      expect(res.message).toContain("vendorcss: ['slick/slick']");
      expect(res.message).toContain("vendorjs: ['slick/slick.min']");
    });
  });
});


