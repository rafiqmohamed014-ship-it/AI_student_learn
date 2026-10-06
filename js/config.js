/**
 * js/config.js
 * ---------------------------------------------------------------------------
 * The ONE file you edit to connect Supabase.
 *
 *   1. Go to https://supabase.com -> your project -> Settings -> API
 *   2. Copy "Project URL"           -> SUPABASE_URL
 *   3. Copy "anon public" key       -> SUPABASE_ANON_KEY
 *   4. Run  supabase/schema.sql  in the SQL editor
 *
 * Leave these blank and the app still runs 100% (localStorage mode):
 * everything works for a single student on one device, with no accounts.
 *
 * The anon key is DESIGNED to be public - it is protected by Row Level
 * Security (see supabase/schema.sql). The AI key is the only secret and it
 * lives on the server in .env - never in this file.
 */

export const CONFIG = {
  /* ---- Supabase (optional) ---- */
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',

  /* ---- AI backend (required for AI features) ----
     Must be a server endpoint. Never point this at the provider directly,
     that would expose your key. Local dev: served by `npm start`.        */
  AI_ENDPOINT: '/api/ai',
  AI_HEALTH_ENDPOINT: '/api/health',
  AI_TIMEOUT_MS: 90000,

  /* ---- App ---- */
  APP_NAME: 'Kalvi AI',
  STORAGE_PREFIX: 'edunova.v1.',
  DEFAULT_DAILY_GOAL: 60,
  PUBLIC_PAGES: ['/index.html', '/login.html', '/register.html', '/forgot-password.html', '/404.html'],
};

export const isSupabaseConfigured = () =>
  Boolean(
    CONFIG.SUPABASE_URL &&
      CONFIG.SUPABASE_ANON_KEY &&
      /^https?:\/\//.test(CONFIG.SUPABASE_URL) &&
      CONFIG.SUPABASE_ANON_KEY.length > 20,
  );
