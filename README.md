# Kalvi AI — AI-Powered Student Learning Platform

A complete, self-hosted learning platform with a **real** AI tutor, study plans, quizzes,
flashcards, notes and progress analytics. No build step or frontend framework — just Node.js
and modern browser ES modules.

```
npm start          # http://localhost:3000
```

---

## 1. What you get

| Area | Feature |
| --- | --- |
| AI tutor | Real chat with 6 modes: explain, quiz me, simplify, summarise, study plan, flashcards |
| Personalisation | Every AI request carries your education level, course, subjects and ability |
| Subjects | 9 built-in subjects, 23 full lessons, plus your own custom subjects and lessons |
| Quizzes | AI-generated quizzes **and** a built-in offline question bank with full answer review |
| Study plan | Day-by-day AI plan, exportable as text, one-click conversion into tasks |
| Notes | Rich notes with AI summarise / key points / flashcard extraction |
| Flashcards | Flip, rate easy/difficult, generate new decks with AI |
| Progress | Streaks, 14-day chart, 12-week consistency heatmap, quiz trends, AI recommendations |
| Profile | Everything the AI knows about you, editable in one place |
| Settings | Theme, AI temperature/length/language, notifications, subjects, JSON export, data wipe |
| Auth | Supabase Auth with row-level security, or zero-config localStorage mode |
| Responsive | Sidebar on desktop, bottom tab bar on mobile, light and dark themes |

---

## 2. Requirements

* **Node.js 18 or newer** (tested on 24.x).
* **MongoDB Community Server** for database persistence (optional; browser storage remains
  available if MongoDB is not running).
* An API key from **one** AI provider, if you want the AI features (optional — the app runs
  fully without it and tells you clearly that AI is unconfigured).

---

## 3. Configuration

### 3.1 AI (server side, required for AI features)

Copy the example file and edit it:

```bash
cp .env.example .env
```

```ini
AI_PROVIDER=openrouter
AI_API_KEY=sk-or-v1-your-key-here
AI_MODEL=nvidia/nemotron-3-ultra-550b-a55b:free
AI_BASE_URL=https://openrouter.ai/api/v1
AI_TIMEOUT_MS=60000
AI_MAX_TOKENS=6000
AI_REASONING_EFFORT=low
PORT=3000
```

`AI_MAX_TOKENS` must stay generous: reasoning models such as Nemotron spend part of the
budget on hidden reasoning, and a small budget makes them return an empty answer. The
server enforces a 4000-token floor and retries with double the budget when that happens.
`AI_REASONING_EFFORT` (`low` | `medium` | `high`, OpenRouter only) caps how long the model
thinks before answering.

Supported `AI_PROVIDER` values and their defaults:

| Provider | `AI_BASE_URL` default | Suggested model |
| --- | --- | --- |
| `nvidia` | `https://integrate.api.nvidia.com/v1` | `nvidia/nemotron-3-ultra-550b-a55b` |
| `openai` | `https://api.openai.com/v1` | `gpt-4o-mini` |
| `groq` | `https://api.groq.com/openai/v1` | `llama-3.3-70b-versatile` |
| `openrouter` | `https://openrouter.ai/api/v1` | `nvidia/nemotron-3-ultra-550b-a55b:free` |
| `together` | `https://api.together.xyz/v1` | `meta-llama/Llama-3-8b-chat-hstml` |
| `ollama` | `http://localhost:11434/v1` | `llama3.1` |
| `custom` | *required* | *your choice* |

The key and the base URL must come from the **same** vendor: an OpenRouter key sent to
`integrate.api.nvidia.com` (or an `nvapi-...` key sent to OpenRouter) returns HTTP 401.
Model ids also differ per vendor — NVIDIA's own API has no `:free` suffix, OpenRouter requires it.

Local models work with no key at all:

```ini
AI_PROVIDER=ollama
AI_BASE_URL=http://localhost:11434/v1
AI_MODEL=llama3.1
```

**Your key never reaches the browser.** The frontend only ever talks to `/api/ai`; the server
reads the key from the environment and calls the provider. `npm run check` fails the build if an
API key is ever found in `js/`.

### 3.2 Supabase (optional — real accounts and cloud sync)

Without Supabase the app runs in **local mode**: the profile is created in the browser, no
password is ever created or stored, and everything is kept in `localStorage`.

To enable real accounts, edit `js/config.js`:

```js
export const CONFIG = {
  SUPABASE_URL: 'https://YOUR-PROJECT.supabase.co',
  SUPABASE_ANON_KEY: 'YOUR_ANON_KEY',
  // ...
};
```

Then create the database — open the Supabase dashboard → **SQL Editor** → paste
[`supabase/schema.sql`](./supabase/schema.sql) → **Run**. It creates all 14 tables, enables
row-level security with an owner-only policy on every table, and adds a trigger that creates a
profile row on sign-up.

In the Supabase dashboard → **Authentication → URL Configuration**, add
`http://localhost:3000/**` to the redirect allow-list.

### 3.3 Local MongoDB (optional — persistent local data)

Start the MongoDB Community Server service, then connect MongoDB Compass to:

```text
mongodb://127.0.0.1:27017
```

The app server connects using `MONGODB_URI` from `.env`, or defaults to
`mongodb://127.0.0.1:27017/edunova_ai`. Add a different URI to `.env` if needed.
Restart the app with `npm start`. In Compass, refresh the connection and open the
`edunova_ai` database and its `app_state` collection. Browser-mode profiles, notes,
progress, quizzes and other app data are stored in the `data` field of the `default`
document and synchronized through the server; the MongoDB URI is never sent to the browser.

This passwordless MongoDB mode is intended for a local, single-user development setup.
It does not provide per-user authentication or access controls. For real accounts and
multi-user cloud access, configure Supabase instead.

---

## 4. Running

```bash
npm start              # static server + /api/ai on http://localhost:3000
npm run check          # syntax, imports, required files, link and key-hygiene checks
npm run lint           # alias of check
```

The server:

* serves every static file with correct MIME types and no caching in development,
* refuses to serve anything outside the project directory (path traversal),
* answers `GET /api/health` with the live AI status (provider, model, configured),
* answers `POST /api/ai` with body-size limits, per-IP rate limiting, timeouts and
  human-readable error messages,
* loads `.env` automatically — no `dotenv` dependency needed,
* connects to MongoDB before listening and persists local-mode app state in the
  `edunova_ai.app_state` collection.

### Deploying to Vercel

`vercel.json` is included. Set the same environment variables in the Vercel project settings and
`api/ai.js` + `api/health.js` are deployed as serverless functions. Static assets are served by
the CDN.

### Deploying from GitHub with Render

GitHub stores the source code; Render runs the Node.js server required by the AI API. The included
[`render.yaml`](./render.yaml) defines a free web service that installs dependencies, starts the
app, and checks `/api/health`.

1. Push this project to a GitHub repository.
2. In Render, choose **New → Blueprint**, connect the repository, and deploy the detected
   `render.yaml`.
3. To enable AI, add `AI_API_KEY` in the Render service's **Environment** settings. The default
   provider is OpenRouter; set `AI_PROVIDER`, `AI_MODEL`, and `AI_BASE_URL` there if using another
   provider. Never commit provider keys to GitHub.
4. For persistent server-side data, add a MongoDB connection string as `MONGODB_URI`. Without it,
   the app still starts and uses browser storage; data stored only in the browser is not shared
   between devices.

---

## 5. Project layout

```
api/                 Vercel serverless entry points
  ai.js              POST /api/ai
  health.js          GET  /api/health
assets/favicon.svg
css/
  base.css           design tokens, reset, buttons, forms, utilities
  layout.css         app shell, sidebar, topbar, mobile nav, grids, auth
  components.css     cards, chat, quizzes, flashcards, charts, modals, landing
js/
  config.js          Supabase + endpoint config
  store.js           data layer: localStorage and Supabase behind one API
  ai.js              browser client for /api/ai (never sees the key)
  ui.js              toasts, modals, markdown, icons, helpers, $
  shell.js           auth guard, navigation, theme, global search
  charts.js          line, bar, donut, sparkline, heatmap — pure SVG
  data/
    curriculum.js    9 subjects, 23 lessons
    quizbank.js      built-in offline question bank
  pages/             one controller per page
server/
  ai-core.js         provider calls, prompting, JSON parsing, typed errors
  prompts.js         system prompts, mode instructions, JSON contracts
  handler.js         request routing, validation, rate limiting
  server.js          static file server, .env loader, entry point
scripts/check.js     the checker behind npm run check
supabase/schema.sql  tables, RLS policies, sign-up trigger
```

---

## 6. The AI endpoint

```http
POST /api/ai
Content-Type: application/json

{ "action": "chat", "prompt": "Explain recursion", "student": { ... } }
```

| Action | Returns |
| --- | --- |
| `chat` | A conversational reply calibrated to the student |
| `transform` | Text rewritten: simpler, example, analogy, step-by-step, key points |
| `lessonHelp` | Chat grounded in a specific lesson |
| `studyPlan` | `{ plan: { title, summary, focusAreas[], days: [{ day, label, focus, blocks[] }], tips[] } }` |
| `quiz` | `{ quiz: { subject, topic, difficulty, questions: [{ question, options[], answer, why }] } }` |
| `summarize` | Summary, key points, exam notes or action items |
| `flashcards` | `{ cards: [{ front, back, hint }] }` |
| `recommendations` | `{ recommendations: { headline, strongestSubject, reviseTopics[], nextSteps[] } }` |

Every response is wrapped as `{ ok: true, type, ... }`; `js/ai.js` unwraps the envelope so
pages always receive the payload itself (`ai.chat()` -> text, `ai.quiz()` -> `{ questions }`, and so on).

Errors are typed and explicit — `AI_NOT_CONFIGURED`, `AI_TIMEOUT`, `AI_RATE_LIMITED`,
`AI_AUTH`, `AI_BAD_RESPONSE`, `AI_PROVIDER`. The UI surfaces the real message instead of
pretending an answer exists.

---

## 7. Privacy

Your AI key stays on the server. In local mode nothing leaves the browser at all. When you use an
AI feature, the relevant text plus your study profile are sent from your server to the provider you
configured. See [`privacy.html`](./privacy.html) and [`terms.html`](./terms.html) for the full
policy, both of which are rendered in the app.

---

## 8. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| "AI service is not configured" | No `.env`, or `AI_API_KEY` empty. Create `.env` and restart. |
| `AI_AUTH` (401/403) | Wrong or expired key. Check `AI_PROVIDER` matches the key's vendor. |
| `AI_BAD_RESPONSE` | The model ignored the JSON contract. Try a stronger model or a lower `AI_MAX_TOKENS`. |
| AI features slow | Ollama/Groq on CPU. Raise `AI_TIMEOUT_MS` to `120000`. |
| Nothing loads, blank page | Run `npm run check` — it reports the exact file and line. |
| Signed out after refresh | No profile yet. Open `/register.html` and complete the form. |
| Want to start over | Settings → Data → *Delete all local data*. |
