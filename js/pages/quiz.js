import { guard, mountApp, loadPage, pageRoot } from '../shell.js';
import { $, $$, esc, toast, emptyState, fmtMinutes, progressBar } from '../ui.js';
import { SUBJECTS, SUBJECTS_BY_ID, lessonsFor } from '../data/curriculum.js';
import { profile, quizzes, quizResults, studySessions } from '../store.js';
import { ai, withAI } from '../ai.js';
import { buildBuiltinQuiz } from '../data/quizbank.js';

await guard();
await mountApp({ title: 'Quizzes' });

const params = new URLSearchParams(location.search);
let subjectId = params.get('subject') || '';
let count = 5;
let source = 'practice';
let state = null; // { questions, answers, index, startAt, title }

async function render() {
  const saved = await quizzes.list();
  const results = await quizResults.list({ limit: 20 });
  const p = await profile.get();

  pageRoot().innerHTML = `
    <div class="page-head">
      <div><h1>Quizzes</h1><p class="muted small mt-4">Practise with the built-in bank, or let the AI write fresh questions on your exact topics.</p></div>
    </div>

    ${state ? quizView() : setupView(p, saved, results)}`;

  state ? (state.done ? wireResult() : wireQuiz()) : wireSetup();
}

/* ------------------------------------------------------------------ setup */
function setupView(p, saved, results) {
  const mySubs = (p?.subjects || []).map((s) => (typeof s === 'string' ? s : s.name));
  return `
  <div class="grid g-2">
    <section class="card card-pad-lg">
      <h2 class="mb-6" style="font-size:1.05rem">Build a quiz</h2>
      <p class="tiny dim mb-20">Built-in questions work offline. AI questions are generated live from your chosen topic.</p>

      <div class="field">
        <label>Question source</label>
        <div class="row gap-10" id="sourcePick">
          <button class="option ${source === 'practice' ? 'on' : ''}" data-source="practice">
            <b>📦 Built-in bank</b><span class="tiny dim" style="display:block">Instant, offline, no AI key needed</span>
          </button>
          <button class="option ${source === 'ai' ? 'on' : ''}" data-source="ai">
            <b>✨ AI generated</b><span class="tiny dim" style="display:block">Fresh questions, any topic</span>
          </button>
        </div>
      </div>

      <div class="field">
        <label for="qSubject">Subject</label>
        <select class="select" id="qSubject">
          <option value="">General / mixed</option>
          ${SUBJECTS.map((s) => `<option value="${s.id}" ${s.id === subjectId ? 'selected' : ''}>${s.emoji} ${esc(s.name)}${mySubs.includes(s.name) ? ' ★' : ''}</option>`).join('')}
        </select>
      </div>

      <div class="field" id="topicField" style="${source === 'practice' ? 'display:none' : ''}">
        <label for="qTopic">Specific topic (optional)</label>
        <input class="input" id="qTopic" placeholder="e.g. photosynthesis, TCP vs UDP, derivatives" />
        <div class="hint">Leave blank to use the whole subject.</div>
      </div>

      <div class="field">
        <label for="qCount">Questions: <b id="countVal">${count}</b></label>
        <input type="range" id="qCount" min="3" max="15" step="1" value="${count}" />
      </div>

      <div class="field">
        <label>Difficulty</label>
        <div class="row gap-8" id="diffPick">
          ${['easy', 'medium', 'hard'].map((d) => `<button class="chip ${d === 'medium' ? 'on' : ''}" data-diff="${d}">${d}</button>`).join('')}
        </div>
      </div>

      <button class="btn btn-primary btn-block btn-lg mt-8" id="startBtn">Start quiz</button>
    </section>

    <div class="col gap-20">
      <section class="card card-pad-lg">
        <h2 class="mb-16" style="font-size:1.05rem">Your scores</h2>
        ${results.length ? `<div class="col gap-12">${results.slice(0, 8).map((r) => `
          <div>
            <div class="row-between"><span class="small ellipsis">${esc(r.title)}</span><b class="small ${r.scorePct >= 80 ? 'ok' : r.scorePct >= 50 ? 'warn' : 'bad'}">${Math.round(r.scorePct)}%</b></div>
            ${progressBar(Math.round(r.scorePct), 5)}
          </div>`).join('')}</div>`
          : `<p class="small dim">No attempts yet — your history will appear here.</p>`}
      </section>

      <section class="card card-pad-lg">
        <h2 class="mb-16" style="font-size:1.05rem">Saved quizzes</h2>
        ${saved.length ? `<div class="col gap-8">${saved.map((q) => `
          <div class="row gap-10">
            <div class="grow" style="min-width:0"><b class="small ellipsis" style="display:block">${esc(q.title)}</b><span class="tiny dim">${q.questions?.length || 0} questions · ${q.source || 'practice'}</span></div>
            <button class="btn btn-ghost btn-sm" data-resume="${q.id}">Retake</button>
            <button class="icon-btn sm" data-del="${q.id}" aria-label="Delete">✕</button>
          </div>`).join('')}</div>`
          : `<p class="small dim">Nothing saved yet. AI quizzes you take are stored here automatically.</p>`}
      </section>
    </div>
  </div>`;
}

let difficulty = 'medium';

function wireSetup() {
  $$('[data-source]').forEach((b) => b.addEventListener('click', () => {
    source = b.dataset.source;
    $$('[data-source]').forEach((x) => x.classList.toggle('on', x.dataset.source === source));
    $('#topicField').style.display = source === 'practice' ? 'none' : '';
  }));
  $$('[data-diff]').forEach((b) => b.addEventListener('click', () => {
    difficulty = b.dataset.diff;
    $$('[data-diff]').forEach((x) => x.classList.toggle('on', x.dataset.diff === difficulty));
  }));
  $('#qCount').addEventListener('input', (e) => { count = Number(e.target.value); $('#countVal').textContent = count; });
  $('#qSubject').addEventListener('change', (e) => { subjectId = e.target.value; });

  $('#startBtn').addEventListener('click', start);

  $$('[data-resume]').forEach((b) => b.addEventListener('click', async () => {
    const q = await quizzes.get(b.dataset.resume);
    if (q?.questions?.length) {
      state = { questions: q.questions, answers: new Array(q.questions.length).fill(null), index: 0, startAt: Date.now(), title: q.title, source: q.source };
      render();
    }
  }));
  $$('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    await quizzes.remove(b.dataset.del);
    toast('Quiz deleted.', 'info');
    render();
  }));
}

/* ------------------------------------------------------------------- start */
async function start() {
  const btn = $('#startBtn');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner spinner-sm"></span> Preparing questions…';

  try {
    const subjectName = subjectId ? SUBJECTS_BY_ID[subjectId]?.name : '';
    let questions = [];

    if (source === 'practice') {
      questions = buildBuiltinQuiz(subjectId, { count, difficulty }).questions;
      if (!questions.length) throw new Error('No built-in questions match that filter. Try another subject or difficulty.');
    } else {
      const topic = $('#qTopic')?.value.trim();
      const student = await profile.aiContext();
      const raw = await withAI(
        () => ai.quiz({ prompt: topic || subjectName || 'general science and mathematics', student, count, difficulty, subject: subjectName, subjectId, stream: false }),
        { loadingText: 'writing your quiz' },
      );
      questions = normalise(raw, topic || subjectName || 'Mixed topics');
      if (!questions.length) throw new Error('The AI did not return usable questions. Try again.');
      await quizzes.save({ title: `${topic || subjectName || 'AI quiz'}`, subjectId: subjectId || null, questions, source: 'ai' });
    }

    state = { questions, answers: new Array(questions.length).fill(null), index: 0, startAt: Date.now(), title: subjectName || 'Practice quiz', source };
    btn.innerHTML = original;
    btn.disabled = false;
    render();
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = original;
    toast(err.message || 'Could not build the quiz.', 'error', 6000);
  }
}

function normalise(raw, title) {
  let data = raw;
  if (typeof raw === 'string') {
    const m = raw.match(/\{[\s\S]*\}/);
    try { data = m ? JSON.parse(m[0]) : null; } catch { return []; }
  }
  if (!data) return [];
  const list = Array.isArray(data) ? data : data.questions || data.items || [];
  return list
    .map((q) => ({
      q: String(q.question || q.text || q.prompt || '').trim(),
      options: (q.options || q.choices || []).map(String),
      answer: Number(q.answer ?? q.correct ?? q.correctIndex ?? 0),
      why: String(q.why || q.explanation || '').trim(),
    }))
    .filter((q) => q.q && q.options.length >= 2 && q.answer >= 0 && q.answer < q.options.length)
    .slice(0, 20);
}

/* ------------------------------------------------------------------- quiz */
function quizView() {
  const { questions, index, answers, done } = state;
  if (done) return resultView();
  const q = questions[index];
  const answered = answers.filter((a) => a !== null).length;
  const pct = Math.round((answered / questions.length) * 100);

  return `
  <div class="quiz-wrap">
    <div class="card card-pad-lg">
      <div class="row-between mb-16">
        <div><b>${esc(state.title)}</b><span class="tiny dim" style="display:block">Question ${index + 1} of ${questions.length}</span></div>
        <button class="btn btn-ghost btn-sm" id="quit">Exit</button>
      </div>
      <div class="mb-20">${progressBar(pct, 6)}</div>

      <h2 class="quiz-q">${esc(q.q)}</h2>
      <div class="col gap-10 mt-20" id="options">
        ${q.options.map((o, i) => {
          const chosen = answers[index] === i;
          return `<button class="option ${chosen ? 'on' : ''}" data-opt="${i}">
            <span class="opt-key">${String.fromCharCode(65 + i)}</span>
            <span class="grow" style="text-align:left">${esc(o)}</span>
          </button>`;
        }).join('')}
      </div>

      <div class="row-between mt-32 row-wrap gap-10">
        <button class="btn btn-ghost" id="prev" ${index === 0 ? 'disabled' : ''}>← Back</button>
        <div class="row gap-10">
          <button class="btn btn-ghost" id="skip">Skip</button>
          ${index === questions.length - 1
            ? '<button class="btn btn-primary" id="finish">Finish quiz</button>'
            : '<button class="btn btn-primary" id="next">Next →</button>'}
        </div>
      </div>
    </div>
  </div>`;
}

function wireQuiz() {
  const { questions, index } = state;

  $$('#options [data-opt]').forEach((b) => b.addEventListener('click', () => {
    state.answers[index] = Number(b.dataset.opt);
    render();
  }));
  $('#prev')?.addEventListener('click', () => { state.index = Math.max(0, state.index - 1); render(); });
  $('#next')?.addEventListener('click', () => { state.index = Math.min(questions.length - 1, state.index + 1); render(); });
  $('#skip')?.addEventListener('click', () => { state.index = Math.min(questions.length - 1, state.index + 1); render(); });
  $('#quit')?.addEventListener('click', async () => {
    if (!confirm('Leave this quiz? Your answers will not be saved.')) return;
    state = null;
    render();
  });
  $('#finish')?.addEventListener('click', finish);
}

async function finish() {
  const { questions, answers, title, startAt } = state;
  const correct = answers.reduce((n, a, i) => n + (a === questions[i].answer ? 1 : 0), 0);
  const pct = Math.round((correct / questions.length) * 100);
  const minutes = Math.max(1, Math.round((Date.now() - startAt) / 60000));

  await quizResults.add({ title, total: questions.length, correctCount: correct, scorePct: pct, durationSec: Math.round((Date.now() - startAt) / 1000) });
  await studySessions.add({ minutes, subjectId: subjectId || null, source: 'quiz' });

  state = { ...state, done: true, result: { correct, total: questions.length, pct, minutes } };
  render();
}

/* ---------------------------------------------------------------- results */
function resultView() {
  const { questions, answers, result } = state;
  const { pct, correct, total, minutes } = result;
  const verdict = pct >= 80 ? 'Excellent work — this topic is solid.' : pct >= 50 ? 'Decent. Review the ones you missed.' : 'Worth another pass. Ask the AI to explain the weak spots.';

  return `
  <div class="col gap-20" id="resultCard">
    <div class="card card-pad-lg center">
      <div class="result-ring" style="--pct:${pct}">${pct}%</div>
      <h2 class="mt-20" style="font-size:1.3rem">${esc(state.title)}</h2>
      <p class="muted small mt-6">${correct} of ${total} correct · ${minutes} min</p>
      <p class="small mt-12" style="max-width:44ch;margin-inline:auto">${verdict}</p>
      <div class="row gap-10 mt-24" style="justify-content:center">
        <button class="btn btn-primary" id="again">Retake</button>
        <button class="btn btn-ghost" id="reviewWrong">Review answers</button>
        <button class="btn btn-ghost" id="askAI">Ask AI to explain mistakes</button>
        <button class="btn btn-ghost" id="doneBtn">Done</button>
      </div>
    </div>

    <div class="card card-pad-lg">
      <h3 class="mb-16" style="font-size:1rem">Answer review</h3>
      <div class="col gap-16" id="reviewList">
        ${questions.map((q, i) => {
          const chosen = answers[i];
          const ok = chosen === q.answer;
          return `<div class="review-item ${ok ? 'ok' : 'bad'}">
            <div class="row gap-10" style="align-items:flex-start">
              <span class="review-mark">${ok ? '✓' : '✕'}</span>
              <div class="grow">
                <b class="small">${i + 1}. ${esc(q.q)}</b>
                <div class="tiny mt-6 ${ok ? 'ok' : 'bad'}">${ok ? 'Correct' : `You chose: ${esc(q.options[chosen] ?? 'nothing')}`}</div>
                ${!ok ? `<div class="tiny ok mt-2">Correct: ${esc(q.options[q.answer])}</div>` : ''}
                ${q.why ? `<div class="tiny dim mt-6">${esc(q.why)}</div>` : ''}
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>
  </div>`;
}

function wireResult() {
  const start = () => { state = null; render(); };
  $('#again')?.addEventListener('click', start);
  $('#doneBtn')?.addEventListener('click', start);
  $('#reviewWrong')?.addEventListener('click', () => {
    $('#reviewList').scrollIntoView({ behavior: 'smooth' });
  });
  $('#askAI')?.addEventListener('click', async () => {
    const wrong = state.questions
      .map((q, i) => ({ q, chosen: state.answers[i] }))
      .filter(({ q, chosen }) => chosen !== q.answer)
      .map(({ q, chosen }) => `Q: ${q.q}\nI answered: ${q.options[chosen] ?? 'skipped'}\nCorrect: ${q.options[q.answer]}`);
    if (!wrong.length) { toast('You got everything right — nothing to review.', 'success'); return; }
    sessionStorage.setItem('edunova.prompt', `I got these wrong in a quiz. Explain what I misunderstood and why the right answer is right:\n\n${wrong.join('\n\n')}`);
    location.href = '/ai-tutor.html';
  });
}

loadPage(render, 'your quizzes');
