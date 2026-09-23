/**
 * sync-snippets.js
 * Universal FLOCSS Component Snippet Engine
 * Dynamically scans any _*.ejs file in src/pages/components/
 * and generates accurate VS Code snippets for any c-* and l-* class.
 * Zero hardcoded file names, zero hardcoded class names.
 */

import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from 'fs';
import { resolve, dirname, basename } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = resolve(__dirname, '..');
const COMPONENTS_DIR = resolve(ROOT, 'src/pages/components');
const SNIPPETS_FILE = resolve(ROOT, '.vscode/jline-components.code-snippets');

const VOID_TAGS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'
]);

function toTitleCase(str) {
  if (!str) return '';
  return str.split(/[-_]+/).map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

/**
 * Accurately extracts full HTML block taking nested closing tags and void elements into account
 */
function extractBalancedTag(html, startPos) {
  const openTagMatch = html.slice(startPos).match(/^<([a-zA-Z0-9]+)\b(?:[^'">]|"[^"]*"|'[^']*')*>/);
  if (!openTagMatch) return null;
  const tagName = openTagMatch[1].toLowerCase();

  // Void elements (input, img, hr, etc.) or explicit self-closing tags have no closing tag
  if (VOID_TAGS.has(tagName) || openTagMatch[0].endsWith('/>')) {
    return openTagMatch[0];
  }

  let depth = 0;
  const tagRegex = new RegExp(`<(/?)(${tagName})\\b[^>]*>`, 'gi');
  tagRegex.lastIndex = startPos;
  let match;
  while ((match = tagRegex.exec(html)) !== null) {
    if (match[1] === '/') {
      depth--;
      if (depth === 0) {
        return html.slice(startPos, tagRegex.lastIndex);
      }
    } else {
      depth++;
    }
  }
  return null;
}

/**
 * Universal component extractor:
 * Finds all top-level FLOCSS components (c-* or l-*) in any HTML string
 */
function extractFlocssComponents(html, fileName) {
  // Find ranges of comments so we know where comments start/end
  const commentRanges = [];
  const commentRegex = /<!--([\s\S]*?)-->/g;
  let cMatch;
  while ((cMatch = commentRegex.exec(html)) !== null) {
    commentRanges.push({
      start: cMatch.index,
      end: cMatch.index + cMatch[0].length,
      text: cMatch[1].trim()
    });
  }

  const components = [];
  const tagRegex = /<([a-zA-Z0-9]+)\b([^>]*)>/gi;
  let match;
  const extractedRanges = [];

  while ((match = tagRegex.exec(html)) !== null) {
    const startIndex = match.index;
    const tagName = match[1].toLowerCase();
    const attrString = match[2];

    // 1. Skip if inside a comment block (commented-out HTML)
    if (commentRanges.some(c => startIndex >= c.start && startIndex < c.end)) {
      continue;
    }

    // 2. Skip if inside an already extracted component block
    if (extractedRanges.some(r => startIndex >= r.start && startIndex < r.end)) {
      continue;
    }

    const classMatch = attrString.match(/\bclass=["']([^"']+)["']/i);
    if (!classMatch) continue;

    const classStr = classMatch[1].trim();
    const classList = classStr.split(/\s+/).filter(Boolean);

    // FLOCSS Root tokens: starts with c- or l-, not wrapper classes or BEM elements
    const flocssClasses = classList.filter(c =>
      /^[cl]-[a-zA-Z0-9_-]+/.test(c) &&
      c !== 'l-container' &&
      !c.startsWith('p-component') &&
      !c.includes('__')
    );

    if (flocssClasses.length === 0) continue;

    const fullHtml = extractBalancedTag(html, startIndex);
    if (!fullHtml) continue;

    const endIndex = startIndex + fullHtml.length;
    extractedRanges.push({ start: startIndex, end: endIndex });

    // Look for immediately preceding comment
    let commentTitle = null;
    const prevComments = commentRanges.filter(c => c.end <= startIndex);
    if (prevComments.length > 0) {
      const lastPrev = prevComments[prevComments.length - 1];
      const between = html.slice(lastPrev.end, startIndex);
      const strippedBetween = between.replace(/<\/?(?:div|section)\b[^>]*>/gi, '').trim();
      if (strippedBetween === '') {
        let cleanText = lastPrev.text.replace(/^[\s*#-]+/, '').replace(/[\s*#-]+$/, '').trim();
        if (cleanText && !cleanText.includes('<') && !cleanText.includes('>')) {
          commentTitle = cleanText;
        }
      }
    }

    components.push({
      tagName,
      classStr,
      classList,
      flocssClasses,
      mainClass: flocssClasses[0],
      rawHtml: fullHtml,
      commentTitle
    });
  }

  return components;
}

/**
 * Generate a clean, user-friendly snippet prefix from class list
 */
function formatSnippetPrefix(classList) {
  const flocss = classList.filter(c =>
    /^[cl]-[a-zA-Z0-9_-]+/.test(c) &&
    c !== 'l-container' &&
    !c.startsWith('p-component')
  );

  if (flocss.length === 0) return 'component';
  if (flocss.length === 1) return flocss[0];

  const base = flocss[0];
  const mods = flocss.slice(1).map(m => m.replace(new RegExp(`^${base}--?`), '').replace(/^--/, ''));
  return `${base}-${mods.join('-')}`;
}

/**
 * Format user-friendly title for snippet label
 */
function formatFriendlyTitle(prefix, classStr) {
  let clean = prefix.replace(/^[cl]-/, '');
  if (classStr.includes('--cl3')) return 'Grid (3 Columns)';
  if (classStr.includes('--cl4')) return 'Grid (4 Columns)';
  if (classStr.includes('--cl5')) return 'Grid (5 Columns)';
  if (classStr.includes('--middle') && classStr.includes('--reverse')) return 'Flex (Reverse + Middle)';
  if (classStr.includes('--equal')) return 'Flex Equal 50/50';
  if (classStr.includes('--reverse')) return classStr.includes('btn') ? 'Button Reverse' : 'Flex Reverse';
  if (classStr.includes('--arrow-between')) return 'Button Arrow Between';
  if (classStr.includes('--arrow-center')) return 'Button Arrow Center';
  if (classStr.includes('--arrow')) return 'Button with Arrow';
  if (classStr.includes('--blank')) return 'Link External (Blank)';
  if (classStr.includes('--line')) return 'Heading Line';
  if (classStr.includes('--dot')) return 'Heading Dot';
  return toTitleCase(clean);
}

/**
 * Format HTML body into VS Code snippet lines with intelligent tabstops
 */

function normalizeIndentation(html) {
  if (!html) return '';
  const trimmed = html.trim();
  const lines = trimmed.split(/\r?\n/);
  if (lines.length <= 1) return trimmed;

  let minIndent = Infinity;
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().length === 0) continue;
    const m = line.match(/^(\s*)/);
    const len = m ? m[1].length : 0;
    if (len < minIndent) {
      minIndent = len;
    }
  }

  if (minIndent === Infinity || minIndent === 0) {
    return lines.map(l => l.trimEnd()).join('\n').trim();
  }

  const result = [lines[0].trim()];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().length === 0) {
      result.push('');
    } else {
      result.push(line.slice(minIndent).trimEnd());
    }
  }

  return result.join('\n').trim();
}

function formatSnippetBody(rawHtml, tagName, mainClass, classStr) {
  const normalizedHtml = normalizeIndentation(rawHtml);
  let lines = normalizedHtml.split(/\r?\n/).map(line => line.replace(/^ +/g, match => '\t'.repeat(Math.round(match.length / 4))));

  // 1. Lists (ul/ol): keep 2 items with tabstops for fast authoring
  if (tagName === 'ul' || tagName === 'ol') {
    const liMatches = rawHtml.match(/<li\b[^>]*>[\s\S]*?<\/li>/gi) || [];
    if (liMatches.length > 2) {
      const sampleLi = liMatches[0];
      const itemClsMatch = sampleLi.match(/class=["']([^"']+)["']/i);
      const itemCls = itemClsMatch ? itemClsMatch[1] : `${mainClass}__item`;
      return [
        `<${tagName} class="${classStr}">`,
        `\t<li class="${itemCls}">\${1:ダミーテキスト。}</li>`,
        `\t<li class="${itemCls}">\${2:ダミーテキスト。}</li>`,
        `</${tagName}>`
      ];
    }
  }

  let joined = lines.join('\n');
  // Normalize links & image paths
  joined = joined.replace(/\bhref=["'][^"']*["']/g, 'href=""');
  joined = joined.replace(/src=["'](?:\.\.\/)+assets\//g, 'src="./assets/');

  // 2. Links (<a>) & Buttons: wrap inner text in ${1:...}
  if (tagName === 'a') {
    if (joined.includes('<span')) {
      joined = joined.replace(/(<span\b[^>]*>)([^<\n]+)(<\/span>)/g, (m, openSpan, txt, closeSpan) => {
        return `${openSpan}\${1:${txt.trim()}}${closeSpan}`;
      });
    } else {
      joined = joined.replace(/>([^<\n]+)<\/a>/g, (m, txt) => {
        return `>\${1:${txt.trim()}}</a>`;
      });
    }
    return joined.split('\n');
  }

  // 3. Headings & Paragraphs with single text child
  if ((/^h[1-6]$/.test(tagName) || tagName === 'p') && !joined.includes('<span') && !joined.includes('<a')) {
    joined = joined.replace(new RegExp(`>([^<\\n]+)<\\/${tagName}>`, 'g'), (m, txt) => {
      return `>\${1:${txt.trim()}}</${tagName}>`;
    });
    return joined.split('\n');
  }

  return joined.split('\n');
}

/**
 * Generate Snippets dynamically from all src/pages/components/_*.ejs
 */
export function syncSnippets(options = {}) {
  const { quiet = false } = options;

  if (!existsSync(COMPONENTS_DIR)) {
    if (!quiet) console.warn(`[snippets] Directory not found: ${COMPONENTS_DIR}`);
    return;
  }

  const generated = {};
  const stats = {};

  const files = readdirSync(COMPONENTS_DIR).filter(f => f.startsWith('_') && f.endsWith('.ejs'));

  for (const file of files) {
    const filePath = resolve(COMPONENTS_DIR, file);
    const content = readFileSync(filePath, 'utf8');
    const compName = basename(file, '.ejs').replace(/^_/, '');
    stats[compName] = 0;

    // Extract all FLOCSS components generically
    const components = extractFlocssComponents(content, file);

    for (const comp of components) {
      const prefix = formatSnippetPrefix(comp.classList);
      const friendlyTitle = comp.commentTitle || formatFriendlyTitle(prefix, comp.classStr);
      const label = `${comp.classStr} (${friendlyTitle})`;

      // Skip duplicate entries with identical classes
      if (generated[label]) continue;

      const body = formatSnippetBody(comp.rawHtml, comp.tagName, comp.mainClass, comp.classStr);

      generated[label] = {
        prefix,
        body,
        description: comp.commentTitle
          ? `${comp.commentTitle} (${comp.classStr}) from ${file}`
          : `FLOCSS (${comp.classStr}) from ${file}`
      };
      stats[compName]++;
    }

    // Enhancement: Multi-size heading picker for c-ttl
    const sizeMatches = Array.from(content.matchAll(/\bc-ttl(\d+)\b/g)).map(m => m[1]);
    const uniqueSizes = Array.from(new Set(sizeMatches)).sort((a, b) => Number(b) - Number(a));
    if (uniqueSizes.length > 1 && !generated['c-ttl (Heading with Selectable Size)']) {
      generated['c-ttl (Heading with Selectable Size)'] = {
        prefix: 'c-ttl',
        body: [
          `<h2 class="c-ttl\${1|${uniqueSizes.join(',')}|}">\${2:タイトルコンテンツ}</h2>`
        ],
        description: 'FLOCSS Heading with selectable font-size'
      };
      stats[compName]++;
    }

    // Enhancement: Multi-size paragraph picker for c-txt
    const txtSizeMatches = Array.from(content.matchAll(/\bc-txt(\d+)\b/g)).map(m => m[1]);
    const uniqueTxtSizes = Array.from(new Set(txtSizeMatches)).sort((a, b) => Number(b) - Number(a));
    if (uniqueTxtSizes.length > 1 && !generated['c-txt (Text with Selectable Size)']) {
      generated['c-txt (Text with Selectable Size)'] = {
        prefix: 'c-txt',
        body: [
          `<p class="c-txt\${1|${uniqueTxtSizes.join(',')}|}">\${2:ダミーテキスト。}</p>`
        ],
        description: 'FLOCSS Paragraph with selectable font-size'
      };
      stats[compName]++;
    }

    // Enhancement: Bilingual EN/JP Heading for c-title
    if (content.includes('c-title') && content.includes('c-title__en') && !generated['c-title (EN/JP Bilingual Heading)']) {
      generated['c-title (EN/JP Bilingual Heading)'] = {
        prefix: 'c-title',
        body: [
          '<h2 class="c-title">',
          '\t<span class="c-title__en">${1:ENGLISH TITLE}</span>',
          '\t<span class="c-title__jp">${2:日本語タイトル}</span>',
          '</h2>'
        ],
        description: 'FLOCSS Bilingual Title EN/JP (component/_titles.scss)'
      };
      stats[compName]++;
    }
  }

  // Dirty-check: only write to disk if content has actually changed
  const newContent = JSON.stringify(generated, null, 2) + '\n';
  let oldContent = '';
  if (existsSync(SNIPPETS_FILE)) {
    try { oldContent = readFileSync(SNIPPETS_FILE, 'utf8'); } catch {}
  }

  const hasChanged = newContent !== oldContent;
  if (hasChanged) {
    const snippetsDir = dirname(SNIPPETS_FILE);
    if (!existsSync(snippetsDir)) {
      mkdirSync(snippetsDir, { recursive: true });
    }
    writeFileSync(SNIPPETS_FILE, newContent, 'utf8');
  }

  const total = Object.keys(generated).length;
  if (!quiet) {
    const { compact = false } = options;
    if (compact) {
      if (hasChanged) {
        console.log(`[snippets] ✓ Auto-synced ${total} components -> .vscode/jline-components.code-snippets`);
      } else {
        console.log(`[snippets] ✓ Synced ${total} components (up to date)`);
      }
    } else {
      console.log(`\n✓ Snippets Rewritten & Synced (${total} items in .vscode/jline-components.code-snippets):`);
      for (const [name, count] of Object.entries(stats)) {
        if (count > 0) {
          console.log(`  - _${name}.ejs: ${count} snippet(s)`);
        }
      }
    }
  }

  return generated;
}

// CLI execution
if (process.argv[1] && resolve(process.argv[1]) === resolve(__filename)) {
  syncSnippets();
}
