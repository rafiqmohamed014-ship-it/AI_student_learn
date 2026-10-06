import { guard, mountApp, loadPage, pageRoot } from '../shell.js';
import { $, $$, esc, toast, emptyState, ring, avatarHTML, confirmDialog } from '../ui.js';
import { icon } from '../icons.js';
import { SUBJECTS, SUBJECTS_BY_ID } from '../data/curriculum.js';
import { store, profile, assessments, studySessions } from '../store.js';
import { ai, withAI } from '../ai.js';

await guard();
await mountApp({ title: 'Assessment', key: 'assessment' });

/* ------------------------------------------------------------------ state */
/**
 * one test in flight:
 *   { questions, answers, flagged, index, startedAt, limitSec, deadlineAt, meta, result }
 * `questions` use the server's canonical shape: { question, options, answerIndex, explanation }
 */
let exam = null;
let tickHandle = null;

let subjectId = '';
let difficulty = 'medium';
let count = 10;
let minutes = 0; // 0 = auto
let boardSubject = ''; // '' = all subjects

const LETTERS = 'ABCDEFGH';

/* ==================================================================== page */
async function render() {
  stopTick();
  if (exam) {
    if (exam.result) renderResult();
    else { renderExam(); startTick(); }
    return;
  }
  await renderSetup();
}

/* ================================================================== setup */
async function renderSetup() {
  const mine = await assessments.listMine({ limit: 8 }).catch(() => []);
  const board = await loadBoard();

  pageRoot().innerHTML = `
    <div class="page-head">
      <div>
        <h1>Assessment</h1>
        <p class="muted small mt-4">A timed test of AI-written multiple-choice questions. Answer fast, score high, climb the board.</p>
      </div>
    </div>

    <div class="asm-layout">
      <section class="card card-pad-lg">
        <div class="row-between mb-16">
          <h2 class="mb-0" style="font-size:1.05rem">New assessment</h2>
          <span class="badge badge-orange">${icon('sparkles')} AI questions</span>
        </div>

        <div class="field">
          <label for="aSubject">Subject</label>
          <select class="select" id="aSubject">
            <option value="">Mixed (all subjects)</option>
            ${SUBJECTS.map((s) => `<option value="${s.id}" ${s.id === subjectId ? 'selected' : ''}>${s.emoji} ${esc(s.name)}</option>`).join('')}
          </select>
        </div>

        <div class="field">
          <label for="aTopic">Topic <span class="dim">(optional)</span></label>
          <input class="input" id="aTopic" placeholder="e.g. recursion, TCP vs UDP, integration by parts" />
          <div class="hint">Leave blank to test the whole subject.</div>
        </div>

        <div class="field">
          <label>Difficulty</label>
          <div class="row gap-8" id="aDiff">
            ${['easy', 'medium', 'hard'].map((d) => `
              <button class="chip" aria-pressed="${d === difficulty}" data-diff="${d}">${d}</button>`).join('')}
          </div>
        </div>

        <div class="field">
          <label>Questions</label>
          <div class="row gap-8" id="aCount">
            ${[5, 10, 15].map((n) => `
              <button class="chip" aria-pressed="${n === count}" data-count="${n}">${n}</button>`).join('')}
          </div>
        </div>

        <div class="field">
          <label for="aTime">Time limit</label>
          <select class="select" id="aTime">
            ${timeOptions().map((o) => `<option value="${o.value}" ${o.value === minutes ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}
          </select>
          <div class="hint" id="aTimeHint">${fmtClock(limitFor(count, minutes))} total. The clock runs down and the test submits itself at zero.</div>
        </div>

        <button class="btn btn-primary btn-block btn-lg mt-8" id="aStart">Start assessment</button>
        <p class="tiny dim mt-12">Questions are written fresh by the AI each time, so no two attempts are identical.</p>
      </section>

      <div class="col gap-20">
        ${boardCard(board)}
        ${historyCard(mine)}
      </div>
    </div>`;

  $$('#aDiff [data-diff]').forEach((b) => b.addEventListener('click', () => {
    difficulty = b.dataset.diff;
    $$('#aDiff [data-diff]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  }));
  $$('#aCount [data-count]').forEach((b) => b.addEventListener('click', () => {
    count = Number(b.dataset.count);
    $$('#aCount [data-count]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    const hint = $('#aTimeHint');
    if (hint) hint.textContent = `${fmtClock(limitFor(count, minutes))} total. The clock runs down and the test submits itself at zero.`;
  }));
  $('#aSubject').addEventListener('change', (e) => { subjectId = e.target.value; });
  $('#aTime').addEventListener('change', (e) => { minutes = Number(e.target.value); });
  $('#aStart').addEventListener('click', start);
  wireBoard();
}

/** Time limit options, always offering a sensible default for the count. */
function timeOptions() {
  const auto = limitFor(count, 0);
  const opts = [{ value: 0, label: `Auto (${fmtClock(auto)})` }];
  for (const m of [3, 5, 10, 15, 20]) opts.push({ value: m, label: `${m} minutes` });
  return opts;
}

function limitFor(count, minutes) {
  if (minutes > 0) return minutes * 60;
  return Math.max(120, Math.round(count * 45)); // 45s a question, floor of 2 min
}

function fmtClock(totalSec) {
  const s = Math.max(0, Math.round(Number(totalSec) || 0));
  const m = Math.floor(s / 60);
  return `${m}:${String(s % 60).padStart(2, '0')}`;
}

/* =================================================================== start */
async function start() {
  const btn = $('#aStart');
  const label = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner spinner-sm"></span> Writing your questions…';

  const topic = $('#aTopic')?.value.trim() || '';
  const subjectName = subjectId ? SUBJECTS_BY_ID[subjectId]?.name || '' : '';

  try {
    const student = await profile.aiContext();
    const raw = await withAI(
      () => ai.quiz({
        prompt: topic || subjectName || 'general science and mathematics',
        student,
        count,
        difficulty,
        subject: subjectName || 'Mixed topics',
        subjectId: subjectId || null,
        stream: false,
      }),
      { loadingText: 'writing your questions' },
    );

    const questions = normalise(raw);
    if (!questions.length) throw new Error('The AI did not return usable questions. Try again.');

    const limitSec = limitFor(questions.length, minutes);
    exam = {
      questions,
      answers: new Array(questions.length).fill(null),
      flagged: new Set(),
      index: 0,
      startedAt: Date.now(),
      limitSec,
      deadlineAt: Date.now() + limitSec * 1000,
      meta: {
        title: `${topic || subjectName || 'Mixed topics'} · ${difficulty}`,
        subject: subjectName,
        subjectId: subjectId || null,
        topic: topic || subjectName || 'Mixed topics',
        difficulty,
      },
    };
    render();
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = label;
    toast(err.message || 'Could not start the assessment.', 'error', 6000);
  }
}

/**
 * Canonicalises whatever the AI returned into the server's shape.
 * `answerIndex` is the field that matters; several fallbacks are accepted
 * because models do not always use the exact contract key.
 */
function normalise(raw) {
  let data = raw;
  if (typeof raw === 'string') {
    const m = raw.match(/\{[\s\S]*\}/);
    try { data = m ? JSON.parse(m[0]) : null; } catch { return []; }
  }
  if (!data) return [];
  const list = Array.isArray(data) ? data : data.questions || data.items || [];
  return list
    .map((q) => {
      const options = (q.options || q.choices || []).map((o) => String(o).trim()).filter(Boolean).slice(0, 4);
      const answerIndex = Number(q.answerIndex ?? q.answer_index ?? q.correctIndex ?? q.answer ?? q.correct);
      return {
        question: String(q.question || q.text || q.prompt || '').trim(),
        options,
        answerIndex: Number.isInteger(answerIndex) ? answerIndex : -1,
        explanation: String(q.explanation || q.why || '').trim(),
        topic: String(q.topic || '').trim(),
        difficulty: q.difficulty || difficulty,
      };
    })
    .filter((q) => q.question && q.options.length >= 2 && q.answerIndex >= 0 && q.answerIndex < q.options.length);
}

/* ==================================================================== exam */
function renderExam() {
  const { questions, index, answers, flagged } = exam;
  const q = questions[index];
  const answered = answers.filter((a) => a !== null).length;

  pageRoot().innerHTML = `
    <div class="asm-wrap">
      <div class="quiz-head">
        <span class="timer" id="aClock">${fmtClock(remaining())}</span>
        <div class="quiz-progress">
          <div class="bar-label"><span>${esc(exam.meta.title)}</span><b>${answered}/${questions.length}</b></div>
          <div class="bar"><span style="width:${(answered / questions.length) * 100}%"></span></div>
        </div>
        <button class="btn btn-ghost btn-sm" id="aQuit">Exit</button>
      </div>

      <div class="card q-card">
        <div class="row-between mb-8">
          <span class="q-number">Question ${index + 1} of ${questions.length}</span>
          <button class="chip static ${flagged.has(index) ? 'active' : ''}" id="aFlag">
            ${icon('bookmark')} ${flagged.has(index) ? 'Flagged' : 'Flag for review'}
          </button>
        </div>

        <h2 class="q-text">${esc(q.question)}</h2>

        <div class="options">
          ${q.options.map((o, i) => `
            <button class="opt" aria-pressed="${answers[index] === i}" data-opt="${i}">
              <span class="opt-key">${LETTERS[i]}</span>
              <span class="grow">${esc(o)}</span>
            </button>`).join('')}
        </div>

        <div class="q-nav">
          <button class="btn btn-ghost" id="aPrev" ${index === 0 ? 'disabled' : ''}>${icon('left')} Back</button>
          <div class="row gap-10">
            <button class="btn btn-ghost" id="aSkip">Skip</button>
            ${index === questions.length - 1
              ? '<button class="btn btn-primary" id="aSubmit">Submit assessment</button>'
              : '<button class="btn btn-primary" id="aNext">Next ' + icon('right') + '</button>'}
          </div>
        </div>

        <div class="q-dots">
          ${questions.map((_, i) => `
            <button class="q-dot ${answers[i] !== null ? 'answered' : ''} ${i === index ? 'current' : ''} ${flagged.has(i) ? 'flagged' : ''}"
              data-jump="${i}" aria-label="Go to question ${i + 1}">${i + 1}</button>`).join('')}
        </div>
      </div>
    </div>`;

  $$('#pageRoot [data-opt]').forEach((b) => b.addEventListener('click', () => {
    exam.answers[exam.index] = Number(b.dataset.opt);
    renderExam();
  }));
  $$('#pageRoot [data-jump]').forEach((b) => b.addEventListener('click', () => {
    exam.index = Number(b.dataset.jump);
    renderExam();
  }));
  $('#aPrev')?.addEventListener('click', () => { exam.index = Math.max(0, exam.index - 1); renderExam(); });
  $('#aNext')?.addEventListener('click', () => { exam.index = Math.min(exam.questions.length - 1, exam.index + 1); renderExam(); });
  $('#aSkip')?.addEventListener('click', () => { exam.index = Math.min(exam.questions.length - 1, exam.index + 1); renderExam(); });
  $('#aFlag').addEventListener('click', () => {
    if (exam.flagged.has(exam.index)) exam.flagged.delete(exam.index);
    else exam.flagged.add(exam.index);
    renderExam();
  });
  $('#aSubmit')?.addEventListener('click', () => submit(false));
  $('#aQuit').addEventListener('click', async () => {
    const ok = await confirmDialog('Leave this assessment?', 'Your answers and your place on the leaderboard will be lost. The clock is still running.', {
      danger: true,
      confirmLabel: 'Leave',
    });
    if (ok) { stopTick(); exam = null; render(); }
  });
}

/* ------------------------------------------------------------------- clock */
function remaining() {
  if (!exam) return 0;
  return Math.max(0, Math.round((exam.deadlineAt - Date.now()) / 1000));
}

/**
 * Ticks the clock in place. The exam markup is deliberately NOT re-rendered
 * every second: a full re-render would blow away focus and scroll position
 * mid-question.
 */
function startTick() {
  stopTick();
  tickHandle = setInterval(() => {
    if (!exam || exam.result) return stopTick();
    const left = remaining();
    const el = $('#aClock');
    if (!el) return stopTick();

    el.textContent = fmtClock(left);
    el.classList.toggle('warn', left <= exam.limitSec * 0.25 && left > exam.limitSec * 0.1);
    el.classList.toggle('danger', left <= exam.limitSec * 0.1);

    if (left <= 0) {
      stopTick();
      toast('Time is up — your answers were submitted automatically.', 'warn', 6000);
      submit(true);
    }
  }, 500);
}

function stopTick() {
  if (tickHandle) clearInterval(tickHandle);
  tickHandle = null;
}

// Coming back to a backgrounded tab must not buy extra time.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && exam && !exam.result && remaining() <= 0) {
    stopTick();
    submit(true);
  }
});

/* ================================================================== submit */
async function submit(auto) {
  if (!exam || exam.result) return;
  stopTick();

  const { questions, answers, meta } = exam;
  const correct = answers.reduce((n, a, i) => n + (a === questions[i].answerIndex ? 1 : 0), 0);
  const durationSeconds = Math.min(Math.round((Date.now() - exam.startedAt) / 1000), exam.limitSec);
  const wrongTopics = questions
    .map((q, i) => ({ q, a: answers[i] }))
    .filter(({ q, a }) => a !== q.answerIndex)
    .map(({ q }) => q.topic)
    .filter(Boolean);
  const uniqueWrong = [...new Set(wrongTopics)];

  const result = {
    correct,
    total: questions.length,
    percentage: questions.length ? Math.round((correct / questions.length) * 100) : 0,
    durationSeconds,
    timedOut: auto,
    unanswered: answers.filter((a) => a === null).length,
    wrongTopics: uniqueWrong,
  };

  exam = { ...exam, result };

  try {
    await assessments.save({
      title: meta.title,
      subject: meta.subject,
      subjectId: meta.subjectId,
      topic: meta.topic,
      difficulty: meta.difficulty,
      total: result.total,
      correctCount: result.correct,
      percentage: result.percentage,
      durationSeconds,
      timeLimitSeconds: exam.limitSec,
      answers,
      wrongTopics: uniqueWrong,
    });
    const minutesStudied = Math.max(1, Math.round(durationSeconds / 60));
    await studySessions.add({ minutes: minutesStudied, subjectId: meta.subjectId, source: 'assessment' }).catch(() => {});
  } catch (err) {
    console.error('[assessment] could not save attempt', err);
    toast('Your score is shown, but it could not be saved to the leaderboard.', 'error', 6000);
  }

  renderResult();
}

/* ================================================================= results */
async function renderResult() {
  const { questions, answers, result, meta, limitSec } = exam;
  const board = await loadBoard().catch(() => []);
  const myRow = board.find((r) => r.isMe);
  const verdict = result.timedOut && result.unanswered
    ? `The clock ran out with ${result.unanswered} question${result.unanswered === 1 ? '' : 's'} unanswered.`
    : result.percentage >= 80
      ? 'Excellent work. This topic is solid.'
      : result.percentage >= 50
        ? 'Decent. Review the ones you missed.'
        : 'Worth another pass. Ask the AI to explain the weak spots.';

  pageRoot().innerHTML = `
    <div class="col gap-20">
      <div class="card card-pad-lg result-hero">
        ${ring(result.percentage, { size: 150, label: 'Score' })}
        <h2 class="mt-20" style="font-size:1.3rem">${esc(meta.title)}</h2>
        <p class="muted small mt-6">
          ${result.correct} of ${result.total} correct · ${fmtClock(result.durationSeconds)} of ${fmtClock(limitSec)} used
        </p>
        ${myRow
          ? `<div class="asm-rank mt-16">
               <span class="asm-rank-badge">#${myRow.rank}</span>
               <div><b>Your rank this week</b><div class="tiny dim">on the ${myRow.subject ? esc(myRow.subject) + ' · ' : 'overall '}leaderboard</div></div>
             </div>`
          : `<p class="tiny dim mt-16">Complete an assessment to appear on the leaderboard.</p>`}
        <p class="small mt-12" style="max-width:46ch;margin-inline:auto">${verdict}</p>
        <div class="row gap-10 mt-24" style="justify-content:center;flex-wrap:wrap">
          <button class="btn btn-primary" id="aAgain">New assessment</button>
          <button class="btn btn-ghost" id="aAsk">${icon('sparkles')} Explain my mistakes</button>
          <button class="btn btn-ghost" id="aBoard">See leaderboard</button>
        </div>
      </div>

      ${boardCard(board)}

      <div class="card card-pad-lg">
        <h3 class="mb-16" style="font-size:1rem">Answer review</h3>
        <div class="col gap-12">
          ${questions.map((q, i) => {
            const chosen = answers[i];
            const ok = chosen === q.answerIndex;
            return `<div class="review-item ${ok ? 'ok' : 'bad'}">
              <div class="row gap-10" style="align-items:flex-start">
                <span class="review-mark">${ok ? '✓' : '✕'}</span>
                <div class="grow">
                  <b class="small">${i + 1}. ${esc(q.question)}</b>
                  <div class="tiny mt-6 ${ok ? 'ok' : 'bad'}">
                    ${ok ? 'Correct' : `You chose: ${esc(q.options[chosen] ?? 'nothing')}`}
                  </div>
                  ${!ok ? `<div class="tiny ok mt-2">Correct: ${esc(q.options[q.answerIndex])}</div>` : ''}
                  ${q.explanation ? `<div class="tiny dim mt-6">${esc(q.explanation)}</div>` : ''}
                </div>
              </div>
            </div>`;
          }).join('')}
        </div>
      </div>
    </div>`;

  $('#aAgain').addEventListener('click', () => { exam = null; render(); });
  $('#aBoard').addEventListener('click', () => {
    document.getElementById('asmBoard')?.scrollIntoView({ behavior: 'smooth' });
  });
  $('#aAsk').addEventListener('click', () => {
    const wrong = questions
      .map((q, i) => ({ q, chosen: answers[i] }))
      .filter(({ q, chosen }) => chosen !== q.answerIndex)
      .map(({ q, chosen }) => `Q: ${q.question}\nI answered: ${q.options[chosen] ?? 'skipped'}\nCorrect: ${q.options[q.answerIndex]}`);
    if (!wrong.length) { toast('Full marks — nothing to explain.', 'success'); return; }
    sessionStorage.setItem('edunova.prompt',
      `I scored ${result.correct}/${result.total} on a timed ${meta.title} assessment. Explain what I misunderstood on these:\n\n${wrong.join('\n\n')}`);
    location.href = '/ai-tutor.html';
  });
  wireBoard();
}

/* ============================================================= leaderboard */
async function loadBoard() {
  try {
    return await assessments.leaderboard({ limit: 25, subjectId: boardSubject || null });
  } catch (err) {
    console.error('[assessment] leaderboard failed', err);
    return [];
  }
}

function boardCard(board) {
  const mine = board.find((r) => r.isMe);
  const localNote = store.mode !== 'supabase'
    ? `<div class="hint mt-12">${icon('info')} Only your own attempts are ranked. Connect Supabase to rank against every student.</div>`
    : '';

  const body = board.length
    ? `<div class="table-wrap">
        <table class="tbl">
          <thead>
            <tr><th style="width:44px">#</th><th>Student</th><th>Subject</th><th>Score</th><th>Time</th></tr>
          </thead>
          <tbody>
            ${board.map((r) => `
              <tr class="${r.isMe ? 'me' : ''}">
                <td><span class="asm-rank-no r${r.rank <= 3 ? r.rank : 0}">${r.rank}</span></td>
                <td>
                  <div class="row gap-8">
                    ${avatarHTML(r.name, r.avatarUrl, 'avatar-sm')}
                    <div style="min-width:0">
                      <div class="ellipsis"><b>${esc(r.name)}</b>${r.isMe ? ' <span class="pill accent">you</span>' : ''}</div>
                      <div class="tiny dim">${esc(r.difficulty)} · ${esc(r.topic)}</div>
                    </div>
                  </div>
                </td>
                <td>${r.subject ? esc(r.subject) : '<span class="dim">Mixed</span>'}</td>
                <td>
                  <b class="${r.score >= 80 ? 'ok' : r.score >= 50 ? 'warn' : 'bad'}">${r.score}%</b>
                  <span class="tiny dim"> ${r.correct}/${r.total}</span>
                </td>
                <td class="mono">${fmtClock(r.durationSeconds)}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`
    : emptyState({
        icon: 'trophy',
        title: 'No attempts on the board yet',
        text: 'Finish your first assessment and you will be ranked here straight away.',
      });

  return `
    <section class="card card-pad-lg" id="asmBoard">
      <div class="card-head mb-16">
        <div>
          <h2 class="card-title">${icon('trophy')} Leaderboard</h2>
          <p class="card-sub">Best attempt per student — most correct first, then fastest.</p>
        </div>
      </div>
      <div class="field">
        <label for="aBoardSubject" class="sr-only">Filter by subject</label>
        <select class="select" id="aBoardSubject">
          <option value="" ${boardSubject === '' ? 'selected' : ''}>All subjects</option>
          ${SUBJECTS.map((s) => `<option value="${s.id}" ${s.id === boardSubject ? 'selected' : ''}>${s.emoji} ${esc(s.name)}</option>`).join('')}
        </select>
      </div>
      ${mine ? `<div class="asm-mine">${icon('trophy')} You are ranked <b>#${mine.rank}</b> of ${board.length}${mine.score}% · ${mine.correct}/${mine.total} correct.</div>` : ''}
      ${body}
      ${localNote}
    </section>`;
}

function wireBoard() {
  $('#aBoardSubject')?.addEventListener('change', async (e) => {
    boardSubject = e.target.value;
    const board = await loadBoard();
    const existing = document.getElementById('asmBoard');
    if (!existing) return;
    existing.outerHTML = boardCard(board);
    wireBoard();
  });
}

function historyCard(mine) {
  if (!mine.length) {
    return `<section class="card card-pad-lg">
      <h2 class="card-title mb-12">${icon('clock')} Your attempts</h2>
      <p class="small dim">Nothing yet. Your last five assessments will show up here.</p>
    </section>`;
  }
  const best = mine.reduce((m, a) => (a.percentage > m.percentage ? a : m), mine[0]);
  return `<section class="card card-pad-lg">
    <h2 class="card-title mb-12">${icon('clock')} Your attempts</h2>
    <div class="row gap-16 mb-16" style="flex-wrap:wrap">
      <div><div class="stat-value" style="font-size:1.4rem">${best.percentage}%</div><div class="stat-label">Best score</div></div>
      <div><div class="stat-value" style="font-size:1.4rem">${mine.length}</div><div class="stat-label">Attempts</div></div>
    </div>
    <div class="col gap-10">
      ${mine.slice(0, 5).map((a) => `
        <div class="row-between">
          <div style="min-width:0">
            <div class="ellipsis"><b class="small">${esc(a.title)}</b></div>
            <span class="tiny dim">${esc(a.difficulty)} · ${a.correct}/${a.total} · ${fmtClock(a.durationSeconds)}</span>
          </div>
          <span class="score-pill ${a.percentage >= 80 ? 'good' : a.percentage >= 50 ? 'mid' : 'bad'}">${a.percentage}%</span>
        </div>`).join('')}
    </div>
  </section>`;
}

loadPage(render, 'your assessments');