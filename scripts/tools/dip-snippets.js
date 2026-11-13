import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';

// Called only by the DIP page build. Missing configuration preserves the old output.
export async function loadDipSnippets(configPath) {
  let source;
  try {
    source = readFileSync(configPath);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }

  try {
    // Reload edited config in dev without re-importing unchanged config for every page.
    const url = pathToFileURL(configPath);
    url.searchParams.set('version', createHash('sha256').update(source).digest('hex'));
    const { default: config } = await import(url.href);
    if (!config || typeof config !== 'object' || Array.isArray(config)) {
      throw new Error('default export must be an object');
    }
    const snippets = {};
    for (const device of ['pc', 'sp']) {
      const entry = config[device];
      if (entry !== undefined && (!entry || typeof entry !== 'object' || Array.isArray(entry))) {
        throw new Error(`${device} must be an object`);
      }
      snippets[device] = {};
      for (const position of ['bodyStart', 'bodyEnd']) {
        const value = entry?.[position];
        if (value !== undefined && typeof value !== 'string') {
          throw new Error(`${device}.${position} must be a string`);
        }
        snippets[device][position] = value ?? '';
      }
    }
    return snippets;
  } catch (error) {
    throw new Error(`[dip] Cannot load ${configPath}: ${error.message}`, { cause: error });
  }
}

export function injectDipSnippets(html, prefix, config) {
  const device = prefix.split('/')[0];
  const { bodyStart = '', bodyEnd = '' } = config?.[device] ?? {};
  if (!bodyStart && !bodyEnd) return html;

  // Skip comments, PHP and raw-text elements so tag-like text in scripts or
  // attributes cannot be mistaken for the document's body boundaries.
  const tags = /<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<(script|style|textarea|title)\b(?:[^>"']|"[^"]*"|'[^']*')*>[\s\S]*?<\/\1\s*>|<\/?[a-z][a-z0-9:-]*(?:[^>"']|"[^"]*"|'[^']*')*>/gi;
  let start = -1;
  let end = -1;
  for (const match of html.matchAll(tags)) {
    if (start === -1 && /^<body(?:\s|>)/i.test(match[0])) start = match.index + match[0].length;
    if (/^<\/body\s*>$/i.test(match[0])) end = match.index;
  }
  if ((bodyStart && start === -1) || (bodyEnd && end === -1) || (start !== -1 && end !== -1 && start > end)) {
    throw new Error(`[dip] Cannot insert ${device} snippets: required <body> or </body> tag is missing`);
  }

  // Slices preserve every character of the configured strings, including '$&',
  // backslashes, whitespace and EJS-looking text. Do not format this result.
  let output = html;
  if (bodyEnd) output = output.slice(0, end) + '\n' + bodyEnd + '\n' + output.slice(end);
  if (bodyStart) output = output.slice(0, start) + '\n' + bodyStart + '\n' + output.slice(start);
  return output;
}
