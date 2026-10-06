import { guard, mountApp, loadPage, pageRoot } from '../shell.js';
import { $, $$, esc, toast, md, relTime, emptyState, copyText } from '../ui.js';
import { SUBJECTS_BY_ID, LESSONS_BY_ID } from '../data/curriculum.js';
import { initStore, auth, profile, conversations, messages, lessons } from '../store.js';
import { ai, aiHealth, AIServiceError, withAI } from '../ai.js';

await guard();
await mountApp({ title: 'AI Tutor', wide: true });

const MODES = [
  { id: 'chat', label: 'Explain', icon: '💬', hint: 'Ask anything about your subjects' },
  { id: 'quiz', label: 'Quiz me', icon: '📝', hint: 'Interactive question-and-answer' },
  { id: 'simplify', label: 'Simplify', icon: '🍬', hint: 'Make any text much easier' },
  { id: 'summary', label: 'Summarise', icon: '📄', hint: 'Condense notes or a lesson' },
  { id: 'plan', label: 'Study plan', icon: '📅', hint: 'Build a day-by-day plan' },
  { id: 'cards', label: 'Flashcards', icon: '🃏', hint: 'Generate a revision deck' },
];

let mode = sessionStorage.getItem('edunova.mode') || 'chat';
let convoId = null;
let pendingSource = '';
let busy = false;

async function render() {
  const list = await conversations.list();
  const p = await profile.get();
  const health = await aiHealth();
  if (!MODES.some((m) => m.id === mode)) mode = 'chat';

  pageRoot().innerHTML = `
    <div class="tutor-layout">
      <aside class="card tutor-side">
        <div class="tutor-face-wrap">
          <div class="ai-face ${health.configured ? 'live' : ''}" style="--fs:64px"><span class="ai-face-eyes"></span></div>
          <b>AI Tutor</b>
          <p class="tiny dim center" style="padding:0 12px">${health.configured
            ? `${esc(health.provider)} · ${esc(health.model || '')}`
            : 'Not connected'}</p>
        </div>

        <div class="pad-16 col gap-16">
          <div>
            <div class="label mb-8">Mode</div>
            <div class="col gap-6" id="modeList">
              ${MODES.map((m) => `<button class="mode-btn ${m.id === mode ? 'on' : ''}" data-mode="${m.id}">
                <span class="mode-ico">${m.icon}</span>
                <span class="grow" style="text-align:left"><b class="small">${m.label}</b><span class="tiny dim" style="display:block">${m.hint}</span></span>
              </button>`).join('')}
            </div>
          </div>

          <div>
            <div class="label row-between mb-8">Chats <button class="link tiny" id="newChat">＋ New</button></div>
            <div class="col gap-4" id="convoList">
              ${list.length ? list.map((c) => `<div class="convo-row ${c.id === convoId ? 'on' : ''}" data-convo="${c.id}">
                <span class="grow ellipsis small">${esc(c.title || 'New chat')}</span>
                <span class="tiny dim">${relTime(c.updatedAt || c.createdAt)}</span>
                <button class="icon-btn sm" data-del-convo="${c.id}" aria-label="Delete chat">✕</button>
              </div>`).join('') : '<p class="tiny dim">No chats yet.</p>'}
            </div>
          </div>
        </div>
      </aside>

      <section class="card chat-card">
        <header class="chat-head">
          <div class="grow">
            <b>${MODES.find((m) => m.id === mode).label}</b>
            <p class="tiny dim" id="chatSub">${esc(p?.course || p?.educationLevel || 'Student')} · ${esc((p?.subjects || []).map((s) => (typeof s === 'string' ? s : s.name)).slice(0, 2).join(', ') || 'no subjects set')}</p>
          </div>
          <button class="icon-btn" id="clearChat" title="Clear conversation">🗑</button>
        </header>

        <div class="chat-log" id="chatLog"></div>

        <div class="chat-input-wrap">
          ${mode === 'simplify' || mode === 'summary' ? `
            <div class="paste-row">
              <textarea class="input" id="sourceText" rows="2" placeholder="${mode === 'summary' ? 'Paste lecture notes, an article or a transcript…' : 'Paste any text you want explained more simply…'}"></textarea>
              <button class="btn btn-ghost btn-sm" id="useSource">Use this text</button>
            </div>` : ''}
          <div class="chat-input-row">
            <textarea class="input" id="prompt" rows="1" placeholder="${placeholder()}"></textarea>
            <button class="btn btn-primary" id="sendBtn" aria-label="Send"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2 11 13M22 2l-7 20-4-9-9-4z"/></svg></button>
          </div>
          <p class="tiny dim mt-8" id="hint"></p>
        </div>
      </section>
    </div>`;

  wire();
  await openConversation(convoId);
}

function placeholder() {
  return {
    chat: 'Ask anything — e.g. "why does photosynthesis need light?"',
    quiz: 'Name a topic and I will quiz you one question at a time…',
    simplify: 'Paste text above, or describe what you want simplified…',
    summary: 'Paste text above, or tell me what to summarise…',
    plan: 'Tell me your exam date and how many hours a day you can study…',
    cards: 'Tell me the topic to build flashcards for…',
  }[mode];
}

function wire() {
  $$('[data-mode]').forEach((b) => b.addEventListener('click', async () => {
    mode = b.dataset.mode;
    sessionStorage.setItem('edunova.mode', mode);
    render();
  }));

  $('#newChat').addEventListener('click', async () => {
    const c = await conversations.create({ title: 'New chat', mode });
    convoId = c.id;
    render();
  });

  $$('[data-convo]').forEach((r) => r.addEventListener('click', () => { convoId = r.dataset.convo; render(); }));
  $$('[data-del-convo]').forEach((b) => b.addEventListener('click', async (e) => {
    e.stopPropagation();
    await conversations.remove(b.dataset.delConvo);
    if (convoId === b.dataset.delConvo) convoId = null;
    toast('Chat deleted.', 'info');
    render();
  }));

  $('#clearChat').addEventListener('click', async () => {
    if (!convoId) return;
    await conversations.remove(convoId);
    convoId = null;
    render();
  });

  $('#useSource')?.addEventListener('click', () => {
    pendingSource = $('#sourceText').value.trim();
    if (!pendingSource) return toast('Paste or type some text first.', 'info');
    toast('Text ready — now ask what you want done with it.', 'success');
    $('#prompt').focus();
  });

  const input = $('#prompt');
  input.addEventListener('input', () => {
    input.style.height = 'auto';
    input.style.height = `${Math.min(160, input.scrollHeight)}px`;
  });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  $('#sendBtn').addEventListener('click', send);

  $('#hint').textContent = {
    chat: 'The AI knows your course, subjects and level. Be as specific as you like.',
    quiz: 'Answer in the chat. Type “skip” to move on, or “stop” to end the quiz.',
    simplify: 'Modes: simpler · example · analogy · step-by-step · key points',
    summary: 'Modes: key points · flashcards · exam-ready notes · action items',
    plan: 'Include your exam date and available study hours for the best plan.',
    cards: 'A deck is created and saved to your Flashcards page.',
  }[mode];

  // suggestion chips for empty state
  if (!pendingPromptUsed && !convoId) {
    pendingPromptUsed = true;
    const pre = sessionStorage.getItem('edunova.prompt');
    if (pre) { input.value = pre; sessionStorage.removeItem('edunova.prompt'); }
  }
}
let pendingPromptUsed = false;

/* ------------------------------------------------------------ conversation */
async function openConversation(id) {
  const log = $('#chatLog');
  if (!log) return;

  if (id) {
    convoId = id;
    const msgs = await messages.list(id);
    log.innerHTML = msgs.length
      ? msgs.map((m) => bubble(m.role, m.content, m.mode, m.createdAt)).join('')
      : welcome();
  } else {
    convoId = null;
    log.innerHTML = welcome();
  }
  scrollDown();
  $$('#convoList [data-convo]').forEach((r) => r.classList.toggle('on', r.dataset.convo === convoId));
}

function welcome() {
  const suggestions = {
    chat: ['Explain recursion like I am 15', 'What is the difference between TCP and UDP?', 'How do I revise for exams in 2 weeks?'],
    quiz: ['Quiz me on cell biology', 'Test me on quadratic equations'],
    simplify: [],
    summary: [],
    plan: ['I have an exam in 5 days and 2 hours a day'],
    cards: ['Photosynthesis', 'Big-O complexity'],
  }[mode] || [];
  return `<div class="chat-welcome">
    <div class="ai-face live" style="--fs:72px;margin:0 auto 16px"><span class="ai-face-eyes"></span></div>
    <h2>Hi — what are we working on?</h2>
    <p class="muted small">I already know your course and the subjects you picked, so I will pitch everything at your level.</p>
    ${suggestions.length ? `<div class="row-wrap gap-8 mt-20" style="justify-content:center">${suggestions.map((s) => `<button class="chip" data-suggest="${esc(s)}">${esc(s)}</button>`).join('')}</div>` : ''}
  </div>`;
}

function bubble(role, content, m, at) {
  if (role === 'user') return `<div class="msg user"><div class="msg-bubble">${md(content)}</div></div>`;
  return `<div class="msg ai">
    <div class="ai-avatar sm">AI</div>
    <div class="grow">
      <div class="msg-bubble">${md(content)}</div>
      <div class="row gap-8 mt-6">
        <button class="chip-mini" data-copy="${esc(content)}">Copy</button>
        ${at ? `<span class="tiny dim">${relTime(at)}</span>` : ''}
      </div>
    </div>
  </div>`;
}

/* ------------------------------------------------------------------- send */
async function send() {
  if (busy) return;
  const input = $('#prompt');
  const text = input.value.trim();
  if (!text) return;

  busy = true;
  input.value = '';
  input.style.height = 'auto';
  $('#sendBtn').disabled = true;

  const log = $('#chatLog');
  log.querySelector('.chat-welcome')?.remove();
  log.insertAdjacentHTML('beforeend', bubble('user', text, mode));
  log.insertAdjacentHTML('beforeend', `<div class="msg ai" id="thinking">
    <div class="ai-avatar sm">AI</div>
    <div class="msg-bubble"><span class="spinner"></span> <span class="tiny dim">thinking…</span></div>
  </div>`);
  scrollDown();

  try {
    if (!convoId) {
      const c = await conversations.create({ title: text.slice(0, 44), mode });
      convoId = c.id;
      await messages.add(convoId, 'user', text, mode);
    } else {
      await messages.add(convoId, 'user', text, mode);
    }

    const ctx = await buildContext(text);
    const history = (await messages.list(convoId))
      .filter((m) => m.id !== undefined || true)
      .slice(-11, -1)
      .map((m) => ({ role: m.role, content: m.content }));

    const reply = await withAI(() => callAI(ctx, history), { loadingText: 'thinking' });

    $('#thinking')?.remove();
    log.insertAdjacentHTML('beforeend', bubble('assistant', reply, mode));
    await messages.add(convoId, 'assistant', reply, mode);
    await conversations.touch(convoId);
    bindCopy();
  } catch (err) {
    console.error('[ai-tutor] send failed', err);
    $('#thinking')?.remove();
    const msg = err instanceof AIServiceError ? err.message : 'Something went wrong. Please try again.';
    log.insertAdjacentHTML('beforeend', bubble('assistant', `_${msg}_\n\nIf this is an AI connection problem, check your \`.env\` file and restart the server.`, mode));
    toast(msg, 'error', 6000);
  } finally {
    busy = false;
    $('#sendBtn').disabled = false;
    scrollDown();
  }
}

async function callAI(ctx, history) {
  const text = $('#prompt')?.value;
  if (mode === 'quiz') {
    return ai.quiz({ prompt: ctx.prompt, history, mode: 'interactive', student: ctx.student, subjectId: ctx.subjectId, count: 5, stream: false });
  }
  if (mode === 'plan') {
    return ai.studyPlan({ goal: ctx.prompt, student: ctx.student, days: 7, hoursPerDay: 2, subjects: ctx.subjects });
  }
  if (mode === 'cards') {
    return ai.flashcards({ topic: ctx.prompt, student: ctx.student, count: 10 });
  }
  if (mode === 'simplify') {
    return ai.transform({ source: pendingSource || ctx.prompt, mode: 'simpler', student: ctx.student });
  }
  if (mode === 'summary') {
    return ai.summarize({ text: pendingSource || ctx.prompt, student: ctx.student, style: 'key points' });
  }
  const lessonId = sessionStorage.getItem('edunova.lessonId');
  if (lessonId) {
    const lesson = await lessons.get(lessonId);
    if (lesson) return ai.lessonHelp({ prompt: ctx.prompt, history, lessonText: `${lesson.title}\n\n${lesson.content || ''}`, student: ctx.student, mode: 'chat' });
  }
  return ai.chat({ prompt: ctx.prompt, history, mode: 'chat', student: ctx.student });
}

async function buildContext(prompt) {
  const p = await profile.get();
  const subjects = (p?.subjects || []).map((s) => (typeof s === 'string' ? s : s.name));
  const subjectId = Object.keys(SUBJECTS_BY_ID).find((id) => {
    const n = SUBJECTS_BY_ID[id].name.toLowerCase();
    return prompt.toLowerCase().includes(n.split(' ')[0]);
  }) || null;
  return { prompt, student: await profile.aiContext(), subjectId, subjects };
}

function bindCopy() {
  $$('[data-copy]').forEach((b) => b.addEventListener('click', async () => {
    await copyText(b.dataset.copy);
    toast('Copied.', 'success');
  }));
  $$('[data-suggest]').forEach((b) => b.addEventListener('click', () => {
    $('#prompt').value = b.dataset.suggest;
    send();
  }));
}

function scrollDown() {
  const log = $('#chatLog');
  if (log) log.scrollTop = log.scrollHeight;
}

loadPage(async () => {
  await initStore();
  await render();
}, 'the AI tutor');
