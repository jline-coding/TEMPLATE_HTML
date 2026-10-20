/**
 * scripts/tools/components/registry.js
 * Component Registry, Specification & Installation Status
 */

import { existsSync, readdirSync, readFileSync } from 'fs';
import { resolve, basename, dirname } from 'path';
import { createHash } from 'crypto';
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
  findMatchingJs,
  resolveComponentFiles
} from './paths.js';
import { isTemplateStub, findMatchingTag } from './variants.js';
import { sortComponentRegistry } from './ordering.js';
import { compareComponentVersions } from './metadata.js';

export function getWorkbenchRevision(paths = getDefaultPaths(), registry = getRegistry(paths)) {
  const state = registry.map(item => [item.name, item.category, item.ejsFile, item.scssFile, item.jsFile,
    item.wbEjsContent, item.scssContent, item.jsContent]).sort((a, b) => a[0].localeCompare(b[0]));
  return createHash('sha256').update(JSON.stringify(state)).digest('hex');
}


/**
 * Strips Workbench Showroom metadata and item wrapper from component EJS
 */
export function stripEjsShowroomWrapper(content) {
  if (!content) return '';
  const parsed = parseComponentMetadata(content);
  const clean = parsed.content || '';
  const wrapper = /<div\b[^>]*class=["'][^"']*\bp-component__item\b[^"']*["'][^>]*>/g;
  let output = '', offset = 0, match;
  while ((match = wrapper.exec(clean))) {
    const end = findMatchingTag(clean, match.index);
    if (end < 0) break; // Never truncate malformed input.
    output += clean.slice(offset, match.index);
    const inner = clean.slice(match.index + match[0].length, end).replace(/<\/div>\s*$/i, '');
    output += inner.replace(/^\s*<!--[\s\S]*?-->\s*/, '');
    offset = end;
    wrapper.lastIndex = end;
  }
  return output + clean.slice(offset);
}

/**
 * Locates the exact character range of a component JS module in a file
 */
export function getComponentJsRange(fullJs, compName) {
  if (!fullJs || !compName) return null;
  const markers = [...fullJs.matchAll(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g)]
    .map(match => ({ match, name: match[0].match(/\[Component(?:\s*Module)?:\s*([\w-]+)\]/i)?.[1] }))
    .filter(item => item.name);
  const index = markers.findIndex(item => item.name.toLowerCase() === compName.toLowerCase());
  return index < 0 ? null : { start: markers[index].match.index, end: markers[index + 1]?.match.index ?? fullJs.length };
}

export function removeComponentJs(fullJs, compName) {
  const range = getComponentJsRange(fullJs, compName);
  return range ? fullJs.slice(0, range.start) + fullJs.slice(range.end) : null;
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

  const incomingMarkerMatch = incomingJs.match(/\[Component(?:\s*Module)?:\s*([\w-]+)\]/i);
  const targetCompName = incomingMarkerMatch ? incomingMarkerMatch[1] : compName;
  const range = getComponentJsRange(existingJs, targetCompName) || (compName ? getComponentJsRange(existingJs, compName) : null);
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

    const source = resolveComponentFiles(rawName, paths);
    const wbEjsContent = source.raw;
    const parsedMeta = source.meta;
    const category = source.category;
    const categoryMeta = getCategoryMeta(category);
    const targetWbScssDir = getWorkbenchScssDirForCategory(category, paths);
    const targetClientScssDir = getScssDirForCategory(category, paths);
    const matchingScss = source.scssFile;
    const usedWbScssDir = source.scssPath ? dirname(source.scssPath) : targetWbScssDir;
    const usedClientScssDir = usedWbScssDir === paths.wbScssDir ? paths.clientScssDir : targetClientScssDir;

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
    const matchingJs = source.jsPath ? basename(source.jsPath) : null;
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

    const clientSource = resolveComponentFiles(rawName, paths, 'client');
    let clientJsExists = false;
    let clientJsFile = clientSource.jsPath ? basename(clientSource.jsPath) : '';
    let clientJsContent = '';
    if (clientSource.jsPath) {
      const raw = readFileSync(clientSource.jsPath, 'utf8');
      const range = getComponentJsRange(raw, rawName);
      const dedicated = [rawName + '.js', rawName + 's.js', '_' + rawName + '.js'].includes(clientJsFile);
      clientJsExists = Boolean(range || dedicated);
      clientJsContent = range ? raw.slice(range.start, range.end).trim() : dedicated ? raw : '';
    }

    const isInstalled = clientScssExists || clientJsExists || (['header', 'footer'].includes(category) && clientEjsExists);

    const deps = resolveComponentDependencies(rawName, parsedMeta, wbEjsContent);
    const compTitle = parsedMeta.title || rawName.split(/[-_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
    const compId = parsedMeta.id || generateComponentId(rawName, category);
    const version = parsedMeta.version || '1.0.0';
    const schemaVersion = parsedMeta.schemaVersion || COMPONENT_SCHEMA_VERSION;
    const installedVersion = isInstalled ? (clientMeta.version || version) : null;
    const hasUpdate = Boolean(isInstalled && installedVersion && compareComponentVersions(version, installedVersion) > 0);

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
