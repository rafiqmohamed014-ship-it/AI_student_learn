/**
 * server/ai-core.js
 * ---------------------------------------------------------------------------
 * The single place where the platform talks to an AI provider.
 *
 * DESIGN GOALS
 *  - Provider agnostic: any OpenAI-compatible `/chat/completions` endpoint works.
 *    Change provider = change AI_PROVIDER / AI_BASE_URL / AI_MODEL (see .env.example).
 *  - The API key is read from the environment ONLY. It is never returned to a client.
 *  - Typed errors (AIError) so the frontend can show precise, friendly messages.
 *  - Structured outputs are parsed defensively (fences, prose around JSON, etc).
 */

import { buildSystemPrompt, MODE_INSTRUCTIONS, jsonContract } from './prompts.js';

/* ------------------------------------------------------------------ config */

const PROVIDER_DEFAULTS = {
  nvidia: { baseUrl: 'https://integrate.api.nvidia.com/v1', model: 'nvidia/nemotron-3-ultra-550b-a55b' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
  openrouter: { baseUrl: 'https://openrouter.ai/api/v1', model: 'nvidia/nemotron-3-ultra-550b-a55b:free' },
  together: { baseUrl: 'https://api.together.xyz/v1', model: 'meta-llama/Llama-3.3-70B-Instruct-Turbo' },
  custom: { baseUrl: '', model: 'gpt-4o-mini' },
  ollama: { baseUrl: 'http://localhost:11434/v1', model: 'llama3.1' },
};

export const NOT_CONFIGURED_MESSAGE =
  'AI service is not configured yet. Add your AI API key to the environment variables.';

export function getAIConfig() {
  const provider = (process.env.AI_PROVIDER || 'openrouter').toLowerCase();
  const preset = PROVIDER_DEFAULTS[provider] || PROVIDER_DEFAULTS.openrouter;
  const apiKey = (process.env.AI_API_KEY || '').trim();
  const baseUrl = (process.env.AI_BASE_URL || preset.baseUrl).replace(/\/+$/, '');
  const model = (process.env.AI_MODEL || preset.model).trim();
  const timeoutMs = Number(process.env.AI_TIMEOUT_MS) || 60000;
  const maxTokens = Number(process.env.AI_MAX_TOKENS) || 6000;

  const placeholder = !apiKey || /^your_api_key_here$/i.test(apiKey) || /^sk-\.\.\.$/.test(apiKey);

  return {
    provider,
    apiKey,
    baseUrl,
    model,
    timeoutMs,
    maxTokens,
    configured: !placeholder && Boolean(baseUrl) && Boolean(model),
  };
}

export function isConfigured() {
  return getAIConfig().configured;
}

/* ------------------------------------------------------------------- errors */

export class AIError extends Error {
  constructor(code, message, status = 500, extra = {}) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.status = status;
    this.extra = extra;
  }
  toJSON() {
    return { error: this.message, code: this.code, status: this.status, ...this.extra };
  }
}

/** Human-friendly copy for every failure mode (requirement: ERROR HANDLING). */
function friendlyError(err) {
  const msg = String(err?.message || err || '').toLowerCase();
  if (err?.name === 'AbortError' || msg.includes('abort')) {
    return new AIError(
      'AI_TIMEOUT',
      'The AI took too long to respond. Please try again, or ask a slightly shorter question.',
      504,
    );
  }
  if (msg.includes('fetch failed') || msg.includes('econnrefused') || msg.includes('network') || msg.includes('enotfound')) {
    return new AIError(
      'AI_NETWORK',
      'Could not reach the AI service. Check your internet connection and try again.',
      503,
    );
  }
  if (err?.status === 401 || err?.status === 403 || msg.includes('api key') || msg.includes('unauthorized')) {
    return new AIError(
      'AI_AUTH',
      'The AI provider rejected the API key. Check AI_API_KEY in your .env file.',
      502,
    );
  }
  if (err?.status === 429 || msg.includes('rate limit') || msg.includes('quota')) {
    return new AIError(
      'AI_RATE_LIMIT',
      'The AI provider rate limit was reached. Wait a moment and try again.',
      429,
    );
  }
  if (err?.status >= 500) {
    return new AIError('AI_UPSTREAM', 'The AI provider is temporarily unavailable. Please try again.', 502);
  }
  return new AIError('AI_UNKNOWN', 'Something went wrong while talking to the AI. Please try again.', 500);
}

/* ------------------------------------------------------------ transport */

/** Best-effort extraction of a human-readable message from an error response. */
async function readErrorDetail(res) {
  try {
    const j = await res.json();
    return j?.error?.message || j?.message || '';
  } catch {
    return (await res.text().catch(() => '')) || '';
  }
}

/** Content is a string on most providers but an array of parts on some. */
function normaliseContent(content) {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) {
    return content
      .map((p) => (typeof p === 'string' ? p : p?.type === 'text' || !p?.type ? p?.text || '' : ''))
      .join('');
  }
  return '';
}

/**
 * Reasoning models (Nemotron, DeepSeek-R1, o-series...) spend part of `max_tokens`
 * on hidden reasoning. If the budget is too small they finish "thinking" and return
 * empty content, which the UI then reports as a broken AI. So every request gets at
 * least this many tokens, whatever the caller asked for.
 */
const MIN_TOKENS = 4000;
const MAX_TOKENS_CEILING = 32000;
const MAX_ATTEMPTS = 4;
const RETRY_BASE_MS = 1000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const DAILY_LIMIT_MESSAGE =
  'The free AI daily limit has been reached (50 free requests per day). It resets automatically, or add credits on the provider to raise the limit.';

/** Free tiers cap requests per day; retrying that never helps. */
function isDailyCap(message) {
  return /per[- ]?day|daily limit|daily_limit|free_tier_daily|unlock \d+ free/i.test(String(message || ''));
}

/** Failures that are worth retrying: free tiers overload, rate-limit and stall. */
const RETRYABLE = new Set(['AI_EMPTY', 'AI_OVERLOADED', 'AI_BAD_RESPONSE', 'AI_RATE_LIMIT']);

/**
 * Core call to any OpenAI-compatible chat completions endpoint.
 * Retries on a busy free tier and on reasoning models that return nothing.
 * @returns {Promise<{text:string, raw:object, model:string, usage:object|null}>}
 */
export async function chatCompletion({ messages, temperature, maxTokens, jsonMode = false }) {
  const cfg = getAIConfig();

  if (!cfg.configured) {
    throw new AIError('AI_NOT_CONFIGURED', NOT_CONFIGURED_MESSAGE, 503, {
      provider: cfg.provider,
      hint: 'Copy .env.example to .env, set AI_API_KEY, then restart the server (npm start).',
    });
  }

  const wanted = maxTokens || cfg.maxTokens;
  const base = Math.min(Math.max(wanted, MIN_TOKENS), MAX_TOKENS_CEILING);

  let lastErr;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // A retry gets double the tokens: covers reasoning models that ran out of budget.
    const budget = attempt === 0 ? base : Math.min(base * 2, MAX_TOKENS_CEILING);
    try {
      return await singleCall(cfg, { messages, temperature, maxTokens: budget, jsonMode });
    } catch (err) {
      lastErr = err;
      const retryable = err instanceof AIError && RETRYABLE.has(err.code);
      if (!retryable || attempt === MAX_ATTEMPTS - 1) break;
      await sleep(RETRY_BASE_MS * (attempt + 1));
    }
  }

  if (lastErr instanceof AIError && lastErr.code === 'AI_OVERLOADED') {
    throw new AIError(
      'AI_OVERLOADED',
      'The free AI is very busy right now. Please wait a few seconds and try again.',
      503,
    );
  }
  if (lastErr instanceof AIError && lastErr.code === 'AI_EMPTY') {
    throw new AIError(
      'AI_EMPTY',
      'The AI thought for too long and returned nothing. Try a shorter, more specific question.',
      502,
    );
  }
  if (lastErr instanceof AIError && lastErr.code === 'AI_RATE_LIMIT') {
    throw new AIError(
      'AI_RATE_LIMIT',
      'You have made a lot of AI requests in a short time. Please wait about a minute and try again.',
      429,
    );
  }
  if (lastErr instanceof AIError && lastErr.code === 'AI_DAILY_LIMIT') {
    throw new AIError('AI_DAILY_LIMIT', DAILY_LIMIT_MESSAGE, 429);
  }
  throw lastErr;
}

/** One HTTP round-trip. Throws AIError when the provider returns no usable content. */
async function singleCall(cfg, { messages, temperature, maxTokens, jsonMode }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), cfg.timeoutMs);

  const body = {
    model: cfg.model,
    messages,
    temperature: typeof temperature === 'number' ? temperature : 0.6,
    max_tokens: maxTokens,
  };
  if (jsonMode) body.response_format = { type: 'json_object' };

  // OpenRouter hosts reasoning models that will happily burn the whole token budget
  // thinking and return empty content. Asking for minimal reasoning fixes that.
  if (cfg.provider === 'openrouter') {
    const effort = String(process.env.AI_REASONING_EFFORT || 'low').toLowerCase();
    if (['low', 'medium', 'high'].includes(effort)) body.reasoning = { effort };
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${cfg.apiKey}`,
  };
  if (cfg.provider === 'openrouter') {
    headers['HTTP-Referer'] = process.env.APP_ORIGIN || 'http://localhost:3000';
    headers['X-Title'] = 'Kalvi AI';
  }

  const post = (payload) =>
    fetch(`${cfg.baseUrl}/chat/completions`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload),
      signal: controller.signal,
    });

  let res = null;
  let detail = '';
  try {
    res = await post(body);
    if (!res.ok) {
      detail = await readErrorDetail(res);
      // Some OpenAI-compatible providers reject `response_format` / `reasoning`.
      // Retry once without them; callers parse JSON loosely.
      if (res.status === 400 && /response_format|json_object|json mode|reasoning|extra fields|not permitted|unrecognized/i.test(detail)) {
        const plain = { ...body };
        delete plain.response_format;
        delete plain.reasoning;
        res = await post(plain);
        if (!res.ok) detail = await readErrorDetail(res);
      }
    }
  } catch (err) {
    throw err instanceof AIError ? err : friendlyError(err);
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    // The free tier's daily cap is not worth retrying - fail fast with a clear reason.
    if (isDailyCap(detail)) throw new AIError('AI_DAILY_LIMIT', DAILY_LIMIT_MESSAGE, 429);
    throw friendlyError(new AIError('AI_UPSTREAM', detail || `AI provider error (HTTP ${res.status}).`, res.status));
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new AIError('AI_BAD_RESPONSE', 'The AI returned an unreadable response. Please try again.', 502);
  }

  // Gateways (OpenRouter included) often answer HTTP 200 with an error object and no
  // `choices`. Detect that instead of reporting it as an empty answer.
  if (json && json.error && !json.choices) {
    const info = json.error;
    const msg = String(info.message || info || 'The AI provider reported an error.');
    const code = Number(info.code ?? info.status);
    const transient = /overload|busy|temporar|try again|rate.?limit|timeout|upstream|no capacity/i.test(msg) ||
      [408, 409, 425, 429, 500, 502, 503, 504, 529].includes(code);
    if (transient) throw new AIError('AI_OVERLOADED', msg, 503);
    if (isDailyCap(msg)) throw new AIError('AI_DAILY_LIMIT', DAILY_LIMIT_MESSAGE, 429);
    throw friendlyError(new AIError('AI_UPSTREAM', msg, code >= 400 && code < 600 ? code : 502));
  }

  const choice = json?.choices?.[0]?.message || {};
  const text = normaliseContent(choice.content);
  if (!text.trim()) {
    // Some reasoning models put the answer in a different field when content is null.
    const alt = choice.reasoning_content || choice.reasoning || '';
    const err = new AIError('AI_EMPTY', 'The AI returned an empty response. Please rephrase your question.', 502);
    if (alt) err.extra = { reasoning_only: true };
    throw err;
  }
  return { text, raw: json, model: json?.model || cfg.model, usage: json?.usage || null };
}

/* --------------------------------------------------------- json extraction */

export function parseJSONLoose(text) {
  if (typeof text !== 'string') throw new AIError('AI_BAD_JSON', 'The AI returned an unexpected format.', 502);
  let t = text.trim();

  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) t = fence[1].trim();

  try {
    return JSON.parse(t);
  } catch {
    /* keep trying */
  }
  // Fallback: first balanced {...} or [...] block.
  for (const [open, close] of [['{', '}'], ['[', ']']]) {
    const start = t.indexOf(open);
    if (start === -1) continue;
    let depth = 0;
    let inStr = false;
    let esc = false;
    for (let i = start; i < t.length; i++) {
      const c = t[i];
      if (inStr) {
        if (esc) esc = false;
        else if (c === '\\') esc = true;
        else if (c === '"') inStr = false;
        continue;
      }
      if (c === '"') inStr = true;
      else if (c === open) depth++;
      else if (c === close) {
        depth--;
        if (depth === 0) {
          try {
            return JSON.parse(t.slice(start, i + 1));
          } catch {
            break;
          }
        }
      }
    }
  }
  throw new AIError('AI_BAD_JSON', 'The AI returned an unreadable format. Try generating again.', 502);
}

/* --------------------------------------------------------------- utilities */

const clampStr = (v, max, fallback = '') =>
  typeof v === 'string' ? v.trim().slice(0, max) : v == null ? fallback : String(v).slice(0, max);

const arr = (v) => (Array.isArray(v) ? v.map((x) => clampStr(x, 60)).filter(Boolean).slice(0, 20) : []);

function normaliseStudent(student = {}) {
  return {
    fullName: clampStr(student.fullName, 80, 'Student'),
    educationLevel: clampStr(student.educationLevel, 60, ''),
    course: clampStr(student.course, 80, ''),
    subjects: arr(student.subjects),
    learningLevel: clampStr(student.learningLevel, 30, 'beginner'),
    studyGoal: clampStr(student.studyGoal, 200, ''),
    dailyGoalMinutes: Number(student.dailyGoalMinutes) || 0,
  };
}

/** Turns arbitrary conversation history from the client into provider messages. */
function historyToMessages(history = []) {
  const out = [];
  for (const m of Array.isArray(history) ? history : []) {
    const role = m?.role === 'assistant' ? 'assistant' : m?.role === 'system' ? 'system' : 'user';
    const content = clampStr(m?.content, 6000);
    if (!content) continue;
    if (role === 'system') continue; // student-supplied system prompts are ignored on purpose
    out.push({ role, content });
  }
  return out.slice(-24);
}

/* ----------------------------------------------------------------- actions */

/**
 * action handlers: each returns a plain object which is JSON-sent to the browser.
 * Adding a new AI feature = add a key here.
 */
export const actions = {
  /* Free-form tutor chat (the main AI Tutor). */
  async chat(payload) {
    const student = normaliseStudent(payload.student);
    const mode = MODE_INSTRUCTIONS[payload.mode] ? payload.mode : 'chat';
    const messages = [
      { role: 'system', content: buildSystemPrompt(student, { mode, lessonContext: payload.lessonContext, language: payload.language }) },
      ...historyToMessages(payload.history),
    ];
    if (clampStr(payload.prompt, 6000)) messages.push({ role: 'user', content: clampStr(payload.prompt, 6000) });
    if (messages.length < 2) {
      throw new AIError('AI_EMPTY_INPUT', 'Type a question first so the AI has something to work with.', 400);
    }
    const { text, model, usage } = await chatCompletion({
      messages,
      temperature: payload.temperature ?? (mode === 'test' || mode === 'quiz' ? 0.85 : 0.55),
    });
    return { type: 'text', text: text.trim(), model, usage };
  },

  /* "Explain simpler" / "Give examples" / "Summarize" applied to a previous answer. */
  async transform(payload) {
    const student = normaliseStudent(payload.student);
    const mode = MODE_INSTRUCTIONS[payload.mode] ? payload.mode : 'simpler';
    const source = clampStr(payload.source, 12000);
    if (!source) throw new AIError('AI_EMPTY_INPUT', 'There is no previous AI answer to work from yet.', 400);

    const lead = {
      simpler: 'Here is the previous answer, simplified:\n\n',
      examples: 'Here are worked examples based on the previous answer:\n\n',
      summarize: 'Here is a tight summary of the previous answer:\n\n',
      explain: 'Here is a clear re-explanation of the previous answer:\n\n',
      notes: 'Here are revision notes built from the previous answer:\n\n',
    }[mode] || 'Based on the previous answer:\n\n';

    const messages = [
      { role: 'system', content: buildSystemPrompt(student, { mode, language: payload.language }) },
      { role: 'user', content: `${lead}${source}\n\n${extraInstructionFor(mode, payload)}` },
    ];
    const { text, model, usage } = await chatCompletion({ messages, temperature: 0.5 });
    return { type: 'text', text: text.trim(), model, usage };
  },

  /* Answer a question about a specific lesson, using the lesson as context. */
  async lessonHelp(payload) {
    return actions.chat({ ...payload, lessonContext: payload.lessonContext || payload.lessonText, mode: payload.mode || 'chat' });
  },

  /* ---------------- Study plan generator ---------------- */
  async studyPlan(payload) {
    const student = normaliseStudent(payload.student);
    const subjects = arr(payload.subjects);
    if (!subjects.length) throw new AIError('AI_EMPTY_INPUT', 'Pick at least one subject for your study plan.', 400);

    const hours = Math.min(Math.max(Number(payload.hoursPerDay) || 2, 0.5), 12);
    const days = Math.min(Math.max(Number(payload.days) || 7, 1), 30);
    const level = clampStr(payload.level, 30, 'beginner');
    const weak = arr(payload.weakSubjects);
    const slot = clampStr(payload.preferredTime, 40, 'evening');
    const exam = clampStr(payload.examDate, 40, '');

    const user = `Build a ${days}-day study plan for me.
- Exam date: ${exam || 'not set (assume it is at the end of this plan)'}
- Subjects: ${subjects.join(', ')}
- Weak subjects needing extra time: ${weak.length ? weak.join(', ') : 'none specified'}
- Available study time: ${hours} hour(s) per day
- Current knowledge level: ${level}
- Preferred study time: ${slot}

Rules:
- Fit everything inside ${hours}h/day, include 2 short breaks.
- Start with the weakest subject, interleave so no subject is studied for 3 days straight.
- Each block must name a CONCRETE topic (a real concept or algorithm), not "study maths".
- Mix block types: concept/lesson, practice questions, quiz, revision/flashcards, mock test.
- Before JSON, reason silently. Output only JSON.`;

    const shape = {
      title: 'string',
      summary: '1-2 sentence overview of the strategy',
      focusAreas: ['the 2-3 subjects/topics that get the most time'],
      days: [
        {
          day: 1,
          label: 'Monday',
          focus: 'string - the theme of this day',
          blocks: [
            { time: '6:00 PM - 7:00 PM', title: 'string - concrete topic', type: 'lesson|practice|quiz|revision|mock', detail: 'string - what to actually do' },
          ],
        },
      ],
      tips: ['string'],
    };

    const { text, model, usage } = await chatCompletion({
      messages: [
        { role: 'system', content: buildSystemPrompt(student, { mode: 'plan' }) + '\n\n' + jsonContract(shape) },
        { role: 'user', content: user },
      ],
      temperature: 0.5,
      maxTokens: 3000,
      jsonMode: true,
    });

    const data = sanitisePlan(parseJSONLoose(text), { subjects, hours, slot, exam });
    return { type: 'studyPlan', plan: data, model, usage };
  },

  /* ---------------- Quiz generator ---------------- */
  async quiz(payload) {
    const student = normaliseStudent(payload.student);
    const subject = clampStr(payload.subject, 80);
    const topic = clampStr(payload.topic, 120, 'general topics');
    const difficulty = ['easy', 'medium', 'hard'].includes(payload.difficulty) ? payload.difficulty : 'medium';
    const count = Math.min(Math.max(Number(payload.count) || 5, 1), 15);
    if (!subject) throw new AIError('AI_EMPTY_INPUT', 'Choose a subject first.', 400);

    const shape = {
      questions: [
        {
          question: 'string',
          options: ['exactly 4 distinct options'],
          answerIndex: 0,
          explanation: 'string - why that option is correct AND why the tempting wrong one is wrong',
          topic: 'string - sub-topic tested',
          difficulty: 'easy|medium|hard',
        },
      ],
    };

    const user = `Create a ${difficulty} ${count}-question multiple-choice quiz.
- Subject: ${subject}
- Topic: ${topic}
- Difficulty: ${difficulty} (${difficulty === 'hard' ? 'requires multi-step reasoning and edge cases' : difficulty === 'easy' ? 'single-concept recall' : 'applied understanding'})
- Exactly ${count} questions, exactly 4 options each, exactly one correct option.
- Distractors must be plausible mistakes a real student makes, not joke answers.
- Cover different sub-topics of "${topic}" where possible.
- Explanations must be specific and teach the concept, 1-3 sentences.
Output only JSON.`;

    const { text, model, usage } = await chatCompletion({
      messages: [
        { role: 'system', content: buildSystemPrompt(student, { mode: 'quiz' }) + '\n\n' + jsonContract(shape) },
        { role: 'user', content: user },
      ],
      temperature: difficulty === 'hard' ? 0.85 : 0.65,
      maxTokens: 1200 + count * 220,
      jsonMode: true,
    });

    const questions = sanitiseQuiz(parseJSONLoose(text), count, difficulty, topic);
    if (!questions.length) {
      throw new AIError('AI_BAD_JSON', 'The AI could not produce valid quiz questions. Try generating again.', 502);
    }
    return { type: 'quiz', quiz: { subject, topic, difficulty, questions, source: 'ai' }, model, usage };
  },

  /* ---------------- Notes helpers ---------------- */
  async summarize(payload) {
    const text = clampStr(payload.text, 20000);
    if (!text) throw new AIError('AI_EMPTY_INPUT', 'Add some text to your note before summarizing it.', 400);
    const messages = [
      { role: 'system', content: buildSystemPrompt(normaliseStudent(payload.student), { mode: 'summarize', language: payload.language }) },
      { role: 'user', content: `Summarize the following student note. Keep every technical term accurate.\n\n---\n${text}` },
    ];
    const { text: out, model, usage } = await chatCompletion({ messages, temperature: 0.35 });
    return { type: 'text', text: out.trim(), model, usage };
  },

  /* ---------------- Flashcard generator ---------------- */
  async flashcards(payload) {
    const text = clampStr(payload.text, 20000);
    const topic = clampStr(payload.topic, 120, '');
    const count = Math.min(Math.max(Number(payload.count) || 10, 3), 30);
    const subject = clampStr(payload.subject, 80, '');
    if (!text && !topic) throw new AIError('AI_EMPTY_INPUT', 'Paste a note or name a topic to build flashcards from.', 400);

    const shape = { cards: [{ front: 'question side, max 18 words', back: 'answer side, max 40 words', topic: 'string' }] };

    const user = `Create ${count} revision flashcards.
${subject ? `- Subject: ${subject}` : ''}
${topic ? `- Topic: ${topic}` : ''}
${text ? `- Source material (authoritative - only use what is here):\n"""\n${text}\n"""` : '- Source material: none provided, use your own knowledge of this topic.'}
Rules:
- Exactly ${count} cards.
- Front = a specific question or "complete the definition" prompt. Never a yes/no question.
- Back = a precise, self-contained answer. If the answer is a formula, include when to use it.
- Test understanding, not trivia. Spread across sub-topics.
Output only JSON.`;

    const { text: raw, model, usage } = await chatCompletion({
      messages: [
        { role: 'system', content: buildSystemPrompt(normaliseStudent(payload.student), { mode: 'notes' }) + '\n\n' + jsonContract(shape) },
        { role: 'user', content: user },
      ],
      temperature: 0.5,
      maxTokens: 900 + count * 90,
      jsonMode: true,
    });

    const cards = sanitiseFlashcards(parseJSONLoose(raw), count);
    if (!cards.length) throw new AIError('AI_BAD_JSON', 'The AI could not build valid flashcards. Try again.', 502);
    return { type: 'flashcards', cards, model, usage };
  },

  /* ---------------- Smart recommendations ---------------- */
  async recommendations(payload) {
    const stats = payload.stats || {};
    const student = normaliseStudent(payload.student);
    const shape = {
      headline: 'string - one short sentence about where they are',
      strongestSubject: 'string',
      reviseTopics: ['3-5 specific topics to revise'],
      nextLesson: 'string - exact lesson/topic to study next',
      studyTip: 'string - one actionable tip',
    };
    const user = `Here is my real learning data. Analyse it and tell me exactly what to do next.
- Overall progress: ${stats.overall ?? 0}%
- Streak: ${stats.streak ?? 0} days
- Study minutes (7d): ${stats.minutes7 ?? 0}
- Quiz average: ${stats.quizAvg ?? 0}%
- Subject progress: ${JSON.stringify(stats.subjects || {})}
- Weakest topics from quiz results: ${JSON.stringify(stats.weakTopics || [])}
Be concrete and reference my actual data. No cheerleading filler. Output only JSON.`;

    const { text, model, usage } = await chatCompletion({
      messages: [
        { role: 'system', content: buildSystemPrompt(student, { mode: 'notes' }) + '\n\n' + jsonContract(shape) },
        { role: 'user', content: user },
      ],
      temperature: 0.4,
      maxTokens: 700,
      jsonMode: true,
    });
    return { type: 'recommendations', recommendations: parseJSONLoose(text), model, usage };
  },
};

function extraInstructionFor(mode, payload) {
  if (payload?.focus) return `Focus especially on: ${clampStr(payload.focus, 300)}`;
  return '';
}

/* ------------------------------------------------------ output sanitising */

const FALLBACK_TIMES = ['6:00 PM - 6:45 PM', '7:00 PM - 7:45 PM', '8:00 PM - 8:30 PM', '8:45 PM - 9:15 PM'];

function sanitisePlan(data, ctx) {
  const plan = data && typeof data === 'object' ? data : {};
  const days = Array.isArray(plan.days) ? plan.days : [];
  if (!days.length) throw new AIError('AI_BAD_JSON', 'The AI could not build a valid study plan. Try again.', 502);

  const outDays = days.slice(0, ctx.days || 7).map((d, i) => {
    const blocks = Array.isArray(d.blocks) ? d.blocks : [];
    return {
      day: Number(d.day) || i + 1,
      label: clampStr(d.label, 30, `Day ${i + 1}`),
      focus: clampStr(d.focus, 140, 'Revision'),
      blocks: blocks.slice(0, 8).map((b, j) => ({
        time: clampStr(b?.time, 40, FALLBACK_TIMES[j % FALLBACK_TIMES.length]),
        title: clampStr(b?.title, 140, 'Study block'),
        type: ['lesson', 'practice', 'quiz', 'revision', 'mock'].includes(b?.type) ? b.type : 'lesson',
        detail: clampStr(b?.detail, 400, ''),
      })),
    };
  });

  return {
    title: clampStr(plan.title, 120, 'My Study Plan'),
    summary: clampStr(plan.summary, 600, ''),
    focusAreas: arr(plan.focusAreas).slice(0, 5),
    days: outDays,
    tips: arr(plan.tips).slice(0, 6),
    generatedFor: { subjects: ctx.subjects, hoursPerDay: ctx.hours, preferredTime: ctx.slot, examDate: ctx.exam },
    generatedAt: new Date().toISOString(),
  };
}

function sanitiseQuiz(data, count, difficulty, topic) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.questions) ? data.questions : [];
  return list
    .filter((q) => q && typeof q.question === 'string' && Array.isArray(q.options))
    .map((q) => {
      const options = q.options.map((o) => clampStr(o, 300)).filter(Boolean).slice(0, 4);
      let answerIndex = Number.isInteger(q.answerIndex) ? q.answerIndex : options.findIndex((o) => o === q.answer);
      if (!Number.isInteger(answerIndex) || answerIndex < 0 || answerIndex >= options.length) answerIndex = 0;
      return {
        question: clampStr(q.question, 500),
        options,
        answerIndex,
        explanation: clampStr(q.explanation, 800, 'No explanation provided.'),
        topic: clampStr(q.topic, 80, topic),
        difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : difficulty,
      };
    })
    .filter((q) => q.question && q.options.length >= 2)
    .slice(0, count);
}

function sanitiseFlashcards(data, count) {
  const list = Array.isArray(data) ? data : Array.isArray(data?.cards) ? data.cards : [];
  return list
    .filter((c) => c && c.front)
    .map((c) => ({
      front: clampStr(c.front, 300),
      back: clampStr(c.back, 600),
      topic: clampStr(c.topic, 80, 'General'),
    }))
    .slice(0, count);
}

/* ---------------------------------------------------------------- dispatch */

/**
 * @param {{action:string, [k:string]:any}} payload
 * @returns {Promise<object>} response body
 */
export async function handleAIRequest(payload = {}) {
  const action = String(payload.action || '').trim();
  const fn = actions[action];
  if (!fn) {
    throw new AIError('UNKNOWN_ACTION', `Unknown AI action "${action || '(missing)'}".`, 400, {
      available: Object.keys(actions),
    });
  }
  return fn(payload);
}
