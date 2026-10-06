/**
 * api/health.js — serverless health probe (Vercel/Netlify)
 */
import { handleApi } from '../server/handler.js';

export default async function handler(req, res) {
  const pathname = (req.url || '/api/health').split('?')[0];
  const handled = await handleApi(pathname, req, res);
  if (!handled) {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'not found' }));
  }
}
