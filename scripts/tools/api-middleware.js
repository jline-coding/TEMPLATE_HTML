/**
 * scripts/tools/api-middleware.js
 * Dev Server API Middleware for BrowserSync
 * Powers 1-Click Interactive Web UI in Workbench:
 * - GET  /__api/registry : Real-time component list with src/ installation status
 * - POST /__api/import   : 1-click install component into src/
 * - POST /__api/remove   : 1-click remove component from src/
 * - POST /__api/save     : 1-click save/export component from src/ to workbench/
 */

import { URL } from 'url';
import {
  getRegistry,
  installComponent,
  removeComponent,
  saveComponent,
  installVariant,
  isVariantInstalled,
  getAvailableJsFiles,
  deleteWorkbenchComponent,
  deleteAllWorkbenchComponents,
  deleteWorkbenchVariant
} from './component-service.js';
import { exportSelectionToWorkbench } from './selection-exporter.js';
import { buildWorkbench } from '../builders/workbench.js';
import { syncSnippets } from '../sync-snippets.js';
import { relative, resolve, normalize, isAbsolute } from 'path';
import {
  isValidDevToken,
  getDevSessionToken,
  isValidComponentName,
  isPathInside,
  resolveSafePath,
  PROJECT_ROOT
} from './safety.js';

function isOriginAllowed(origin) {
  if (!origin) return false;
  try {
    const u = new URL(origin);
    const host = u.hostname.toLowerCase();
    return (host === 'localhost' || host === '127.0.0.1') && (u.protocol === 'http:' || u.protocol === 'https:');
  } catch {
    return false;
  }
}

const MUTATION_ENDPOINTS = new Set([
  '/__api/import',
  '/__api/import-variant',
  '/__api/remove',
  '/__api/save',
  '/__api/export',
  '/__api/restore',
  '/__api/save-selection',
  '/__api/delete-workbench',
  '/__api/delete-from-workbench',
  '/__api/delete-variant',
  '/__api/clear-workbench'
]);

function sendJson(res, statusCode, data, req = null) {
  const jsonStr = JSON.stringify(data);
  const headers = {
    'Content-Type': 'application/json; charset=UTF-8',
    'X-Content-Type-Options': 'nosniff'
  };

  const origin = req?.headers?.origin;
  if (origin && isOriginAllowed(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers['Access-Control-Allow-Credentials'] = 'true';
    headers['Vary'] = 'Origin';
  }

  headers['Access-Control-Allow-Methods'] = 'GET, POST, DELETE, OPTIONS';
  headers['Access-Control-Allow-Headers'] = 'Content-Type, X-Workbench-Token';
  res.writeHead(statusCode, headers);
  res.end(jsonStr);
}

async function refreshDerivedFiles(result) {
  const warnings = result.warnings || [];
  try { syncSnippets({ quiet: true }); } catch (error) { warnings.push(`Snippets: ${error.message}`); }
  try { await buildWorkbench({ force: true }); } catch (error) { warnings.push(`Preview: ${error.message}`); }
  result.warnings = warnings;
  if (warnings.length) result.message = `${result.message || 'Saved.'} ${warnings.join(' ')}`;
  return result;
}

function parseRequestBody(req) {
  const limit = 1024 * 1024;
  return new Promise((resolve, reject) => {
    let body = '';
    let bytes = 0;
    const invalid = (message, status = 400) => reject(Object.assign(new Error(message), { status }));
    if (Number(req.headers['content-length']) > limit) return invalid('Request body exceeds 1 MB', 413);
    req.on('data', chunk => {
      bytes += Buffer.byteLength(chunk);
      if (bytes > limit) { body = ''; invalid('Request body exceeds 1 MB', 413); return; }
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        const parsed = JSON.parse(body);
        if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return invalid('JSON body must be an object');
        resolve(parsed);
      } catch {
        invalid('Invalid JSON body');
      }
    });
    req.on('error', () => invalid('Request body could not be read'));
  });
}

export function createApiMiddleware() {
  return async function apiMiddleware(req, res, next) {
    if (req.url.startsWith('/__workbench/assets/')) {
      req.url = req.url.replace('/__workbench/assets/', '/assets/');
      return next();
    }

    if (!req.url.startsWith('/__api/')) {
      return next();
    }

    // ─────────────────────────────────────────────
    // Security Layer 1: Host & Origin Check (Anti-CSRF & DNS Rebinding)
    // ─────────────────────────────────────────────
    const isExternalAllowed = process.argv.includes('--external') || process.argv.includes('--lan');
    const hostHeader = (req.headers['host'] || '').split(':')[0].toLowerCase();
    const isLocalHost = hostHeader === 'localhost' || hostHeader === '127.0.0.1';

    const origin = req.headers['origin'];
    if (origin && !isOriginAllowed(origin)) {
      return sendJson(res, 403, {
        success: false,
        message: '[SECURITY] Truy cập bị chặn: Origin không được phép. Chỉ chấp nhận localhost và 127.0.0.1.'
      }, req);
    }

    const referer = req.headers['referer'];
    if (referer) {
      try {
        const refUrl = new URL(referer);
        if (refUrl.hostname.toLowerCase() !== 'localhost' && refUrl.hostname.toLowerCase() !== '127.0.0.1') {
          return sendJson(res, 403, {
            success: false,
            message: '[SECURITY] Truy cập bị chặn: Referer không được phép.'
          }, req);
        }
      } catch {}
    }

    if (!isLocalHost && !isExternalAllowed) {
      return sendJson(res, 403, {
        success: false,
        message: '[SECURITY] Truy cập bị chặn: Host header không hợp lệ.'
      }, req);
    }

    if (req.method === 'OPTIONS') {
      const headers = {
        'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, X-Workbench-Token',
        'X-Content-Type-Options': 'nosniff'
      };
      if (origin && isOriginAllowed(origin)) {
        headers['Access-Control-Allow-Origin'] = origin;
        headers['Access-Control-Allow-Credentials'] = 'true';
        headers['Vary'] = 'Origin';
      }
      res.writeHead(204, headers);
      return res.end();
    }

    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathname = parsedUrl.pathname;
    const queryComp = parsedUrl.searchParams.get('component') || parsedUrl.searchParams.get('name') || '';
    const queryAs = parsedUrl.searchParams.get('as') || '';

    // ─────────────────────────────────────────────
    // Security Layer 2: HTTP Method Enforcement (No GET for Mutations)
    // ─────────────────────────────────────────────
    if (MUTATION_ENDPOINTS.has(pathname)) {
      if (req.method !== 'POST' && req.method !== 'DELETE') {
        return sendJson(res, 405, {
          success: false,
          message: `[SECURITY] Phương thức ${req.method} không được phép cho endpoint này. Thao tác thay đổi filesystem bắt buộc phải dùng POST hoặc DELETE.`
        }, req);
      }
    }

    let bodyData = {};
    if (req.method === 'POST') {
      try { bodyData = await parseRequestBody(req); }
      catch (error) { return sendJson(res, error.status || 400, { success: false, message: error.message }, req); }
    }
    const compName = bodyData.component || bodyData.name || queryComp;
    const asAlias = bodyData.as || queryAs;
    if (bodyData.cardIndex !== undefined && (bodyData.cardIndex === null || !['string', 'number'].includes(typeof bodyData.cardIndex) || !Number.isInteger(Number(bodyData.cardIndex)) || Number(bodyData.cardIndex) < 0)) {
      return sendJson(res, 400, { success: false, message: 'cardIndex must be a nonnegative integer' }, req);
    }
    for (const key of ['component', 'name', 'as', 'classStr', 'scssCode', 'html', 'title', 'commentTitle', 'filePath', 'targetJsFile', 'revision']) {
      if (bodyData[key] !== undefined && bodyData[key] !== null && typeof bodyData[key] !== 'string') {
        return sendJson(res, 400, { success: false, message: `${key} must be a string` }, req);
      }
    }

    // ─────────────────────────────────────────────
    // Security Layer 3: Dev Session Token for State-Mutating Operations
    // ─────────────────────────────────────────────
    const isMutation = req.method !== 'GET' && req.method !== 'OPTIONS' && req.method !== 'HEAD';
    if (isMutation) {
      const clientToken = req.headers['x-workbench-token'] || parsedUrl.searchParams.get('token');
      if (!isValidDevToken(clientToken)) {
        return sendJson(res, 401, {
          success: false,
          message: '[SECURITY] Phiên làm việc không hợp lệ hoặc thiếu Dev Token. Vui lòng tải lại trang Workbench.'
        }, req);
      }
    }

    // ─────────────────────────────────────────────
    // Security Layer 3: Parameter Sanitization (Anti Path-Traversal)
    // ─────────────────────────────────────────────
    if (compName && !isValidComponentName(compName)) {
      return sendJson(res, 400, {
        success: false,
        message: 'Tên component không hợp lệ (chỉ cho phép ký tự a-z, 0-9, gạch ngang và gạch dưới).'
      }, req);
    }

    if (asAlias && !isValidComponentName(asAlias)) {
      return sendJson(res, 400, {
        success: false,
        message: 'Tên alias không hợp lệ (chỉ cho phép ký tự a-z, 0-9, gạch ngang và gạch dưới).'
      }, req);
    }

    if (bodyData.targetJsFile && bodyData.targetJsFile !== '__skip__' && bodyData.targetJsFile !== 'none') {
      let targetFile = String(bodyData.targetJsFile).trim();
      if (!targetFile.endsWith('.js')) {
        targetFile += '.js';
      }
      bodyData.targetJsFile = targetFile;

      const assetsJsDir = resolve(PROJECT_ROOT, 'src/pages/assets/js');
      let isSafe = false;
      try {
        resolveSafePath(assetsJsDir, bodyData.targetJsFile, 'targetJsFile');
        isSafe = /^[a-zA-Z0-9_-]+\.js$/i.test(bodyData.targetJsFile) && !bodyData.targetJsFile.includes('..');
      } catch {
        isSafe = false;
      }
      if (!isSafe) {
        return sendJson(res, 400, {
          success: false,
          message: '[SECURITY] Tên file JS đích không hợp lệ hoặc có dấu hiệu Path Traversal.'
        }, req);
      }
    }

    // 1. Component Registry Status
    if (pathname === '/__api/registry' || pathname === '/__api/status') {
      try {
        const registry = getRegistry();
        return sendJson(res, 200, {
          success: true,
          components: registry,
          timestamp: Date.now()
        }, req);
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message }, req);
      }
    }

    // 1b. Available JS files in assets/js/
    if (pathname === '/__api/js-files') {
      try {
        const files = getAvailableJsFiles();
        return sendJson(res, 200, {
          success: true,
          files,
          timestamp: Date.now()
        }, req);
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message }, req);
      }
    }

    // 1b. Dev Session Token endpoint (Auto-recovery for client session)
    if (pathname === '/__api/token') {
      return sendJson(res, 200, {
        success: true,
        token: getDevSessionToken()
      }, req);
    }

    // 2. Import into Site (src/)
    if (pathname === '/__api/import') {
      if (!compName) {
        return sendJson(res, 400, { success: false, message: 'Thiếu tên component cần import' });
      }
      try {
        const result = installComponent(compName, {
          as: asAlias,
          force: bodyData.force === true,
          targetJsFile: bodyData.targetJsFile
        });
        if (result.success) {
          await refreshDerivedFiles(result);
          return sendJson(res, 200, result);
        } else {
          const status = result.conflict ? 409 : 400;
          return sendJson(res, status, result);
        }
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // 2b. Import individual variant into Site (src/)
    if (pathname === '/__api/import-variant') {
      if (!compName) {
        return sendJson(res, 400, { success: false, message: 'Thiếu thông tin component variant' });
      }
      try {
        const result = installVariant(compName, bodyData);
        if (result.success) await refreshDerivedFiles(result);
        return sendJson(res, result.success ? 200 : 400, result, req);
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // 2c. Check if a specific variant is installed
    if (pathname === '/__api/check-variant') {
      const cls = parsedUrl.searchParams.get('class') || bodyData.classStr || '';
      const installed = isVariantInstalled(compName, cls);
      return sendJson(res, 200, { success: true, component: compName, classStr: cls, isInstalled: installed });
    }

    // 2d. Batch check multiple variants
    if (pathname === '/__api/check-variants') {
      const list = bodyData.items === undefined ? [] : bodyData.items;
      if (!Array.isArray(list) || list.length > 2000 || list.some(item => !item || typeof item !== 'object' || !isValidComponentName(item.component) || typeof item.classStr !== 'string')) {
        return sendJson(res, 400, { success: false, message: 'Invalid variant items (maximum 2000)' }, req);
      }
      const scssCache = new Map();
      const results = list.map(item => ({
        component: item.component,
        classStr: item.classStr,
        isInstalled: isVariantInstalled(item.component, item.classStr, undefined, scssCache)
      }));
      return sendJson(res, 200, { success: true, results });
    }

    // 3. Remove from Site (src/)
    if (pathname === '/__api/remove') {
      if (!compName) {
        return sendJson(res, 400, { success: false, message: 'Thiếu tên component cần gỡ bỏ' });
      }
      try {
        const force = bodyData.force === true || parsedUrl.searchParams.get('force') === 'true';
        const result = removeComponent(compName, { force });
        if (result.success) {
          await refreshDerivedFiles(result);
          return sendJson(res, 200, result);
        } else {
          const status = result.conflict ? 409 : 400;
          return sendJson(res, status, result);
        }
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // 4. Save/Export from Site (src/) to Workbench
    if (pathname === '/__api/save' || pathname === '/__api/export') {
      if (!compName) {
        return sendJson(res, 400, { success: false, message: 'Thiếu tên component cần lưu/đồng bộ vào workbench' });
      }
      try {
        const force = bodyData.force === true || parsedUrl.searchParams.get('force') === 'true';
        const result = saveComponent(compName, { as: asAlias, force });
        if (result.success) {
          await refreshDerivedFiles(result);
          return sendJson(res, 200, result);
        } else {
          const status = result.conflict ? 409 : 400;
          return sendJson(res, status, result);
        }
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // 4b. Restore canonical workbench component back into Site (src/)
    if (pathname === '/__api/restore') {
      if (!compName) {
        return sendJson(res, 400, { success: false, message: 'Thiếu tên component cần khôi phục' });
      }
      try {
        const result = installComponent(compName, {
          as: asAlias,
          force: true,
          targetJsFile: bodyData.targetJsFile
        });
        if (result.success) {
          await refreshDerivedFiles(result);
          return sendJson(res, 200, result);
        } else {
          return sendJson(res, 400, result);
        }
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // 5. Save/Export from Selection or Clipboard into Workbench
    if (pathname === '/__api/save-selection') {
      try {
        let safeFilePath = null;
        if (bodyData.filePath) {
          try {
            safeFilePath = resolveSafePath(PROJECT_ROOT, bodyData.filePath, 'filePath');
          } catch (err) {
            return sendJson(res, 400, {
              success: false,
              message: '[SECURITY] Đường dẫn file nằm ngoài phạm vi project root (Path Traversal).'
            }, req);
          }
        }
        if (bodyData.name && !isValidComponentName(bodyData.name)) {
          return sendJson(res, 400, { success: false, message: 'Tên component tùy chỉnh không hợp lệ' }, req);
        }
        const result = await exportSelectionToWorkbench({
          html: bodyData.html,
          filePath: safeFilePath,
          lineNumber: bodyData.lineNumber,
          name: bodyData.name,
          title: bodyData.title
        });
        return sendJson(res, result.success ? 200 : 400, result, req);
      } catch (err) {
        return sendJson(res, 500, { success: false, message: err.message }, req);
      }
    }

    if (pathname === '/__api/clear-workbench') {
      if (req.method !== 'POST') return sendJson(res, 405, { success: false, message: 'Use POST to clear the Workbench library.' }, req);
      if (bodyData.confirm !== true || !/^[a-f0-9]{64}$/.test(bodyData.revision || '')) {
        return sendJson(res, 400, { success: false, message: 'Cần xác nhận và phiên bản thư viện hiện tại.' }, req);
      }
      const result = deleteAllWorkbenchComponents({ revision: bodyData.revision });
      if (result.success && result.deletedCount > 0) await refreshDerivedFiles(result);
      return sendJson(res, result.success ? 200 : result.conflict ? 409 : 400, result, req);
    }

    // 6. Delete entire group component from Workbench (HTML, SCSS, JS)
    if (pathname === '/__api/delete-workbench' || pathname === '/__api/delete-from-workbench') {
      if (!compName) {
        return sendJson(res, 400, { success: false, message: 'Thiếu tên component cần xóa khỏi Workbench' });
      }
      try {
        const result = deleteWorkbenchComponent(compName);
        if (result.success) {
          await refreshDerivedFiles(result);
          return sendJson(res, 200, result);
        } else {
          return sendJson(res, 400, result);
        }
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    // 6b. Delete a single component variant/card from Workbench (card-level delete)
    if (pathname === '/__api/delete-variant') {
      const comp = bodyData.component || bodyData.name || queryComp;
      if (!comp) {
        return sendJson(res, 400, { success: false, message: 'Thiếu tên component cần xóa variant' });
      }
      try {
        const result = deleteWorkbenchVariant({
          component: comp,
          revision: bodyData.revision,
          classStr: bodyData.classStr || '',
          title: bodyData.title || '',
          cardIndex: bodyData.cardIndex !== undefined ? Number(bodyData.cardIndex) : undefined,
          commentTitle: bodyData.commentTitle || ''
        });
        if (result.success) {
          await refreshDerivedFiles(result);
          return sendJson(res, 200, result);
        } else {
          return sendJson(res, 400, result);
        }
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    return sendJson(res, 404, { success: false, message: `Endpoint API không tồn tại: ${pathname}` });
  };
}
