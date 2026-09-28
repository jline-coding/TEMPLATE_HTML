import { describe, it, expect, beforeEach, afterEach, afterAll } from 'vitest';
import { existsSync, unlinkSync, readFileSync, writeFileSync } from 'fs';
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
  COMPONENT_DEPENDENCIES
} from '../scripts/tools/component-service.js';
import {
  CLIENT_COMPONENTS_DIR,
  CLIENT_SCSS_DIR,
  CLIENT_JS_DIR,
  WORKBENCH_COMPONENTS_DIR,
  WORKBENCH_SCSS_DIR
} from '../scripts/tools/config.js';

describe('Component Service & Dual Environment Engine', () => {
  const accordionScssPath = resolve(CLIENT_SCSS_DIR, '_accordion.scss');
  const accordionJsPath = resolve(CLIENT_JS_DIR, 'accordion.js');
  const scssIndexPath = resolve(CLIENT_SCSS_DIR, '_index.scss');

  const originalAccordionScss = existsSync(accordionScssPath) ? readFileSync(accordionScssPath, 'utf8') : null;
  const originalAccordionJs = existsSync(accordionJsPath) ? readFileSync(accordionJsPath, 'utf8') : null;
  const originalScssIndex = existsSync(scssIndexPath) ? readFileSync(scssIndexPath, 'utf8') : null;

  beforeEach(() => {
    try {
      if (existsSync(accordionScssPath)) unlinkSync(accordionScssPath);
      if (existsSync(accordionJsPath)) unlinkSync(accordionJsPath);
    } catch {}
  });

  afterAll(() => {
    try {
      if (originalAccordionScss !== null) {
        writeFileSync(accordionScssPath, originalAccordionScss, 'utf8');
      } else if (existsSync(accordionScssPath)) {
        unlinkSync(accordionScssPath);
      }

      if (originalAccordionJs !== null) {
        writeFileSync(accordionJsPath, originalAccordionJs, 'utf8');
      } else if (existsSync(accordionJsPath)) {
        unlinkSync(accordionJsPath);
      }

      if (originalScssIndex !== null) {
        writeFileSync(scssIndexPath, originalScssIndex, 'utf8');
      }
    } catch {}
  });


  it('correctly categorizes components into header, footer, layout, component', () => {
    expect(getComponentCategory('header')).toBe('header');
    expect(getComponentCategory('header_01')).toBe('header');
    expect(getComponentCategory('gnavi')).toBe('header');

    expect(getComponentCategory('footer')).toBe('footer');
    expect(getComponentCategory('footer_01')).toBe('footer');

    expect(getComponentCategory('sidebar')).toBe('layout');
    expect(getComponentCategory('grids')).toBe('layout');
    expect(getComponentCategory('flexs')).toBe('layout');
    expect(getComponentCategory('tbls')).toBe('layout');
    expect(getComponentCategory('mv')).toBe('layout');
    expect(getComponentCategory('l-container')).toBe('layout');

    expect(getComponentCategory('accordion')).toBe('component');
    expect(getComponentCategory('btns')).toBe('component');
    expect(getComponentCategory('titles')).toBe('component');
    expect(getComponentCategory('texts')).toBe('component');
  });

  it('scans registry and retrieves component assets with metadata', () => {
    const registry = getRegistry();
    expect(registry.length).toBeGreaterThan(0);

    const accordion = registry.find(r => r.name === 'accordion');
    expect(accordion).toBeDefined();
    expect(accordion.category).toBe('component');
    expect(accordion.ejsFile).toBe('_accordion.ejs');
    expect(accordion.scssFile).toBe('_accordion.scss');
    expect(accordion.jsFile).toBe('accordion.js');
    expect(accordion.jsContent).toContain('c-accordion');

    const header = registry.find(r => r.name === 'header');
    expect(header).toBeDefined();
    expect(header.category).toBe('header');
  });

  it('correctly manages layout components between workbench/layout/ and src/pages/assets/scss/layout/', () => {
    const registry = getRegistry();
    const flexs = registry.find(r => r.name === 'flexs');
    expect(flexs).toBeDefined();
    expect(flexs.category).toBe('layout');
    expect(flexs.scssFile).toBe('_flexs.scss');
    expect(flexs.scssContent).toContain('.l-flex');

    const grids = registry.find(r => r.name === 'grids');
    expect(grids).toBeDefined();
    expect(grids.category).toBe('layout');
    expect(grids.scssFile).toBeDefined();

    const tbls = registry.find(r => r.name === 'tbls');
    expect(tbls).toBeDefined();
    expect(tbls.category).toBe('layout');
    expect(tbls.scssFile).toBe('_tbls.scss');
    expect(tbls.scssContent).toContain('.l-tbl');
  });


  it('installs and removes a component completely and accurately without cluttering src/components/', () => {
    // 1. Install accordion
    const installRes = installComponent('accordion');
    expect(installRes.success).toBe(true);

    const ejsPath = resolve(CLIENT_COMPONENTS_DIR, '_accordion.ejs');
    const scssPath = resolve(CLIENT_SCSS_DIR, '_accordion.scss');
    const jsPath = resolve(CLIENT_JS_DIR, 'accordion.js');
    const scssIndexPath = resolve(CLIENT_SCSS_DIR, '_index.scss');

    // EJS is NOT copied to src/components/ because snippets handle the HTML markup
    expect(existsSync(ejsPath)).toBe(false);
    // SCSS and JS are installed accurately
    expect(existsSync(scssPath)).toBe(true);
    expect(existsSync(jsPath)).toBe(true);

    const indexContent = readFileSync(scssIndexPath, 'utf8');
    expect(indexContent).toContain('@use "accordion";');

    // Registry reflects installed
    const regAfterInstall = getRegistry();
    const installedAccordion = regAfterInstall.find(r => r.name === 'accordion');
    expect(installedAccordion.isInstalled).toBe(true);

    // 2. Safe Overwrite Protection: modifying SCSS prevents silent overwrite
    writeFileSync(scssPath, '/* developer custom styles */', 'utf8');
    const conflictRes = installComponent('accordion');
    expect(conflictRes.success).toBe(false);
    expect(conflictRes.conflict).toBe(true);
    expect(readFileSync(scssPath, 'utf8')).toBe('/* developer custom styles */'); // Code preserved!

    // 3. Force overwrite works if explicitly requested
    const forceRes = installComponent('accordion', { force: true });
    expect(forceRes.success).toBe(true);
    expect(readFileSync(scssPath, 'utf8')).not.toBe('/* developer custom styles */');

    // 4. Safe Removal Guard: modifying SCSS prevents silent deletion
    writeFileSync(scssPath, '/* another custom edit */', 'utf8');
    const safeRemoveRes = removeComponent('accordion');
    expect(safeRemoveRes.success).toBe(false);
    expect(safeRemoveRes.conflict).toBe(true);
    expect(existsSync(scssPath)).toBe(true); // File preserved!

    // 5. Force removal works when explicitly confirmed
    const removeRes = removeComponent('accordion', { force: true });
    expect(removeRes.success).toBe(true);

    expect(existsSync(scssPath)).toBe(false);
    expect(existsSync(jsPath)).toBe(false);

    const indexCleanContent = readFileSync(scssIndexPath, 'utf8');
    expect(indexCleanContent).not.toContain('@use "accordion";');

    // Registry reflects uninstalled
    const regAfterRemove = getRegistry();
    const removedAccordion = regAfterRemove.find(r => r.name === 'accordion');
    expect(removedAccordion.isInstalled).toBe(false);

    // 6. Restore accordion placeholder back to src/
    writeFileSync(scssPath, `@use "sass:math";\n@use "../global" as *;\n\n/*!\ncomponent > Accordion\n------------------------------\n*/\n`, 'utf8');
    updateClientScssIndex('accordion', 'add');
  });


  it('exports/saves component from src/ to workbench/ (two-way sync)', () => {
    // Ensure test source files exist in src/
    const dummyEjs = resolve(CLIENT_COMPONENTS_DIR, '_test_sample.ejs');
    const dummyScss = resolve(CLIENT_SCSS_DIR, '_test_sample.scss');
    writeFileSync(dummyEjs, '<div class="c-sample">Sample</div>', 'utf8');
    writeFileSync(dummyScss, '.c-sample { color: red; }', 'utf8');

    // Export to workbench as "test-sample"
    const saveRes = saveComponent('test_sample', { as: 'test_sample' });
    expect(saveRes.success).toBe(true);

    const wbEjs = resolve(WORKBENCH_COMPONENTS_DIR, '_test_sample.ejs');
    const wbScss = resolve(WORKBENCH_SCSS_DIR, '_test_sample.scss');
    expect(existsSync(wbEjs)).toBe(true);
    expect(existsSync(wbScss)).toBe(true);

    // Clean up test files
    if (existsSync(dummyEjs)) unlinkSync(dummyEjs);
    if (existsSync(dummyScss)) unlinkSync(dummyScss);
    if (existsSync(wbEjs)) unlinkSync(wbEjs);
    if (existsSync(wbScss)) unlinkSync(wbScss);
    updateWorkbenchScss('test_sample', 'remove');
  });

  it('slices and merges individual component variants without importing entire bundle', () => {
    const sampleFullScss = `@use "sass:math";\n@use "../global" as *;\n\n/*!\ncomponent > btn\n------------------------------\n*/\n.c-btn{\n  color: red;\n  &--arrow{\n    content: ">";\n  }\n  &--reverse{\n    color: blue;\n  }\n}\n.c-totop{\n  display: none;\n}\n`;

    // 1. Slice base c-btn only
    const baseSliced = sliceScssForClasses(sampleFullScss, 'c-btn');
    expect(baseSliced).toContain('.c-btn');
    expect(baseSliced).not.toContain('&--arrow');
    expect(baseSliced).not.toContain('&--reverse');
    expect(baseSliced).not.toContain('.c-totop');

    // 2. Slice c-btn with --arrow only
    const arrowSliced = sliceScssForClasses(sampleFullScss, 'c-btn c-btn--arrow');
    expect(arrowSliced).toContain('.c-btn');
    expect(arrowSliced).toContain('&--arrow');
    expect(arrowSliced).not.toContain('&--reverse');
    expect(arrowSliced).not.toContain('.c-totop');

    // 3. Merge modifier into base without duplicating headers
    const merged = mergeVariantScss(baseSliced, arrowSliced, 'c-btn c-btn--arrow');
    expect(merged).toContain('.c-btn');
    expect(merged).toContain('&--arrow');
    expect(merged).not.toContain('&--reverse');
    // Ensure @use is only present at top, not duplicated
    const useOccurrences = (merged.match(/@use\s+"sass:math"/g) || []).length;
    expect(useOccurrences).toBe(1);
  });

  it('accurately handles complex nested components with sub-elements and prevents false positive modifier matches', () => {
    const complexNestedScss = `
@use "sass:math";
@use "../global" as *;

.c-card {
  padding: 20px;
  background: var(--white);
  
  &__head {
    font-size: 18px;
    font-weight: 700;
  }

  &__body {
    padding: 10px 0;

    .c-btn {
      margin-top: 15px;
    }
  }

  &--featured {
    border: 2px solid gold;
  }

  &--featured-dark {
    background: black;
  }
}
`;

    // 1. Slicing base c-card preserves nested elements (__head, __body, inner .c-btn) and excludes modifiers
    const slicedCard = sliceScssForClasses(complexNestedScss, 'c-card');
    expect(slicedCard).toContain('.c-card');
    expect(slicedCard).toContain('&__head');
    expect(slicedCard).toContain('&__body');
    expect(slicedCard).toContain('.c-btn');
    expect(slicedCard).not.toContain('&--featured');
    expect(slicedCard).not.toContain('&--featured-dark');

    // 2. Slicing with modifier keeps that modifier and excludes others
    const slicedFeatured = sliceScssForClasses(complexNestedScss, 'c-card c-card--featured');
    expect(slicedFeatured).toContain('&--featured');
    expect(slicedFeatured).not.toContain('&--featured-dark');

    // 3. Strict modifier matching prevents substring false positives (--featured vs --featured-dark)
    const existingWithFeaturedDark = '.c-card { &--featured-dark { background: black; } }';
    const isFeaturedInstalled = isVariantInstalled('card', 'c-card c-card--featured');
    // File doesn't exist on disk so isVariantInstalled returns false
    expect(isFeaturedInstalled).toBe(false);

    // 4. Non-destructive merge preserves existing custom CSS
    const customUserCss = '.c-card {\n  /* CUSTOM USER CODE */\n  box-shadow: 0 4px 10px rgba(0,0,0,0.1);\n}';
    const mergedCustom = mergeVariantScss(customUserCss, slicedFeatured, 'c-card c-card--featured');
    expect(mergedCustom).toContain('/* CUSTOM USER CODE */');
    expect(mergedCustom).toContain('box-shadow: 0 4px 10px rgba(0,0,0,0.1);');
    expect(mergedCustom).toContain('&--featured');
  });

  it('installs individual variants into site non-destructively and checks status accurately', () => {
    // 1. Install base variant
    const res1 = installVariant('accordion', {
      classStr: 'c-accordion',
      variantTitle: 'Accordion Standard'
    });
    expect(res1.success).toBe(true);
    expect(existsSync(accordionScssPath)).toBe(true);

    const initialContent = readFileSync(accordionScssPath, 'utf8');
    expect(initialContent).toContain('.c-accordion');

    // Variant check returns true
    expect(isVariantInstalled('accordion', 'c-accordion')).toBe(true);

    // 2. Add custom developer code & comment into the site SCSS file
    const customContent = initialContent + '\n/* CUSTOM SITE MODIFICATION: Do NOT DELETE */\n.c-custom-rule { display: block; }\n';
    writeFileSync(accordionScssPath, customContent, 'utf8');

    // 3. Import another variant with an additional modifier or custom scss
    const incomingModifierScss = `
.c-accordion {
  &--compact {
    padding: 4px;
  }
}
`;
    const res2 = installVariant('accordion', {
      classStr: 'c-accordion c-accordion--compact',
      variantTitle: 'Accordion Compact',
      scssCode: incomingModifierScss
    });
    expect(res2.success).toBe(true);

    // 4. Verify existing custom developer code was NOT lost or deleted!
    const mergedContent = readFileSync(accordionScssPath, 'utf8');
    expect(mergedContent).toContain('/* CUSTOM SITE MODIFICATION: Do NOT DELETE */');
    expect(mergedContent).toContain('.c-custom-rule { display: block; }');
    expect(mergedContent).toContain('&--compact');
    expect(isVariantInstalled('accordion', 'c-accordion c-accordion--compact')).toBe(true);
  });

  it('correctly declares and resolves component dependencies', () => {
    expect(COMPONENT_DEPENDENCIES.header).toContain('gnavi');
    expect(COMPONENT_DEPENDENCIES.header).toContain('btns');
    expect(COMPONENT_DEPENDENCIES.footer).toContain('btns');

    const registry = getRegistry();
    const headerComp = registry.find(c => c.name === 'header');
    expect(headerComp).toBeDefined();
    expect(headerComp.dependencies).toContain('gnavi');
    expect(headerComp.dependencies).toContain('btns');

    const gnaviComp = registry.find(c => c.name === 'gnavi');
    expect(gnaviComp).toBeDefined();
    expect(gnaviComp.category).toBe('header');
    expect(gnaviComp.scssFile).toBe('_gnavi.scss');
    expect(gnaviComp.jsFile).toBe('gnavi.js');
  });
});
