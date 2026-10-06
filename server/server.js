/**
 * server/server.js
 * ---------------------------------------------------------------------------
 * Zero-dependency Node static file server + API host for local development.
 *
 *   npm start   ->  http://localhost:3000
 *
 * It does two jobs:
 *   1. serves the HTML/CSS/JS front-end
 *   2. hosts /api/ai so the AI API key stays on the server (never in the browser)
 *
 * The same /api/ai logic is exported as a serverless function in /api/ai.js,
 * so the exact same app deploys to Vercel / Netlify without changes.
 */

import http from 'node:http';
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './handler.js';
import { isConfigured, NOT_CONFIGURED_MESSAGE } from './ai-core.js';
import { connectMongo, mongoDatabaseName } from './mongo-store.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/* ------------------------------------------------------------- .env loader */

function loadEnvFile(file = path.join(ROOT, '.env')) {
  if (!fs.existsSync(file)) return false;
  const text = fs.readFileSync(file, 'utf8');
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    // Real environment variables always win over the .env file.
    if (!(key in process.env)) process.env[key] = value;
  }
  return true;
}

const envLoaded = loadEnvFile();

/* ------------------------------------------------------------ static files */

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

async function serveStatic(req, res, pathname) {
  // decode + normalise, then guarantee the resolved path stays inside ROOT
  let rel;
  try {
    rel = decodeURIComponent(pathname);
  } catch {
    res.writeHead(400).end('Bad request');
    return;
  }
  if (rel.endsWith('/')) rel += 'index.html';

  const filePath = path.resolve(ROOT, '.' + path.posix.normalize(rel));
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403).end('Forbidden');
    return;
  }

  let stat;
  try {
    stat = await fsp.stat(filePath);
  } catch {
    await notFound(res, rel);
    return;
  }

  if (stat.isDirectory()) return serveStatic(req, res, rel + '/');

  const ext = path.extname(filePath).toLowerCase();
  const etag = `W/"${stat.size}-${stat.mtimeMs.toString(36)}"`;
  if (req.headers['if-none-match'] === etag) {
    res.writeHead(304, { ETag: etag }).end();
    return;
  }

  res.writeHead(200, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    ETag: etag,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=300',
    'X-Content-Type-Options': 'nosniff',
  });
  fs.createReadStream(filePath).pipe(res);
}

async function notFound(res, rel) {
  const custom = path.join(ROOT, '404.html');
  if (rel !== '/404.html' && fs.existsSync(custom)) {
    const html = await fsp.readFile(custom);
    res.writeHead(404, { 'Content-Type': MIME['.html'], 'Content-Length': html.length });
    res.end(html);
    return;
  }
  res.writeHead(404, { 'Content-Type': MIME['.html'] });
  res.end('<h1>404</h1><p>Not found. <a href="/">Go home</a></p>');
}

/* ------------------------------------------------------------------ server */

const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '0.0.0.0';

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;

  try {
    if (pathname.startsWith('/api/')) {
      const handled = await handleApi(pathname, req, res);
      if (!handled) {
        res.writeHead(404, { 'Content-Type': MIME['.json'] });
        res.end(JSON.stringify({ error: `No API route ${pathname}`, code: 'NOT_FOUND' }));
      }
      return;
    }
    await serveStatic(req, res, pathname);
  } catch (err) {
    console.error('[server]', err);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': MIME['.html'] });
    res.end('<h1>500</h1><p>Internal server error. Check the terminal for details.</p>');
  }
});

let mongoConnected = false;
try {
  await connectMongo();
  mongoConnected = true;
} catch (err) {
  console.error(`[server] ${err.message}`);
  console.error('[server] Starting with browser-only storage until MongoDB is available.');
}

server.listen(PORT, HOST, () => {
  const bar = '─'.repeat(52);
  console.log(`\n\x1b[38;5;208m┌${bar}┐\x1b[0m`);
  console.log(`\x1b[38;5;208m│\x1b[0m  \x1b[1mKalvi AI - Student Learning Platform\x1b[0m`);
  console.log(`\x1b[38;5;208m├${bar}┤\x1b[0m`);
  console.log(`  Local:      \x1b[4mhttp://localhost:${PORT}\x1b[0m`);
  if (mongoConnected) {
    console.log(`  MongoDB:    \x1b[32mconnected\x1b[0m (${mongoDatabaseName()})`);
  } else {
    console.log('  MongoDB:    \x1b[33mnot connected\x1b[0m (browser-only storage)');
  }
  if (isConfigured()) {
    console.log(`  AI:         \x1b[32mconfigured\x1b[0m (${process.env.AI_PROVIDER || 'openrouter'} / ${process.env.AI_MODEL || 'default'})`);
  } else {
    console.log(`  AI:         \x1b[33mNOT configured\x1b[0m`);
    console.log(`              ${NOT_CONFIGURED_MESSAGE}`);
    console.log(`              \x1b[2mNo .env found -> copy .env.example to .env and set AI_API_KEY\x1b[0m`);
  }
  if (!envLoaded) console.log(`  Config:     \x1b[2musing process environment only (.env not found)\x1b[0m`);
  console.log(`\x1b[38;5;208m└${bar}┘\x1b[0m\n`);
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  Port ${PORT} is already in use. Start on another port:  PORT=4000 npm start\n`);
  } else {
    console.error(err);
  }
  process.exit(1);
});
