/**
 * api/ai.js  —  Vercel-style serverless function
 * ---------------------------------------------------------------------------
 * This is the PRODUCTION entry point for AI requests. The browser calls
 * POST /api/ai and never sees the API key.
 *
 * Local dev uses the exact same code through server/server.js.
 *
 * Deploy to Vercel:  vercel --prod
 * Deploy to Netlify: point the "functions" directory at /api (or use a rewrite).
 *
 * Required environment variables (Project Settings -> Environment Variables):
 *   AI_API_KEY   = sk-or-v1-...   (OpenRouter key, from https://openrouter.ai/keys)
 *   AI_PROVIDER  = openrouter | nvidia | openai | groq | custom | ollama
 *   AI_MODEL     = nvidia/nemotron-3-ultra-550b-a55b:free
 *   AI_BASE_URL  = (optional, overrides the provider default)
 */

import { handleApi } from '../server/handler.js';

export default async function handler(req, res) {
  const pathname = (req.url || '/api/ai').split('?')[0];
  const handled = await handleApi(pathname, req, res);
  if (!handled) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: `No API route ${pathname}`, code: 'NOT_FOUND' }));
  }
}
