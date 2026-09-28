/**
 * scripts/tools/component-service.js
 * Core Component Engine for Dual Environment:
 * - Syncs & Installs between workbench/ (template library) and src/ (client site)
 * - Two-way workflow:
 *   1. workbench -> src  (Install / Remove)
 *   2. src -> workbench  (Export / Save)
 * - Complete asset handling: EJS, SCSS (with auto _index.scss @use), and JS
 */

import { existsSync, readdirSync, readFileSync, writeFileSync, copyFileSync, unlinkSync, mkdirSync } from 'fs';
import { resolve, dirname, basename, extname } from 'path';
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
} from './config.js';

const CLIENT_SCSS_INDEX = resolve(CLIENT_SCSS_DIR, '_index.scss');
const CLIENT_LAYOUT_INDEX = resolve(CLIENT_LAYOUT_DIR, '_index.scss');
const WORKBENCH_SCSS_MAIN = resolve(WORKBENCH_DIR, 'workbench.scss');
const WORKBENCH_LAYOUT_INDEX = resolve(WORKBENCH_LAYOUT_DIR, '_index.scss');

/**
 * Component Dependencies Map
 * Declares prerequisite sub-components required for composite components
 */
export const COMPONENT_DEPENDENCIES = {
  header: ['gnavi', 'btns'],
  footer: ['btns']
};

/**
 * Normalizes input name (e.g. "_btns.ejs" -> "btns", "btn" -> "btn")
 */
export function normalizeName(input) {
  if (!input) return '';
  let name = input.trim();
  name = basename(name, extname(name));
  return name.replace(/^_+/, '').toLowerCase();
}

/**
 * Detects if an SCSS file is merely an empty template stub/placeholder
 * (contains only @use/@forward statements and template banner comments, no custom rules/comments)
 */
export function isTemplateStub(content) {
  if (!content || !content.trim()) return true;
  const stripped = content
    .replace(/@use\s+[^;]+;/g, '')
    .replace(/@forward\s+[^;]+;/g, '')
    .replace(/\/\*![\s\S]*?\*\//g, '')
    .trim();
  return stripped === '';
}

/**
 * Categorize component by name
 * Returns: 'header' | 'footer' | 'layout' | 'component'
 */
export function getComponentCategory(name) {
  const norm = normalizeName(name);
  if (norm.startsWith('header') || norm.startsWith('gnavi')) return 'header';
  if (norm.startsWith('footer')) return 'footer';
  if (
    norm.startsWith('l-') ||
    ['sidebar', 'grids', 'girds', 'flexs', 'tbls', 'tbl', 'container', 'mv', 'hero', 'wrapper', 'section', 'columns'].includes(norm)
  ) {
    return 'layout';
  }
  return 'component';
}

/**
 * Get target client SCSS directory for category
 */
export function getScssDirForCategory(category) {
  return category === 'layout' ? CLIENT_LAYOUT_DIR : CLIENT_SCSS_DIR;
}

/**
 * Get target workbench SCSS directory for category
 */
export function getWorkbenchScssDirForCategory(category) {
  return category === 'layout' ? WORKBENCH_LAYOUT_DIR : WORKBENCH_SCSS_DIR;
}

/**
 * Get target client _index.scss path for category
 */
export function getScssIndexForCategory(category) {
  return category === 'layout' ? CLIENT_LAYOUT_INDEX : CLIENT_SCSS_INDEX;
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
 * Find matching SCSS file for a given component name in target directory
 */
export function findMatchingScss(compName, scssDir) {
  if (!existsSync(scssDir)) return null;
  const candidates = [
    `_${compName}.scss`,
    `_${compName.replace(/s$/, '')}.scss`,
    `_${compName}s.scss`
  ];
  if (compName.includes('grid')) {
    candidates.push('_girds.scss', '_gird.scss');
  }
  if (compName.includes('gird')) {
    candidates.push('_grids.scss', '_grid.scss');
  }
  for (const candidate of candidates) {
    const p = resolve(scssDir, candidate);
    if (existsSync(p)) return candidate;
  }
  // Check subdirectories (for future component scalability)
  try {
    const entries = readdirSync(scssDir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const subDir = resolve(scssDir, entry.name);
        for (const candidate of candidates) {
          const p = resolve(subDir, candidate);
          if (existsSync(p)) return `${entry.name}/${candidate}`;
        }
      }
    }
  } catch {}
  return null;
}

/**
 * Find matching JS file for a given component name in target directory
 */
export function findMatchingJs(compName, jsDir) {
  if (!existsSync(jsDir)) return null;
  const candidates = [
    `${compName}.js`,
    `${compName.replace(/s$/, '')}.js`,
    `${compName}s.js`
  ];
  for (const candidate of candidates) {
    const p = resolve(jsDir, candidate);
    if (existsSync(p)) return candidate;
  }
  return null;
}

/**
 * Updates client _index.scss to add or remove @use (category-aware: component vs layout)
 */
export function updateClientScssIndex(scssBaseName, action = 'add', category = 'component') {
  const targetDir = getScssDirForCategory(category);
  const targetIndex = getScssIndexForCategory(category);
  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }
  let content = existsSync(targetIndex) ? readFileSync(targetIndex, 'utf8') : '';
  const importStatement = `@use "${scssBaseName}";`;
  const regex = new RegExp(`@use\\s+["']${scssBaseName}["'];?\\r?\\n?`, 'g');

  if (action === 'add') {
    if (!content.includes(`@use "${scssBaseName}"`) && !content.includes(`@use '${scssBaseName}'`)) {
      content = content.trimEnd();
      content = content ? `${content}\n${importStatement}\n` : `${importStatement}\n`;
      writeFileSync(targetIndex, content, 'utf8');
      return true;
    }
  } else if (action === 'remove') {
    if (regex.test(content)) {
      content = content.replace(regex, '');
      writeFileSync(targetIndex, content.trimEnd() ? (content.trimEnd() + '\n') : '', 'utf8');
      return true;
    }
  }
  return false;
}

/**
 * Ensures workbench SCSS index has @use (category-aware: component vs layout)
 */
export function updateWorkbenchScss(scssBaseName, action = 'add', category = 'component') {
  const targetDir = category === 'layout' ? WORKBENCH_LAYOUT_DIR : WORKBENCH_SCSS_DIR;
  const targetIndex = category === 'layout' ? WORKBENCH_LAYOUT_INDEX : resolve(WORKBENCH_SCSS_DIR, '_index.scss');

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }
  let content = existsSync(targetIndex) ? readFileSync(targetIndex, 'utf8') : '';
  const importStatement = `@use "${scssBaseName}";`;
  const regex = new RegExp(`@use\\s+["']${scssBaseName}["'];?\\r?\\n?`, 'g');

  if (action === 'add') {
    if (!content.includes(`@use "${scssBaseName}"`) && !content.includes(`@use '${scssBaseName}'`)) {
      content = content.trimEnd() + `\n${importStatement}\n`;
      writeFileSync(targetIndex, content, 'utf8');
      return true;
    }
  } else if (action === 'remove') {
    if (regex.test(content)) {
      content = content.replace(regex, '');
      writeFileSync(targetIndex, content.trimEnd() ? (content.trimEnd() + '\n') : '', 'utf8');
      return true;
    }
  }
  return false;
}

/**
 * Get all available components in workbench with real-time status in src/
 */
export function getRegistry() {
  if (!existsSync(WORKBENCH_COMPONENTS_DIR)) return [];
  const files = readdirSync(WORKBENCH_COMPONENTS_DIR).filter(f => f.startsWith('_') && f.endsWith('.ejs'));

  return files.map(file => {
    const rawName = basename(file, '.ejs').replace(/^_/, '');
    const clientEjs = resolve(CLIENT_COMPONENTS_DIR, file);
    const clientEjsExists = existsSync(clientEjs);

    const category = getComponentCategory(rawName);
    const categoryMeta = getCategoryMeta(category);

    const targetWbScssDir = getWorkbenchScssDirForCategory(category);
    const targetClientScssDir = getScssDirForCategory(category);

    // Matching SCSS: check target directory first, then fallback
    let matchingScss = findMatchingScss(rawName, targetWbScssDir);
    let usedWbScssDir = targetWbScssDir;
    let usedClientScssDir = targetClientScssDir;
    if (!matchingScss) {
      matchingScss = findMatchingScss(rawName, WORKBENCH_SCSS_DIR);
      if (matchingScss) {
        usedWbScssDir = WORKBENCH_SCSS_DIR;
        usedClientScssDir = CLIENT_SCSS_DIR;
      }
    }

    let clientScssExists = false;
    let clientScssFile = '';
    const clientMatchingScss = findMatchingScss(rawName, usedClientScssDir);
    if (clientMatchingScss) {
      clientScssFile = clientMatchingScss;
      const clientScssPath = resolve(usedClientScssDir, clientMatchingScss);
      if (existsSync(clientScssPath)) {
        const scssRaw = readFileSync(clientScssPath, 'utf8');
        // Only count as installed if it has real CSS rules, not an empty template boilerplate stub!
        clientScssExists = !isTemplateStub(scssRaw);
      }
    }

    // Matching JS
    const matchingJs = findMatchingJs(rawName, WORKBENCH_JS_DIR);
    let clientJsExists = false;
    let clientJsFile = '';
    if (matchingJs) {
      clientJsFile = matchingJs;
      clientJsExists = existsSync(resolve(CLIENT_JS_DIR, matchingJs));
    }

    // In our modern workflow, a component is installed when its SCSS exists in src/.
    // For site partials (header/footer), either SCSS or EJS marks it as installed.
    const isInstalled = clientScssExists || (['header', 'footer'].includes(category) && clientEjsExists);

    // Read preview contents if needed
    let scssContent = '';
    if (matchingScss) {
      const scssPath = resolve(usedWbScssDir, matchingScss);
      if (existsSync(scssPath)) scssContent = readFileSync(scssPath, 'utf8');
    }

    let jsContent = '';
    if (matchingJs) {
      const jsPath = resolve(WORKBENCH_JS_DIR, matchingJs);
      if (existsSync(jsPath)) jsContent = readFileSync(jsPath, 'utf8');
    }

    const deps = COMPONENT_DEPENDENCIES[rawName] || [];

    return {
      name: rawName,
      title: rawName.split(/[-_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' '),
      ejsFile: file,
      scssFile: matchingScss,
      jsFile: matchingJs,
      dependencies: deps,
      category,
      categoryLabel: categoryMeta.label,
      categoryIcon: categoryMeta.icon,
      isInstalled,
      clientEjsExists,
      clientScssExists,
      clientJsExists,
      scssContent,
      jsContent
    };
  });
}

/**
 * Install a component from workbench into src/ (Site chính)
 * Optimal workflow:
 * 1. SCSS -> src/pages/assets/scss/component/ or layout/ & auto @use in _index.scss
 * 2. JS (if exists) -> src/pages/assets/js/component/
 * 3. HTML is NOT copied because snippets are already generated in VS Code!
 *    (Preserves clean src/components/ for site-level layouts like header/footer).
 * 4. Conflict protection: Prevents accidental overwrite of customized code.
 */
export function installComponent(targetName, options = {}) {
  const norm = normalizeName(targetName);
  const registry = getRegistry();
  const found = registry.find(r => r.name === norm || r.name === norm + 's' || r.name.replace(/s$/, '') === norm);

  if (!found) {
    return {
      success: false,
      message: `Component "${targetName}" không tìm thấy trong workbench/components/`
    };
  }

  const alias = options.as ? normalizeName(options.as) : norm;
  const isCustomAlias = alias !== norm;
  const category = found.category || getComponentCategory(norm);
  const targetWbScssDir = getWorkbenchScssDirForCategory(category);
  const targetClientScssDir = getScssDirForCategory(category);
  const installedFiles = [];
  const installedDependencies = [];

  // Auto-install dependencies if enabled (default true)
  if (options.installDependencies !== false) {
    const deps = COMPONENT_DEPENDENCIES[norm] || [];
    for (const dep of deps) {
      const depMeta = registry.find(r => r.name === dep || r.name === dep + 's' || r.name.replace(/s$/, '') === dep);
      if (depMeta && !depMeta.isInstalled) {
        const depRes = installComponent(dep, {
          force: options.force,
          installDependencies: false,
          includeEjs: false
        });
        if (depRes.success) {
          installedDependencies.push(dep);
          if (Array.isArray(depRes.files)) {
            installedFiles.push(...depRes.files);
          }
        }
      }
    }
  }

  // 1. Copy SCSS to appropriate directory & update corresponding _index.scss
  if (found.scssFile) {
    let srcScss = resolve(targetWbScssDir, found.scssFile);
    let destDir = targetClientScssDir;
    let relBase = category === 'layout' ? 'src/pages/assets/scss/layout' : 'src/pages/assets/scss/component';

    if (!existsSync(srcScss)) {
      srcScss = resolve(WORKBENCH_SCSS_DIR, found.scssFile);
      destDir = CLIENT_SCSS_DIR;
      relBase = 'src/pages/assets/scss/component';
    }

    if (!existsSync(destDir)) {
      mkdirSync(destDir, { recursive: true });
    }
    const destScssName = isCustomAlias ? `_${alias}.scss` : found.scssFile;
    const destScss = resolve(destDir, destScssName);

    if (existsSync(srcScss)) {
      // Conflict check: Safe Overwrite Protection
      if (existsSync(destScss) && !options.force) {
        const existing = readFileSync(destScss, 'utf8');
        const incoming = readFileSync(srcScss, 'utf8');
        // If the existing file is merely an empty template stub, allow seamless overwrite!
        if (!isTemplateStub(existing) && existing.trim() !== incoming.trim()) {
          return {
            success: false,
            conflict: true,
            message: `File "${relBase}/${destScssName}" đã tồn tại và có nội dung tùy chỉnh. Dùng --force để ghi đè hoặc --as <tên_mới> để đổi tên tránh mất code!`
          };
        }
      }

      copyFileSync(srcScss, destScss);
      installedFiles.push(`${relBase}/${destScssName}`);

      const scssBase = basename(destScssName, '.scss').replace(/^_/, '');
      updateClientScssIndex(scssBase, 'add', category);
    }
  }

  // 2. Copy JS to src/pages/assets/js/component/ (ONLY if component has JS)
  if (found.jsFile) {
    if (!existsSync(CLIENT_JS_DIR)) {
      mkdirSync(CLIENT_JS_DIR, { recursive: true });
    }
    const srcJs = resolve(WORKBENCH_JS_DIR, found.jsFile);
    const destJsName = isCustomAlias ? `${alias}.js` : found.jsFile;
    const destJs = resolve(CLIENT_JS_DIR, destJsName);

    if (existsSync(srcJs)) {
      if (existsSync(destJs) && !options.force) {
        const existing = readFileSync(destJs, 'utf8');
        const incoming = readFileSync(srcJs, 'utf8');
        if (existing.trim() !== incoming.trim()) {
          return {
            success: false,
            conflict: true,
            message: `File "src/pages/assets/js/component/${destJsName}" đã tồn tại. Dùng --force để ghi đè hoặc --as <tên_mới> để đổi tên!`
          };
        }
      }

      copyFileSync(srcJs, destJs);
      installedFiles.push(`src/pages/assets/js/component/${destJsName}`);
    }
  }

  // 3. HTML/EJS: Only copied if explicitly requested or for global layout headers/footers
  if (options.includeEjs || (['header', 'footer'].includes(found.category) && options.includeEjs !== false)) {
    if (!existsSync(CLIENT_COMPONENTS_DIR)) {
      mkdirSync(CLIENT_COMPONENTS_DIR, { recursive: true });
    }
    const srcEjs = resolve(WORKBENCH_COMPONENTS_DIR, found.ejsFile);
    const destEjsName = isCustomAlias ? `_${alias}.ejs` : found.ejsFile;
    const destEjs = resolve(CLIENT_COMPONENTS_DIR, destEjsName);
    if (existsSync(srcEjs)) {
      copyFileSync(srcEjs, destEjs);
      installedFiles.push(`src/components/${destEjsName}`);
    }
  }

  return {
    success: true,
    name: alias,
    files: installedFiles,
    hasJs: !!found.jsFile,
    installedDependencies,
    message: installedDependencies.length > 0
      ? `Đã cài đặt "${alias}" và dependencies liên quan (${installedDependencies.join(', ')}). Dùng snippet VS Code để chèn HTML!`
      : `Đã cài đặt SCSS${found.jsFile ? ' & JS' : ''} cho component "${alias}". Dùng snippet VS Code để chèn HTML!`
  };
}

/**
 * Accurately finds the matching closing brace index for a block
 * Strictly ignores braces inside single-quotes, double-quotes, line comments, and block comments
 */
export function findMatchingBrace(text, startIdx) {
  let depth = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;

  for (let i = startIdx; i < text.length; i++) {
    const char = text[i];
    const prev = i > 0 ? text[i - 1] : '';
    const next = i < text.length - 1 ? text[i + 1] : '';

    if (inLineComment) {
      if (char === '\n') inLineComment = false;
      continue;
    }
    if (inBlockComment) {
      if (char === '*' && next === '/') {
        inBlockComment = false;
        i++;
      }
      continue;
    }
    if (inSingleQuote) {
      if (char === "'" && prev !== '\\') inSingleQuote = false;
      continue;
    }
    if (inDoubleQuote) {
      if (char === '"' && prev !== '\\') inDoubleQuote = false;
      continue;
    }

    if (char === '/' && next === '/') { inLineComment = true; i++; continue; }
    if (char === '/' && next === '*') { inBlockComment = true; i++; continue; }
    if (char === "'") { inSingleQuote = true; continue; }
    if (char === '"') { inDoubleQuote = true; continue; }

    if (char === '{') {
      depth++;
    } else if (char === '}') {
      depth--;
      if (depth === 0) return i + 1;
    }
  }
  return -1;
}

/**
 * Extracts all file-level header elements: @use, @forward, top comments, variables, mixins, functions
 */
export function extractFileHeader(fullScss) {
  if (!fullScss) return '';
  let header = '';

  // 1. All @use and @forward statements
  const useMatches = fullScss.match(/@(use|forward)\s+[^;]+;/g) || [];
  if (useMatches.length > 0) {
    header += useMatches.join('\n') + '\n\n';
  }

  // 2. Banner comment (/*! ... */ or /* ... */ at top of file)
  const bannerMatch = fullScss.match(/^(?:\s*@(use|forward)[^;]+;\s*)*(\/\*[\s\S]*?\*\/)/);
  if (bannerMatch && bannerMatch[2]) {
    header += bannerMatch[2].trim() + '\n\n';
  }

  // 3. File-level variables ($var: ...;)
  const varMatches = fullScss.match(/(?:^|\n)(\$[a-zA-Z0-9_-]+\s*:[^;]+;)/g) || [];
  if (varMatches.length > 0) {
    header += varMatches.map(v => v.trim()).join('\n') + '\n\n';
  }

  // 4. File-level @mixin and @function blocks
  const mixinRegex = /(?:^|\n)([ \t]*@(mixin|function)\s+[a-zA-Z0-9_-]+[^{]*\{)/g;
  let mMatch;
  while ((mMatch = mixinRegex.exec(fullScss)) !== null) {
    const startPos = mMatch.index + (mMatch[0].length - mMatch[1].length);
    const bracePos = fullScss.indexOf('{', startPos);
    if (bracePos !== -1) {
      const endPos = findMatchingBrace(fullScss, bracePos);
      if (endPos !== -1) {
        header += fullScss.slice(startPos, endPos).trim() + '\n\n';
      }
    }
  }

  return header.trim();
}

/**
 * Extract SCSS specific to a class/variant from full component SCSS
 */
export function sliceScssForClasses(fullScss, classStr) {
  if (!fullScss || !classStr) return fullScss || '';
  const tokens = classStr.split(/\s+/).filter(Boolean);
  
  // Support single or multiple root classes (e.g. c-card, c-btn)
  const candidateClasses = tokens
    .filter(c => /^[cl]-/.test(c))
    .map(c => c.split('--')[0]);
  
  const uniqueBases = Array.from(new Set(candidateClasses));
  if (uniqueBases.length === 0 && tokens[0]) {
    uniqueBases.push(tokens[0].split('--')[0]);
  }

  const headers = extractFileHeader(fullScss);
  const extractedBlocks = [];

  for (const baseBlockName of uniqueBases) {
    const regex = new RegExp('(?:^|\\n)([ \\t]*\\.' + baseBlockName.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\$&') + '(?![a-zA-Z0-9_-])[^{]*\\{)', 'm');
    const m = fullScss.match(regex);
    if (!m) continue;

    const startIdx = m.index + (m[0].length - m[1].length);
    const openBraceIdx = fullScss.indexOf('{', startIdx);
    if (openBraceIdx === -1) continue;

    const endIdx = findMatchingBrace(fullScss, openBraceIdx);
    if (endIdx === -1) continue;

    const blockContent = fullScss.slice(startIdx, endIdx);

    const activeMods = tokens
      .filter(c => c.startsWith(baseBlockName + '--'))
      .map(c => c.slice(baseBlockName.length));

    const modRegex = /\n([ \t]*&--([a-zA-Z0-9_-]+)(?![a-zA-Z0-9_-])[^{]*\{)/g;
    let match;
    const allMods = [];
    while ((match = modRegex.exec(blockContent)) !== null) {
      const modName = '--' + match[2];
      const modStart = match.index + 1;
      const modBraceIdx = blockContent.indexOf('{', modStart);
      if (modBraceIdx !== -1) {
        const modEnd = findMatchingBrace(blockContent, modBraceIdx);
        if (modEnd !== -1) {
          allMods.push({ name: modName, start: modStart, end: modEnd });
        }
      }
    }

    let filteredBlock = '';
    let lastPos = 0;
    for (const mod of allMods) {
      if (!activeMods.includes(mod.name)) {
        filteredBlock += blockContent.slice(lastPos, mod.start);
        lastPos = mod.end;
      }
    }
    filteredBlock += blockContent.slice(lastPos);
    filteredBlock = filteredBlock.replace(/\n\s*\n\s*\n+/g, '\n\n');
    extractedBlocks.push(filteredBlock.trim());
  }

  if (extractedBlocks.length === 0) return fullScss;

  return (headers ? headers.trim() + '\n\n' : '') + extractedBlocks.join('\n\n').trim();
}

/**
 * Merge an individual variant SCSS into an existing site SCSS file
 */
export function mergeVariantScss(existing, incoming, classStr) {
  if (!existing || isTemplateStub(existing)) return incoming.trim() + '\n';
  if (!incoming || !incoming.trim()) return existing;

  const tokens = (classStr || '').split(/\s+/).filter(Boolean);
  const candidateClasses = tokens
    .filter(c => /^[cl]-/.test(c))
    .map(c => c.split('--')[0]);
  const uniqueBases = Array.from(new Set(candidateClasses));
  if (uniqueBases.length === 0 && tokens[0]) {
    uniqueBases.push(tokens[0].split('--')[0]);
  }

  // Separate headers and body from incoming SCSS
  const matchIncomingFirstRule = incoming.search(/(?:^|\n)\s*[.#%a-zA-Z0-9_-]+\s*\{/);
  const incomingHeaders = matchIncomingFirstRule !== -1 ? incoming.slice(0, matchIncomingFirstRule).trim() : '';
  const incomingBody = matchIncomingFirstRule !== -1 ? incoming.slice(matchIncomingFirstRule).trim() : incoming.trim();

  let merged = existing;

  // Make sure any required @use statements from incoming exist at the top of merged
  if (incomingHeaders) {
    const useMatches = incomingHeaders.match(/@use\s+[^;]+;/g) || [];
    for (const useStmt of useMatches) {
      if (!merged.includes(useStmt)) {
        merged = useStmt + '\n' + merged;
      }
    }
    // Also include any missing file-level variables ($var: ...;)
    const varMatches = incomingHeaders.match(/(?:^|\n)(\$[a-zA-Z0-9_-]+\s*:[^;]+;)/g) || [];
    for (const varStmt of varMatches) {
      const varName = varStmt.match(/\$([a-zA-Z0-9_-]+)/)?.[1];
      if (varName && !merged.includes('$' + varName)) {
        merged = varStmt.trim() + '\n' + merged;
      }
    }
  }

  for (const baseBlockName of uniqueBases) {
    // Check if base block already exists in file
    const baseCheckRegex = new RegExp('\\.' + baseBlockName.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\$&') + '(?![a-zA-Z0-9_-])');
    if (!baseCheckRegex.test(merged)) {
      merged = merged.trim() + '\n\n' + incomingBody + '\n';
      continue;
    }

    // If base block exists, check modifiers
    const activeMods = tokens
      .filter(c => c.startsWith(baseBlockName + '--'))
      .map(c => c.slice(baseBlockName.length));

    for (const mod of activeMods) {
      const modCheckRegex = new RegExp('&' + mod.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\$&') + '(?![a-zA-Z0-9_-])');
      if (modCheckRegex.test(merged)) continue;

      const modExtractRegex = new RegExp('(?:^|\\n)([ \\t]*&' + mod.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\$&') + '(?![a-zA-Z0-9_-])[^{]*\\{)', 'm');
      const m = incoming.match(modExtractRegex);
      if (!m) continue;

      const startIdx = m.index + (m[0].length - m[1].length);
      const modBraceIdx = incoming.indexOf('{', startIdx);
      if (modBraceIdx === -1) continue;

      const endIdx = findMatchingBrace(incoming, modBraceIdx);
      if (endIdx === -1) continue;

      const modBlock = incoming.slice(startIdx, endIdx);

      const baseRegex = new RegExp('(?:^|\\n)([ \\t]*\\.' + baseBlockName.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\$&') + '(?![a-zA-Z0-9_-])[^{]*\\{)', 'm');
      const bMatch = merged.match(baseRegex);
      if (!bMatch) continue;

      const bStart = bMatch.index + (bMatch[0].length - bMatch[1].length);
      const bOpenBrace = merged.indexOf('{', bStart);
      if (bOpenBrace === -1) continue;

      const bEnd = findMatchingBrace(merged, bOpenBrace);
      if (bEnd !== -1) {
        const insertPos = bEnd - 1;
        merged = merged.slice(0, insertPos) + '    ' + modBlock.trim() + '\n' + merged.slice(insertPos);
      }
    }
  }

  return merged.replace(/\n\s*\n\s*\n+/g, '\n\n').trim() + '\n';
}

/**
 * Check if a specific component variant is already installed in site
 */
export function isVariantInstalled(compName, classStr) {
  const norm = normalizeName(compName);
  const category = getComponentCategory(norm);
  const targetClientScssDir = getScssDirForCategory(category);
  const scssFile = findMatchingScss(norm, targetClientScssDir);
  if (!scssFile) return false;

  const destScssPath = resolve(targetClientScssDir, scssFile);
  if (!existsSync(destScssPath)) return false;

  const existing = readFileSync(destScssPath, 'utf8');
  if (isTemplateStub(existing)) return false;

  const tokens = (classStr || '').split(/\s+/).filter(Boolean);
  const mainClass = tokens.find(c => /^[cl]-/.test(c)) || tokens[0];
  if (!mainClass) return true;

  const baseBlockName = mainClass.split('--')[0];
  const baseRegex = new RegExp('\\.' + baseBlockName.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\$&') + '(?![a-zA-Z0-9_-])');
  if (!baseRegex.test(existing)) return false;

  const activeMods = tokens
    .filter(c => c.startsWith(baseBlockName + '--'))
    .map(c => c.slice(baseBlockName.length));

  for (const mod of activeMods) {
    const modRegex = new RegExp('&' + mod.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\$&') + '(?![a-zA-Z0-9_-])');
    if (!modRegex.test(existing)) return false;
  }

  return true;
}

/**
 * Install an individual component variant into site
 */
export function installVariant(compName, variantData = {}) {
  const norm = normalizeName(compName);
  const category = getComponentCategory(norm);
  const targetClientScssDir = getScssDirForCategory(category);
  const targetWbScssDir = getWorkbenchScssDirForCategory(category);

  if (!existsSync(targetClientScssDir)) {
    mkdirSync(targetClientScssDir, { recursive: true });
  }

  let scssFileName = findMatchingScss(norm, targetClientScssDir);
  if (!scssFileName) {
    scssFileName = findMatchingScss(norm, targetWbScssDir) || `_${norm}.scss`;
  }
  const destScssPath = resolve(targetClientScssDir, scssFileName);

  let incomingScss = variantData.scssCode;
  const wbScssPath = resolve(targetWbScssDir, scssFileName);
  let fullWbScss = '';
  if (existsSync(wbScssPath)) {
    fullWbScss = readFileSync(wbScssPath, 'utf8');
  }

  if (!incomingScss && fullWbScss) {
    incomingScss = sliceScssForClasses(fullWbScss, variantData.classStr);
  }

  let finalScss = incomingScss || '';

  if (existsSync(destScssPath)) {
    const existing = readFileSync(destScssPath, 'utf8');
    if (!isTemplateStub(existing)) {
      finalScss = mergeVariantScss(existing, incomingScss, variantData.classStr);
    }
  }

  writeFileSync(destScssPath, finalScss.trim() + '\n', 'utf8');

  // Ensure @use in _index.scss
  const scssBase = basename(scssFileName, '.scss').replace(/^_/, '');
  updateClientScssIndex(scssBase, 'add', category);

  // Copy JS if component has JS
  const wbJsFile = findMatchingJs(norm, WORKBENCH_JS_DIR);
  if (wbJsFile) {
    if (!existsSync(CLIENT_JS_DIR)) {
      mkdirSync(CLIENT_JS_DIR, { recursive: true });
    }
    const destJs = resolve(CLIENT_JS_DIR, wbJsFile);
    if (!existsSync(destJs)) {
      const srcJs = resolve(WORKBENCH_JS_DIR, wbJsFile);
      if (existsSync(srcJs)) {
        copyFileSync(srcJs, destJs);
      }
    }
  }

  return {
    success: true,
    component: norm,
    classStr: variantData.classStr,
    title: variantData.variantTitle,
    scssFile: scssFileName,
    message: `Đã import riêng component "${variantData.variantTitle || variantData.classStr}" vào site!`
  };
}

/**
 * Remove a component from src/
 * Safe Removal Protection: Prevents accidental loss of custom code.
 */
export function removeComponent(targetName, options = {}) {
  const norm = normalizeName(targetName);
  const registry = getRegistry();
  const found = registry.find(r => r.name === norm || r.name === norm + 's' || r.name.replace(/s$/, '') === norm);

  if (!found) {
    return {
      success: false,
      message: `Component "${targetName}" không tồn tại trong registry`
    };
  }

  const category = found.category || getComponentCategory(norm);
  const targetWbScssDir = getWorkbenchScssDirForCategory(category);
  const targetClientScssDir = getScssDirForCategory(category);

  let clientScss = resolve(targetClientScssDir, found.scssFile);
  let srcScss = resolve(targetWbScssDir, found.scssFile);
  let usedClientDir = targetClientScssDir;
  let relBase = category === 'layout' ? 'src/pages/assets/scss/layout' : 'src/pages/assets/scss/component';

  if (!existsSync(clientScss) && !existsSync(srcScss)) {
    clientScss = resolve(CLIENT_SCSS_DIR, found.scssFile);
    srcScss = resolve(WORKBENCH_SCSS_DIR, found.scssFile);
    usedClientDir = CLIENT_SCSS_DIR;
    relBase = 'src/pages/assets/scss/component';
  }

  // Safe Removal Guard: Warn if developer has custom edits
  if (!options.force && found.scssFile) {
    if (existsSync(clientScss) && existsSync(srcScss)) {
      const clientContent = readFileSync(clientScss, 'utf8');
      const wbContent = readFileSync(srcScss, 'utf8');
      // If client file is just a template stub, allow removal without warning
      if (!isTemplateStub(clientContent) && clientContent.trim() !== wbContent.trim()) {
        return {
          success: false,
          conflict: true,
          message: `⚠️ File "${found.scssFile}" trong site đã được chỉnh sửa khác với bản mẫu. Gỡ bỏ sẽ làm mất code! Dùng --force để xác nhận gỡ bỏ hoặc "npm run save" để lưu lại trước.`
        };
      }
    }
  }

  const removedFiles = [];

  // 1. Remove SCSS & clean _index.scss
  if (found.scssFile) {
    if (existsSync(clientScss)) {
      unlinkSync(clientScss);
      removedFiles.push(`${relBase}/${found.scssFile}`);
    }
    const scssBase = basename(found.scssFile, '.scss').replace(/^_/, '');
    updateClientScssIndex(scssBase, 'remove', category);
  }

  // 2. Remove JS
  if (found.jsFile) {
    const clientJs = resolve(CLIENT_JS_DIR, found.jsFile);
    if (existsSync(clientJs)) {
      unlinkSync(clientJs);
      removedFiles.push(`src/pages/assets/js/component/${found.jsFile}`);
    }
  }

  // 3. Remove EJS if it was previously created
  const clientEjs = resolve(CLIENT_COMPONENTS_DIR, found.ejsFile);
  if (existsSync(clientEjs)) {
    unlinkSync(clientEjs);
    removedFiles.push(`src/components/${found.ejsFile}`);
  }

  return {
    success: true,
    name: found.name,
    removedFiles,
    message: `Đã gỡ bỏ component "${found.name}" khỏi site chính.`
  };
}

/**
 * Export/Save component from src/ to workbench/ (Template Showroom)
 * Supports custom destination alias with options.as
 */
export function saveComponent(srcName, options = {}) {
  const norm = normalizeName(srcName);
  const targetName = options.as ? normalizeName(options.as) : norm;
  const category = getComponentCategory(srcName);
  const targetClientScssDir = getScssDirForCategory(category);
  const targetWbScssDir = getWorkbenchScssDirForCategory(category);

  // Find source EJS in src/components/
  let srcEjsFile = null;
  const ejsCandidates = [`_${norm}.ejs`, `${norm}.ejs`];
  for (const c of ejsCandidates) {
    const p = resolve(CLIENT_COMPONENTS_DIR, c);
    if (existsSync(p)) {
      srcEjsFile = p;
      break;
    }
  }

  // Find source SCSS in targetClientScssDir or CLIENT_SCSS_DIR
  let srcScssFile = null;
  let scssMatch = findMatchingScss(norm, targetClientScssDir);
  if (scssMatch) {
    srcScssFile = resolve(targetClientScssDir, scssMatch);
  } else {
    scssMatch = findMatchingScss(norm, CLIENT_SCSS_DIR);
    if (scssMatch) {
      srcScssFile = resolve(CLIENT_SCSS_DIR, scssMatch);
    }
  }

  // Find source JS in src/pages/assets/js/component/ or src/pages/assets/js/
  let srcJsFile = null;
  const jsCandidates = [
    resolve(CLIENT_JS_DIR, `${norm}.js`),
    resolve(ROOT, 'src/pages/assets/js', `${norm}.js`)
  ];
  for (const p of jsCandidates) {
    if (existsSync(p)) {
      srcJsFile = p;
      break;
    }
  }

  if (!srcEjsFile && !srcScssFile && !srcJsFile) {
    return {
      success: false,
      message: `Không tìm thấy file liên quan nào cho component "${srcName}" trong src/`
    };
  }

  // Safe Overwrite Protection: Protect workbench master components
  if (!options.force && srcScssFile) {
    const destScss = resolve(targetWbScssDir, `_${targetName}.scss`);
    if (existsSync(destScss)) {
      const existingWb = readFileSync(destScss, 'utf8');
      const incomingSrc = readFileSync(srcScssFile, 'utf8');
      if (existingWb.trim() !== incomingSrc.trim()) {
        return {
          success: false,
          conflict: true,
          message: `⚠️ Component "${targetName}" đã có sẵn trong Workbench với nội dung khác. Dùng --force để ghi đè hoặc --as <tên_mới> để lưu thành component mới!`
        };
      }
    }
  }

  const savedFiles = [];

  // 1. Copy EJS to workbench/components/_<target>.ejs
  if (srcEjsFile) {
    if (!existsSync(WORKBENCH_COMPONENTS_DIR)) {
      mkdirSync(WORKBENCH_COMPONENTS_DIR, { recursive: true });
    }
    const destEjs = resolve(WORKBENCH_COMPONENTS_DIR, `_${targetName}.ejs`);
    copyFileSync(srcEjsFile, destEjs);
    savedFiles.push(`workbench/components/_${targetName}.ejs`);
  }

  // 2. Copy SCSS to targetWbScssDir/_<target>.scss
  if (srcScssFile) {
    if (!existsSync(targetWbScssDir)) {
      mkdirSync(targetWbScssDir, { recursive: true });
    }
    const destScss = resolve(targetWbScssDir, `_${targetName}.scss`);
    copyFileSync(srcScssFile, destScss);
    const relWb = category === 'layout' ? `workbench/layout/_${targetName}.scss` : `workbench/scss/_${targetName}.scss`;
    savedFiles.push(relWb);
    // Ensure @use in workbench index
    updateWorkbenchScss(targetName, 'add', category);
  }

  // 3. Copy JS to workbench/js/<target>.js
  if (srcJsFile) {
    if (!existsSync(WORKBENCH_JS_DIR)) {
      mkdirSync(WORKBENCH_JS_DIR, { recursive: true });
    }
    const destJs = resolve(WORKBENCH_JS_DIR, `${targetName}.js`);
    copyFileSync(srcJsFile, destJs);
    savedFiles.push(`workbench/js/${targetName}.js`);
  }

  return {
    success: true,
    name: targetName,
    savedFiles,
    message: `Đã lưu thành công component "${targetName}" vào workbench showroom!`
  };
}

