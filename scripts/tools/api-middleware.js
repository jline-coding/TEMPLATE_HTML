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
  isVariantInstalled
} from './component-service.js';
import { buildWorkbench } from '../builders/workbench.js';
import { syncSnippets } from '../sync-snippets.js';

function sendJson(res, statusCode, data) {
  const jsonStr = JSON.stringify(data);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=UTF-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(jsonStr);
}

function parseRequestBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
    req.on('error', () => resolve({}));
  });
}

export function createApiMiddleware() {
  return async function apiMiddleware(req, res, next) {
    if (!req.url.startsWith('/__api/')) {
      return next();
    }

    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      });
      return res.end();
    }

    const parsedUrl = new URL(req.url, 'http://localhost');
    const pathname = parsedUrl.pathname;
    const queryComp = parsedUrl.searchParams.get('component') || parsedUrl.searchParams.get('name') || '';
    const queryAs = parsedUrl.searchParams.get('as') || '';

    // 1. Component Registry Status
    if (pathname === '/__api/registry' || pathname === '/__api/status') {
      try {
        const registry = getRegistry();
        return sendJson(res, 200, {
          success: true,
          components: registry,
          timestamp: Date.now()
        });
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    let bodyData = {};
    if (req.method === 'POST') {
      bodyData = await parseRequestBody(req);
    }
    const compName = bodyData.component || bodyData.name || queryComp;
    const asAlias = bodyData.as || queryAs;

    // 2. Import into Site (src/)
    if (pathname === '/__api/import') {
      if (!compName) {
        return sendJson(res, 400, { success: false, message: 'Thiếu tên component cần import' });
      }
      try {
        const result = installComponent(compName, { as: asAlias, force: bodyData.force === true });
        if (result.success) {
          try { syncSnippets({ quiet: true }); } catch {}
          try { await buildWorkbench({ force: true }); } catch {}
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
        try { syncSnippets({ quiet: true }); } catch {}
        return sendJson(res, 200, result);
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
      const list = Array.isArray(bodyData.items) ? bodyData.items : [];
      const results = list.map(item => ({
        component: item.component,
        classStr: item.classStr,
        isInstalled: isVariantInstalled(item.component, item.classStr)
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
          try { syncSnippets({ quiet: true }); } catch {}
          try { await buildWorkbench({ force: true }); } catch {}
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
        return sendJson(res, 400, { success: false, message: 'Thiếu tên component cần lưu vào workbench' });
      }
      try {
        const force = bodyData.force === true || parsedUrl.searchParams.get('force') === 'true';
        const result = saveComponent(compName, { as: asAlias, force });
        if (result.success) {
          try { syncSnippets({ quiet: true }); } catch {}
          try { await buildWorkbench({ force: true }); } catch {}
          return sendJson(res, 200, result);
        } else {
          const status = result.conflict ? 409 : 400;
          return sendJson(res, status, result);
        }
      } catch (err) {
        return sendJson(res, 500, { success: false, error: err.message });
      }
    }

    return sendJson(res, 404, { success: false, message: `Endpoint API không tồn tại: ${pathname}` });
  };
}
