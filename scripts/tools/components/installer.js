/**
 * scripts/tools/components/installer.js
 * Transactional Component Installer with Automatic Rollback Guard
 * Guarantees atomicity: if any step fails (SCSS, JS, EJS, or Dependency),
 * all changes are immediately and cleanly rolled back!
 */

import { existsSync, readFileSync, writeFileSync, copyFileSync, unlinkSync, mkdirSync } from 'fs';
import { resolve, basename } from 'path';
import { normalizeName, COMPONENT_DEPENDENCIES, parseComponentMetadata, resolveComponentDependencies } from './metadata.js';
import {
  getDefaultPaths,
  getComponentCategory,
  getScssDirForCategory,
  getScssIndexForCategory,
  getWorkbenchScssDirForCategory,
  findMatchingScss,
  findMatchingJs
} from './paths.js';
import { resolveSafePath, isValidComponentName } from '../safety.js';
import { isTemplateStub, sliceScssForClasses, mergeVariantScss, mergeComponentScss } from './variants.js';
import { stripEjsShowroomWrapper, sliceJsForComponent, mergeComponentJs } from './registry.js';

/**
 * Transaction Manager to track and rollback filesystem modifications
 */
export class InstallTransaction {
  constructor() {
    this.createdFiles = [];
    this.modifiedFiles = new Map(); // path -> original content string (or null if was created)
    this.committed = false;
  }

  recordCreated(filePath) {
    this.createdFiles.push(filePath);
  }

  recordModified(filePath, originalContent) {
    if (!this.modifiedFiles.has(filePath)) {
      this.modifiedFiles.set(filePath, originalContent);
    }
  }

  rollback() {
    if (this.committed) return;

    // 1. Restore modified files back to original contents
    for (const [filePath, content] of this.modifiedFiles.entries()) {
      try {
        if (content === null || content === undefined) {
          if (existsSync(filePath)) unlinkSync(filePath);
        } else {
          writeFileSync(filePath, content, 'utf8');
        }
      } catch (err) {
        console.error('[installer] Rollback modified file error:', filePath, err.message);
      }
    }

    // 2. Remove newly created files
    for (const filePath of this.createdFiles) {
      try {
        if (existsSync(filePath)) {
          unlinkSync(filePath);
        }
      } catch (err) {
        console.error('[installer] Rollback created file error:', filePath, err.message);
      }
    }
  }

  commit() {
    this.committed = true;
  }
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
  const hasMarker = formattedJs.includes(`[Component: ${compName}]`) || formattedJs.includes(`[Component Module: ${compName}]`);
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

    const category = getComponentCategory(norm);
    const targetWbScssDir = getWorkbenchScssDirForCategory(category, paths);
    const targetClientScssDir = getScssDirForCategory(category, paths);

    // Discover component files in workbench
    const ejsFile = existsSync(resolve(paths.wbComponentsDir, `_${norm}.ejs`)) ? `_${norm}.ejs` : null;
    const scssFile = findMatchingScss(norm, targetWbScssDir) || findMatchingScss(norm, paths.wbScssDir);
    let jsFile = findMatchingJs(norm, paths.wbJsDir);

    let meta = {};
    let rawEjs = '';
    if (ejsFile) {
      const srcEjsPath = resolve(paths.wbComponentsDir, ejsFile);
      if (existsSync(srcEjsPath)) {
        rawEjs = readFileSync(srcEjsPath, 'utf8');
        meta = parseComponentMetadata(rawEjs).meta || {};
      }
    }

    if (!jsFile && meta.js && existsSync(resolve(paths.wbJsDir, meta.js))) {
      jsFile = meta.js;
    }

    if (!jsFile && options.targetJsFile && options.targetJsFile !== '__skip__' && options.targetJsFile !== 'none' && existsSync(resolve(paths.wbJsDir, options.targetJsFile))) {
      jsFile = options.targetJsFile;
    }

    if (!ejsFile && !scssFile && !jsFile) {
      throw new Error(`Component "${targetName}" không tồn tại trong Workbench`);
    }

    const installedFiles = [];
    const installedDependencies = [];

    // Step 0: Flexible & Intelligent Dependency Resolution (Frontmatter > Auto-detection > Fallback)
    const deps = resolveComponentDependencies(norm, meta, rawEjs);
    for (const dep of deps) {
      if (dep !== norm) {
        const depCategory = getComponentCategory(dep);
        const depWbScssDir = getWorkbenchScssDirForCategory(depCategory, paths);
        const depEjs = existsSync(resolve(paths.wbComponentsDir, `_${dep}.ejs`));
        const depScss = findMatchingScss(dep, depWbScssDir) || findMatchingScss(dep, paths.wbScssDir);
        if (depEjs || depScss) {
          const depResult = installComponent(dep, { force: options.force, includeEjs: false }, paths, tx);
          if (!depResult.success) {
            throw new Error(`Cài đặt dependency thất bại [${dep}]: ${depResult.message || depResult.error}`);
          }
          installedDependencies.push(dep);
        }
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
        const sliced = sliceJsForComponent(srcJsContent, norm);
        if (sliced) {
          srcJsContent = sliced;
        }

        const targetFile = options.targetJsFile || meta.js || (jsFile === 'common.js' || jsFile === 'top.js' ? jsFile : null);
        if (targetFile && targetFile !== '__skip__' && targetFile !== 'none') {
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

          if (existedBefore) {
            tx.recordModified(destJs, existing);
          } else {
            tx.recordCreated(destJs);
          }

          const mergedJs = mergeComponentJs(existing, srcJsContent, isCustomAlias ? alias : norm);
          writeFileSync(destJs, mergedJs, 'utf8');
          installedFiles.push(`src/pages/assets/js/component/${destJsName}`);
        }
      }
    }

    // Step 3: Handle EJS (Only writes file if explicitly requested with options.includeEjs, otherwise dev inserts via snippet)
    if (options.includeEjs === true) {
      if (!existsSync(paths.clientComponentsDir)) {
        mkdirSync(paths.clientComponentsDir, { recursive: true });
      }
      const srcEjs = resolveSafePath(paths.wbComponentsDir, ejsFile, 'srcEjs');
      const destEjsName = isCustomAlias ? `_${alias}.ejs` : ejsFile;
      const destEjs = resolveSafePath(paths.clientComponentsDir, destEjsName, 'destEjs');

      if (existsSync(srcEjs)) {
        if (existsSync(destEjs)) {
          tx.recordModified(destEjs, readFileSync(destEjs, 'utf8'));
        } else {
          tx.recordCreated(destEjs);
        }
        const rawEjs = readFileSync(srcEjs, 'utf8');
        const cleanEjs = stripEjsShowroomWrapper(rawEjs);
        writeFileSync(destEjs, cleanEjs, 'utf8');
        installedFiles.push(`src/components/${destEjsName}`);
      }
    }

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
      message: installedDependencies.length > 0
        ? `Đã cài đặt "${alias}" và dependencies (${installedDependencies.join(', ')}). Dùng snippet VS Code để chèn HTML!`
        : `Đã cài đặt SCSS${jsFile ? ' & JS' : ''} cho component "${alias}". Dùng snippet VS Code để chèn HTML!`
    };
  } catch (err) {
    if (isRootTx) {
      tx.rollback();
    }
    return {
      success: false,
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
    const category = getComponentCategory(norm);
    const targetClientScssDir = getScssDirForCategory(category, paths);
    const targetWbScssDir = getWorkbenchScssDirForCategory(category, paths);

    if (!existsSync(targetClientScssDir)) {
      mkdirSync(targetClientScssDir, { recursive: true });
    }

    let scssFileName = findMatchingScss(norm, targetClientScssDir);
    if (!scssFileName) {
      scssFileName = findMatchingScss(norm, targetWbScssDir) || `_${norm}.scss`;
    }
    const destScssPath = resolveSafePath(targetClientScssDir, scssFileName, 'destScssPath');

    let incomingScss = variantData.scssCode;
    const wbScssPath = resolve(targetWbScssDir, scssFileName);
    let fullWbScss = '';
    if (existsSync(wbScssPath)) {
      fullWbScss = readFileSync(wbScssPath, 'utf8');
    }

    if (!incomingScss && fullWbScss) {
      incomingScss = sliceScssForClasses(fullWbScss, variantData.classStr);
    }
    if (!incomingScss) {
      incomingScss = fullWbScss;
    }

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
    } else if (variantData.classStr && variantData.classStr.includes('--')) {
      const mergedVariant = mergeVariantScss(existing, incomingScss, variantData.classStr);
      finalScss = mergeComponentScss(mergedVariant, '', norm);
    } else {
      finalScss = mergeComponentScss(existing, incomingScss, norm);
    }

    writeFileSync(destScssPath, finalScss.trim() + '\n', 'utf8');

    const scssBase = basename(scssFileName, '.scss').replace(/^_/, '');
    updateClientScssIndex(scssBase, 'add', category, paths, tx);

    // JS Handling
    const wbJsFile = findMatchingJs(norm, paths.wbJsDir);
    if (wbJsFile) {
      const srcJsPath = resolveSafePath(paths.wbJsDir, wbJsFile, 'wbJsFile');
      if (existsSync(srcJsPath)) {
        const srcJsContent = readFileSync(srcJsPath, 'utf8');

        if (variantData.targetJsFile && variantData.targetJsFile !== '__skip__' && variantData.targetJsFile !== 'none') {
          const appendRes = appendJsToTargetFile(variantData.targetJsFile, norm, srcJsContent, paths, tx);
          if (!appendRes.success) {
            throw new Error(appendRes.message);
          }
        } else if (variantData.targetJsFile === '__skip__' || variantData.targetJsFile === 'none') {
          // Skip JS
        } else {
          if (!existsSync(paths.clientJsDir)) {
            mkdirSync(paths.clientJsDir, { recursive: true });
          }
          const destJs = resolveSafePath(paths.clientJsDir, wbJsFile, 'destJs');
          if (!existsSync(destJs)) {
            tx.recordCreated(destJs);
            copyFileSync(srcJsPath, destJs);
          }
        }
      }
    }

    tx.commit();
    return {
      success: true,
      component: norm,
      variant: variantData.classStr || 'default',
      message: `Đã cài đặt biến thể (${variantData.classStr || 'default'}) của "${norm}" vào site chính!`
    };
  } catch (err) {
    tx.rollback();
    return {
      success: false,
      rolledBack: true,
      error: err.message,
      message: `[VARIANT INSTALL FAILED] Đã rollback an toàn: ${err.message}`
    };
  }
}

/**
 * Remove a component from site (src/)
 */
export function removeComponent(targetName, options = {}, paths = getDefaultPaths()) {
  const norm = normalizeName(targetName);
  const category = getComponentCategory(norm);
  const targetWbScssDir = getWorkbenchScssDirForCategory(category, paths);
  const targetClientScssDir = getScssDirForCategory(category, paths);

  const scssFile = findMatchingScss(norm, targetClientScssDir) || findMatchingScss(norm, paths.clientScssDir);
  const jsFile = findMatchingJs(norm, paths.clientJsDir);
  const ejsCandidates = [`_${norm}.ejs`, `${norm}.ejs`];
  let clientEjs = null;
  for (const c of ejsCandidates) {
    const p = resolve(paths.clientComponentsDir, c);
    if (existsSync(p)) {
      clientEjs = p;
      break;
    }
  }

  if (!scssFile && !jsFile && !clientEjs) {
    return {
      success: false,
      message: `Component "${targetName}" chưa được cài đặt trong site chính.`
    };
  }

  let clientScss = scssFile ? resolveSafePath(targetClientScssDir, scssFile, 'clientScss') : null;
  let srcScss = scssFile ? resolve(targetWbScssDir, scssFile) : null;
  let relBase = category === 'layout' ? 'src/pages/assets/scss/layout' : 'src/pages/assets/scss/component';

  if (clientScss && !existsSync(clientScss)) {
    clientScss = resolveSafePath(paths.clientScssDir, scssFile, 'clientScss fallback');
    srcScss = resolve(paths.wbScssDir, scssFile);
    relBase = 'src/pages/assets/scss/component';
  }

  if (!options.force && clientScss && existsSync(clientScss) && srcScss && existsSync(srcScss)) {
    const clientContent = readFileSync(clientScss, 'utf8');
    const wbContent = readFileSync(srcScss, 'utf8');
    if (!isTemplateStub(clientContent) && clientContent.trim() !== wbContent.trim()) {
      return {
        success: false,
        conflict: true,
        message: `⚠️ File "${scssFile}" trong site đã được chỉnh sửa khác với bản mẫu. Gỡ bỏ sẽ làm mất code! Dùng --force để xác nhận gỡ bỏ.`
      };
    }
  }

  const removedFiles = [];

  // 1. Remove SCSS & clean _index.scss
  if (clientScss && existsSync(clientScss)) {
    unlinkSync(clientScss);
    removedFiles.push(`${relBase}/${scssFile}`);
    const scssBase = basename(scssFile, '.scss').replace(/^_/, '');
    updateClientScssIndex(scssBase, 'remove', category, paths);
  }

  // 2. Remove JS
  if (jsFile) {
    const clientJs = resolveSafePath(paths.clientJsDir, jsFile, 'clientJs');
    if (existsSync(clientJs)) {
      unlinkSync(clientJs);
      removedFiles.push(`src/pages/assets/js/component/${jsFile}`);
    }
  }

  // 3. Remove EJS
  if (clientEjs && existsSync(clientEjs)) {
    unlinkSync(clientEjs);
    removedFiles.push(`src/components/${basename(clientEjs)}`);
  }

  return {
    success: true,
    name: norm,
    removedFiles,
    message: `Đã gỡ bỏ component "${norm}" khỏi site chính.`
  };
}
