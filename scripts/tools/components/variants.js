/**
 * scripts/tools/components/variants.js
 * Component Variant Extraction, SCSS Class Slicing, Card Parsing, and Variant Removal
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { resolve, basename } from 'path';
import { normalizeName } from './metadata.js';
import {
  getDefaultPaths,
  getComponentCategory,
  getScssDirForCategory,
  getWorkbenchScssDirForCategory,
  findMatchingScss
} from './paths.js';

/**
 * Checks whether an SCSS file contains real rules or is merely a placeholder stub
 */
export function isTemplateStub(scssCode) {
  if (!scssCode || !scssCode.trim()) return true;
  const stripped = scssCode
    .replace(/@use\s+[^;]+;/g, '')
    .replace(/@forward\s+[^;]+;/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*/g, '')
    .trim();
  return stripped.length === 0;
}

/**
 * Accurately finds the matching closing brace index for a block
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
 * Extracts file-level header elements: @use, @forward, top comments, variables, mixins, functions
 */
export function extractFileHeader(fullScss) {
  if (!fullScss) return '';
  let header = '';

  const useMatches = fullScss.match(/@(use|forward)\s+[^;]+;/g) || [];
  if (useMatches.length > 0) {
    header += useMatches.join('\n') + '\n\n';
  }

  const bannerMatch = fullScss.match(/^(?:\s*@(use|forward)[^;]+;\s*)*(\/\*[\s\S]*?\*\/)/);
  if (bannerMatch && bannerMatch[2]) {
    header += bannerMatch[2].trim() + '\n\n';
  }

  const varMatches = fullScss.match(/(?:^|\n)(\$[a-zA-Z0-9_-]+\s*:[^;]+;)/g) || [];
  if (varMatches.length > 0) {
    header += varMatches.map(v => v.trim()).join('\n') + '\n\n';
  }

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
 * Accurately finds the start and end of a specific class rule block in SCSS
 */
export function findRuleBlockRange(scssCode, className) {
  if (!scssCode || !className) return null;
  const escaped = className.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp('(?:^|\\n)([ \\t]*\\.' + escaped + '(?![a-zA-Z0-9_-])[^{]*\\{)', 'm');
  const m = scssCode.match(regex);
  if (!m) return null;

  const startIdx = m.index + (m[0].length - m[1].length);
  const openBrace = scssCode.indexOf('{', startIdx);
  if (openBrace === -1) return null;

  const endIdx = findMatchingBrace(scssCode, openBrace);
  if (endIdx === -1) return null;

  return {
    start: startIdx,
    openBrace,
    end: endIdx,
    content: scssCode.slice(startIdx, endIdx)
  };
}

/**
 * Checks whether a specific modifier exists for a base block (scoped, never global)
 */
export function isModifierInBlock(blockContent, modName, fullScss = '', baseBlockName = '') {
  if (!modName) return true;
  const escaped = modName.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');

  // Check 1: Nested inside block: &--mod
  if (blockContent) {
    const nestedRegex = new RegExp('&' + escaped + '(?![a-zA-Z0-9_-])');
    if (nestedRegex.test(blockContent)) return true;
  }

  // Check 2: Standalone class in fullScss: .baseBlockName--mod {
  if (fullScss && baseBlockName) {
    const standaloneRegex = new RegExp('(?:^|\\n)[ \\t]*\\.' + baseBlockName + escaped + '(?![a-zA-Z0-9_-])[^{]*\\{', 'm');
    if (standaloneRegex.test(fullScss)) return true;
  }

  return false;
}

/**
 * Extract SCSS specific to a class/variant from full component SCSS (Block-Scoped)
 */
export function sliceScssForClasses(fullScss, classStr) {
  if (!fullScss || !classStr) return fullScss || '';
  const tokens = classStr.split(/\s+/).filter(Boolean);

  const candidateClasses = [
    ...tokens.filter(c => /^[cl]-/.test(c) && !c.startsWith('c-inview') && !c.startsWith('js-inview')).map(c => c.split(/__|--/)[0]),
    ...tokens.filter(c => /^[cl]-/.test(c) && !c.startsWith('c-inview') && !c.startsWith('js-inview')).map(c => c.split('--')[0])
  ];

  const uniqueBases = Array.from(new Set(candidateClasses));
  if (uniqueBases.length === 0 && tokens[0]) {
    uniqueBases.push(tokens[0].split(/__|--/)[0]);
  }

  const headers = extractFileHeader(fullScss);
  const extractedBlocks = [];

  for (const baseBlockName of uniqueBases) {
    const baseRange = findRuleBlockRange(fullScss, baseBlockName);
    if (!baseRange) continue;

    const blockContent = baseRange.content;
    const activeMods = tokens
      .filter(c => c.startsWith(baseBlockName + '--'))
      .map(c => c.slice(baseBlockName.length));

    // Find all modifier blocks &--... inside THIS block
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

    // Also look for standalone .baseBlockName--mod blocks outside
    for (const mod of activeMods) {
      const standaloneRange = findRuleBlockRange(fullScss, `${baseBlockName}${mod}`);
      if (standaloneRange && !extractedBlocks.includes(standaloneRange.content.trim())) {
        extractedBlocks.push(standaloneRange.content.trim());
      }
    }
  }

  if (extractedBlocks.length === 0) return fullScss;
  return (headers ? headers.trim() + '\n\n' : '') + extractedBlocks.join('\n\n').trim();
}

/**
 * Merge an individual variant SCSS into an existing site SCSS file (100% Block-Scoped)
 */
export function mergeVariantScss(existing, incoming, classStr) {
  if (!existing || isTemplateStub(existing)) return incoming.trim() + '\n';
  if (!incoming || !incoming.trim()) return existing;

  const tokens = (classStr || '').split(/\s+/).filter(Boolean);
  const candidateClasses = [
    ...tokens.filter(c => /^[cl]-/.test(c) && !c.startsWith('c-inview') && !c.startsWith('js-inview')).map(c => c.split(/__|--/)[0]),
    ...tokens.filter(c => /^[cl]-/.test(c) && !c.startsWith('c-inview') && !c.startsWith('js-inview')).map(c => c.split('--')[0])
  ];
  const uniqueBases = Array.from(new Set(candidateClasses));
  if (uniqueBases.length === 0 && tokens[0]) {
    uniqueBases.push(tokens[0].split(/__|--/)[0]);
  }

  let merged = existing;

  // Header preservation & injection (@use and variables)
  const matchIncomingFirstRule = incoming.search(/(?:^|\n)\s*[.#%a-zA-Z0-9_-]+\s*\{/);
  const incomingHeaders = matchIncomingFirstRule !== -1 ? incoming.slice(0, matchIncomingFirstRule).trim() : '';

  if (incomingHeaders) {
    const useMatches = incomingHeaders.match(/@use\s+[^;]+;/g) || [];
    for (const useStmt of useMatches) {
      if (!merged.includes(useStmt)) {
        merged = useStmt + '\n' + merged;
      }
    }
    const varMatches = incomingHeaders.match(/(?:^|\n)(\$[a-zA-Z0-9_-]+\s*:[^;]+;)/g) || [];
    for (const varStmt of varMatches) {
      const varName = varStmt.match(/\$([a-zA-Z0-9_-]+)/)?.[1];
      if (varName && !merged.includes('$' + varName)) {
        merged = varStmt.trim() + '\n' + merged;
      }
    }
  }

  for (const baseBlockName of uniqueBases) {
    const incomingBaseRange = findRuleBlockRange(incoming, baseBlockName);
    const existingBaseRange = findRuleBlockRange(merged, baseBlockName);

    // Case 1: Base block does NOT exist in merged yet:
    if (!existingBaseRange) {
      if (incomingBaseRange) {
        merged = merged.trim() + '\n\n' + incomingBaseRange.content.trim() + '\n';
      }
      // Check for standalone modifier rules in incoming
      const activeMods = tokens
        .filter(c => c.startsWith(baseBlockName + '--'))
        .map(c => c.slice(baseBlockName.length));
      for (const mod of activeMods) {
        const standaloneRange = findRuleBlockRange(incoming, `${baseBlockName}${mod}`);
        if (standaloneRange && !merged.includes(standaloneRange.content.trim())) {
          merged = merged.trim() + '\n\n' + standaloneRange.content.trim() + '\n';
        }
      }
      continue;
    }

    // Case 2: Base block ALREADY exists in merged:
    // Only merge missing modifiers into THIS specific base block!
    const activeMods = tokens
      .filter(c => c.startsWith(baseBlockName + '--'))
      .map(c => c.slice(baseBlockName.length));

    for (const mod of activeMods) {
      const currentExistingBase = findRuleBlockRange(merged, baseBlockName);
      if (!currentExistingBase) break;

      // 1. Check if modifier already exists in THIS base block or as standalone
      const alreadyNested = isModifierInBlock(currentExistingBase.content, mod);
      const alreadyStandalone = isModifierInBlock('', mod, merged, baseBlockName);
      if (alreadyNested || alreadyStandalone) {
        continue; // Already has this modifier in this block, skip!
      }

      // 2. Extract modifier from incomingBaseRange
      let modBlock = null;
      if (incomingBaseRange) {
        const escapedMod = mod.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
        const modRegex = new RegExp('(?:^|\\n)([ \\t]*&' + escapedMod + '(?![a-zA-Z0-9_-])[^{]*\\{)', 'm');
        const m = incomingBaseRange.content.match(modRegex);
        if (m) {
          const mStart = m.index + (m[0].length - m[1].length);
          const mOpen = incomingBaseRange.content.indexOf('{', mStart);
          if (mOpen !== -1) {
            const mEnd = findMatchingBrace(incomingBaseRange.content, mOpen);
            if (mEnd !== -1) {
              modBlock = incomingBaseRange.content.slice(mStart, mEnd);
            }
          }
        }
      }

      // 3. If nested &--mod found in incomingBaseRange:
      if (modBlock) {
        // Insert right before the closing brace '}' of currentExistingBase
        const insertPos = currentExistingBase.end - 1;
        merged = merged.slice(0, insertPos).trimEnd() + '\n\n    ' + modBlock.trim() + '\n' + merged.slice(insertPos);
      } else {
        // 4. Check if incoming has standalone .baseBlockName--mod
        const standaloneIncoming = findRuleBlockRange(incoming, `${baseBlockName}${mod}`);
        if (standaloneIncoming) {
          const insertPos = currentExistingBase.end;
          merged = merged.slice(0, insertPos) + '\n\n' + standaloneIncoming.content.trim() + '\n' + merged.slice(insertPos);
        }
      }
    }
  }

  return merged.replace(/\n\s*\n\s*\n+/g, '\n\n').trim() + '\n';
}

/**
 * Check if a specific component variant is already installed in site (100% Block-Scoped)
 */
export function isVariantInstalled(compName, classStr, paths = getDefaultPaths()) {
  const norm = normalizeName(compName);
  const category = getComponentCategory(norm);
  const targetClientScssDir = getScssDirForCategory(category, paths);
  const scssFile = findMatchingScss(norm, targetClientScssDir);
  if (!scssFile) return false;

  const destScssPath = resolve(targetClientScssDir, scssFile);
  if (!existsSync(destScssPath)) return false;

  const existing = readFileSync(destScssPath, 'utf8');
  if (isTemplateStub(existing)) return false;

  const tokens = (classStr || '').split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return true;

  const candidateBases = Array.from(new Set(
    tokens
      .filter(c => /^[cl]-/.test(c) && !c.startsWith('c-inview') && !c.startsWith('js-inview'))
      .map(c => c.split('--')[0])
  ));

  if (candidateBases.length === 0) {
    candidateBases.push(tokens[0].split('--')[0]);
  }

  for (const base of candidateBases) {
    const baseRange = findRuleBlockRange(existing, base);

    const activeMods = tokens
      .filter(c => c.startsWith(base + '--'))
      .map(c => c.slice(base.length));

    if (activeMods.length > 0) {
      for (const mod of activeMods) {
        const hasNested = baseRange ? isModifierInBlock(baseRange.content, mod) : false;
        const hasStandalone = isModifierInBlock('', mod, existing, base);
        if (!hasNested && !hasStandalone) {
          return false;
        }
      }
    } else {
      if (!baseRange) {
        return false;
      }
    }
  }

  return true;
}

/**
 * Accurately finds the matching closing tag index for an HTML element
 */
export function findMatchingTag(str, startIdx) {
  const match = str.slice(startIdx).match(/^<([a-zA-Z0-9]+)\b[^>]*>/);
  if (!match) return -1;
  const tagName = match[1].toLowerCase();
  let depth = 0;
  const tagRegex = new RegExp('<(\\/?)' + tagName + '(\\s*|\\s+[^>]*?)>', 'gi');
  tagRegex.lastIndex = startIdx;
  let m;
  while ((m = tagRegex.exec(str)) !== null) {
    if (m[0].endsWith('/>')) continue;
    if (m[1] === '/') {
      depth--;
      if (depth === 0) return tagRegex.lastIndex;
    } else {
      depth++;
    }
  }
  return -1;
}

/**
 * Parses all component cards from an EJS file, matching Workbench showroom card order
 */
export function parseEjsComponentCards(html) {
  if (!html) return [];
  const cards = [];
  const pBlockRegex = /<div\b[^>]*class=["'][^"']*p-component__[^"']*["'][^>]*>/g;
  let pm;
  const pBlocks = [];

  while ((pm = pBlockRegex.exec(html)) !== null) {
    const start = pm.index;
    const end = findMatchingTag(html, start);
    if (end === -1) break;
    pBlocks.push({ start, end, fullText: html.slice(start, end) });
  }

  function getTopLevelChildren(str, baseOffset) {
    const children = [];
    const openTagRegex = /<([a-zA-Z0-9]+)\b([^>]*)>/g;
    let tm;
    while ((tm = openTagRegex.exec(str)) !== null) {
      const tagStart = tm.index;
      const tagEnd = findMatchingTag(str, tagStart);
      if (tagEnd === -1) break;

      const tagName = tm[1].toLowerCase();
      const attrStr = tm[2] || '';
      const classMatch = attrStr.match(/class=["']([^"']*)["']/i);
      const classStr = classMatch ? classMatch[1] : '';

      const beforeText = str.slice(0, tagStart);
      const commentMatch = beforeText.match(/([ \t]*<!--((?:(?!-->)[\s\S])*?)-->[ \t]*\r?\n)[ \t]*$/);
      const commentDelStart = commentMatch ? (tagStart - commentMatch[1].length) : tagStart;
      const commentTitle = commentMatch ? commentMatch[2].replace(/^[\s*#-]+|[\s*#-]+$/g, '').trim() : '';

      children.push({
        tagName,
        classStr,
        commentTitle,
        start: baseOffset + tagStart,
        end: baseOffset + tagEnd,
        delStart: baseOffset + commentDelStart,
        delEnd: baseOffset + tagEnd,
        outerHtml: str.slice(tagStart, tagEnd)
      });

      openTagRegex.lastIndex = tagEnd;
    }
    return children;
  }

  if (pBlocks.length > 0) {
    for (const pb of pBlocks) {
      const openTagMatch = pb.fullText.match(/^<div\b[^>]*>/i);
      if (!openTagMatch) continue;
      const innerStartOffset = openTagMatch[0].length;
      const innerContent = pb.fullText.slice(innerStartOffset, pb.fullText.length - 6);
      const children = getTopLevelChildren(innerContent, pb.start + innerStartOffset);

      const beforeWrapperText = html.slice(0, pb.start);
      const wrapperCommentMatch = beforeWrapperText.match(/([ \t]*<!--((?:(?!-->)[\s\S])*?)-->[ \t]*\r?\n)[ \t]*$/);
      const wrapperDelStart = wrapperCommentMatch ? (pb.start - wrapperCommentMatch[1].length) : pb.start;

      if (children.length <= 1) {
        const child = children[0] || {};
        cards.push({
          index: cards.length,
          wrapperStart: pb.start,
          wrapperEnd: pb.end,
          isSoleChildOfWrapper: true,
          elemStart: child.start || pb.start,
          elemEnd: child.end || pb.end,
          delStart: wrapperDelStart,
          delEnd: pb.end,
          classStr: child.classStr || '',
          commentTitle: child.commentTitle || (wrapperCommentMatch ? wrapperCommentMatch[2].trim() : '')
        });
      } else {
        for (const child of children) {
          cards.push({
            index: cards.length,
            wrapperStart: pb.start,
            wrapperEnd: pb.end,
            isSoleChildOfWrapper: false,
            elemStart: child.start,
            elemEnd: child.end,
            delStart: child.delStart,
            delEnd: child.delEnd,
            classStr: child.classStr,
            commentTitle: child.commentTitle
          });
        }
      }
    }
  } else {
    const children = getTopLevelChildren(html, 0);
    for (const child of children) {
      cards.push({
        index: cards.length,
        wrapperStart: null,
        wrapperEnd: null,
        isSoleChildOfWrapper: false,
        elemStart: child.start,
        elemEnd: child.end,
        delStart: child.delStart,
        delEnd: child.delEnd,
        classStr: child.classStr,
        commentTitle: child.commentTitle
      });
    }
  }

  return cards;
}

function removeCardFromHtml(html, targetCard) {
  const before = html.slice(0, targetCard.delStart).trimEnd();
  const after = html.slice(targetCard.delEnd).trimStart();
  let result = (before + (before && after ? '\n\n' : '') + after).trim() + '\n';
  result = result.replace(/<div\b[^>]*class=["'][^"']*p-component__[^"']*["'][^>]*>\s*<\/div>\r?\n?/g, '');
  return result;
}

/**
 * Removes a specific component variant from EJS content
 */
export function removeVariantFromEjs(html, { classStr, commentTitle, cardIndex }) {
  if (!html) return '';

  const cards = parseEjsComponentCards(html);
  if (cards.length === 0) return html;

  let targetCard = null;

  if (cardIndex !== undefined && cardIndex >= 0 && cardIndex < cards.length) {
    targetCard = cards[cardIndex];
  }

  if (!targetCard && classStr) {
    const targetTokens = classStr.split(/\s+/).filter(Boolean).sort().join(' ');
    targetCard = cards.find(c => {
      const cTokens = (c.classStr || '').split(/\s+/).filter(Boolean).sort().join(' ');
      if (cTokens !== targetTokens) return false;
      if (commentTitle && c.commentTitle) {
        return c.commentTitle.toLowerCase().includes(commentTitle.toLowerCase()) ||
               commentTitle.toLowerCase().includes(c.commentTitle.toLowerCase());
      }
      return true;
    });
    if (!targetCard) {
      targetCard = cards.find(c => {
        const cTokens = (c.classStr || '').split(/\s+/).filter(Boolean).sort().join(' ');
        return cTokens === targetTokens;
      });
    }
  }

  if (!targetCard && commentTitle) {
    targetCard = cards.find(c => 
      c.commentTitle && (
        c.commentTitle.toLowerCase().includes(commentTitle.toLowerCase()) ||
        commentTitle.toLowerCase().includes(c.commentTitle.toLowerCase())
      )
    );
  }

  if (targetCard) {
    return removeCardFromHtml(html, targetCard);
  }

  return html;
}

/**
 * Removes modifier rules or standalone class from SCSS if no longer used in EJS
 */
export function removeVariantFromScss(scssContent, remainingEjs, classStr) {
  if (!scssContent || !classStr) return scssContent;
  const tokens = classStr.split(/\s+/).filter(Boolean);
  let updatedScss = scssContent;

  for (const token of tokens) {
    if (token.includes('--')) {
      const [baseName, modName] = token.split('--');
      const fullMod = '--' + modName;

      // Only remove if remainingEjs doesn't contain this exact token anymore
      if (!remainingEjs.includes(token)) {
        // Find base block in updatedScss
        const baseRange = findRuleBlockRange(updatedScss, baseName);
        if (baseRange) {
          const escapedMod = fullMod.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
          const modRegex = new RegExp('(?:^|\\n)([ \\t]*&' + escapedMod + '(?![a-zA-Z0-9_-])[^{]*\\{)', 'm');
          const m = baseRange.content.match(modRegex);
          if (m) {
            const mStart = baseRange.start + m.index + (m[0].length - m[1].length);
            const mOpen = updatedScss.indexOf('{', mStart);
            if (mOpen !== -1) {
              const mEnd = findMatchingBrace(updatedScss, mOpen);
              if (mEnd !== -1) {
                updatedScss = updatedScss.slice(0, mStart).trimEnd() + '\n' + updatedScss.slice(mEnd).trimStart();
              }
            }
          }
        }
        // Also remove standalone rule if present
        const standaloneRange = findRuleBlockRange(updatedScss, `${baseName}${fullMod}`);
        if (standaloneRange) {
          updatedScss = updatedScss.slice(0, standaloneRange.start).trimEnd() + '\n' + updatedScss.slice(standaloneRange.end).trimStart();
        }
      }
    } else if (/^[cl]-/.test(token)) {
      if (!remainingEjs.includes(token)) {
        const baseRange = findRuleBlockRange(updatedScss, token);
        if (baseRange) {
          updatedScss = updatedScss.slice(0, baseRange.start).trimEnd() + '\n' + updatedScss.slice(baseRange.end).trimStart();
        }
      }
    }
  }

  return updatedScss.replace(/\n\s*\n\s*\n+/g, '\n\n').trim() + '\n';
}

/**
 * Safely merges incoming component SCSS into an existing or new destination file
 * - 100% non-destructive: Preserves all existing developer code in the file
 * - Automatically ensures required @use statements are placed at the top of the file
 * - If component block already exists: cleanly updates that block in place
 * - If component block does not exist: safely appends to the END OF THE FILE
 * 
 * @param {string} existingScss - Current contents of destScss (or empty string if file is new)
 * @param {string} incomingScss - SCSS content from workbench to install
 * @param {string} compName - Normalized component name (e.g. 'header')
 * @param {Object} [options={}] - Options (e.g. { force: false })
 * @returns {string} Fully merged, clean, valid SCSS code
 */
export function mergeComponentScss(existingScss, incomingScss, compName, options = {}) {
  const norm = normalizeName(compName);

  // 1. If destination file is completely empty or new:
  if (!existingScss || !existingScss.trim()) {
    let result = '';
    const useStatements = incomingScss.match(/@(use|forward)\s+[^;]+;/g) || [];
    const hasMath = useStatements.some(u => u.includes('sass:math'));
    const hasGlobal = useStatements.some(u => u.includes('../global') || u.includes('./global'));

    const headerUses = [];
    if (!hasMath) headerUses.push('@use "sass:math";');
    if (!hasGlobal) headerUses.push('@use "../global" as *;');
    headerUses.push(...useStatements);

    const uniqueUses = Array.from(new Set(headerUses));
    result += uniqueUses.join('\n') + '\n\n';

    const hasBanner = /\/\*![\s\S]*?component\s*>/i.test(incomingScss);
    if (!hasBanner) {
      result += `/*!\ncomponent > ${norm}\n------------------------------\n*/\n\n`;
    }

    const bodyRules = incomingScss
      .replace(/@(use|forward)\s+[^;]+;\r?\n?/g, '')
      .trim();

    result += bodyRules + '\n';
    return result;
  }

  // 2. If destination file already exists:
  let merged = existingScss;

  // 2a. Extract @use statements from incomingScss and ensure standard uses exist
  const incomingUses = incomingScss.match(/@(use|forward)\s+[^;]+;/g) || [];
  const missingUses = [];

  const hasMath = /@use\s+["']sass:math["']/.test(merged);
  const hasGlobal = /@use\s+["']\.\.?\/global["']/.test(merged);
  if (!hasMath) missingUses.push('@use "sass:math";');
  if (!hasGlobal) missingUses.push('@use "../global" as *;');

  for (const useStmt of incomingUses) {
    const useTarget = useStmt.match(/@(use|forward)\s+["']([^"']+)["']/)?.[2];
    if (useTarget) {
      const alreadyHas = new RegExp(`@(use|forward)\\s+["']${useTarget.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\$&')}["']`).test(merged);
      if (!alreadyHas && !missingUses.includes(useStmt)) {
        missingUses.push(useStmt);
      }
    } else if (!merged.includes(useStmt) && !missingUses.includes(useStmt)) {
      missingUses.push(useStmt);
    }
  }

  if (missingUses.length > 0) {
    const lastUseMatches = Array.from(merged.matchAll(/@(use|forward)\s+[^;]+;/g));
    if (lastUseMatches.length > 0) {
      const lastMatch = lastUseMatches[lastUseMatches.length - 1];
      const insertIdx = lastMatch.index + lastMatch[0].length;
      merged = merged.slice(0, insertIdx) + '\n' + missingUses.join('\n') + merged.slice(insertIdx);
    } else {
      merged = missingUses.join('\n') + '\n\n' + merged;
    }
  }

  // 2a-2. Ensure standard component banner exists if not already present
  const hasBanner = /\/\*![\s\S]*?component\s*>/i.test(merged);
  if (!hasBanner) {
    const banner = `/*!\ncomponent > ${norm}\n------------------------------\n*/\n`;
    const lastUseMatches = Array.from(merged.matchAll(/@(use|forward)\s+[^;]+;/g));
    if (lastUseMatches.length > 0) {
      const lastMatch = lastUseMatches[lastUseMatches.length - 1];
      const insertIdx = lastMatch.index + lastMatch[0].length;
      merged = merged.slice(0, insertIdx).trimEnd() + '\n\n' + banner + '\n' + merged.slice(insertIdx).trimStart();
    } else {
      merged = banner + '\n' + merged.trimStart();
    }
  }

  // 2b. Extract pure rule content from incomingScss (without @use statements)
  let incomingRules = incomingScss
    .replace(/@(use|forward)\s+[^;]+;\r?\n?/g, '')
    .trim();

  if (!incomingRules) {
    return merged;
  }

  // 2c. Check if existing file is just a template stub (only @use statements and comments)
  // PRESERVE the entire existing content (including user banner / comments), and append rules!
  if (isTemplateStub(merged)) {
    if (merged.includes('/*!') && incomingRules.startsWith('/*!')) {
      incomingRules = incomingRules.replace(/^\/\*![\s\S]*?\*\/\s*/, '');
    }
    return merged.trimEnd() + '\n\n' + incomingRules.trim() + '\n';
  }

  // 2d. Check if component block already exists in existing file
  const baseSelectorRegex = new RegExp(`(?:^|\\n)([ \\t]*\\.(?:c|l)-${norm.replace(/[-\\/\\\\^$*+?.()|[\\]{}]/g, '\\$&')}(?![a-zA-Z0-9_-])[^{]*\\{)`, 'm');
  const selectorMatch = merged.match(baseSelectorRegex);

  if (selectorMatch) {
    const startIdx = selectorMatch.index + (selectorMatch[0].length - selectorMatch[1].length);
    const braceIdx = merged.indexOf('{', startIdx);
    if (braceIdx !== -1) {
      const endIdx = findMatchingBrace(merged, braceIdx);
      if (endIdx !== -1) {
        // Cleanly replace only the component block in place, preserving everything else in the file!
        if (incomingRules.startsWith('/*!')) {
          incomingRules = incomingRules.replace(/^\/\*![\s\S]*?\*\/\s*/, '');
        }
        merged = merged.slice(0, startIdx).trimEnd() + '\n\n' + incomingRules + '\n\n' + merged.slice(endIdx).trimStart();
        return merged.trimEnd() + '\n';
      }
    }
  }

  // 2e. Component does not exist in file yet: Safely APPEND to the end of the file!
  if (merged.includes('/*!') && incomingRules.startsWith('/*!')) {
    incomingRules = incomingRules.replace(/^\/\*![\s\S]*?\*\/\s*/, '');
  }
  return merged.trimEnd() + '\n\n' + incomingRules.trim() + '\n';
}
