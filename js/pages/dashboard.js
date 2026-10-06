import { guard, mountApp, loadPage, pageRoot } from '../shell.js';
import { $, esc, toast, fmtMinutes, emptyState, ring, progressBar, md } from '../ui.js';
import { SUBJECTS_BY_ID, lessonsFor } from '../data/curriculum.js';
import { initStore, profile, subjects, tasks, studySessions, studyPlans, quizResults, notifications, lessonProgress, conversations, auth } from '../store.js';
import { ai, aiHealth } from '../ai.js';

await guard();
await mountApp({ title: 'Dashboard' });

const TASK_TEMPLATES = [
  { title: 'Review today’s flashcards', minutes: 15 },
  { title: 'Watch one lesson and take notes', minutes: 30 },
  { title: 'Run a 10-question quiz', minutes: 20 },
];

function greet() {
  const h = new Date().getHours();
  const part = h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  return part;
}

async function render() {
  const p = await profile.get();
  const settings = await profile.getSettings();
  const allSubjects = await subjects.list();
  const todaysTasks = await tasks.list({ includeDone: false });
  const sessions = await studySessions.list();
  const stats = await studySessions.stats();
  const results = await quizResults.list({ limit: 8 });
  const plan = await studyPlans.latest();
  const done = await lessonProgress.countDone();
  const totalLessons = Object.values(SUBJECTS_BY_ID).reduce((n, s) => n + lessonsFor(s.id).length, 0);
  const health = await aiHealth();
  const convos = await conversations.list();

  const firstName = (p?.fullName || 'there').split(' ')[0];
  const aiHello = ai.getGreeting(p, { streak: stats.streak, mode: 'chat' });

  pageRoot().innerHTML = `
    <div class="page-head">
      <div>
        <span class="eyebrow">${greet()}, ${esc(firstName)}</span>
        <h1 style="margin:8px 0 6px">${esc(p?.studyGoal || 'Let’s keep your momentum going.')}</h1>
        <p class="muted small">${stats.today ? `You have studied ${fmtMinutes(stats.today)} today.` : 'No study time logged today — even 15 minutes counts.'}</p>
      </div>
      <div class="row gap-10">
        <a class="btn btn-ghost" href="/study-plan.html">📅 Study plan</a>
        <a class="btn btn-primary" href="/ai-tutor.html">✨ Ask AI tutor</a>
      </div>
    </div>

    <div class="grid g-4 stat-grid">
      ${statCard('🔥', stats.streak || 0, stats.streak === 1 ? 'Day streak' : 'Day streak', 'streak')}
      ${statCard('⏱️', fmtMinutes(stats.week), 'This week', 'neutral')}
      ${statCard('✅', `${done}/${totalLessons}`, 'Lessons done', 'neutral')}
      ${statCard('🏆', results.length ? `${Math.round(results.reduce((s, r) => s + (r.scorePct || 0), 0) / results.length)}%` : '—', 'Avg quiz score', 'neutral')}
    </div>

    <div class="grid dash-grid mt-24">
      <div class="col gap-20">
        <section class="card card-pad-lg">
          <div class="row-between mb-20">
            <h2 style="font-size:1.05rem">Today's focus</h2>
            <span class="chip-soft">${todaysTasks.length} task${todaysTasks.length === 1 ? '' : 's'}</span>
          </div>
          ${todaysTasks.length ? `<ul class="task-list">${todaysTasks.map((t) => `
            <li class="task" data-task="${t.id}">
              <button class="task-check" data-toggle-task="${t.id}" aria-label="Mark complete"></button>
              <div class="grow"><div class="strong small">${esc(t.title)}</div>
                <div class="tiny dim">${t.minutes || 15} min${t.subjectName ? ` · ${esc(t.subjectName)}` : ''}</div></div>
              <button class="icon-btn sm" data-del-task="${t.id}" aria-label="Delete">✕</button>
            </li>`).join('')}</ul>`
            : `<div class="stack gap-12">
                ${TASK_TEMPLATES.map((t, i) => `<button class="suggest" data-add-task="${i}">
                  <span class="icon-box plain">${['🃏', '📖', '📝'][i]}</span>
                  <span class="grow" style="text-align:left"><b class="small">${t.title}</b><span class="tiny dim" style="display:block">${t.minutes} min</span></span>
                  <span class="btn btn-ghost btn-sm">Add</span>
                </button>`).join('')}
              </div>`}
        </section>

        <section class="card card-pad-lg">
          <div class="row-between mb-20">
            <h2 style="font-size:1.05rem">Continue learning</h2>
            <a class="link" href="/subjects.html">All subjects →</a>
          </div>
          ${allSubjects.length ? `<div class="col gap-12">${allSubjects.slice(0, 4).map((s) => {
            const ls = lessonsFor(s.id);
            const pct = s.progress?.pct || 0;
            return `<a class="subject-row" href="/subject.html?id=${s.id}">
              <div class="icon-box" style="background:${s.color}22;color:${s.color}">${s.emoji}</div>
              <div class="grow">
                <div class="row-between"><b class="small">${esc(s.name)}</b><span class="tiny dim">${pct}%</span></div>
                <div class="mt-8">${progressBar(pct, 6)}</div>
                <div class="tiny dim mt-6">${ls.length} lessons · ${s.progress?.done || 0} complete</div>
              </div>
            </a>`;
          }).join('')}</div>` : emptyState('No subjects yet', 'Add one in Settings to start tracking progress.', 'Add subject', '/settings.html')}
        </section>
      </div>

      <div class="col gap-20">
        <section class="card ai-card card-pad-lg">
          <div class="row gap-12 mb-12">
            <div class="ai-face live" style="--fs:40px"><span class="ai-face-eyes"></span></div>
            <div><b>Ask your AI tutor</b><p class="tiny dim">Calibrated to ${esc(p?.educationLevel || 'your level')}${p?.course ? ` · ${esc(p.course)}` : ''}</p></div>
          </div>
          <p class="small muted" style="margin-bottom:14px">${esc(aiHello)}</p>
          <div class="row-wrap gap-8 mb-16">
            ${['Explain a hard concept simply', 'Quiz me on this week’s topic', 'Make me a 3-day revision plan'].map((q) => `<button class="chip" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}
          </div>
          <a class="btn btn-primary btn-block" href="/ai-tutor.html">Open AI tutor</a>
          ${health.configured === false ? `<p class="tiny dim center mt-12">${health.reason || 'AI key not configured'}</p>` : ''}
        </section>

        <section class="card card-pad-lg center">
          ${ring(Math.round((done / Math.max(1, totalLessons)) * 100), 132, 12, `${Math.round((done / Math.max(1, totalLessons)) * 100)}%`, 'lessons')}
          <h3 class="mt-16" style="font-size:1rem">Overall progress</h3>
          <p class="tiny dim">${done} of ${totalLessons} built-in lessons completed</p>
        </section>

        <section class="card card-pad-lg">
          <div class="row-between mb-16"><h2 style="font-size:1.05rem">Recent quizzes</h2><a class="link" href="/quiz.html">All →</a></div>
          ${results.length ? `<div class="col gap-10">${results.slice(0, 5).map((r) => `
            <div class="row gap-10">
              <div class="score-pill ${r.scorePct >= 80 ? 'good' : r.scorePct >= 50 ? 'mid' : 'bad'}">${Math.round(r.scorePct || 0)}%</div>
              <div class="grow" style="min-width:0"><div class="small strong ellipsis">${esc(r.title || 'Quiz')}</div><div class="tiny dim">${r.correctCount}/${r.total} correct</div></div>
            </div>`).join('')}</div>`
            : `<p class="small dim center">No quizzes yet. <a class="link" href="/quiz.html">Take your first one.</a></p>`}
        </section>

        ${plan ? `<section class="card card-pad-lg">
          <div class="row-between mb-12"><h2 style="font-size:1.05rem">Study plan</h2><a class="link" href="/study-plan.html">Open →</a></div>
          <p class="small muted">${esc(plan.goal || 'Your current plan')}</p>
          <div class="tiny dim mt-8">${(plan.days || []).length} days · created ${new Date(plan.createdAt).toLocaleDateString()}</div>
        </section>` : ''}
      </div>
    </div>`;

  await notifications.sync();
  wire();
}

function statCard(icon, value, label, tone) {
  return `<div class="stat-card">
    <div class="stat-ico">${icon}</div>
    <div class="stat-val">${value}</div>
    <div class="stat-lbl ${tone === 'streak' ? 'accent' : ''}">${label}</div>
  </div>`;
}

function wire() {
  pageRoot().querySelectorAll('[data-add-task]').forEach((b) => {
    b.addEventListener('click', async () => {
      const t = TASK_TEMPLATES[Number(b.dataset.addTask)];
      await tasks.add({ title: t.title, minutes: t.minutes, dueDate: new Date().toISOString() });
      toast('Task added for today.', 'success');
      render();
    });
  });
  pageRoot().querySelectorAll('[data-toggle-task]').forEach((b) => {
    b.addEventListener('click', async () => { await tasks.toggle(b.dataset.toggleTask); render(); });
  });
  pageRoot().querySelectorAll('[data-del-task]').forEach((b) => {
    b.addEventListener('click', async () => { await tasks.remove(b.dataset.delTask); render(); });
  });
  pageRoot().querySelectorAll('[data-ask]').forEach((b) => {
    b.addEventListener('click', () => {
      sessionStorage.setItem('edunova.prompt', b.dataset.ask);
      location.href = '/ai-tutor.html';
    });
  });
}

loadPage(render, 'your dashboard');
