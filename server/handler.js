/**
 * server/handler.js
 * ---------------------------------------------------------------------------
 * HTTP handlers for the backend API. Deliberately transport-agnostic so the
 * exact same logic powers:
 *   - the local Node dev server   (server/server.js)
 *   - Vercel serverless functions (api/*.js)
 */

import { handleAIRequest, AIError, isConfigured, getAIConfig, NOT_CONFIGURED_MESSAGE } from './ai-core.js';
import { readAppState, writeAppState } from './mongo-store.js';

const MAX_BODY = 512 * 1024; // 512 KB is plenty for a pasted note
const MAX_STATE_BODY = 8 * 1024 * 1024;
const STATE_PREFIX = 'edunova.v1.';

/* ----------------------------------------------------------- rate limiting */

const buckets = new Map();

function rateLimit(key, { max = 30, windowMs = 60_000 } = {}) {
  const now = Date.now();
  const b = buckets.get(key);
  if (!b || now > b.reset) {
    buckets.set(key, { count: 1, reset: now + windowMs });
    return { ok: true, remaining: max - 1, retryAfter: 0 };
  }
  b.count++;
  if (b.count > max) {
    return { ok: false, remaining: 0, retryAfter: Math.ceil((b.reset - now) / 1000) };
  }
  return { ok: true, remaining: max - b.count, retryAfter: 0 };
}

// keep the map from growing forever
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of buckets) if (now > v.reset) buckets.delete(k);
}, 60_000).unref?.();

/* ------------------------------------------------------------------ helpers */

function clientKey(req) {
  const fwd = req.headers?.['x-forwarded-for'];
  if (typeof fwd === 'string' && fwd.length) return fwd.split(',')[0].trim();
  return req.socket?.remoteAddress || 'local';
}

function sendJSON(res, status, body, extraHeaders = {}, allowCors = true) {
  const data = JSON.stringify(body);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store',
    ...extraHeaders,
  };
  if (allowCors) {
    headers['Access-Control-Allow-Origin'] = '*';
    headers['Access-Control-Allow-Headers'] = 'Content-Type';
    headers['Access-Control-Allow-Methods'] = 'POST, GET, OPTIONS';
  }
  res.writeHead(status, headers);
  res.end(data);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    if (req.method === 'GET') return resolve({});
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) {
        reject(new AIError('BODY_TOO_LARGE', 'That request was too large. Paste a shorter note and try again.', 413));
        req.destroy();
        return;
      }
      chunks.push(c);
    });
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8');
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new AIError('BAD_JSON', 'The request body was not valid JSON.', 400));
      }
    });
    req.on('error', reject);
  });
}

function readStateBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_STATE_BODY) {
        reject(Object.assign(new Error('The saved app data is too large.'), { status: 413 }));
        req.resume();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(Object.assign(new Error('The request body was not valid JSON.'), { status: 400 }));
      }
    });
    req.on('error', reject);
  });
}

/* ----------------------------------------------------------------- routes */

/**
 * @param {string} pathname
 * @param {import('http').IncomingMessage} req
 * @param {import('http').ServerResponse} res
 * @returns {Promise<boolean>} true if the request was handled
 */
export async function handleApi(pathname, req, res) {
  if (pathname === '/api/data') {
    const remoteAddress = req.socket?.remoteAddress || '';
    const isLoopback = remoteAddress === '127.0.0.1' || remoteAddress === '::1' || remoteAddress === '::ffff:127.0.0.1';
    if (!isLoopback) {
      sendJSON(res, 403, { ok: false, error: 'MongoDB data is available only to the local machine.', code: 'LOCAL_ONLY' }, {}, false);
      return true;
    }

    if (req.method === 'GET') {
      try {
        sendJSON(res, 200, { ok: true, data: await readAppState() }, {}, false);
      } catch (err) {
        console.error('[api/data] MongoDB read failed:', err);
        sendJSON(res, 503, { ok: false, error: 'Could not read app data from MongoDB.', code: 'MONGODB_UNAVAILABLE' }, {}, false);
      }
      return true;
    }

    if (req.method === 'PUT') {
      try {
        const data = await readStateBody(req);
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          sendJSON(res, 400, { ok: false, error: 'Saved app data must be a JSON object.', code: 'BAD_STATE' }, {}, false);
          return true;
        }
        const keys = Object.keys(data);
        if (keys.length > 64 || keys.some((key) => !key.startsWith(STATE_PREFIX))) {
          sendJSON(res, 400, { ok: false, error: 'Saved app data contains an unsupported key.', code: 'BAD_STATE' }, {}, false);
          return true;
        }
        await writeAppState(data);
        sendJSON(res, 200, { ok: true }, {}, false);
      } catch (err) {
        console.error('[api/data] MongoDB write failed:', err);
        sendJSON(res, err.status || 503, {
          ok: false,
          error: err.status ? err.message : 'Could not save app data in MongoDB.',
          code: err.status ? 'BAD_REQUEST' : 'MONGODB_UNAVAILABLE',
        }, {}, false);
      }
      return true;
    }

    sendJSON(res, 405, { ok: false, error: 'Method not allowed.', code: 'METHOD_NOT_ALLOWED' }, { Allow: 'GET, PUT' }, false);
    return true;
  }

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Max-Age': '86400',
    });
    res.end();
    return true;
  }

  /* ---- GET /api/health : lets the UI know if the AI is configured ---- */
  if (pathname === '/api/health' && req.method === 'GET') {
    const cfg = getAIConfig();
    sendJSON(res, 200, {
      ok: true,
      ai: {
        configured: cfg.configured,
        provider: cfg.provider,
        model: cfg.model,
        message: cfg.configured ? `AI ready via ${cfg.provider} (${cfg.model})` : NOT_CONFIGURED_MESSAGE,
      },
      serverTime: new Date().toISOString(),
    });
    return true;
  }

  /* ---- POST /api/ai : every AI capability funnels through here ---- */
  if (pathname === '/api/ai' && req.method === 'POST') {
    const limit = rateLimit(clientKey(req), { max: 40, windowMs: 60_000 });
    if (!limit.ok) {
      sendJSON(res, 429, {
        error: 'Too many AI requests. Please wait a moment before trying again.',
        code: 'RATE_LIMITED',
        retryAfter: limit.retryAfter,
      });
      return true;
    }

    let payload;
    try {
      payload = await readBody(req);
    } catch (err) {
      sendJSON(res, err.status || 400, err.toJSON ? err.toJSON() : { error: err.message, code: 'BAD_REQUEST' });
      return true;
    }

    try {
      const result = await handleAIRequest(payload);
      sendJSON(res, 200, { ok: true, ...result });
    } catch (err) {
      if (err instanceof AIError) {
        sendJSON(res, err.status, err.toJSON());
      } else {
        console.error('[api/ai] unexpected error:', err);
        sendJSON(res, 500, {
          error: 'Something went wrong. Please try again.',
          code: 'INTERNAL',
          detail: process.env.NODE_ENV === 'development' ? String(err?.message || err) : undefined,
        });
      }
    }
    return true;
  }

  return false;
}

export { isConfigured, NOT_CONFIGURED_MESSAGE };
