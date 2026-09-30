/**
 * scripts/tools/components/registry.js
 * Component Registry, Specification & Drift Detection Engine (View Diff before update)
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve, basename } from 'path';
import {
  parseComponentMetadata,
  generateComponentId,
  COMPONENT_DEPENDENCIES,
  COMPONENT_SCHEMA_VERSION
} from './metadata.js';
import {
  getDefaultPaths,
  getComponentCategory,
  getWorkbenchScssDirForCategory,
  getScssDirForCategory,
  findMatchingScss,
  findMatchingJs
} from './paths.js';
import { isTemplateStub, sliceScssForClasses } from './variants.js';

/**
 * Normalizes code content for accurate semantic diffing
 */
export function normalizeCodeForDiff(content) {
  if (!content) return '';
  return content
    .replace(/\r\n/g, '\n')
    .replace(/@use\s+[^;]+;/g, '')
    .replace(/@forward\s+[^;]+;/g, '')
    .replace(/\/\*![\s\S]*?\*\//g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .join('\n');
}

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
 * Get all available components in workbench with real-time status, specification, and diff in src/
 */
export function getRegistry(paths = getDefaultPaths()) {
  if (!existsSync(paths.wbComponentsDir)) return [];
  const files = readdirSync(paths.wbComponentsDir).filter(f => f.startsWith('_') && f.endsWith('.ejs'));

  return files.map(file => {
    const rawName = basename(file, '.ejs').replace(/^_/, '');
    const clientEjs = resolve(paths.clientComponentsDir, file);
    const clientEjsExists = existsSync(clientEjs);
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
        try { wbJsContent = readFileSync(jsPath, 'utf8'); } catch {}
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
        }
      }
      if (existsSync(clientJsPath)) {
        clientJsExists = true;
        try { clientJsContent = readFileSync(clientJsPath, 'utf8'); } catch {}
      }
    }

    const isInstalled = clientScssExists || (['header', 'footer'].includes(category) && clientEjsExists);

    let syncStatus = 'uninstalled';
    let scssDiff = false;
    let jsDiff = false;
    let ejsDiff = false;

    if (isInstalled) {
      if (clientScssExists && wbScssContent) {
        let compClientScss = clientScssContent;
        let compWbScss = wbScssContent;
        if (matchingScss && matchingScss !== `_${rawName}.scss` && matchingScss !== `_${rawName}s.scss`) {
          compClientScss = sliceScssForClasses(clientScssContent, `c-${rawName}`);
          compWbScss = sliceScssForClasses(wbScssContent, `c-${rawName}`);
        }
        if (normalizeCodeForDiff(compClientScss) !== normalizeCodeForDiff(compWbScss)) {
          scssDiff = true;
        }
      }

      if (clientJsExists && wbJsContent) {
        const compClientJs = sliceJsForComponent(clientJsContent, rawName);
        const compWbJs = sliceJsForComponent(wbJsContent, rawName);
        if (normalizeCodeForDiff(compClientJs) !== normalizeCodeForDiff(compWbJs)) {
          jsDiff = true;
        }
      }

      if (clientEjsExists && wbEjsContent && ['header', 'footer'].includes(category)) {
        const cleanWbEjs = stripEjsShowroomWrapper(wbEjsContent);
        if (normalizeCodeForDiff(clientEjsContent) !== normalizeCodeForDiff(cleanWbEjs)) {
          ejsDiff = true;
        }
      }

      if (scssDiff || jsDiff || ejsDiff) {
        syncStatus = 'diverged';
      } else {
        syncStatus = 'synced';
      }
    }

    const deps = parsedMeta.dependencies || COMPONENT_DEPENDENCIES[rawName] || [];
    const compTitle = parsedMeta.title || rawName.split(/[-_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const compId = parsedMeta.id || generateComponentId(rawName, category);
    const version = parsedMeta.version || '1.0.0';
    const schemaVersion = parsedMeta.schemaVersion || COMPONENT_SCHEMA_VERSION;
    const installedVersion = isInstalled ? (clientMeta.version || version) : null;
    const hasUpdate = Boolean(isInstalled && installedVersion && version > installedVersion);

    if (hasUpdate) {
      syncStatus = 'outdated';
    }

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
      category,
      categoryLabel: categoryMeta.label,
      categoryIcon: categoryMeta.icon,
      isInstalled,
      syncStatus,
      diffDetails: { scssDiff, jsDiff, ejsDiff },
      meta: parsedMeta,
      scssContent: wbScssContent,
      clientScssContent,
      jsContent: wbJsContent,
      clientJsContent,
      wbEjsContent,
      clientEjsContent
    };
  });
}
