/**
 * scripts/tools/components/backup.js
 * Component Snapshot Backup & Safe Rollback Engine
 * Creates automatic snapshots before destructive updates/deletions.
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync, writeFileSync, mkdtempSync } from 'fs';
import { resolve, basename, relative } from 'path';
import { normalizeName } from './metadata.js';
import { getDefaultPaths, resolveComponentFiles } from './paths.js';
import { resolveSafePath } from '../safety.js';

/**
 * Creates a timestamped snapshot backup of a component before update or delete
 * @param {string} compName
 * @param {string} [reason='manual_backup']
 * @param {Object} [paths=getDefaultPaths()]
 * @returns {string|null} Backup directory path if created
 */
export function createSnapshotBackup(compName, reason = 'manual_backup', paths = getDefaultPaths(), files = null) {
  const norm = normalizeName(compName);
  if (!norm) return null;

  const backupDir = resolveSafePath(paths.wbDir, '.backup', 'workbench backup');
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const prefix = resolveSafePath(backupDir, `${timestamp}_${norm}_${reason}_`, 'backup target');
  const targetDir = mkdtempSync(prefix);
  const source = files ? null : resolveComponentFiles(norm, paths);
  const sources = files || [source.ejsPath, source.scssPath, source.jsPath];
  const manifest = [];
  for (const file of [...new Set(sources.filter(Boolean))]) {
    const safeFile = resolveSafePath(paths.root, file, 'snapshot source');
    if (!existsSync(safeFile)) continue;
    let stored = basename(safeFile);
    if (manifest.some(item => item.stored === stored)) stored = `${manifest.length}_${stored}`;
    copyFileSync(safeFile, resolve(targetDir, stored));
    manifest.push({ original: relative(paths.root, safeFile), stored });
  }
  writeFileSync(resolve(targetDir, 'manifest.json'), JSON.stringify({ component: norm, reason, timestamp, files: manifest }, null, 2));

  return targetDir;
}

/**
 * Lists available snapshot backups for a component
 * @param {string} compName
 * @param {Object} [paths=getDefaultPaths()]
 * @returns {Array<{ id: string, timestamp: string, reason: string, dir: string }>}
 */
export function listSnapshotBackups(compName, paths = getDefaultPaths()) {
  const norm = normalizeName(compName);
  const backupDir = resolve(paths.wbDir, '.backup');
  if (!existsSync(backupDir)) return [];

  const entries = readdirSync(backupDir, { withFileTypes: true });
  return entries
    .filter(e => e.isDirectory() && e.name.includes(`_${norm}_`))
    .map(e => {
      const parts = e.name.split('_');
      let metadata = {};
      const manifest = resolve(backupDir, e.name, 'manifest.json');
      if (existsSync(manifest)) {
        try { metadata = JSON.parse(readFileSync(manifest, 'utf8')); } catch {}
      }
      return {
        id: e.name,
        timestamp: parts[0] || '',
        component: norm,
        reason: metadata.reason || parts.slice(2).join('_') || 'backup',
        dir: resolve(backupDir, e.name)
      };
    })
    .sort((a, b) => b.id.localeCompare(a.id));
}
