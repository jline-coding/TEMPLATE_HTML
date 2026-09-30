/**
 * scripts/tools/components/backup.js
 * Component Snapshot Backup & Safe Rollback Engine
 * Creates automatic snapshots before destructive updates/deletions.
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync } from 'fs';
import { resolve } from 'path';
import { normalizeName } from './metadata.js';
import { getDefaultPaths, getWorkbenchScssDirForCategory, getComponentCategory } from './paths.js';
import { resolveSafePath } from '../safety.js';

/**
 * Creates a timestamped snapshot backup of a component before update or delete
 * @param {string} compName
 * @param {string} [reason='manual_backup']
 * @param {Object} [paths=getDefaultPaths()]
 * @returns {string|null} Backup directory path if created
 */
export function createSnapshotBackup(compName, reason = 'manual_backup', paths = getDefaultPaths()) {
  const norm = normalizeName(compName);
  if (!norm) return null;

  const backupDir = resolveSafePath(paths.wbDir, '.backup', 'workbench backup');
  if (!existsSync(backupDir)) {
    mkdirSync(backupDir, { recursive: true });
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const targetDir = resolveSafePath(backupDir, `${timestamp}_${norm}_${reason}`, 'backup target');
  mkdirSync(targetDir, { recursive: true });

  const category = getComponentCategory(norm);
  const wbScssDir = getWorkbenchScssDirForCategory(category, paths);

  // Backup EJS
  const wbEjs = resolve(paths.wbComponentsDir, `_${norm}.ejs`);
  if (existsSync(wbEjs)) copyFileSync(wbEjs, resolve(targetDir, `_${norm}.ejs`));

  // Backup SCSS
  const wbScss = resolve(wbScssDir, `_${norm}.scss`);
  if (existsSync(wbScss)) copyFileSync(wbScss, resolve(targetDir, `_${norm}.scss`));

  // Backup JS
  const wbJs = resolve(paths.wbJsDir, `${norm}.js`);
  if (existsSync(wbJs)) copyFileSync(wbJs, resolve(targetDir, `${norm}.js`));

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
      return {
        id: e.name,
        timestamp: parts[0] || '',
        component: norm,
        reason: parts.slice(2).join('_') || 'backup',
        dir: resolve(backupDir, e.name)
      };
    })
    .sort((a, b) => b.id.localeCompare(a.id));
}
