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
  mergeComponentScss,
  mergeComponentJs,
  sliceJsForComponent,
  stripEjsShowroomWrapper,
  getComponentJsRange,
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
  let trimmed = html.trim();

  // If wrapped in showroom container (e.g. <div class="p-component__item">...</div>), unwrap it first!
  const showroomWrapperMatch = trimmed.match(/^<div\s+class=["'][^"']*p-component[^"']*["'][^>]*>([\s\S]*?)<\/div>$/i);
  if (showroomWrapperMatch) {
    trimmed = showroomWrapperMatch[1].trim();
  }

  // Strip leading HTML comments to reveal actual root element
  trimmed = trimmed.replace(/^<!--[\s\S]*?-->\s*/, '');

  // Find root tag and class: <(div|section|header|footer|details|...) ... class="..."
  const tagMatch = trimmed.match(/^<([a-zA-Z0-9-]+)[^>]*class=["']([^"']+)["']/i);
  let rootClass = '';
  let compName = '';

  if (tagMatch) {
    const classAttr = tagMatch[2];
    const classes = classAttr.split(/\s+/).filter(Boolean);
    // Prioritize c-* or l-* class, ignoring animation hooks like c-inview and js-inview
    const compClass = classes.find(c => /^[cl]-/.test(c) && !c.startsWith('c-inview') && !c.startsWith('js-inview')) || classes.find(c => /^[cl]-/.test(c));
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

  // Fallback: search for any c-* or l-* inside snippet (ignoring inview hooks)
  if (!compName) {
    const allCompMatches = Array.from(trimmed.matchAll(/class=["'][^"']*\b([cl]-([a-zA-Z0-9_-]+))/gi));
    const validMatch = allCompMatches.find(m => !m[1].startsWith('c-inview') && !m[1].startsWith('js-inview')) || allCompMatches[0];
    if (validMatch) {
      rootClass = validMatch[1];
      let rawBase = validMatch[2].split(/__|--/)[0];
      compName = normalizeName(rawBase);
      if (['flex', 'grid', 'btn', 'text', 'title', 'list', 'tbl'].includes(compName)) {
        compName = compName + 's';
      }
    }
  }

  // If still no c-* or l-* class, only then fall back to root tag class if present
  if (!compName && tagMatch) {
    const classAttr = tagMatch[2];
    const classes = classAttr.split(/\s+/).filter(Boolean);
    if (classes.length > 0) {
      rootClass = classes[0];
      let rawBase = rootClass.replace(/^[cl]-/, '').split(/__|--/)[0];
      compName = normalizeName(rawBase);
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

  // Pass 2: Deep Content Search: find WHICH EXACT FILE in site contains component classes
  // Prioritize component root class (c-header) before inner child classes (c-btn)
  const prioritizedClasses = Array.from(new Set([
    `c-${norm}`,
    `l-${norm}`,
    norm,
    ...classList.map(c => c.split(/__|--/)[0]),
    ...classList
  ].filter(Boolean)));

  for (const targetClass of prioritizedClasses) {
    const classRegex = new RegExp('(?:^|\\n)[ \\t]*\\.' + targetClass.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\$&') + '(?![a-zA-Z0-9_-])[^{]*\\{', 'm');
    for (const dir of [CLIENT_SCSS_DIR, CLIENT_LAYOUT_DIR]) {
      if (!existsSync(dir)) continue;
      const files = readdirSync(dir).filter(f => f.startsWith('_') && f.endsWith('.scss') && f !== '_index.scss');
      for (const file of files) {
        const fullPath = resolve(dir, file);
        const content = readFileSync(fullPath, 'utf8');
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
        const hasRange = getComponentJsRange(content, nameCandidate);
        if (hasRange) {
          const sliced = sliceJsForComponent(content, nameCandidate);
          if (sliced) {
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

              const hasModuleMarker = new RegExp(`\\[Component(?:\\s*Module)?:\\s*${norm}\\]`, 'i').test(extracted);

              // Must have actual event binding or function targeting the selector
              const hasDirectInteraction = selectors.some(s => {
                const escaped = s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
                if (new RegExp(`${escaped}[^\\n;]*?\\.(?:on|addEventListener|click|toggleClass|slideToggle|find)\\b`).test(extracted)) return true;
                if (new RegExp(`\\$\\(['"]${escaped}['"]\\)`).test(extracted)) {
                  return /\.(?:on|addEventListener|click|toggleClass|slideToggle|animate|slideDown|slideUp)\b/.test(extracted);
                }
                return false;
              });

              if (!hasDirectInteraction && !hasModuleMarker) {
                continue;
              }

              if (!extracted.startsWith('(function') && extracted.includes('$(')) {
                extracted = `(function ($) {\n  ${extracted}\n})(typeof jQuery !== 'undefined' ? jQuery : window.$);`;
              }

              let cleanExtracted = extracted;
              if (!hasModuleMarker) {
                cleanExtracted = `/* ==========================================================================\n   [Component: ${norm}]\n   ========================================================================== */\n${cleanExtracted}`;
              }

              return {
                fileName: f,
                sourceFile: `src/pages/assets/js/${f}`,
                content: cleanExtracted,
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

  // 1. If HTML is not provided directly and file + line provided, extract from file
  if (!html && options.filePath && options.lineNumber) {
    try {
      const safePath = resolveSafePath(ROOT, options.filePath, 'exportSelectionToWorkbench filePath');
      html = extractTagBlockFromFile(safePath, options.lineNumber);
    } catch {
      html = null;
    }
  }

  // 2. If still no HTML, try reading from clipboard
  if (!html) {
    const clip = getClipboardText();
    if (clip && (clip.includes('class=') && (clip.includes('c-') || clip.includes('l-')))) {
      html = clip;
    }
  }

  if (!html) {
    return {
      success: false,
      message: 'Không tìm thấy khối mã HTML component nào từ vùng chọn hoặc clipboard!'
    };
  }

  // 3. Auto-detect component name from SCSS file or HTML root class
  const meta = parseComponentHtml(html);
  const rawTargetName = options.name ? normalizeName(options.name) : (meta?.compName || 'custom-component');

  const blockClasses = (meta?.allClasses && meta.allClasses.length > 0)
    ? meta.allClasses
    : [meta?.rootClass || `c-${rawTargetName}`];

  // Look up which SCSS file in site contains this component's class
  const foundScss = findComponentScssInSite(rawTargetName, blockClasses);
  const scssBaseName = foundScss ? basename(foundScss.fileName, '.scss').replace(/^_/, '') : null;
  const targetName = options.name ? normalizeName(options.name) : (scssBaseName || rawTargetName);
  const category = meta?.category || getComponentCategory(targetName);
  const displayTitle = options.title || (targetName.charAt(0).toUpperCase() + targetName.slice(1));

  const savedFiles = [];

  // 4. Save SCSS into workbench (Append/merge component rules into corresponding file)
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
      finalScss = mergeComponentScss(finalScss, '', targetName);
    } else {
      finalScss = mergeComponentScss('', componentScss, targetName);
    }

    writeFileSync(destScss, finalScss.trimEnd() + '\n', 'utf8');
    savedFiles.push(`workbench/scss/${scssCategory === 'layout' ? 'layout' : 'component'}/${foundScss.fileName}`);

    const wbScssBase = basename(foundScss.fileName, '.scss').replace(/^_/, '');
    updateWorkbenchScss(wbScssBase, 'add', scssCategory);
  }

  // 5. Look up and mirror JS for this component into workbench
  const foundJs = findComponentJsInSite(targetName, blockClasses);
  if (foundJs && foundJs.content) {
    if (!existsSync(WORKBENCH_JS_DIR)) {
      mkdirSync(WORKBENCH_JS_DIR, { recursive: true });
    }
    const destJs = resolve(WORKBENCH_JS_DIR, foundJs.fileName);
    let finalJs = foundJs.content.trimEnd() + '\n';
    if (existsSync(destJs)) {
      const existing = readFileSync(destJs, 'utf8');
      finalJs = mergeComponentJs(existing, foundJs.content, targetName);
    }
    writeFileSync(destJs, finalJs, 'utf8');
    savedFiles.push(`workbench/js/${foundJs.fileName}`);
  }

  // 6. Save/Append HTML to workbench/components/_<targetName>.ejs (Pure HTML/EJS, 100% clean, NO frontmatter)
  if (!existsSync(WORKBENCH_COMPONENTS_DIR)) {
    mkdirSync(WORKBENCH_COMPONENTS_DIR, { recursive: true });
  }
  const destEjs = resolve(WORKBENCH_COMPONENTS_DIR, `_${targetName}.ejs`);
  const trimmedHtml = html.trim();
  const isAlreadyWrapped = /^<div class=["']p-component__item["']>/i.test(trimmedHtml);
  const itemBlock = isAlreadyWrapped
    ? (trimmedHtml + '\n')
    : `<div class="p-component__item">\n    <!-- ${displayTitle} -->\n${trimmedHtml.split('\n').map(l => '    ' + l).join('\n')}\n</div>\n`;

  let existingEjs = existsSync(destEjs) ? readFileSync(destEjs, 'utf8') : '';
  if (existingEjs.trim()) {
    const cleanExisting = stripEjsShowroomWrapper(existingEjs);
    const cleanSnippet = stripEjsShowroomWrapper(trimmedHtml);
    const normExisting = cleanExisting.replace(/\s+/g, ' ').trim();
    const normSnippet = cleanSnippet.replace(/\s+/g, ' ').trim();
    const snippetMissing = !normExisting.includes(normSnippet);
    if (snippetMissing) {
      const body = existingEjs.trimEnd() + '\n\n' + itemBlock;
      writeFileSync(destEjs, body.trim() + '\n', 'utf8');
    }
  } else {
    writeFileSync(destEjs, itemBlock, 'utf8');
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
