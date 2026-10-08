/**
 * scripts/tools/components/paths.js
 * Path and Category Resolution for Dual Environment Engine
 * Enforces Path Confinement via resolveSafePath.
 * Supports configurable root/directories for isolated testing.
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import {
  ROOT,
  WORKBENCH_DIR,
  WORKBENCH_COMPONENTS_DIR,
  WORKBENCH_SCSS_DIR,
  WORKBENCH_LAYOUT_DIR,
  WORKBENCH_JS_DIR,
  CLIENT_COMPONENTS_DIR,
  CLIENT_SCSS_DIR,
  CLIENT_LAYOUT_DIR,
  CLIENT_JS_DIR
} from '../config.js';
import { resolveSafePath } from '../safety.js';
import { normalizeName } from './metadata.js';

export const LAYOUT_CATEGORIES = new Set(['layout', 'layouts']);
export const KNOWN_LAYOUT_COMPONENTS = new Set([
  'container', 'flex', 'flexs', 'grid', 'grids', 'tbls', 'sidebar', 'wrapper', 'wrap', 'layout'
]);

/**
 * Returns default configured directory paths
 */
export function getDefaultPaths() {
  return {
    root: ROOT,
    wbDir: WORKBENCH_DIR,
    wbComponentsDir: WORKBENCH_COMPONENTS_DIR,
    wbScssDir: WORKBENCH_SCSS_DIR,
    wbLayoutDir: WORKBENCH_LAYOUT_DIR,
    wbJsDir: WORKBENCH_JS_DIR,
    clientComponentsDir: CLIENT_COMPONENTS_DIR,
    clientScssDir: CLIENT_SCSS_DIR,
    clientLayoutDir: CLIENT_LAYOUT_DIR,
    clientJsDir: CLIENT_JS_DIR
  };
}

/**
 * Determines the category of a component based on name and context
 * @param {string} compName
 * @returns {'header' | 'footer' | 'layout' | 'component'}
 */
export function getComponentCategory(compName) {
  const norm = normalizeName(compName);
  if (norm.startsWith('header') || norm.startsWith('gnavi') || norm.includes('_header')) return 'header';
  if (norm.startsWith('footer') || norm.includes('_footer')) return 'footer';
  if (norm.startsWith('l-') || KNOWN_LAYOUT_COMPONENTS.has(norm)) return 'layout';
  return 'component';
}

/**
 * Resolves the client SCSS directory for a given category
 */
export function getScssDirForCategory(category, paths = getDefaultPaths()) {
  return category === 'layout' ? paths.clientLayoutDir : paths.clientScssDir;
}

/**
 * Resolves the client _index.scss file for a given category
 */
export function getScssIndexForCategory(category, paths = getDefaultPaths()) {
  const dir = getScssDirForCategory(category, paths);
  return resolveSafePath(dir, '_index.scss', 'client _index.scss');
}

/**
 * Resolves the workbench SCSS directory for a given category
 */
export function getWorkbenchScssDirForCategory(category, paths = getDefaultPaths()) {
  return category === 'layout' ? paths.wbLayoutDir : paths.wbScssDir;
}

/**
 * Finds matching SCSS file candidate in target directory
 */
export function findMatchingScss(normName, searchDir) {
  if (!existsSync(searchDir)) return null;
  const candidates = [
    `_${normName}.scss`,
    `_${normName}s.scss`,
    `_${normName.replace(/s$/, '')}.scss`
  ];
  for (const c of candidates) {
    const p = resolve(searchDir, c);
    if (existsSync(p)) return c;
  }
  return null;
}

/**
 * Finds matching EJS file candidate in target directory
 */
export function findMatchingEjs(normName, searchDir) {
  if (!existsSync(searchDir)) return null;
  const candidates = [
    `_${normName}.ejs`,
    `_${normName}s.ejs`,
    `_${normName.replace(/s$/, '')}.ejs`,
    `${normName}.ejs`,
    `${normName}s.ejs`,
    `${normName.replace(/s$/, '')}.ejs`
  ];
  for (const c of candidates) {
    const p = resolve(searchDir, c);
    if (existsSync(p)) return c;
  }
  return null;
}

/**
 * Finds matching JS file candidate in target directory
 */
export function findMatchingJs(normName, searchDir) {
  if (!existsSync(searchDir)) return null;
  const candidates = [
    `${normName}.js`,
    `${normName}s.js`,
    `${normName.replace(/s$/, '')}.js`,
    `_${normName}.js`
  ];
  for (const c of candidates) {
    const p = resolve(searchDir, c);
    if (existsSync(p)) return c;
  }

  // Scan JS files for component marker: [Component: <name>] or [Component Module: <name>]
  try {
    const files = readdirSync(searchDir).filter(f => f.endsWith('.js') && !f.endsWith('.min.js'));
    const markerRegex = new RegExp(`\\[Component(?:\\s*Module)?:\\s*${normName}\\]`, 'i');
    for (const f of files) {
      const p = resolve(searchDir, f);
      const content = readFileSync(p, 'utf8');
      if (markerRegex.test(content)) {
        return f;
      }
    }
  } catch {}

  return null;
}

/**
 * Get all available JavaScript files in src/pages/assets/js/
 */
export function getAvailableJsFiles(paths = getDefaultPaths()) {
  const assetsJsDir = resolve(paths.root, 'src/pages/assets/js');
  if (!existsSync(assetsJsDir)) return [];
  const entries = readdirSync(assetsJsDir, { withFileTypes: true });
  const priority = { 'common.js': 1, 'top.js': 2, 'company.js': 3, 'contact.js': 4 };
  return entries
    .filter(e => e.isFile() && e.name.endsWith('.js') && !e.name.endsWith('.min.js'))
    .map(e => {
      const isCommon = e.name === 'common.js';
      return {
        name: e.name,
        path: `assets/js/${e.name}`,
        isCommon,
        order: priority[e.name] || 50
      };
    })
    .sort((a, b) => a.order - b.order || a.name.localeCompare(b.name));
}
