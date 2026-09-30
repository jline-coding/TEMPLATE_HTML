import { describe, it, expect } from 'vitest';
import { createApiMiddleware } from '../scripts/tools/api-middleware.js';
import { getDevSessionToken } from '../scripts/tools/safety.js';

describe('Workbench API Security (4-Layer Defense-in-Depth)', () => {
  const middleware = createApiMiddleware();
  const validToken = getDevSessionToken();

  function createMockHttp(reqOptions = {}) {
    const headers = Object.assign({
      host: 'localhost:8686'
    }, reqOptions.headers);

    const req = {
      url: reqOptions.url || '/__api/registry',
      method: reqOptions.method || 'GET',
      headers,
      on: (event, handler) => {
        if (event === 'data' && reqOptions.body) {
          handler(Buffer.from(JSON.stringify(reqOptions.body)));
        }
        if (event === 'end') {
          handler();
        }
      }
    };

    let statusCode = 200;
    const responseHeaders = {};
    let responseBody = '';

    const res = {
      writeHead: (code, hdrs = {}) => {
        statusCode = code;
        for (const [k, v] of Object.entries(hdrs)) {
          responseHeaders[k.toLowerCase()] = v;
        }
      },
      setHeader: (key, val) => {
        responseHeaders[key.toLowerCase()] = val;
      },
      end: (data) => {
        responseBody = data;
      }
    };

    return { req, res, getStatus: () => statusCode, getHeaders: () => responseHeaders, getBody: () => responseBody ? JSON.parse(responseBody) : null };
  }

  describe('Layer 1 & 2: Host & Origin Protection (Anti-CSRF & DNS Rebinding)', () => {
    it('blocks requests with external/malicious Host header', async () => {
      const { req, res, getStatus, getBody } = createMockHttp({
        url: '/__api/registry',
        headers: { host: 'evil-attacker.com' }
      });

      await middleware(req, res, () => {});
      expect(getStatus()).toBe(403);
      expect(getBody().message).toContain('[SECURITY]');
    });

    it('blocks cross-origin requests from external websites (Drive-by Localhost)', async () => {
      const { req, res, getStatus, getBody } = createMockHttp({
        url: '/__api/registry',
        headers: {
          host: 'localhost:8686',
          origin: 'https://malicious-website.com'
        }
      });

      await middleware(req, res, () => {});
      expect(getStatus()).toBe(403);
      expect(getBody().message).toContain('[SECURITY]');
    });

    it('does not send Access-Control-Allow-Origin: * on OPTIONS preflight', async () => {
      const { req, res, getHeaders } = createMockHttp({
        url: '/__api/import',
        method: 'OPTIONS',
        headers: {
          host: 'localhost:8686',
          origin: 'https://attacker.com'
        }
      });

      await middleware(req, res, () => {});
      expect(getHeaders()['access-control-allow-origin']).toBeUndefined();
    });

    it('allows valid local OPTIONS preflight with safe localhost reflection', async () => {
      const { req, res, getHeaders, getStatus } = createMockHttp({
        url: '/__api/import',
        method: 'OPTIONS',
        headers: {
          host: 'localhost:8686',
          origin: 'http://localhost:8686'
        }
      });

      await middleware(req, res, () => {});
      expect(getStatus()).toBe(204);
      expect(getHeaders()['access-control-allow-origin']).toBe('http://localhost:8686');
    });
  });

  describe('Layer 3: Dev Session Token Authentication', () => {
    it('rejects POST requests without X-Workbench-Token', async () => {
      const { req, res, getStatus, getBody } = createMockHttp({
        url: '/__api/remove?component=header',
        method: 'POST'
      });

      await middleware(req, res, () => {});
      expect(getStatus()).toBe(401);
      expect(getBody().message).toContain('[SECURITY]');
    });

    it('rejects POST requests with invalid X-Workbench-Token', async () => {
      const { req, res, getStatus, getBody } = createMockHttp({
        url: '/__api/remove?component=header',
        method: 'POST',
        headers: {
          'x-workbench-token': 'fake-invalid-token-1234'
        }
      });

      await middleware(req, res, () => {});
      expect(getStatus()).toBe(401);
      expect(getBody().message).toContain('Dev Token');
    });

    it('accepts POST requests with valid X-Workbench-Token', async () => {
      // Testing with check-variants which is a safe batch read via POST
      const { req, res, getStatus, getBody } = createMockHttp({
        url: '/__api/check-variants',
        method: 'POST',
        headers: {
          'x-workbench-token': validToken
        },
        body: { items: [] }
      });

      await middleware(req, res, () => {});
      expect(getStatus()).toBe(200);
      expect(getBody().success).toBe(true);
    });
  });

  describe('HTTP Method Segregation (No GET for Mutations)', () => {
    it('rejects GET requests on /__api/import with 405 Method Not Allowed', async () => {
      const { req, res, getStatus, getBody } = createMockHttp({
        url: '/__api/import?component=header',
        method: 'GET'
      });

      await middleware(req, res, () => {});
      expect(getStatus()).toBe(405);
      expect(getBody().message).toContain('bắt buộc phải dùng POST');
    });

    it('rejects GET requests on /__api/remove with 405 Method Not Allowed', async () => {
      const { req, res, getStatus, getBody } = createMockHttp({
        url: '/__api/remove?component=header',
        method: 'GET'
      });

      await middleware(req, res, () => {});
      expect(getStatus()).toBe(405);
      expect(getBody().message).toContain('bắt buộc phải dùng POST');
    });

    it('rejects GET requests on /__api/delete-workbench with 405 Method Not Allowed', async () => {
      const { req, res, getStatus, getBody } = createMockHttp({
        url: '/__api/delete-workbench?component=header',
        method: 'GET'
      });

      await middleware(req, res, () => {});
      expect(getStatus()).toBe(405);
      expect(getBody().message).toContain('bắt buộc phải dùng POST');
    });

    it('allows localhost:3000 as valid origin', async () => {
      const { req, res, getHeaders } = createMockHttp({
        url: '/__api/registry',
        method: 'GET',
        headers: {
          host: 'localhost:8686',
          origin: 'http://localhost:3000'
        }
      });

      await middleware(req, res, () => {});
      expect(getHeaders()['access-control-allow-origin']).toBe('http://localhost:3000');
    });
  });

  describe('Layer 4: Parameter Sanitization (Anti Path-Traversal)', () => {
    it('rejects component names with path traversal ("../evil")', async () => {
      const { req, res, getStatus, getBody } = createMockHttp({
        url: '/__api/import?component=../../etc/passwd',
        method: 'POST',
        headers: {
          'x-workbench-token': validToken
        }
      });

      await middleware(req, res, () => {});
      expect(getStatus()).toBe(400);
      expect(getBody().message).toContain('Tên component không hợp lệ');
    });

    it('rejects component names with dangerous special characters', async () => {
      const { req, res, getStatus, getBody } = createMockHttp({
        url: '/__api/import?component=card;rm%20-rf',
        method: 'POST',
        headers: {
          'x-workbench-token': validToken
        }
      });

      await middleware(req, res, () => {});
      expect(getStatus()).toBe(400);
      expect(getBody().message).toContain('Tên component không hợp lệ');
    });

    it('rejects targetJsFile with directory traversal', async () => {
      const { req, res, getStatus, getBody } = createMockHttp({
        url: '/__api/import',
        method: 'POST',
        headers: {
          'x-workbench-token': validToken
        },
        body: {
          component: 'card',
          targetJsFile: '../../package.json'
        }
      });

      await middleware(req, res, () => {});
      expect(getStatus()).toBe(400);
      expect(getBody().message).toContain('Path Traversal');
    });

    it('rejects targetJsFile in /__api/import-variant with directory traversal', async () => {
      const { req, res, getStatus, getBody } = createMockHttp({
        url: '/__api/import-variant',
        method: 'POST',
        headers: {
          'x-workbench-token': validToken
        },
        body: {
          component: 'btn',
          targetJsFile: '../../package.json'
        }
      });

      await middleware(req, res, () => {});
      expect(getStatus()).toBe(400);
      expect(getBody().message).toContain('Path Traversal');
    });

    it('rejects save-selection with filePath escaping project root', async () => {
      const { req, res, getStatus, getBody } = createMockHttp({
        url: '/__api/save-selection',
        method: 'POST',
        headers: {
          'x-workbench-token': validToken
        },
        body: {
          filePath: '../../package.json',
          lineNumber: 10
        }
      });

      await middleware(req, res, () => {});
      expect(getStatus()).toBe(400);
      expect(getBody().message).toContain('Path Traversal');
    });
  });
});
