/**
 * js/ai.js — browser-side client for the server AI endpoint.
 *
 * The browser NEVER talks to the AI provider directly and never sees a key.
 * It posts to CONFIG.AI_ENDPOINT (served by server/server.js locally, or the
 * /api/ai serverless function in production).
 */

import { CONFIG } from './config.js';

export class AIServiceError extends Error {
  constructor(message, code = 'AI_ERROR', status = 0, extra = {}) {
    super(message);
    this.name = 'AIServiceError';
    this.code = code;
    this.status = status;
    Object.assign(this, extra);
  }
  get isNotConfigured() { return this.code === 'AI_NOT_CONFIGURED'; }
}

const NOT_CONFIGURED_TEXT =
  'AI service is not configured yet. Add your AI API key to the environment variables.';

/* ------------------------------------------------------------ health ---- */
let healthCache = null;

export async function aiHealth({ force = false } = {}) {
  if (healthCache && !force && Date.now() - healthCache.at < 30000) return healthCache.value;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 6000);
    const res = await fetch(CONFIG.AI_HEALTH_ENDPOINT, { signal: ctrl.signal, headers: { Accept: 'application/json' } });
    clearTimeout(t);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    healthCache = { at: Date.now(), value: { ok: true, ...json.ai, provider: json.ai?.provider, model: json.ai?.model } };
  } catch (err) {
    healthCache = {
      at: Date.now(),
      value: {
        ok: false,
        configured: false,
        provider: null,
        model: null,
        message:
          err.name === 'AbortError'
            ? 'The AI server did not respond. Is it running? Start it with: npm start'
            : `Could not reach the AI server (${err.message}). Start it with: npm start`,
        unreachable: true,
      },
    };
  }
  return healthCache.value;
}

/* ----------------------------------------------------------- transport -- */

/**
 * @param {object}   payload  request body for the AI endpoint
 * @param {object}   opts     { timeout, pick } - `pick` unwraps the response
 *                              envelope ({ ok, type, model, usage, ...action })
 *                              into the value the calling page actually uses.
 */
async function call(payload, { timeout, pick } = {}) {
  const ctrl = new AbortController();
  const ms = timeout || CONFIG.AI_TIMEOUT_MS;
  const timer = setTimeout(() => ctrl.abort(), ms);

  let res;
  try {
    res = await fetch(CONFIG.AI_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (err.name === 'AbortError') {
      throw new AIServiceError(
        'The AI took too long to respond. Please try again, or ask a shorter question.',
        'AI_TIMEOUT',
      );
    }
    throw new AIServiceError(
      'Could not reach the AI server. Check that the server is running (npm start) and try again.',
      'AI_NETWORK',
    );
  }
  clearTimeout(timer);

  let json;
  try {
    json = await res.json();
  } catch {
    throw new AIServiceError('The server returned an unreadable response. Please try again.', 'AI_BAD_RESPONSE', res.status);
  }

  if (!res.ok || json?.error) {
    const code = json?.code || `HTTP_${res.status}`;
    const message =
      code === 'AI_NOT_CONFIGURED' ? NOT_CONFIGURED_TEXT : json?.error || 'Something went wrong. Please try again.';
    throw new AIServiceError(message, code, res.status, { hint: json?.hint, available: json?.available });
  }
  return pick ? pick(json) : json;
}

/* ------------------------------------------------------------- unwrapping */
/** The server wraps every action as { ok, type, model, usage, ...payload }. */
const asText = (json) => json?.text ?? '';
const asPlan = (json) => json?.plan ?? json;
const asQuiz = (json) => json?.quiz ?? json;
const asCards = (json) => json?.cards ?? json;
const asList = (json) => json?.recommendations ?? json;

/* ---------------------------------------------------------------- calls -- */

/**
 * A rotating, offline welcome line for the dashboard.
 * This is pure UI copy built from the student's own profile and streak - it is
 * NOT an AI response and never claims to be one.
 */
const GREETINGS = {
  streak: (n) => `${n} days in a row. Keep that engine running.`,
  noStreak: 'One focused session today starts a streak you can actually keep.',
  new: 'Fresh start. Pick one topic and go deep on it.',
};

export function getGreeting(profile = {}, { streak = 0, mode = 'chat' } = {}) {
  const name = String(profile.fullName || '').trim().split(' ')[0];
  const level = String(profile.learningLevel || '').toLowerCase();
  const goal = String(profile.studyGoal || '').trim();

  const byMode = {
    quiz: `Ready to be tested${name ? ', ' + name : ''}? Ask me for a quiz on any topic you are revising.`,
    notes: `Send me a note or a lesson and I will turn it into flashcards${name ? ', ' + name : ''}.`,
    plan: `Tell me your exam date and how many hours you have, and I will build the plan${name ? ' for you, ' + name : ''}.`,
    simpler: `Ask me anything and say "explain simpler" if I go too fast${name ? ', ' + name : ''}.`,
  };
  if (byMode[mode]) return byMode[mode];

  const opening = streak >= 2
    ? GREETINGS.streak(streak)
    : streak === 1
      ? 'One day in. Tomorrow makes it a habit.'
      : GREETINGS.noStreak;
  const tail = level === 'advanced'
    ? ' I will keep the detail high — ask me to go deeper any time.'
    : goal
      ? ` Working towards: ${goal}.`
      : '';
  return opening + tail;
}

export const ai = {
  getGreeting,

  isNotConfigured(err) {
    return err instanceof AIServiceError && (err.isNotConfigured || err.code === 'AI_NETWORK');
  },

  /** Free-form tutor chat. Resolves to the answer text. */
  chat({ prompt, history = [], mode = 'chat', student, lessonContext, language }) {
    return call({ action: 'chat', prompt, history, mode, student, lessonContext, language }, { pick: asText });
  },

  /** Re-work the previous AI answer: simpler / examples / summarize / notes. */
  transform({ source, mode = 'simpler', student, focus, language }) {
    return call({ action: 'transform', source, mode, student, focus, language }, { pick: asText });
  },

  /** Ask about a specific lesson, with the lesson text as context. */
  lessonHelp({ prompt, history, lessonText, student, mode = 'chat' }) {
    return call({ action: 'lessonHelp', prompt, history, lessonContext: lessonText, student, mode }, { pick: asText });
  },

  studyPlan(payload) {
    return call({ action: 'studyPlan', ...payload }, { pick: asPlan });
  },

  quiz(payload) {
    return call({ action: 'quiz', ...payload }, { pick: asQuiz });
  },

  summarize({ text, student, language }) {
    return call({ action: 'summarize', text, student, language }, { pick: asText });
  },

  flashcards(payload) {
    return call({ action: 'flashcards', ...payload }, { pick: asCards });
  },

  recommendations(payload) {
    return call({ action: 'recommendations', ...payload }, { pick: asList });
  },
};

/**
 * Runs an AI call with consistent loading UI + error toasts.
 * Every button in the app uses this so error handling is never forgotten.
 *
 * @param {Function} fn      () => Promise<any>
 * @param {Object}   opts    { button, loadingText, onStart, silent }
 */
export async function withAI(fn, { button, loadingText = 'AI is thinking...', onStart, silent = false } = {}) {
  const host = ensureOverlay();
  let restore = null;
  if (button) restore = setButtonLoading(button, loadingText);
  host.classList.add('show');
  const label = host.querySelector('.ai-overlay-text');
  if (label) label.textContent = loadingText;

  try {
    const out = await fn();
    return out;
  } catch (err) {
    const message = err instanceof AIServiceError ? err.message : 'Something went wrong. Please try again.';
    if (!silent) {
      // surfaced by the caller too; keep one toast per failure
      throw err;
    }
    throw err;
  } finally {
    host.classList.remove('show');
    if (restore) restore();
  }
}

function setButtonLoading(btn, text) {
  const original = btn.innerHTML;
  const wasDisabled = btn.disabled;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner spinner-sm"></span><span>${String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))}</span>`;
  return () => {
    btn.disabled = wasDisabled;
    btn.innerHTML = original;
  };
}

let overlayEl = null;
function ensureOverlay() {
  if (overlayEl) return overlayEl;
  overlayEl = document.createElement('div');
  overlayEl.className = 'ai-overlay';
  overlayEl.innerHTML = `
    <div class="ai-overlay-card">
      <div class="ai-overlay-orb"><span></span><span></span><span></span></div>
      <div class="ai-overlay-text">AI is thinking...</div>
    </div>`;
  document.body.appendChild(overlayEl);
  return overlayEl;
}

export { NOT_CONFIGURED_TEXT };
