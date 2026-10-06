/**
 * scripts/tools/components/workbench-manager.js
 * Workbench Canonical Repository Management (Save, Export, Delete Component & Variant)
 * Enforces Automatic Snapshot Backup before every destructive modification.
 */

import { existsSync, readFileSync, writeFileSync, copyFileSync, unlinkSync, mkdirSync } from 'fs';
import { resolve, basename } from 'path';
import { normalizeName } from './metadata.js';
import {
  getDefaultPaths,
  getComponentCategory,
  getWorkbenchScssDirForCategory,
  getScssDirForCategory,
  findMatchingEjs,
  findMatchingScss
} from './paths.js';
import { resolveSafePath } from '../safety.js';
import { createSnapshotBackup } from './backup.js';
import { updateWorkbenchScss } from './installer.js';
import { getRegistry } from './registry.js';
import { parseEjsComponentCards, removeVariantFromEjs, removeVariantFromScss } from './variants.js';

/**
 * Export/Save component from src/ to workbench/ (Template Showroom)
 * Always creates a snapshot backup before overwriting.
 */
export function saveComponent(srcName, options = {}, paths = getDefaultPaths()) {
  const norm = normalizeName(srcName);
  const targetName = options.as ? normalizeName(options.as) : norm;
  const category = getComponentCategory(srcName);
  const targetClientScssDir = getScssDirForCategory(category, paths);
  const targetWbScssDir = getWorkbenchScssDirForCategory(category, paths);

  // Find source EJS in src/components/
  let srcEjsFile = null;
  const ejsMatch = findMatchingEjs(norm, paths.clientComponentsDir);
  if (ejsMatch) {
    srcEjsFile = resolve(paths.clientComponentsDir, ejsMatch);
  }

  // Find source SCSS in targetClientScssDir or clientScssDir
  let srcScssFile = null;
  let scssMatch = findMatchingScss(norm, targetClientScssDir);
  if (scssMatch) {
    srcScssFile = resolve(targetClientScssDir, scssMatch);
  } else {
    scssMatch = findMatchingScss(norm, paths.clientScssDir);
    if (scssMatch) {
      srcScssFile = resolve(paths.clientScssDir, scssMatch);
    }
  }

  // Find source JS
  let srcJsFile = null;
  const jsCandidates = [
    resolve(paths.clientJsDir, `${norm}.js`),
    resolve(paths.root, 'src/pages/assets/js', `${norm}.js`)
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

  // Safe Overwrite Protection: Protect workbench canonical templates
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

  // Automatic Snapshot Backup before updating canonical workbench component
  createSnapshotBackup(targetName, 'sync_from_site', paths);

  const savedFiles = [];

  // 1. Copy EJS to workbench/components/_<target>.ejs
  if (srcEjsFile) {
    if (!existsSync(paths.wbComponentsDir)) {
      mkdirSync(paths.wbComponentsDir, { recursive: true });
    }
    const destEjs = resolveSafePath(paths.wbComponentsDir, `_${targetName}.ejs`, 'destEjs');
    copyFileSync(srcEjsFile, destEjs);
    savedFiles.push(`workbench/components/_${targetName}.ejs`);
  }

  // 2. Copy SCSS to targetWbScssDir/_<target>.scss
  if (srcScssFile) {
    if (!existsSync(targetWbScssDir)) {
      mkdirSync(targetWbScssDir, { recursive: true });
    }
    const destScss = resolveSafePath(targetWbScssDir, `_${targetName}.scss`, 'destScss');
    copyFileSync(srcScssFile, destScss);
    const relWb = category === 'layout' ? `workbench/layout/_${targetName}.scss` : `workbench/scss/_${targetName}.scss`;
    savedFiles.push(relWb);
    updateWorkbenchScss(targetName, 'add', category, paths);
  }

  // 3. Copy JS to workbench/js/<target>.js
  if (srcJsFile) {
    if (!existsSync(paths.wbJsDir)) {
      mkdirSync(paths.wbJsDir, { recursive: true });
    }
    const destJs = resolveSafePath(paths.wbJsDir, `${targetName}.js`, 'destJs');
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

/**
 * Permanently deletes a component from workbench (HTML/EJS, SCSS, and JS)
 * Always creates a snapshot backup in workbench/.backup/ first.
 */
export function deleteWorkbenchComponent(targetName, options = {}, paths = getDefaultPaths()) {
  const norm = normalizeName(targetName);
  const registry = getRegistry(paths);
  const found = registry.find(r => r.name === norm || r.name === norm + 's' || r.name.replace(/s$/, '') === norm);

  if (!found) {
    return {
      success: false,
      message: `Component "${targetName}" không tồn tại trong Workbench`
    };
  }

  // 1. Snapshot backup before deletion
  createSnapshotBackup(norm, 'before_workbench_delete', paths);

  const category = found.category || getComponentCategory(norm);
  const targetWbScssDir = getWorkbenchScssDirForCategory(category, paths);
  const deletedFiles = [];

  // 2. Delete EJS template
  const ejsFileName = found.ejsFile || `_${norm}.ejs`;
  const ejsPath = resolveSafePath(paths.wbComponentsDir, ejsFileName, 'workbench ejsFile');
  if (existsSync(ejsPath)) {
    unlinkSync(ejsPath);
    deletedFiles.push(`workbench/components/${ejsFileName}`);
  }

  // 3. Delete SCSS & clean @use in _index.scss
  const scssFile = found.scssFile || `_${norm}.scss`;
  let scssPath = resolveSafePath(targetWbScssDir, scssFile, 'workbench scssFile');
  if (!existsSync(scssPath)) {
    scssPath = resolveSafePath(paths.wbScssDir, scssFile, 'workbench scssFile fallback');
  }
  if (existsSync(scssPath)) {
    unlinkSync(scssPath);
    deletedFiles.push(category === 'layout' ? `workbench/layout/${scssFile}` : `workbench/scss/${scssFile}`);
  }
  const scssBase = basename(scssFile, '.scss').replace(/^_/, '');
  updateWorkbenchScss(scssBase, 'remove', category, paths);

  // 4. Delete JS
  if (found.jsFile) {
    const jsPath = resolveSafePath(paths.wbJsDir, found.jsFile, 'workbench jsFile');
    if (existsSync(jsPath)) {
      unlinkSync(jsPath);
      deletedFiles.push(`workbench/js/${found.jsFile}`);
    }
  }

  return {
    success: true,
    name: norm,
    deletedFiles,
    message: `Đã xóa thành công component "${norm}" và toàn bộ file liên quan (HTML, SCSS, JS) khỏi Workbench!`
  };
}

/**
 * Permanently deletes a single component variant from Workbench (card-level delete)
 */
export function deleteWorkbenchVariant({ component, classStr, title, cardIndex, commentTitle }, paths = getDefaultPaths()) {
  const norm = normalizeName(component);
  const registry = getRegistry(paths);
  const found = registry.find(r => r.name === norm || r.name === norm + 's' || r.name.replace(/s$/, '') === norm);

  if (!found) {
    return {
      success: false,
      message: `Component "${component}" không tồn tại trong Workbench`
    };
  }

  // 1. Snapshot backup before deletion
  createSnapshotBackup(norm, 'before_variant_delete', paths);

  const category = found.category || getComponentCategory(norm);
  const targetWbScssDir = getWorkbenchScssDirForCategory(category, paths);
  const modifiedFiles = [];

  // 2. Remove variant from EJS
  const ejsPath = resolveSafePath(paths.wbComponentsDir, found.ejsFile || `_${norm}.ejs`, 'wb EJS');
  let remainingEjs = '';
  if (existsSync(ejsPath)) {
    const rawEjs = readFileSync(ejsPath, 'utf8');
    remainingEjs = removeVariantFromEjs(rawEjs, { classStr, commentTitle, cardIndex });
    writeFileSync(ejsPath, remainingEjs, 'utf8');
    modifiedFiles.push(`workbench/components/${found.ejsFile || `_${norm}.ejs`}`);
  }

  // 3. Remove variant SCSS rules if applicable
  const scssFile = found.scssFile || `_${norm}.scss`;
  let scssPath = resolveSafePath(targetWbScssDir, scssFile, 'wb SCSS');
  if (!existsSync(scssPath)) {
    scssPath = resolveSafePath(paths.wbScssDir, scssFile, 'wb SCSS fallback');
  }
  if (existsSync(scssPath)) {
    const rawScss = readFileSync(scssPath, 'utf8');
    const updatedScss = removeVariantFromScss(rawScss, remainingEjs, classStr);
    if (updatedScss !== rawScss) {
      writeFileSync(scssPath, updatedScss, 'utf8');
      modifiedFiles.push(category === 'layout' ? `workbench/layout/${scssFile}` : `workbench/scss/${scssFile}`);
    }
  }

  const remainingCards = parseEjsComponentCards(remainingEjs);

  return {
    success: true,
    component: norm,
    remainingCards: remainingCards.length,
    modifiedFiles,
    message: `Đã xóa thành công biến thể khỏi Workbench!`
  };
}
