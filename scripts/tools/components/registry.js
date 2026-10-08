/**
 * scripts/tools/components/registry.js
 * Component Registry, Specification & Installation Status
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve, basename } from 'path';
import {
  parseComponentMetadata,
  generateComponentId,
  COMPONENT_DEPENDENCIES,
  COMPONENT_SCHEMA_VERSION,
  resolveComponentDependencies,
  resolveComponentVendors
} from './metadata.js';
import {
  getDefaultPaths,
  getComponentCategory,
  getWorkbenchScssDirForCategory,
  getScssDirForCategory,
  findMatchingScss,
  findMatchingJs
} from './paths.js';
import { isTemplateStub } from './variants.js';
import { sortComponentRegistry } from './ordering.js';


/**
 * Strips Workbench Showroom metadata and item wrapper from component EJS
 */
export function stripEjsShowroomWrapper(content) {
  if (!content) return '';
  const parsed = parseComponentMetadata(content);
  let clean = parsed.content || '';
  clean = clean
    .replace(/<div class="p-component__item">([\s\S]*?)<\/div>(?=\s*(?:<div class="p-component__item">|$))/g, (m, inner) => {
      return inner.replace(/^\s*<!--[^\n]*-->\s*/, '');
    })
    .replace(/^\s*<div class="p-component__item">\s*(?:<!--[^\n]*-->\s*)?/, '')
    .replace(/\s*<\/div>\s*$/, '');
  return clean;
}

/**
 * Locates the exact character range of a component JS module in a file
 */
export function getComponentJsRange(fullJs, compName) {
  if (!fullJs) return null;
  const pattern = new RegExp(
    '(?:/\\*\\s*=+\\s*\\r?\\n\\s*)?\\[Component(?:\\s*Module)?:\\s*' + compName + '\\](?:[\\s\\S]*?=+\\s*\\*/|\\r?\\n)',
    'i'
  );
  const match = fullJs.match(pattern);
  if (!match) return null;

  let startIdx = match.index;
  if (!match[0].startsWith('/*')) {
    const immediateBefore = fullJs.substring(Math.max(0, startIdx - 150), startIdx);
    const commentStart = immediateBefore.lastIndexOf('/* ==========================================================================');
    if (commentStart !== -1) {
      startIdx = Math.max(0, startIdx - 150) + commentStart;
    }
  }

  const remainder = fullJs.substring(match.index + match[0].length);
  const nextMatch = remainder.search(/\n(?:\/\*[\s=*]*\r?\n\s*)?\[Component/i);
  let endIdx = fullJs.length;
  if (nextMatch !== -1) {
    endIdx = match.index + match[0].length + nextMatch;
  }

  return { start: startIdx, end: endIdx };
}

/**
 * Extract component JS module from a full JS file
 */
export function sliceJsForComponent(fullJs, compName) {
  if (!fullJs) return '';
  const range = getComponentJsRange(fullJs, compName);
  if (!range) return fullJs.trim();
  return fullJs.slice(range.start, range.end).trim();
}

/**
 * Merge an individual component JS module into an existing destination JS file
 */
export function mergeComponentJs(existingJs, incomingJs, compName) {
  if (!existingJs || !existingJs.trim()) return incomingJs.trim() + '\n';
  if (!incomingJs || !incomingJs.trim()) return existingJs;

  const range = getComponentJsRange(existingJs, compName);
  if (range) {
    return (
      existingJs.substring(0, range.start).trimEnd() +
      '\n\n' +
      incomingJs.trim() +
      '\n\n' +
      existingJs.substring(range.end).trimStart()
    ).trimEnd() + '\n';
  }

  return existingJs.trimEnd() + '\n\n' + incomingJs.trim() + '\n';
}

/**
 * Formats human-readable category title & icon
 */
export function getCategoryMeta(category) {
  switch (category) {
    case 'header':
      return { id: 'header', label: 'Header', icon: '🧭', order: 1 };
    case 'footer':
      return { id: 'footer', label: 'Footer', icon: '⚓', order: 2 };
    case 'layout':
      return { id: 'layout', label: 'Layout & Structure', icon: '📐', order: 3 };
    case 'component':
    default:
      return { id: 'component', label: 'UI Components', icon: '🧩', order: 4 };
  }
}

/**
 * Get all available components in workbench with installation status and specification
 */
export function getRegistry(paths = getDefaultPaths()) {
  if (!existsSync(paths.wbComponentsDir)) return [];
  const files = readdirSync(paths.wbComponentsDir).filter(f => f.startsWith('_') && f.endsWith('.ejs'));

  const items = files.map(file => {
    const rawName = basename(file, '.ejs').replace(/^_/, '');
    const clientEjs = resolve(paths.clientComponentsDir, file);
    let clientEjsExists = existsSync(clientEjs);
    let clientEjsContent = '';
    let clientMeta = {};

    if (clientEjsExists) {
      try {
        clientEjsContent = readFileSync(clientEjs, 'utf8');
        const parsed = parseComponentMetadata(clientEjsContent);
        clientMeta = parsed.meta || {};
      } catch {}
    }

    const wbEjsPath = resolve(paths.wbComponentsDir, file);
    let wbEjsContent = '';
    let parsedMeta = {};
    if (existsSync(wbEjsPath)) {
      try {
        wbEjsContent = readFileSync(wbEjsPath, 'utf8');
        const parsed = parseComponentMetadata(wbEjsContent);
        parsedMeta = parsed.meta || {};
      } catch {}
    }

    const category = parsedMeta.category || getComponentCategory(rawName);
    const categoryMeta = getCategoryMeta(category);

    const targetWbScssDir = getWorkbenchScssDirForCategory(category, paths);
    const targetClientScssDir = getScssDirForCategory(category, paths);

    // Matching SCSS
    let matchingScss = parsedMeta.scss || null;
    let usedWbScssDir = targetWbScssDir;
    let usedClientScssDir = targetClientScssDir;

    if (!matchingScss) {
      matchingScss = findMatchingScss(rawName, targetWbScssDir);
      if (!matchingScss) {
        matchingScss = findMatchingScss(rawName, paths.wbScssDir);
        if (matchingScss) {
          usedWbScssDir = paths.wbScssDir;
          usedClientScssDir = paths.clientScssDir;
        }
      }
    }

    let wbScssContent = '';
    if (matchingScss) {
      const scssPath = resolve(usedWbScssDir, matchingScss);
      if (existsSync(scssPath)) {
        try { wbScssContent = readFileSync(scssPath, 'utf8'); } catch {}
      }
    }

    let clientScssExists = false;
    let clientScssFile = '';
    let clientScssContent = '';
    const candidateClientScss = matchingScss || findMatchingScss(rawName, usedClientScssDir);
    if (candidateClientScss) {
      const clientScssPath = resolve(usedClientScssDir, candidateClientScss);
      if (existsSync(clientScssPath)) {
        clientScssFile = candidateClientScss;
        const scssRaw = readFileSync(clientScssPath, 'utf8');
        clientScssContent = scssRaw;
        clientScssExists = !isTemplateStub(scssRaw);
      }
    }

    // Matching JS
    const matchingJs = parsedMeta.js || findMatchingJs(rawName, paths.wbJsDir);
    let wbJsContent = '';
    if (matchingJs) {
      const jsPath = resolve(paths.wbJsDir, matchingJs);
      if (existsSync(jsPath)) {
        try {
          const raw = readFileSync(jsPath, 'utf8');
          wbJsContent = sliceJsForComponent(raw, rawName);
        } catch {}
      }
    }

    let clientJsExists = false;
    let clientJsFile = '';
    let clientJsContent = '';
    if (matchingJs) {
      clientJsFile = matchingJs;
      let clientJsPath = resolve(paths.clientJsDir, matchingJs);
      if (!existsSync(clientJsPath)) {
        const rootJs = resolve(paths.root, 'src/pages/assets/js', matchingJs);
        if (existsSync(rootJs)) {
          clientJsPath = rootJs;
        } else {
          const commonJsPath = resolve(paths.root, 'src/pages/assets/js/common.js');
          if (existsSync(commonJsPath)) {
            try {
              const commonRaw = readFileSync(commonJsPath, 'utf8');
              const range = getComponentJsRange(commonRaw, rawName);
              if (range) {
                clientJsPath = commonJsPath;
                clientJsFile = 'common.js';
              }
            } catch {}
          }
        }
      }
      if (existsSync(clientJsPath)) {
        try {
          const raw = readFileSync(clientJsPath, 'utf8');
          if (clientJsFile === 'common.js' || clientJsFile === 'top.js') {
            const range = getComponentJsRange(raw, rawName);
            clientJsExists = !!range;
            clientJsContent = range ? sliceJsForComponent(raw, rawName) : '';
          } else {
            clientJsExists = true;
            clientJsContent = raw;
          }
        } catch {}
      }
    }

    const isInstalled = clientScssExists || (['header', 'footer'].includes(category) && clientEjsExists);

    const deps = resolveComponentDependencies(rawName, parsedMeta, wbEjsContent);
    const compTitle = parsedMeta.title || rawName.split(/[-_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const compId = parsedMeta.id || generateComponentId(rawName, category);
    const version = parsedMeta.version || '1.0.0';
    const schemaVersion = parsedMeta.schemaVersion || COMPONENT_SCHEMA_VERSION;
    const installedVersion = isInstalled ? (clientMeta.version || version) : null;
    const hasUpdate = Boolean(isInstalled && installedVersion && version > installedVersion);

    return {
      id: compId,
      name: rawName,
      title: compTitle,
      version,
      schemaVersion,
      installedVersion,
      latestVersion: version,
      hasUpdate,
      ejsFile: file,
      scssFile: matchingScss,
      jsFile: matchingJs,
      dependencies: deps,
      vendors: resolveComponentVendors(rawName, parsedMeta),
      category,
      categoryLabel: categoryMeta.label,
      categoryIcon: categoryMeta.icon,
      isInstalled,
      meta: parsedMeta,
      scssContent: wbScssContent,
      clientScssContent,
      jsContent: wbJsContent,
      clientJsContent,
      wbEjsContent,
      clientEjsContent
    };
  });

  return sortComponentRegistry(items);
}
