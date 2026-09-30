/**
 * safety.js — Path safety & confinement guards (P0 Protection)
 * Prevents accidental deletion of Project Root, Parent Directories, System Root,
 * or Critical Source Directories during build/clean tasks.
 */

import { resolve, normalize, relative, isAbsolute, parse, dirname } from 'path';
import { fileURLToPath } from 'url';
import { rmSync, existsSync } from 'fs';
import { rm } from 'fs/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PROJECT_ROOT = resolve(__dirname, '../..');

export const FORBIDDEN_ROOT_NAMES = new Set([
  '',
  '.',
  '..',
  'src',
  'scripts',
  '.git',
  '.vscode',
  '.gemini',
  '.github',
  'node_modules',
  'workbench',
  'layouts',
  'tests',
  '__tests__',
  'package.json',
  'package-lock.json',
  'deploy-config.json',
  'readme.md'
]);

/**
 * Asserts that a target directory is strictly a non-protected subdirectory inside rootDir.
 * Throws a Security P0 Error if any risk is detected.
 * 
 * @param {string} targetDir - Directory targeted for operations (e.g. clean/rm)
 * @param {string} [rootDir=PROJECT_ROOT] - The Project Root directory
 * @returns {boolean} true if safe
 */
export function assertSafeOutputDir(targetDir, rootDir = PROJECT_ROOT) {
  if (!targetDir || typeof targetDir !== 'string' || !targetDir.trim()) {
    throw new Error('[SECURITY P0] Target directory cannot be empty or undefined');
  }
  if (!rootDir || typeof rootDir !== 'string' || !rootDir.trim()) {
    throw new Error('[SECURITY P0] Project root directory cannot be empty or undefined');
  }

  const normRoot = normalize(resolve(rootDir));
  const normTarget = normalize(resolve(targetDir));

  // 1. Filesystem Drive / Root Check (e.g. C:\, D:\, /)
  const parsedTarget = parse(normTarget);
  if (normTarget === parsedTarget.root) {
    throw new Error(`[SECURITY P0] Refused unsafe operation: Target is filesystem drive/root: "${normTarget}"`);
  }

  // 2. Strict Project Root Equality Check (Prevents wiping the entire repository)
  const isWindows = process.platform === 'win32';
  const rootComp = isWindows ? normRoot.toLowerCase() : normRoot;
  const targetComp = isWindows ? normTarget.toLowerCase() : normTarget;

  if (targetComp === rootComp) {
    throw new Error(`[SECURITY P0] Refused unsafe operation: Target is equal to Project Root: "${normTarget}"`);
  }

  // 3. Confinement Check (Target MUST be strictly inside rootDir)
  const rel = relative(normRoot, normTarget);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(
      `[SECURITY P0] Refused unsafe operation: Target is outside Project Root!\n` +
      `  Project Root: ${normRoot}\n` +
      `  Target Dir  : ${normTarget}\n` +
      `  Relative    : ${rel}`
    );
  }

  // 4. Critical Source Folder Guard (Prevents wiping src, scripts, .git, node_modules)
  const firstSegment = rel.split(/[\\/]/)[0].toLowerCase();
  if (FORBIDDEN_ROOT_NAMES.has(firstSegment)) {
    throw new Error(
      `[SECURITY P0] Refused unsafe operation: Target points to protected project folder "${firstSegment}": "${normTarget}"`
    );
  }

  return true;
}

import { randomBytes } from 'crypto';

let devSessionToken = null;

/**
 * Returns the current Dev Session Token, generating one if not already created.
 */
export function getDevSessionToken() {
  if (!devSessionToken) {
    devSessionToken = randomBytes(24).toString('hex');
  }
  return devSessionToken;
}

/**
 * Resets the Dev Session Token (useful for testing or session renewal).
 */
export function resetDevSessionToken() {
  devSessionToken = randomBytes(24).toString('hex');
  return devSessionToken;
}

/**
 * Verifies that a client-provided token matches the current dev session token.
 */
export function isValidDevToken(token) {
  if (!token || typeof token !== 'string') return false;
  return token === getDevSessionToken();
}

/**
 * Sanitizes and validates a component name or alias to prevent Path Traversal.
 */
export function isValidComponentName(name) {
  if (!name || typeof name !== 'string') return false;
  const trimmed = name.trim();
  return /^[a-zA-Z0-9_-]+$/.test(trimmed) && !trimmed.includes('..');
}

/**
 * Checks whether a given path is strictly inside the specified allowed directory.
 * Prevents Path Traversal attacks (e.g. ../../escape).
 * 
 * @param {string} targetPath - Path to check (relative or absolute)
 * @param {string} allowedRootDir - The allowed parent directory root
 * @returns {boolean} true if targetPath is strictly inside allowedRootDir
 */
export function isPathInside(targetPath, allowedRootDir) {
  if (!targetPath || typeof targetPath !== 'string' || !allowedRootDir || typeof allowedRootDir !== 'string') {
    return false;
  }
  if (targetPath.includes('\0') || allowedRootDir.includes('\0')) {
    return false;
  }

  const normRoot = normalize(resolve(allowedRootDir));
  const normTarget = normalize(resolve(normRoot, targetPath));

  const isWindows = process.platform === 'win32';
  const rootComp = isWindows ? normRoot.toLowerCase() : normRoot;
  const targetComp = isWindows ? normTarget.toLowerCase() : normTarget;

  if (targetComp === rootComp) {
    return false;
  }

  const rel = relative(normRoot, normTarget);
  return Boolean(rel && !rel.startsWith('..') && !isAbsolute(rel));
}

/**
 * Safely resolves a requested path against an allowed root directory.
 * If the resulting path escapes the allowed root, throws a Security P0 Error.
 * 
 * Enforcement principle:
 * Requested path -> normalize -> resolve -> Is inside allowed root?
 *   YES → continue (returns safe resolved absolute path)
 *   NO  → BLOCK (throws Security P0 Error)
 * 
 * @param {string} allowedRootDir - The root directory boundary
 * @param {string} requestedPath - The user or client requested subpath/filename
 * @param {string} [label='Path'] - Descriptive field name for error reporting
 * @returns {string} Safe normalized absolute path
 */
export function resolveSafePath(allowedRootDir, requestedPath, label = 'Path') {
  if (!allowedRootDir || typeof allowedRootDir !== 'string' || !allowedRootDir.trim()) {
    throw new Error(`[SECURITY P0] Thư mục gốc cho "${label}" không được để trống`);
  }
  if (!requestedPath || typeof requestedPath !== 'string' || !requestedPath.trim()) {
    throw new Error(`[SECURITY P0] Đường dẫn "${label}" không được để trống`);
  }
  if (requestedPath.includes('\0')) {
    throw new Error(`[SECURITY P0] Phát hiện Poison Null Byte trong "${label}"`);
  }

  const normRoot = normalize(resolve(allowedRootDir));
  const normTarget = normalize(resolve(normRoot, requestedPath));

  const isWindows = process.platform === 'win32';
  const rootComp = isWindows ? normRoot.toLowerCase() : normRoot;
  const targetComp = isWindows ? normTarget.toLowerCase() : normTarget;

  if (targetComp === rootComp) {
    throw new Error(`[SECURITY P0] Path Traversal bị chặn: "${label}" không được trùng với thư mục gốc: "${normTarget}"`);
  }

  const rel = relative(normRoot, normTarget);
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) {
    throw new Error(
      `[SECURITY P0] Path Traversal bị chặn: "${label}" nằm ngoài phạm vi thư mục cho phép!\n` +
      `  Thư mục cho phép: ${normRoot}\n` +
      `  Đường dẫn yêu cầu: ${requestedPath}\n` +
      `  Đường dẫn resolve: ${normTarget}\n` +
      `  Relative: ${rel}`
    );
  }

  return normTarget;
}

/**
 * Asserts that a target path is strictly inside allowedRootDir.
 * Throws a Security P0 Error if Path Traversal is detected.
 * 
 * @param {string} targetPath - Path to check
 * @param {string} allowedRootDir - Allowed parent directory
 * @param {string} [label='Path'] - Descriptive label
 * @returns {string} Safe normalized absolute path
 */
export function assertSafePathInside(targetPath, allowedRootDir, label = 'Path') {
  return resolveSafePath(allowedRootDir, targetPath, label);
}

/**
 * Safely removes a directory synchronously after verifying safety assertions.
 */
export function safeRmDirSync(targetDir, rootDir = PROJECT_ROOT, rmOptions = { recursive: true, force: true }) {
  assertSafeOutputDir(targetDir, rootDir);
  if (existsSync(targetDir)) {
    rmSync(targetDir, rmOptions);
  }
}

/**
 * Safely removes a directory asynchronously after verifying safety assertions.
 */
export async function safeRmDir(targetDir, rootDir = PROJECT_ROOT, rmOptions = { recursive: true, force: true }) {
  assertSafeOutputDir(targetDir, rootDir);
  if (existsSync(targetDir)) {
    await rm(targetDir, rmOptions);
  }
}

