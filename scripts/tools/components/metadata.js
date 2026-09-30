/**
 * scripts/tools/components/metadata.js
 * Component Specification & Metadata Management (Component Sharing Architecture)
 * Standards:
 * - schemaVersion: Specification standard (default: '1.0.0')
 * - id: Globally unique component identifier (e.g. 'c-header', 'c-btn', 'l-flex')
 * - version: Semantic component version (e.g. '1.0.0')
 * - dependencies: Prerequisite components required for proper rendering
 */

import { basename, extname } from 'path';
import matter from 'gray-matter';

export const COMPONENT_SCHEMA_VERSION = '1.0.0';

/**
 * Standard Component Dependencies Map
 * Declares prerequisite sub-components required for composite components
 */
export const COMPONENT_DEPENDENCIES = {
  header: ['gnavi', 'btns'],
  footer: ['btns']
};

/**
 * Normalizes input name (e.g. "_btns.ejs" -> "btns", "btn" -> "btn")
 * @param {string} input
 * @returns {string}
 */
export function normalizeName(input) {
  if (!input) return '';
  let name = input.trim();
  name = basename(name, extname(name));
  return name.replace(/^_+/, '').toLowerCase();
}

/**
 * Generates standard unique Component ID according to category and name
 * @param {string} name
 * @param {'header' | 'footer' | 'layout' | 'component'} [category='component']
 * @returns {string}
 */
export function generateComponentId(name, category = 'component') {
  const norm = normalizeName(name);
  if (!norm) return '';
  const prefix = category === 'layout' ? 'l-' : 'c-';
  return norm.startsWith(prefix) ? norm : `${prefix}${norm}`;
}

/**
 * Parse frontmatter metadata from component EJS content
 * Supports YAML frontmatter (---) and HTML comment-wrapped frontmatter (<!-- --- ... --- -->)
 * Standardizes id, version, schemaVersion, and dependencies.
 * 
 * @param {string} content
 * @returns {{ meta: Object, content: string }}
 */
export function parseComponentMetadata(content) {
  if (!content || !content.trim()) return { meta: {}, content: '' };

  let rawMeta = {};
  let bodyContent = content.trim();

  try {
    const direct = matter(content);
    if (direct.data && Object.keys(direct.data).length > 0) {
      rawMeta = direct.data;
      bodyContent = direct.content.trim();
    } else {
      const commentMatch = content.match(/^\s*<!--\s*\r?\n([\s\S]*?)\r?\n\s*-->/);
      if (commentMatch) {
        const inner = matter(commentMatch[1].trim());
        if (inner.data && Object.keys(inner.data).length > 0) {
          rawMeta = inner.data;
          bodyContent = content.slice(commentMatch[0].length).trim();
        }
      }
    }
  } catch {
    // If parsing fails, treat entire file as plain content
    return { meta: {}, content: content.trim() };
  }

  // Standardize metadata with specification defaults
  const normalizedMeta = {
    schemaVersion: rawMeta.schemaVersion || COMPONENT_SCHEMA_VERSION,
    id: rawMeta.id || (rawMeta.name ? generateComponentId(rawMeta.name, rawMeta.category) : undefined),
    version: rawMeta.version || '1.0.0',
    title: rawMeta.title || '',
    category: rawMeta.category || 'component',
    scss: rawMeta.scss || undefined,
    js: rawMeta.js || undefined,
    dependencies: Array.isArray(rawMeta.dependencies) ? rawMeta.dependencies : [],
    ...rawMeta
  };

  return { meta: normalizedMeta, content: bodyContent };
}

/**
 * Serializes metadata and content back into standard HTML comment frontmatter format
 * @param {Object} meta
 * @param {string} content
 * @returns {string}
 */
export function formatComponentMetadata(meta, content) {
  if (!meta || Object.keys(meta).length === 0) {
    return content.trim() + '\n';
  }

  const cleanMeta = {
    schemaVersion: meta.schemaVersion || COMPONENT_SCHEMA_VERSION,
    id: meta.id,
    version: meta.version || '1.0.0',
    title: meta.title,
    category: meta.category || 'component',
    dependencies: meta.dependencies || []
  };

  // Remove undefined keys
  Object.keys(cleanMeta).forEach(k => cleanMeta[k] === undefined && delete cleanMeta[k]);

  const yamlLines = Object.entries(cleanMeta).map(([k, v]) => {
    if (Array.isArray(v)) {
      return `${k}: [${v.map(item => `"${item}"`).join(', ')}]`;
    }
    return `${k}: "${v}"`;
  });

  const header = `<!--\n---\n${yamlLines.join('\n')}\n---\n-->\n\n`;
  return header + content.trim() + '\n';
}
