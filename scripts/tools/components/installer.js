/**
 * scripts/tools/components/installer.js
 * Transactional Component Installer with Automatic Rollback Guard
 * Guarantees atomicity: if any step fails (SCSS, JS, EJS, or Dependency),
 * all changes are immediately and cleanly rolled back!
 */

import { existsSync, readFileSync, writeFileSync, copyFileSync, unlinkSync, mkdirSync } from 'fs';
import { resolve, basename } from 'path';
import { normalizeName, COMPONENT_DEPENDENCIES, parseComponentMetadata, resolveComponentDependencies, resolveComponentVendors } from './metadata.js';
import {
  getDefaultPaths,
  getComponentCategory,
  getScssDirForCategory,
  getScssIndexForCategory,
  getWorkbenchScssDirForCategory,
  findMatchingEjs,
  findMatchingScss,
  findMatchingJs,
  resolveComponentFiles
} from './paths.js';
import { resolveSafePath, isValidComponentName } from '../safety.js';
import { isTemplateStub, sliceScssForClasses, mergeVariantScss, mergeComponentScss, findRuleBlockRange, isModifierInBlock } from './variants.js';
import { stripEjsShowroomWrapper, sliceJsForComponent, mergeComponentJs, getComponentJsRange, removeComponentJs, getRegistry } from './registry.js';

/**
 * Transaction Manager to track and rollback filesystem modifications
 */
export { InstallTransaction } from './transaction.js';
import { InstallTransaction } from './transaction.js';
import { createSnapshotBackup } from './backup.js';

function customConflict(message) {
  throw Object.assign(new Error(message), { conflict: true });
}
function jsBody(content, name) {
  return sliceJsForComponent(content, name)
    .replace(/^\s*\/\*[^]*?\[Component(?:\s*Module)?:[^]*?\*\/\s*/i, '').trim();
}

/**
 * Updates client _index.scss with @use statement, recording changes in transaction if provided
 */
export function updateClientScssIndex(scssBaseName, action = 'add', category = 'component', paths = getDefaultPaths(), transaction = null) {
  const targetDir = getScssDirForCategory(category, paths);
  const targetIndex = getScssIndexForCategory(category, paths);

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  const existingContent = existsSync(targetIndex) ? readFileSync(targetIndex, 'utf8') : '';
  if (transaction && existsSync(targetIndex)) {
    transaction.recordModified(targetIndex, existingContent);
  } else if (transaction && !existsSync(targetIndex)) {
    transaction.recordCreated(targetIndex);
  }

  let content = existingContent;
  const importStatement = `@use "${scssBaseName}";`;
  const regex = new RegExp(`@use\\s+["']${scssBaseName}["'];?\\r?\\n?`, 'g');

  if (action === 'add') {
    if (!content.includes(`@use "${scssBaseName}"`) && !content.includes(`@use '${scssBaseName}'`)) {
      content = content.trimEnd();
      content = content ? `${content}\n${importStatement}\n` : `${importStatement}\n`;
      writeFileSync(targetIndex, content, 'utf8');
      return true;
    }
  } else if (action === 'remove') {
    if (regex.test(content)) {
      content = content.replace(regex, '');
      writeFileSync(targetIndex, content.trimEnd() ? (content.trimEnd() + '\n') : '', 'utf8');
      return true;
    }
  }
  return false;
}

/**
 * Ensures workbench SCSS index has @use
 */
export function updateWorkbenchScss(scssBaseName, action = 'add', category = 'component', paths = getDefaultPaths()) {
  const targetDir = category === 'layout' ? paths.wbLayoutDir : paths.wbScssDir;
  const targetIndex = category === 'layout' ? resolveSafePath(paths.wbLayoutDir, '_index.scss', 'wb layout _index.scss') : resolveSafePath(paths.wbScssDir, '_index.scss', 'wb scss _index.scss');

  if (!existsSync(targetDir)) {
    mkdirSync(targetDir, { recursive: true });
  }

  let content = existsSync(targetIndex) ? readFileSync(targetIndex, 'utf8') : '';
  const importStatement = `@use "${scssBaseName}";`;
  const regex = new RegExp(`@use\\s+["']${scssBaseName}["'];?\\r?\\n?`, 'g');

  if (action === 'add') {
    if (!content.includes(`@use "${scssBaseName}"`) && !content.includes(`@use '${scssBaseName}'`)) {
      content = content.trimEnd();
      content = content ? `${content}\n${importStatement}\n` : `${importStatement}\n`;
      writeFileSync(targetIndex, content, 'utf8');
      return true;
    }
  } else if (action === 'remove') {
    if (regex.test(content)) {
      content = content.replace(regex, '');
      writeFileSync(targetIndex, content.trimEnd() ? (content.trimEnd() + '\n') : '', 'utf8');
      return true;
    }
  }
  return false;
}

/**
 * Cleanly appends component JS logic to the end of a selected file in assets/js
 * Enforces Path Traversal prevention & transaction backup
 */
export function appendJsToTargetFile(targetFileName, compName, jsCode, paths = getDefaultPaths(), transaction = null) {
  if (!targetFileName || typeof targetFileName !== 'string' || !jsCode || !jsCode.trim()) {
    return { success: false, message: 'Thiếu tên file đích hoặc mã JS' };
  }

  const assetsJsDir = resolve(paths.root, 'src/pages/assets/js');
  if (!existsSync(assetsJsDir)) {
    mkdirSync(assetsJsDir, { recursive: true });
  }

  let cleanName = targetFileName.trim().replace(/^[\\/]+/, '');
  if (!cleanName.endsWith('.js')) cleanName += '.js';

  let targetPath;
  try {
    targetPath = resolveSafePath(assetsJsDir, cleanName, 'targetJsFile');
  } catch (err) {
    return {
      success: false,
      message: `[SECURITY] Path Traversal bị chặn: File JS đích "${targetFileName}" nằm ngoài thư mục assets/js.`
    };
  }

  const existedBefore = existsSync(targetPath);
  let existing = existedBefore ? readFileSync(targetPath, 'utf8') : '';

  if (transaction) {
    if (existedBefore) {
      transaction.recordModified(targetPath, existing);
    } else {
      transaction.recordCreated(targetPath);
    }
  }

  // Ensure formatted with component header if not already present
  let formattedJs = jsCode.trim();
  const hasMarker = /\[Component(?:\s*Module)?:\s*[\w-]+\]/i.test(formattedJs);
  if (!hasMarker) {
    formattedJs = `/* ==========================================================================\n   [Component: ${compName}]\n   ========================================================================== */\n${formattedJs}`;
  }

  const updated = mergeComponentJs(existing, formattedJs, compName);
  writeFileSync(targetPath, updated, 'utf8');

  return {
    success: true,
    file: `src/pages/assets/js/${cleanName}`,
    message: `Đã tích hợp JS vào file "assets/js/${cleanName}"`
  };
}

/**
 * Transactional Install: Installs component from workbench/ into client src/
 * Rolls back ALL filesystem changes if any step or sub-dependency fails!
 */
export function installComponent(targetName, options = {}, paths = getDefaultPaths(), existingTx = null) {
  const isRootTx = !existingTx;
  const tx = existingTx || new InstallTransaction();

  try {
    const norm = normalizeName(targetName);
    const alias = options.as ? normalizeName(options.as) : norm;
    const isCustomAlias = Boolean(options.as && alias !== norm);

    if (options.as && !isValidComponentName(options.as)) {
      throw new Error(`Tên alias "${options.as}" không hợp lệ (chỉ chấp nhận a-z, 0-9, gạch ngang/dưới)`);
    }

    const source = resolveComponentFiles(norm, paths);
    const category = source.category;
    const targetWbScssDir = getWorkbenchScssDirForCategory(category, paths);
    const targetClientScssDir = getScssDirForCategory(category, paths);
    const ejsFile = source.ejsFile;
    const scssFile = source.scssPath ? basename(source.scssPath) : null;
    let jsFile = source.jsPath ? basename(source.jsPath) : null;
    const meta = source.meta;
    const rawEjs = source.raw;
    const componentKey = source.name;
    if (tx.activeComponents.has(componentKey)) throw new Error(`Circular dependency: ${[...tx.activeComponents, componentKey].join(' -> ')}`);
    tx.activeComponents.add(componentKey);

    if (!jsFile && options.targetJsFile && options.targetJsFile !== '__skip__' && options.targetJsFile !== 'none' && existsSync(resolve(paths.wbJsDir, options.targetJsFile))) {
      jsFile = options.targetJsFile;
    }

    if (!ejsFile && !scssFile && !jsFile) {
      throw new Error(`Component "${targetName}" không tồn tại trong Workbench`);
    }

    const installedFiles = [];
    const installedDependencies = [];

    // Step 0: Flexible & Intelligent Dependency Resolution (Frontmatter > Auto-detection > Fallback)
    const deps = resolveComponentDependencies(componentKey, meta, rawEjs);
    const warnings = [];
    const clientBefore = resolveComponentFiles(isCustomAlias ? alias : componentKey, paths, 'client');
    const overwriteFiles = [clientBefore.scssPath, clientBefore.jsPath, options.includeEjs ? clientBefore.ejsPath : null].filter(Boolean);
    if (overwriteFiles.length) createSnapshotBackup(alias, 'before_site_install', paths, overwriteFiles);
    for (const dep of deps) {
      if (dep !== norm) {
        const dependency = resolveComponentFiles(dep, paths);
        if (!dependency.ejsPath && !dependency.scssPath && !dependency.jsPath) {
          if (Array.isArray(meta.dependencies)) throw new Error(`Missing dependency: ${dep}`);
          warnings.push(`Optional dependency unavailable: ${dep}`);
          continue;
        }
        if (!tx.completedComponents.has(dependency.name)) {
          const depResult = installComponent(dep, { force: options.force, includeEjs: false, targetJsFile: options.targetJsFile }, paths, tx);
          if (!depResult.success) throw Object.assign(new Error(`Dependency ${dep}: ${depResult.message || depResult.error}`), { conflict: depResult.conflict });
          warnings.push(...(depResult.warnings || []));
        }
        installedDependencies.push(dependency.name);
      }
    }

    // Step 1: Handle SCSS (100% Non-destructive: merge @use & append/merge rules, never overwrite existing developer code!)
    if (scssFile) {
      let srcScss = resolveSafePath(targetWbScssDir, scssFile, 'srcScss');
      let destDir = targetClientScssDir;
      let relBase = category === 'layout' ? 'src/pages/assets/scss/layout' : 'src/pages/assets/scss/component';

      if (!existsSync(srcScss)) {
        srcScss = resolveSafePath(paths.wbScssDir, scssFile, 'srcScss fallback');
        destDir = paths.clientScssDir;
        relBase = 'src/pages/assets/scss/component';
      }

      if (!existsSync(destDir)) {
        mkdirSync(destDir, { recursive: true });
      }

      const destScssName = isCustomAlias ? `_${alias}.scss` : scssFile;
      const destScss = resolveSafePath(destDir, destScssName, 'destScss');

      if (existsSync(srcScss)) {
        const existedBefore = existsSync(destScss);
        const existing = existedBefore ? readFileSync(destScss, 'utf8') : '';
        const incoming = readFileSync(srcScss, 'utf8');
        if (!options.force && !isTemplateStub(existing)) {
          const classes = [...incoming.matchAll(/\.([cl]-[\w-]+)\s*\{/g)].map(match => match[1]);
          for (const cls of new Set(classes)) {
            const oldRule = findRuleBlockRange(existing, cls);
            const newRule = findRuleBlockRange(incoming, cls);
            if (oldRule && newRule && oldRule.content.trim() !== newRule.content.trim()) customConflict(`SCSS ${cls} has custom changes. Use force to replace it.`);
          }
        }

        if (existedBefore) {
          tx.recordModified(destScss, existing);
        } else {
          tx.recordCreated(destScss);
        }

        const mergedScss = mergeComponentScss(existing, incoming, isCustomAlias ? alias : norm, options);
        writeFileSync(destScss, mergedScss, 'utf8');
        installedFiles.push(`${relBase}/${destScssName}`);

        const scssBase = basename(destScssName, '.scss').replace(/^_/, '');
        updateClientScssIndex(scssBase, 'add', category, paths, tx);
      }
    }

    // Step 2: Handle JS (100% Non-destructive: append/merge into target JS file like common.js)
    if (jsFile) {
      const srcJs = resolveSafePath(paths.wbJsDir, jsFile, 'srcJs');
      if (existsSync(srcJs)) {
        let srcJsContent = readFileSync(srcJs, 'utf8');
        const sliced = sliceJsForComponent(srcJsContent, componentKey);
        if (sliced) {
          srcJsContent = sliced;
        }
        if (isCustomAlias) srcJsContent = srcJsContent.replace(/(\[Component(?:\s*Module)?:\s*)[\w-]+(\])/i, `$1${alias}$2`);

        const targetFile = options.targetJsFile || meta.js || (jsFile === 'common.js' || jsFile === 'top.js' ? jsFile : null);
        if (targetFile && targetFile !== '__skip__' && targetFile !== 'none') {
          const targetPath = resolveSafePath(resolve(paths.root, 'src/pages/assets/js'), targetFile.endsWith('.js') ? targetFile : targetFile + '.js', 'target JS');
          if (existsSync(targetPath)) {
            const oldJs = readFileSync(targetPath, 'utf8');
            if (!options.force && getComponentJsRange(oldJs, isCustomAlias ? alias : componentKey) && jsBody(oldJs, isCustomAlias ? alias : componentKey) !== jsBody(srcJsContent, isCustomAlias ? alias : componentKey)) customConflict('JS module has custom changes. Use force to replace it.');
            createSnapshotBackup(alias, 'before_site_js_install', paths, [targetPath]);
          }
          const appendRes = appendJsToTargetFile(targetFile, isCustomAlias ? alias : norm, srcJsContent, paths, tx);
          if (!appendRes.success) {
            throw new Error(appendRes.message);
          }
          installedFiles.push(appendRes.file);
        } else if (targetFile === '__skip__' || targetFile === 'none') {
          // Explicit skip
        } else {
          if (!existsSync(paths.clientJsDir)) {
            mkdirSync(paths.clientJsDir, { recursive: true });
          }
          const destJsName = isCustomAlias ? `${alias}.js` : jsFile;
          const destJs = resolveSafePath(paths.clientJsDir, destJsName, 'destJs');

          const existedBefore = existsSync(destJs);
          const existing = existedBefore ? readFileSync(destJs, 'utf8') : '';
          if (!options.force && existing.trim() && jsBody(existing, componentKey) !== jsBody(srcJsContent, componentKey)) customConflict('JS file has custom changes. Use force to replace it.');

          if (existedBefore) {
            tx.recordModified(destJs, existing);
          } else {
            tx.recordCreated(destJs);
          }

          const mergedJs = /\[Component(?:\s*Module)?:/i.test(existing) ? mergeComponentJs(existing, srcJsContent, isCustomAlias ? alias : norm) : srcJsContent.trim() + '\n';
          writeFileSync(destJs, mergedJs, 'utf8');
          installedFiles.push(`src/pages/assets/js/component/${destJsName}`);
        }
      }
    }

    // Step 3: Handle EJS (Only writes file if explicitly requested with options.includeEjs, otherwise dev inserts via snippet)
    if (options.includeEjs === true && ejsFile) {
      if (!existsSync(paths.clientComponentsDir)) {
        mkdirSync(paths.clientComponentsDir, { recursive: true });
      }
      const srcEjs = resolveSafePath(paths.wbComponentsDir, ejsFile, 'srcEjs');
      const destEjsName = isCustomAlias ? `_${alias}.ejs` : ejsFile;
      const destEjs = resolveSafePath(paths.clientComponentsDir, destEjsName, 'destEjs');

      if (existsSync(srcEjs)) {
        const cleanEjs = stripEjsShowroomWrapper(readFileSync(srcEjs, 'utf8'));
        if (!options.force && existsSync(destEjs) && stripEjsShowroomWrapper(readFileSync(destEjs, 'utf8')).trim() !== cleanEjs.trim()) customConflict('EJS has custom changes. Use force to replace it.');
        if (existsSync(destEjs)) {
          tx.recordModified(destEjs, readFileSync(destEjs, 'utf8'));
        } else {
          tx.recordCreated(destEjs);
        }
        writeFileSync(destEjs, cleanEjs, 'utf8');
        installedFiles.push(`src/components/${destEjsName}`);
      }
    }

    // Resolve vendors
    const vendors = resolveComponentVendors(norm, meta);
    let vendorNotice = '';
    if (vendors.css.length > 0 || vendors.js.length > 0) {
      const parts = [];
      if (vendors.css.length > 0) parts.push(`vendorcss: [${vendors.css.map(c => `'${c}'`).join(', ')}]`);
      if (vendors.js.length > 0) parts.push(`vendorjs: [${vendors.js.map(j => `'${j}'`).join(', ')}]`);
      vendorNotice = ` ⚠️ Yêu cầu khai báo: ${parts.join(' và ')}`;
    }

    tx.activeComponents.delete(componentKey);
    tx.completedComponents.add(componentKey);
    // Commit transaction on success
    if (isRootTx) {
      tx.commit();
    }

    return {
      success: true,
      name: alias,
      files: installedFiles,
      hasJs: Boolean(jsFile),
      installedDependencies,
      warnings,
      vendors,
      message: (installedDependencies.length > 0
        ? `Đã cài đặt "${alias}" và dependencies (${installedDependencies.join(', ')}). Dùng snippet VS Code để chèn HTML!`
        : `Đã cài đặt SCSS${jsFile ? ' & JS' : ''} cho component "${alias}". Dùng snippet VS Code để chèn HTML!`) + vendorNotice + (warnings.length ? ' ' + warnings.join(' ') : '')
    };
  } catch (err) {
    if (isRootTx) {
      try { tx.rollback(); }
      catch (rollbackError) { return { success: false, rolledBack: false, message: `${err.message}; ${rollbackError.message}` }; }
    }
    return {
      success: false,
      conflict: err.conflict === true,
      rolledBack: true,
      error: err.message,
      message: `[INSTALL FAILED] Thao tác thất bại và đã được ROLLBACK an toàn: ${err.message}`
    };
  }
}

/**
 * Install an individual component variant into site with transaction rollback guard
 */
export function installVariant(compName, variantData = {}, paths = getDefaultPaths()) {
  const tx = new InstallTransaction();
  try {
    const norm = normalizeName(compName);
    const source = resolveComponentFiles(norm, paths);
    if (!source.ejsPath && !source.scssPath && !source.jsPath) throw new Error(`Component "${norm}" does not exist in Workbench`);
    const warnings = [];
    tx.activeComponents.add(source.name);
    for (const dep of resolveComponentDependencies(source.name, source.meta, source.raw)) {
      const dependency = resolveComponentFiles(dep, paths);
      if (!dependency.ejsPath && !dependency.scssPath && !dependency.jsPath) {
        if (Array.isArray(source.meta.dependencies)) throw new Error(`Missing dependency: ${dep}`);
        warnings.push(`Optional dependency unavailable: ${dep}`);
        continue;
      }
      const result = installComponent(dep, { targetJsFile: variantData.targetJsFile }, paths, tx);
      if (!result.success) throw new Error(result.message);
    }
    const category = source.category;
    const targetClientScssDir = getScssDirForCategory(category, paths);
    const targetWbScssDir = getWorkbenchScssDirForCategory(category, paths);
    const scssFileName = source.scssPath ? basename(source.scssPath) : `_${norm}.scss`;
    const destScssPath = resolveSafePath(targetClientScssDir, scssFileName, 'destScssPath');
    const fullWbScss = source.scssPath ? readFileSync(source.scssPath, 'utf8') : '';
    const variantSource = variantData.scssCode || fullWbScss;
    for (const token of (variantData.classStr || '').split(/\s+/).filter(token => /^[cl]-.*--/.test(token))) {
      const [base, modifier] = token.split('--');
      const block = findRuleBlockRange(variantSource, base);
      if (!isModifierInBlock(block?.content || '', '--' + modifier, variantSource, base)) throw new Error(`Variant ${token} does not exist`);
    }
    let incomingScss = variantData.scssCode || (variantData.classStr ? sliceScssForClasses(fullWbScss, variantData.classStr, { strict: true }) : fullWbScss);
    const hasScss = Boolean(incomingScss && !isTemplateStub(incomingScss));
    const hasRequestedJs = source.jsPath && variantData.targetJsFile && !['__skip__', 'none'].includes(variantData.targetJsFile);
    if (!hasScss && !hasRequestedJs) throw new Error('Variant has no matching SCSS or requested JS');
    const snapshotFiles = hasScss ? [destScssPath, resolve(targetClientScssDir, '_index.scss')] : [];
    if (hasRequestedJs) snapshotFiles.push(resolveSafePath(resolve(paths.root, 'src/pages/assets/js'), variantData.targetJsFile.endsWith('.js') ? variantData.targetJsFile : variantData.targetJsFile + '.js', 'variant target JS'));
    if (snapshotFiles.some(file => existsSync(file))) createSnapshotBackup(norm, 'before_site_variant_install', paths, snapshotFiles);
    if (hasScss) {
      mkdirSync(targetClientScssDir, { recursive: true });

      const existedBefore = existsSync(destScssPath);
      const existing = existedBefore ? readFileSync(destScssPath, 'utf8') : '';

      if (existedBefore) {
        tx.recordModified(destScssPath, existing);
      } else {
        tx.recordCreated(destScssPath);
      }

      let finalScss;
      if (!existing.trim() || isTemplateStub(existing)) {
        finalScss = mergeComponentScss(existing, incomingScss, norm);
      } else if (variantData.classStr) {
        const mergedVariant = mergeVariantScss(existing, incomingScss, variantData.classStr);
        finalScss = mergeComponentScss(mergedVariant, '', norm);
      } else {
        finalScss = mergeComponentScss(existing, incomingScss, norm);
      }

      writeFileSync(destScssPath, finalScss.trim() + '\n', 'utf8');

      const scssBase = basename(scssFileName, '.scss').replace(/^_/, '');
      updateClientScssIndex(scssBase, 'add', category, paths, tx);

    }

    // JS Handling: Only install JS if specifically requested by this variant
    const wbJsFile = source.jsPath ? basename(source.jsPath) : null;
    if (wbJsFile && variantData.targetJsFile && variantData.targetJsFile !== '__skip__' && variantData.targetJsFile !== 'none') {
      const srcJsPath = resolveSafePath(paths.wbJsDir, wbJsFile, 'wbJsFile');
      if (existsSync(srcJsPath)) {
        const srcJsContent = sliceJsForComponent(readFileSync(srcJsPath, 'utf8'), source.name);
        const targetPath = resolveSafePath(resolve(paths.root, 'src/pages/assets/js'), variantData.targetJsFile.endsWith('.js') ? variantData.targetJsFile : variantData.targetJsFile + '.js', 'variant target JS');
        if (!variantData.force && existsSync(targetPath)) {
          const oldJs = readFileSync(targetPath, 'utf8');
          if (getComponentJsRange(oldJs, source.name) && jsBody(oldJs, source.name) !== jsBody(srcJsContent, source.name)) customConflict('JS module has custom changes. Use force to replace it.');
        }
        const appendRes = appendJsToTargetFile(variantData.targetJsFile, norm, srcJsContent, paths, tx);
        if (!appendRes.success) {
          throw new Error(appendRes.message);
        }
      }
    }


    tx.commit();
    return {
      success: true,
      component: norm,
      variant: variantData.classStr || 'default',
      warnings,
      message: `Đã cài đặt biến thể (${variantData.classStr || 'default'}) của "${norm}" vào site chính!`
    };
  } catch (err) {
    try { tx.rollback(); }
    catch (rollbackError) { return { success: false, rolledBack: false, message: `${err.message}; ${rollbackError.message}` }; }
    return {
      success: false,
      rolledBack: true,
      error: err.message,
      conflict: err.conflict === true,
      message: `[VARIANT INSTALL FAILED] Đã rollback an toàn: ${err.message}`
    };
  }
}

/**
 * Remove a component from site (src/)
 */
export function removeComponent(targetName, options = {}, paths = getDefaultPaths()) {
  const tx = new InstallTransaction();
  try {
    const source = resolveComponentFiles(targetName, paths);
    const client = resolveComponentFiles(targetName, paths, 'client');
    const norm = source.name;
    if (!client.ejsPath && !client.scssPath && !client.jsPath) return { success: false, message: `Component "${targetName}" is not installed` };
    const warnings = [];
    const changes = [];
    const scssShared = client.scssPath && getRegistry(paths).some(item => item.name !== norm &&
      resolveComponentFiles(item.name, paths, 'client').scssPath === client.scssPath);
    if (scssShared) warnings.push('Shared SCSS preserved for other components.');
    if (client.scssPath && !scssShared) {
      const content = readFileSync(client.scssPath, 'utf8');
      const original = source.scssPath ? readFileSync(source.scssPath, 'utf8') : null;
      if (!options.force && !isTemplateStub(content) && (original === null || content.trim() !== original.trim())) {
        return { success: false, conflict: true, message: 'SCSS has custom changes. Use force to remove.' };
      }
      changes.push([client.scssPath, null]);
    }
    if (client.ejsPath) {
      const content = readFileSync(client.ejsPath, 'utf8');
      const original = source.ejsPath ? stripEjsShowroomWrapper(source.raw) : null;
      if (!options.force && (original === null || stripEjsShowroomWrapper(content).trim() !== original.trim())) {
        return { success: false, conflict: true, message: 'EJS has custom changes. Use force to remove.' };
      }
      changes.push([client.ejsPath, null]);
    }
    if (client.jsPath) {
      const full = readFileSync(client.jsPath, 'utf8');
      const range = getComponentJsRange(full, norm);
      const dedicated = [norm + '.js', norm + 's.js', '_' + norm + '.js'].includes(basename(client.jsPath));
      if (!range && !dedicated) warnings.push('Shared JS preserved: no component marker found.');
      else {
        const content = range ? full.slice(range.start, range.end).trim() : full.trim();
        const original = source.jsPath ? sliceJsForComponent(readFileSync(source.jsPath, 'utf8'), norm) : null;
        const withoutMarker = value => (value || '').replace(/\/\*[\s\S]*?\*\/|\/\/[^\r\n]*/g, '').trim();
        if (!options.force && (original === null || withoutMarker(content) !== withoutMarker(original))) return { success: false, conflict: true, message: 'JS has custom changes. Use force to remove.' };
        const remaining = range ? removeComponentJs(full, norm) : '';
        changes.push([client.jsPath, dedicated && !remaining.trim() ? null : remaining]);
      }
    }
    const index = resolve(getScssDirForCategory(client.category, paths), '_index.scss');
    createSnapshotBackup(norm, 'before_site_remove', paths, [...changes.map(([file]) => file), index]);
    for (const [file, content] of changes) {
      if (content === null) tx.remove(file); else tx.write(file, content);
    }
    if (client.scssPath && !scssShared) {
      tx.capture(index);
      updateClientScssIndex(basename(client.scssPath, '.scss').replace(/^_/, ''), 'remove', client.category, paths);
    }
    tx.commit();
    return { success: true, name: norm, removedFiles: changes.map(([file]) => file), warnings, message: `Removed component "${norm}".${warnings.length ? ' ' + warnings.join(' ') : ''}` };
  } catch (error) {
    try { tx.rollback(); } catch (rollbackError) { return { success: false, rolledBack: false, message: `${error.message}; ${rollbackError.message}` }; }
    return { success: false, rolledBack: true, message: error.message };
  }
}
