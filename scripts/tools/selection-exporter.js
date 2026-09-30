/**
 * scripts/tools/selection-exporter.js
 * High-Speed VS Code Component Exporter
 * 
 * Extracts HTML components directly from developer's active editor selection or cursor:
 * 1. Auto-detects component block and root class (e.g. c-accordion -> accordion)
 * 2. Auto-collects matching SCSS styles from src/pages/assets/scss/
 * 3. Auto-collects matching JS logic from src/pages/assets/js/
 * 4. Saves and registers into workbench/ showroom
 * 5. Auto-generates VS Code snippets & rebuilds showroom in < 1 second!
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync, readdirSync, copyFileSync, rmSync } from 'fs';
import { resolve, dirname, basename, extname } from 'path';
import { execSync } from 'child_process';
import {
  ROOT,
  WORKBENCH_COMPONENTS_DIR,
  WORKBENCH_SCSS_DIR,
  WORKBENCH_LAYOUT_DIR,
  WORKBENCH_JS_DIR,
  CLIENT_SCSS_DIR,
  CLIENT_LAYOUT_DIR,
  CLIENT_JS_DIR
} from './config.js';
import {
  normalizeName,
  getComponentCategory,
  findMatchingScss,
  findMatchingJs,
  updateWorkbenchScss,
  isTemplateStub,
  sliceScssForClasses,
  mergeVariantScss,
  mergeComponentJs,
  sliceJsForComponent,
  parseComponentMetadata
} from './component-service.js';
import { syncSnippets } from '../sync-snippets.js';
import { buildWorkbench } from '../builders/workbench.js';
import { resolveSafePath } from './safety.js';

/**
 * Reads text from system clipboard (Windows powershell)
 */
export function getClipboardText() {
  try {
    const output = execSync('powershell -NoProfile -Command "Get-Clipboard"', {
      encoding: 'utf8',
      timeout: 1000,
      stdio: ['pipe', 'pipe', 'ignore']
    });
    return output ? output.trim() : '';
  } catch {
    return '';
  }
}

/**
 * Parses component HTML snippet to auto-detect root class, name, and category
 */
export function parseComponentHtml(html) {
  if (!html || !html.trim()) return null;
  const trimmed = html.trim();

  // Find root tag and class: <(div|section|header|footer|details|...) ... class="..."
  const tagMatch = trimmed.match(/^<([a-zA-Z0-9-]+)[^>]*class=["']([^"']+)["']/i);
  let rootClass = '';
  let compName = '';

  if (tagMatch) {
    const classAttr = tagMatch[2];
    const classes = classAttr.split(/\s+/).filter(Boolean);
    // Prioritize c-* or l-* class
    const compClass = classes.find(c => /^[cl]-/.test(c)) || classes[0];
    if (compClass) {
      rootClass = compClass;
      // Extract base name: c-accordion__head -> accordion, c-header-01 -> header_01, l-flex -> flexs
      let rawBase = compClass.replace(/^[cl]-/, '').split(/__|--/)[0];
      compName = normalizeName(rawBase);
      // Handle known plurals (flex -> flexs, grid -> grids, btn -> btns, text -> texts, title -> titles, list -> lists)
      if (['flex', 'grid', 'btn', 'text', 'title', 'list', 'tbl'].includes(compName)) {
        compName = compName + 's';
      }
    }
  }

  // Fallback: search for any c-* or l-* inside snippet
  if (!compName) {
    const anyCompMatch = trimmed.match(/class=["'][^"']*\b([cl]-([a-zA-Z0-9_-]+))/i);
    if (anyCompMatch) {
      rootClass = anyCompMatch[1];
      let rawBase = anyCompMatch[2].split(/__|--/)[0];
      compName = normalizeName(rawBase);
      if (['flex', 'grid', 'btn', 'text', 'title', 'list', 'tbl'].includes(compName)) {
        compName = compName + 's';
      }
    }
  }

  if (!compName) return null;

  let category = 'component';
  if (rootClass.startsWith('l-') || rootClass.startsWith('l_')) {
    category = 'layout';
  } else {
    category = getComponentCategory(compName);
  }

  // Extract all classes present in the entire HTML block
  const classMatches = trimmed.matchAll(/class=["']([^"']+)["']/gi);
  const allClassesSet = new Set();
  if (rootClass) allClassesSet.add(rootClass);
  for (const m of classMatches) {
    m[1].split(/\s+/).filter(Boolean).forEach(c => {
      if (!c.includes('<%') && !c.includes('%>')) {
        allClassesSet.add(c);
      }
    });
  }
  const allClasses = Array.from(allClassesSet);

  return {
    rootClass,
    compName,
    category,
    allClasses
  };
}

/**
 * Extracts balanced HTML tag block around a given line number in a file
 */
export function extractTagBlockFromFile(filePath, targetLine) {
  if (!filePath || typeof filePath !== 'string') return null;
  let safePath;
  try {
    safePath = resolveSafePath(ROOT, filePath, 'extractTagBlockFromFile');
  } catch {
    return null;
  }
  if (!existsSync(safePath)) return null;
  const content = readFileSync(safePath, 'utf8');
  const lines = content.split(/\r?\n/);
  const targetIdx = Math.max(0, parseInt(targetLine, 10) - 1);

  const isBlockRootTag = (line) => {
    const match = line.match(/<([a-zA-Z0-9-]+)[^>]*class=["']([^"']+)["']/i);
    if (!match) return null;
    const tagName = match[1];
    const classes = match[2].split(/\s+/).filter(Boolean);
    const blockClass = classes.find(c => /^[cl]-[a-zA-Z0-9_-]+$/.test(c) && !c.includes('__'));
    if (blockClass) {
      return { tagName, blockClass };
    }
    return null;
  };

  // 1. Search upwards to find start tag with c-* or l-* block class
  let startLine = -1;
  let rootTagName = '';

  for (let i = targetIdx; i >= 0; i--) {
    const found = isBlockRootTag(lines[i]);
    if (found) {
      startLine = i;
      rootTagName = found.tagName;
      break;
    }
  }

  // If not found above, search forward from targetLine
  if (startLine === -1) {
    for (let i = targetIdx; i < Math.min(lines.length, targetIdx + 15); i++) {
      const found = isBlockRootTag(lines[i]);
      if (found) {
        startLine = i;
        rootTagName = found.tagName;
        break;
      }
    }
  }

  if (startLine === -1 || !rootTagName) return null;

  // 2. Count nesting of rootTagName to find matching closing tag
  let depth = 0;
  let endLine = -1;
  const tagOpenRegex = new RegExp(`<${rootTagName}(\\s+[^>]*)?>`, 'gi');
  const tagCloseRegex = new RegExp(`</${rootTagName}>`, 'gi');
  const selfCloseRegex = new RegExp(`<${rootTagName}(\\s+[^>]*)?\\/>`, 'gi');

  for (let i = startLine; i < lines.length; i++) {
    const line = lines[i];
    const opens = (line.match(tagOpenRegex) || []).length;
    const closes = (line.match(tagCloseRegex) || []).length;
    const selfCloses = (line.match(selfCloseRegex) || []).length;

    depth += (opens - selfCloses);
    depth -= closes;

    if (depth <= 0) {
      endLine = i;
      break;
    }
  }

  if (endLine === -1) endLine = startLine;

  const extractedLines = lines.slice(startLine, endLine + 1);
  const baseIndent = (extractedLines[0].match(/^\s*/) || [''])[0];
  const deindented = extractedLines
    .map(line => line.startsWith(baseIndent) ? line.slice(baseIndent.length) : line)
    .join('\n');

  return deindented.trim();
}

/**
 * Searches site for matching SCSS rules belonging to the component
 * Enhanced with Deep Scanning & Slicing across all SCSS files (e.g. finds .c-toggle in _btn.scss)
 */
export function findComponentScssInSite(compName, classesInput = []) {
  const norm = normalizeName(compName);
  const category = getComponentCategory(norm);
  const searchDirs = [
    category === 'layout' ? CLIENT_LAYOUT_DIR : CLIENT_SCSS_DIR,
    CLIENT_SCSS_DIR,
    CLIENT_LAYOUT_DIR
  ];

  const classList = Array.isArray(classesInput)
    ? classesInput
    : (typeof classesInput === 'string' && classesInput ? [classesInput] : []);

  // Pass 1: Direct file name matching (_<name>.scss)
  for (const dir of searchDirs) {
    if (!existsSync(dir)) continue;
    const match = findMatchingScss(norm, dir);
    if (match) {
      const fullPath = resolve(dir, match);
      const content = readFileSync(fullPath, 'utf8');
      if (!isTemplateStub(content)) {
        const inLayout = dir === CLIENT_LAYOUT_DIR;
        return {
          fileName: match,
          filePath: fullPath,
          category: inLayout ? 'layout' : 'component',
          content: content.trim(),
          isSliced: false
        };
      }
    }
  }

  // Pass 2: Deep Content Search: find WHICH EXACT FILE in site contains ANY class in this block
  const targetClasses = Array.from(new Set([
    ...classList,
    ...classList.map(c => c.split(/__|--/)[0]),
    `c-${norm}`,
    `l-${norm}`,
    norm
  ].filter(Boolean)));

  for (const dir of [CLIENT_SCSS_DIR, CLIENT_LAYOUT_DIR]) {
    if (!existsSync(dir)) continue;
    const files = readdirSync(dir).filter(f => f.startsWith('_') && f.endsWith('.scss') && f !== '_index.scss');
    for (const file of files) {
      const fullPath = resolve(dir, file);
      const content = readFileSync(fullPath, 'utf8');
      for (const targetClass of targetClasses) {
        const classRegex = new RegExp('(?:^|\\n)[ \\t]*\\.' + targetClass.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\$&') + '(?![a-zA-Z0-9_-])[^{]*\\{', 'm');
        if (classRegex.test(content) && !isTemplateStub(content)) {
          const inLayout = dir === CLIENT_LAYOUT_DIR;
          return {
            fileName: file,
            filePath: fullPath,
            category: inLayout ? 'layout' : 'component',
            content: content.trim()
          };
        }
      }
    }
  }

  return null;
}

/**
 * Searches site for matching JS module belonging to the component
 * Strictly mirrors real site JS without generating synthetic code
 */
export function findComponentJsInSite(compName, classesInput = []) {
  const norm = normalizeName(compName);
  const assetsJsDir = resolve(ROOT, 'src/pages/assets/js');

  const classList = Array.isArray(classesInput)
    ? classesInput
    : (typeof classesInput === 'string' && classesInput ? [classesInput] : []);

  // Strategy A: Standalone in src/pages/assets/js/component/<name>.js
  if (existsSync(CLIENT_JS_DIR)) {
    const directFile = resolve(CLIENT_JS_DIR, `${norm}.js`);
    if (existsSync(directFile)) {
      return {
        fileName: `${norm}.js`,
        filePath: directFile,
        content: readFileSync(directFile, 'utf8').trim()
      };
    }
  }

  // Strategy B: Dedicated JS file in src/pages/assets/js/<name>.js
  if (existsSync(assetsJsDir)) {
    const directRootJs = resolve(assetsJsDir, `${norm}.js`);
    if (existsSync(directRootJs)) {
      return {
        fileName: `${norm}.js`,
        filePath: directRootJs,
        content: readFileSync(directRootJs, 'utf8').trim()
      };
    }

    // Strategy C: Delimited module in any file in src/pages/assets/js/
    const jsFiles = readdirSync(assetsJsDir).filter(f => f.endsWith('.js') && !f.endsWith('.min.js'));
    const candidateNames = Array.from(new Set([
      norm,
      ...classList.map(c => c.replace(/^[cl]-/, '')),
      ...classList
    ].filter(Boolean)));

    for (const f of jsFiles) {
      const fullPath = resolve(assetsJsDir, f);
      const content = readFileSync(fullPath, 'utf8');
      for (const nameCandidate of candidateNames) {
        const sliced = sliceJsForComponent(content, nameCandidate);
        if (sliced && sliced !== content.trim()) {
          return {
            fileName: f,
            filePath: fullPath,
            sourceFile: `src/pages/assets/js/${f}`,
            content: sliced,
            isShared: f === 'common.js' || f === 'top.js'
          };
        }
      }
    }

    // Strategy D: Smart Scanner - Detect selector interactions in site JS (e.g. common.js, top.js)
    const selectors = Array.from(new Set([
      ...classList.map(c => `.${c}`),
      ...classList,
      `.c-${norm}`,
      `.js-${norm}`,
      `$${norm}`
    ].filter(Boolean)));

    for (const f of jsFiles) {
      const fullPath = resolve(assetsJsDir, f);
      const code = readFileSync(fullPath, 'utf8');
      
      for (const sel of selectors) {
        const selIdx = code.indexOf(sel);
        if (selIdx !== -1) {
          // Extract enclosing top-level block / closure
          const before = code.substring(0, selIdx);
          const lines = before.split(/\r?\n/);
          let startLineIdx = -1;

          for (let i = lines.length - 1; i >= 0; i--) {
            const line = lines[i];
            if (/^(?:\/\*[\s\S]*?\*\/|\/\/[^\n]*\n)*\s*(?:\(function\b|\$\(document\b|\$\(function\b|function\b|const\s+[a-zA-Z0-9_$]+\s*=\s*(?:function|\([^)]*\)\s*=>)|document\.addEventListener\b)/.test(line)) {
              startLineIdx = i;
              break;
            }
          }

          if (startLineIdx !== -1) {
            const allLines = code.split(/\r?\n/);
            const startCharIdx = allLines.slice(0, startLineIdx).join('\n').length + (startLineIdx > 0 ? 1 : 0);
            let depth = 0;
            let foundFirstBrace = false;
            let endIdx = -1;

            for (let i = startCharIdx; i < code.length; i++) {
              if (code[i] === '{') {
                depth++;
                foundFirstBrace = true;
              } else if (code[i] === '}') {
                depth--;
                if (foundFirstBrace && depth === 0) {
                  const remainder = code.substring(i + 1);
                  const trailingMatch = remainder.match(/^\s*\)\s*\([a-zA-Z0-9_$.,\s'":!=]*\);?/);
                  if (trailingMatch) {
                    endIdx = i + 1 + trailingMatch[0].length;
                  } else {
                    const semiMatch = remainder.match(/^\s*\)?;?/);
                    endIdx = i + 1 + (semiMatch ? semiMatch[0].length : 0);
                  }
                  break;
                }
              }
            }

            if (endIdx !== -1) {
              let extracted = code.substring(startCharIdx, endIdx).trim();

              // Reject if this is a global multi-feature site script rather than a component module
              const isGlobalSiteScript = (
                (extracted.includes('inview.observer') || extracted.includes('AOS.init') || extracted.includes('ScrollHint') || extracted.includes('addFixedBodyModal')) &&
                !selectors.some(s => /inview|modal|scroll/i.test(s))
              );
              if (isGlobalSiteScript) {
                continue;
              }

              // Must have actual event binding or function targeting the selector
              const hasDirectInteraction = selectors.some(s => {
                const escaped = s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                return new RegExp(`${escaped}[^\\n;]*?\\.(?:on|addEventListener|click|toggleClass|slideToggle)\\b`).test(extracted) ||
                       new RegExp(`\\$\\(['"]${escaped}['"]\\)\\.(?:on|addEventListener|click|toggleClass|slideToggle)\\b`).test(extracted);
              });

              if (!hasDirectInteraction && !extracted.includes(`[Component Module: ${norm}]`)) {
                continue;
              }

              if (!extracted.startsWith('(function') && extracted.includes('$(')) {
                extracted = `(function ($) {\n  ${extracted}\n})(typeof jQuery !== 'undefined' ? jQuery : window.$);`;
              }
              return {
                fileName: f,
                sourceFile: `src/pages/assets/js/${f}`,
                content: `// [Component Module: ${norm}]\n` + extracted,
                isShared: f === 'common.js' || f === 'top.js'
              };
            }
          }
        }
      }
    }
  }

  // Strategy E: Reference backup check
  const backupJs = resolve(ROOT, `workbench__backup/js/${norm}.js`);
  if (existsSync(backupJs)) {
    return {
      fileName: `${norm}.js`,
      content: readFileSync(backupJs, 'utf8').trim()
    };
  }

  return null;
}

/**
 * Main Orchestration Function: Exports selected component into Workbench Showroom
 */
export async function exportSelectionToWorkbench(options = {}) {
  let html = (options.html || '').trim();

  // 0. If temporary selection file from VS Code Extension exists, read & consume it
  const tempFile = resolve(ROOT, '.vscode/.temp-selection.html');
  if (!html && existsSync(tempFile)) {
    try {
      const tempContent = readFileSync(tempFile, 'utf8');
      if (tempContent && tempContent.trim()) {
        html = tempContent.trim();
      }
      try {
        import('fs').then(fs => fs.unlinkSync(tempFile));
      } catch {}
    } catch {}
  }

  // 1. If HTML is not provided directly, try reading from clipboard
  if (!html) {
    const clip = getClipboardText();
    if (clip && (clip.includes('class=') && (clip.includes('c-') || clip.includes('l-')))) {
      html = clip;
    }
  }

  // 2. If still no HTML and file + line provided, extract from file
  if (!html && options.filePath && options.lineNumber) {
    try {
      const safePath = resolveSafePath(ROOT, options.filePath, 'exportSelectionToWorkbench filePath');
      html = extractTagBlockFromFile(safePath, options.lineNumber);
    } catch {
      html = null;
    }
  }

  if (!html) {
    return {
      success: false,
      message: 'Không tìm thấy khối mã HTML component nào từ vùng chọn hoặc clipboard!'
    };
  }

  // 3. Auto-detect component name & category
  const meta = parseComponentHtml(html);
  const targetName = options.name ? normalizeName(options.name) : (meta?.compName || 'custom-component');
  const category = meta?.category || getComponentCategory(targetName);
  const displayTitle = options.title || (targetName.charAt(0).toUpperCase() + targetName.slice(1));

  const savedFiles = [];

  // 4. Save SCSS into workbench (Slice component-specific rules, avoid copying unrelated components in shared file!)
  const blockClasses = (meta?.allClasses && meta.allClasses.length > 0)
    ? meta.allClasses
    : [meta?.rootClass || `c-${targetName}`];

  const foundScss = findComponentScssInSite(targetName, blockClasses);
  let customScssMeta = null;
  if (foundScss && foundScss.content) {
    const scssCategory = foundScss.category || category;
    const targetWbScssDir = scssCategory === 'layout' ? WORKBENCH_LAYOUT_DIR : WORKBENCH_SCSS_DIR;
    if (!existsSync(targetWbScssDir)) {
      mkdirSync(targetWbScssDir, { recursive: true });
    }

    const destScss = resolve(targetWbScssDir, foundScss.fileName);
    const classQuery = blockClasses.join(' ');
    
    // Slice ONLY this component's rules!
    const sliced = sliceScssForClasses(foundScss.content, classQuery);
    const componentScss = sliced || foundScss.content;

    let finalScss = componentScss;
    if (existsSync(destScss)) {
      const existing = readFileSync(destScss, 'utf8');
      finalScss = mergeVariantScss(existing, componentScss, classQuery);
    }

    writeFileSync(destScss, finalScss.trimEnd() + '\n', 'utf8');
    savedFiles.push(`workbench/scss/${scssCategory === 'layout' ? 'layout' : 'component'}/${foundScss.fileName}`);

    const scssBaseName = basename(foundScss.fileName, '.scss').replace(/^_/, '');
    updateWorkbenchScss(scssBaseName, 'add', scssCategory);

    // If the file name in site differs from component name, record it in frontmatter
    if (foundScss.fileName !== `_${targetName}.scss` && foundScss.fileName !== `_${targetName}s.scss`) {
      customScssMeta = foundScss.fileName;
      // Clean up any obsolete artificially created SCSS file for this component name
      const obsoleteScss = resolve(targetWbScssDir, `_${targetName}.scss`);
      if (existsSync(obsoleteScss)) {
        try {
          rmSync(obsoleteScss, { force: true });
          updateWorkbenchScss(targetName, 'remove', scssCategory);
        } catch {}
      }
    }
  }

  // 5. Look up and mirror JS for this component if exists on site
  const foundJs = findComponentJsInSite(targetName, blockClasses);
  let customJsMeta = null;
  if (foundJs && foundJs.content) {
    if (!existsSync(WORKBENCH_JS_DIR)) {
      mkdirSync(WORKBENCH_JS_DIR, { recursive: true });
    }
    const destJs = resolve(WORKBENCH_JS_DIR, foundJs.fileName);
    let finalJs = foundJs.content.trimEnd() + '\n';
    if (existsSync(destJs) && (foundJs.fileName === 'common.js' || foundJs.isShared)) {
      const existing = readFileSync(destJs, 'utf8');
      finalJs = mergeComponentJs(existing, foundJs.content, targetName);
    }
    writeFileSync(destJs, finalJs, 'utf8');
    savedFiles.push(`workbench/js/${foundJs.fileName}`);
    customJsMeta = foundJs.fileName;

    // Clean up any obsolete separate JS file for this component name
    if (foundJs.fileName !== `${targetName}.js`) {
      const obsoleteJs = resolve(WORKBENCH_JS_DIR, `${targetName}.js`);
      if (existsSync(obsoleteJs)) {
        try { rmSync(obsoleteJs, { force: true }); } catch {}
      }
    }
  } else {
    // If site does not have JS for this component, clean up any obsolete artificial JS in workbench
    const obsoleteJs = resolve(WORKBENCH_JS_DIR, `${targetName}.js`);
    if (existsSync(obsoleteJs)) {
      try { rmSync(obsoleteJs, { force: true }); } catch {}
    }
  }

  // 6. Save/Append HTML to workbench/components/_<targetName>.ejs
  if (!existsSync(WORKBENCH_COMPONENTS_DIR)) {
    mkdirSync(WORKBENCH_COMPONENTS_DIR, { recursive: true });
  }
  const destEjs = resolve(WORKBENCH_COMPONENTS_DIR, `_${targetName}.ejs`);
  const itemBlock = `<div class="p-component__item">\n    <!-- ${displayTitle} -->\n${html.split('\n').map(l => '    ' + l).join('\n')}\n</div>\n`;

  let existingEjs = existsSync(destEjs) ? readFileSync(destEjs, 'utf8') : '';
  if (existingEjs.trim()) {
    const { meta: existingMeta, content: existingClean } = parseComponentMetadata(existingEjs);
    const normExisting = existingClean.replace(/\s+/g, ' ').trim();
    const normSnippet = html.replace(/\s+/g, ' ').trim();
    const mergedMeta = { ...existingMeta };
    let metaChanged = false;
    if (customScssMeta && mergedMeta.scss !== customScssMeta) {
      mergedMeta.scss = customScssMeta;
      metaChanged = true;
    }
    if (customJsMeta && mergedMeta.js !== customJsMeta) {
      mergedMeta.js = customJsMeta;
      metaChanged = true;
    }
    const snippetMissing = !normExisting.includes(normSnippet);
    if (snippetMissing || metaChanged) {
      const yamlBlock = Object.keys(mergedMeta).length > 0
        ? `---\n${Object.entries(mergedMeta).map(([k, v]) => `${k}: ${v}`).join('\n')}\n---\n`
        : '';
      const body = snippetMissing ? existingClean.trimEnd() + '\n\n' + itemBlock : existingClean.trim();
      writeFileSync(destEjs, yamlBlock + body, 'utf8');
    }
  } else {
    const metaEntries = [];
    if (customScssMeta) metaEntries.push(`scss: ${customScssMeta}`);
    if (customJsMeta) metaEntries.push(`js: ${customJsMeta}`);
    const yamlHeader = metaEntries.length > 0 ? `---\n${metaEntries.join('\n')}\n---\n` : '';
    writeFileSync(destEjs, yamlHeader + itemBlock, 'utf8');
  }
  savedFiles.push(`workbench/components/_${targetName}.ejs`);

  // 7. Auto-sync VS Code snippets & rebuild Workbench
  try { syncSnippets({ quiet: true }); } catch {}
  try { await buildWorkbench({ force: true }); } catch {}

  return {
    success: true,
    name: targetName,
    category,
    savedFiles,
    hasScss: !!foundScss,
    hasJs: !!foundJs,
    message: `Đã đưa component "${targetName}" vào Workbench Showroom thành công!`
  };
}
