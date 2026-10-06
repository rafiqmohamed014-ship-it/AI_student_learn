import { guard, mountApp, loadPage, pageRoot } from '../shell.js';
import { $, $$, esc, toast, progressBar, ring, emptyState, fmtMinutes, md } from '../ui.js';
import { SUBJECTS_BY_ID, LESSONS_BY_ID, lessonsFor } from '../data/curriculum.js';
import { subjects, lessons, notes, quizzes, studySessions } from '../store.js';
import { ai } from '../ai.js';

await guard();
await mountApp({ title: 'Subject' });

const params = new URLSearchParams(location.search);
const subjectId = params.get('id');
const lessonId = params.get('lesson');

if (!subjectId) location.replace('/subjects.html');

/** Trims a lesson title so a button label can never blow out the layout. */
const clip = (text, max) => {
  const t = String(text || '');
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/** Re-renders whichever view is currently on screen. */
function render() {
  return loadPage(
    () => (lessonId ? renderLesson(lessonId) : renderSubject(subjectId)),
    'this subject',
  );
}

render();

/* --------------------------------------------------------- subject view */
async function renderSubject(id) {
  const custom = id.startsWith('custom-') ? await subjects.get(id) : null;
  const base = SUBJECTS_BY_ID[id] || custom;
  if (!base) { location.replace('/404.html'); return; }

  const all = await lessons.list(id);
  const study = all.filter((l) => l.completed);
  const active = all.find((l) => !l.completed) || all[0];
  const pct = all.length ? Math.round((study.length / all.length) * 100) : 0;
  const myNotes = await notes.list({ subjectId: id });
  const myQuizzes = await quizzes.list({ subjectId: id });

  document.title = `${base.name} · Kalvi AI`;

  pageRoot().innerHTML = `
    <nav class="crumbs"><a href="/subjects.html">Subjects</a> <span>/</span> <b>${esc(base.name)}</b></nav>

    <div class="card card-pad-lg mb-24 subject-hero">
      <div class="icon-box icon-box-lg" style="background:${base.color}22;color:${base.color}">${base.emoji}</div>
      <div class="grow">
        <h1 style="font-size:1.5rem">${esc(base.name)}</h1>
        <p class="muted small mt-4" style="max-width:60ch">${esc(base.description || '')}</p>
        <div class="row-wrap gap-8 mt-16">
          ${(base.topics || []).map((t) => `<span class="chip-soft">${esc(t)}</span>`).join('')}
        </div>
      </div>
      <div class="center">
        ${ring(pct, 110, 10, `${pct}%`, 'done')}
      </div>
    </div>

    <div class="row gap-10 mb-24 row-wrap">
      ${active ? `<a class="btn btn-primary" href="/subject.html?id=${id}&lesson=${active.id}">${study.length ? '▶ Continue' : '▶ Start'} “${esc(clip(active.title, 38))}”</a>` : ''}
      <button class="btn btn-ghost" data-ai-lesson>✨ Ask AI about ${esc(base.name)}</button>
      <a class="btn btn-ghost" href="/quiz.html?subject=${id}">📝 Quiz</a>
      <a class="btn btn-ghost" href="/notes.html?subject=${id}">📓 Notes (${myNotes.length})</a>
      ${myQuizzes.length ? `<a class="btn btn-ghost" href="/quiz.html?subject=${id}">♻️ Retake (${myQuizzes.length})</a>` : ''}
    </div>

    <div class="grid g-2">
      <section class="card card-pad-lg">
        <h2 class="mb-20" style="font-size:1.05rem">Lessons <span class="chip-soft">${all.length}</span></h2>
        ${all.length ? `<ul class="lesson-list">${all.map((l, i) => `
          <li>
            <a class="lesson-row ${l.completed ? 'done' : ''}" href="/subject.html?id=${id}&lesson=${l.id}">
              <span class="lesson-num">${l.completed ? '✓' : i + 1}</span>
              <span class="grow">
                <b class="small">${esc(l.title)}</b>
                <span class="tiny dim" style="display:block">${esc(l.summary || '')}</span>
              </span>
              <span class="tiny dim nowrap">${l.minutes} min</span>
            </a>
          </li>`).join('')}</ul>`
          : emptyState('No lessons yet', 'Add your own lesson below, or ask the AI to explain a topic.')}
        <div class="row gap-10 mt-20 row-wrap">
          <input class="input grow" id="newLesson" placeholder="Add your own lesson title…" />
          <button class="btn btn-ghost" id="addLesson">Add</button>
        </div>
      </section>

      <div class="col gap-20">
        <section class="card card-pad-lg">
          <h2 class="mb-16" style="font-size:1.05rem">Recent notes</h2>
          ${myNotes.length ? `<div class="col gap-10">${myNotes.slice(0, 4).map((n) => `
            <a class="note-mini" href="/notes.html?note=${n.id}">
              <b class="small">${esc(n.title)}</b>
              <span class="tiny dim">${esc((n.content || '').slice(0, 70))}…</span>
            </a>`).join('')}</div>`
            : `<p class="small dim">No notes yet. Add one while you study — the AI can summarise it later.</p>`}
        </section>

        <section class="card card-pad-lg">
          <h2 class="mb-12" style="font-size:1.05rem">Ask the AI</h2>
          <div class="col gap-8">
            ${[`Explain the hardest idea in ${base.name} simply`, `Give me 5 practice questions on ${base.name}`, `What should I revise first in ${base.name}?`].map((q) =>
              `<button class="suggest" data-ask="${esc(q)}"><span class="grow" style="text-align:left"><span class="small">${esc(q)}</span></span><span class="link tiny">Ask →</span></button>`).join('')}
          </div>
        </section>
      </div>
    </div>`;

  $('[data-ai-lesson]').addEventListener('click', () => {
    sessionStorage.setItem('edunova.prompt', `Give me a clear overview of ${base.name} and where students usually struggle.`);
    location.href = '/ai-tutor.html';
  });
  $$('[data-ask]').forEach((b) => b.addEventListener('click', () => {
    sessionStorage.setItem('edunova.prompt', b.dataset.ask);
    location.href = '/ai-tutor.html';
  }));
  $('#addLesson').addEventListener('click', async () => {
    const title = $('#newLesson').value.trim();
    if (!title) return;
    await lessons.add({ subjectId: id, title, summary: 'Added by you.' });
    $('#newLesson').value = '';
    toast('Lesson added.', 'success');
    render();
  });
}

/* ---------------------------------------------------------- lesson view */
async function renderLesson(id) {
  const lesson = await lessons.get(id);
  if (!lesson) { location.replace('/404.html'); return; }
  const base = SUBJECTS_BY_ID[lesson.subjectId] || (await subjects.get(lesson.subjectId));
  const siblings = lessonsFor(lesson.subjectId);
  const idx = siblings.findIndex((l) => l.id === id);
  const prev = siblings[idx - 1];
  const next = siblings[idx + 1];

  document.title = `${lesson.title} · Kalvi AI`;

  pageRoot().innerHTML = `
    <nav class="crumbs"><a href="/subjects.html">Subjects</a> <span>/</span> <a href="/subject.html?id=${lesson.subjectId}">${esc(base?.name || 'Subject')}</a> <span>/</span> <b>${esc(lesson.title)}</b></nav>

    <div class="lesson-layout">
      <article class="card card-pad-lg lesson-body">
        <div class="row gap-8 mb-16 row-wrap">
          <span class="chip-soft">${base?.emoji || '📘'} ${esc(base?.name || '')}</span>
          <span class="chip-soft">⏱ ${lesson.minutes} min</span>
          <span class="chip-soft">📶 ${esc(lesson.difficulty || 'intermediate')}</span>
        </div>
        <h1 style="font-size:1.7rem">${esc(lesson.title)}</h1>
        <p class="muted mt-8">${esc(lesson.summary || '')}</p>
        <hr class="divider my-24" />
        <div class="prose">${md(lesson.content || '_No written content for this lesson yet. Use “Explain this lesson” below to get one._')}</div>

        <div class="row-between mt-32 row-wrap gap-12">
          ${prev ? `<a class="btn btn-ghost" href="/subject.html?id=${lesson.subjectId}&lesson=${prev.id}">← ${esc(clip(prev.title, 30))}</a>` : '<span></span>'}
          <button class="btn ${lesson.completed ? 'btn-ghost' : 'btn-primary'}" id="completeBtn">
            ${lesson.completed ? '✓ Completed' : 'Mark as complete'}
          </button>
          ${next ? `<a class="btn btn-ghost" href="/subject.html?id=${lesson.subjectId}&lesson=${next.id}">${esc(clip(next.title, 30))} →</a>` : '<span></span>'}
        </div>
      </article>

      <aside class="col gap-20">
        <section class="card card-pad-lg ai-card">
          <div class="row gap-10 mb-12">
            <div class="ai-face live" style="--fs:34px"><span class="ai-face-eyes"></span></div>
            <b class="small">Confused? Ask the AI</b>
          </div>
          <div class="col gap-8" id="lessonActions">
            <button class="btn btn-primary btn-block" data-action="simplify">Explain this in simpler terms</button>
            <button class="btn btn-ghost btn-block" data-action="example">Give me a worked example</button>
            <button class="btn btn-ghost btn-block" data-action="quiz">Quiz me on this lesson (5 Qs)</button>
            <button class="btn btn-ghost btn-block" data-action="flashcards">Make 8 flashcards from this</button>
          </div>
          <div id="lessonAI" class="mt-16"></div>
        </section>

        <section class="card card-pad-lg">
          <h3 class="mb-12" style="font-size:1rem">In this subject</h3>
          <ul class="lesson-list compact">${siblings.map((l, i) => `
            <li><a class="lesson-row ${l.id === id ? 'active' : ''} ${l.completed ? 'done' : ''}" href="/subject.html?id=${lesson.subjectId}&lesson=${l.id}">
              <span class="lesson-num">${l.completed ? '✓' : i + 1}</span><span class="grow small">${esc(l.title)}</span></a></li>`).join('')}</ul>
        </section>
      </aside>
    </div>`;

  $('#completeBtn').addEventListener('click', async () => {
    await lessons.setComplete(lesson.id, !lesson.completed);
    if (!lesson.completed) {
      toast('Lesson complete. Nice work.', 'success');
      await studySessions.add({ minutes: lesson.minutes, subjectId: lesson.subjectId, lessonId: lesson.id, source: 'lesson' });
    }
    render();
  });

  $$('#lessonActions [data-action]').forEach((b) => b.addEventListener('click', () => {
    sessionStorage.setItem('edunova.lessonId', lesson.id);
    sessionStorage.setItem('edunova.lessonTitle', lesson.title);
    const prompts = {
      simplify: `Explain “${lesson.title}” again in much simpler language, with a short analogy.`,
      example: `Give me a fully worked example of ${lesson.title}, showing every step.`,
      quiz: `Quiz me with 5 questions on ${lesson.title}. One at a time, and wait for my answer.`,
      flashcards: `Create 8 flashcards from ${lesson.title}.`,
    };
    sessionStorage.setItem('edunova.prompt', prompts[b.dataset.action]);
    sessionStorage.setItem('edunova.mode', b.dataset.action === 'quiz' ? 'quiz' : b.dataset.action === 'flashcards' ? 'flashcards' : 'chat');
    location.href = '/ai-tutor.html';
  }));
}
