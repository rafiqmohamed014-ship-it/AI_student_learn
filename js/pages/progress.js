import { guard, mountApp, loadPage, pageRoot } from '../shell.js';
import { $, esc, toast, fmtMinutes, emptyState, progressBar } from '../ui.js';
import { lineChart, barChart, heatmap, donut, legend, animateCharts, sparkline } from '../charts.js';
import { SUBJECTS_BY_ID } from '../data/curriculum.js';
import { studySessions, quizResults, subjects, lessonProgress, profile } from '../store.js';
import { ai, withAI } from '../ai.js';

await guard();
await mountApp({ title: 'Progress' });

async function render() {
  const stats = await studySessions.stats();
  const results = await quizResults.list({ limit: 100 });
  const subs = await subjects.list();
  const p = await profile.get();
  const done = await lessonProgress.countDone();

  const bySubject = subs.map((s) => ({ label: s.emoji + ' ' + s.name.split(' ')[0], value: s.progress?.pct || 0 })).filter((s) => s.value > 0);
  const last14 = stats.days?.slice(-14) || [];
  const recs = await buildRecommendations({ stats, results, subs, done, p });

  pageRoot().innerHTML = `
    <div class="page-head">
      <div><h1>Progress</h1><p class="muted small mt-4">Your study habits, quiz trends and what to focus on next.</p></div>
      <button class="btn btn-ghost" id="logBtn">＋ Log study time</button>
    </div>

    <div class="grid g-4 stat-grid">
      <div class="stat-card"><div class="stat-ico">🔥</div><div class="stat-val">${stats.streak || 0}</div><div class="stat-lbl accent">Day streak</div></div>
      <div class="stat-card"><div class="stat-ico">⏱️</div><div class="stat-val">${fmtMinutes(stats.total)}</div><div class="stat-lbl">Total studied</div></div>
      <div class="stat-card"><div class="stat-ico">📅</div><div class="stat-val">${fmtMinutes(stats.week)}</div><div class="stat-lbl">This week</div></div>
      <div class="stat-card"><div class="stat-ico">🎯</div><div class="stat-val">${stats.avgPerDay || 0}m</div><div class="stat-lbl">Daily average</div></div>
    </div>

    <div class="grid g-2 mt-24">
      <section class="card card-pad-lg">
        <h2 class="mb-20" style="font-size:1.05rem">Last 14 days</h2>
        <div id="lineChart"></div>
      </section>
      <section class="card card-pad-lg">
        <h2 class="mb-20" style="font-size:1.05rem">Consistency</h2>
        <div class="row gap-20 wrap">
          <div id="heatmap"></div>
          <div class="col gap-8" style="justify-content:center">
            <div><b class="small">${stats.activeDays || 0}</b><span class="tiny dim" style="display:block">active days</span></div>
            <div><b class="small">${stats.bestStreak || 0}</b><span class="tiny dim" style="display:block">best streak</span></div>
          </div>
        </div>
      </section>
    </div>

    <div class="grid g-2 mt-24">
      <section class="card card-pad-lg">
        <h2 class="mb-20" style="font-size:1.05rem">Quiz performance</h2>
        ${results.length ? `
          <div class="row gap-16 mb-20">
            <div><b style="font-size:1.6rem">${Math.round(results.reduce((s, r) => s + (r.scorePct || 0), 0) / results.length)}%</b><span class="tiny dim" style="display:block">average</span></div>
            <div><b style="font-size:1.6rem">${Math.max(...results.map((r) => r.scorePct || 0))}%</b><span class="tiny dim" style="display:block">best</span></div>
            <div><b style="font-size:1.6rem">${results.length}</b><span class="tiny dim" style="display:block">attempts</span></div>
          </div>
          <div id="barChart"></div>`
          : emptyState('No quiz data yet', 'Take a quiz to start building your performance picture.', 'Take a quiz', '/quiz.html')}
      </section>

      <section class="card card-pad-lg">
        <h2 class="mb-20" style="font-size:1.05rem">Subject completion</h2>
        ${bySubject.length ? `<div class="row gap-20 wrap">
            <div id="donut"></div>
            <div class="grow col gap-10">${bySubject.map((s) => `
              <div>
                <div class="row-between"><span class="small">${esc(s.label)}</span><span class="tiny dim">${s.value}%</span></div>
                ${progressBar(s.value, 5)}
              </div>`).join('')}</div>
          </div>`
          : `<p class="small dim">Start a lesson to see subject-level progress.</p>`}
      </section>
    </div>

    <section class="card card-pad-lg mt-24 ai-card">
      <div class="row gap-12 mb-16">
        <div class="ai-face live" style="--fs:38px"><span class="ai-face-eyes"></span></div>
        <div class="grow"><b>Recommended next steps</b><p class="tiny dim">Based on your streak, scores and unfinished lessons</p></div>
        <button class="btn btn-ghost btn-sm" id="refreshRecs">Refresh</button>
      </div>
      <div class="col gap-10" id="recs">${recs.map((r) => `
        <div class="suggest static">
          <span class="icon-box plain">${r.icon}</span>
          <span class="grow"><b class="small">${esc(r.title)}</b><span class="tiny dim" style="display:block">${esc(r.detail)}</span></span>
          <a class="btn btn-ghost btn-sm" href="${r.href}">Go</a>
        </div>`).join('')}</div>
    </section>`;

  /* charts */
  const line = document.getElementById('lineChart');
  if (line) line.innerHTML = lineChart(last14.map((d) => d.minutes || 0), { labels: last14.map((d) => new Date(d.date).toLocaleDateString(undefined, { weekday: 'short' })) });

  const hm = document.getElementById('heatmap');
  if (hm) hm.innerHTML = heatmap((stats.days || []).slice(-84), { cell: 12, gap: 3 });

  const bar = document.getElementById('barChart');
  if (bar) bar.innerHTML = barChart(results.slice(-8).reverse().map((r) => ({ label: r.title?.slice(0, 8) || 'Quiz', value: Math.round(r.scorePct || 0) })), { max: 100, suffix: '%' });

  const dn = document.getElementById('donut');
  if (dn) {
    const palette = ['#ff7a00', '#ff9d2e', '#22d3ee', '#a78bfa', '#f472b6', '#34d399', '#facc15', '#60a5fa', '#fb7185'];
    const segs = bySubject.map((s, i) => ({ label: s.label, value: s.value, color: palette[i % palette.length] }));
    dn.innerHTML = donut(segs, { size: 150, thickness: 17, centerTop: `${subs.filter((s) => (s.progress?.pct || 0) > 0).length}`, centerSub: 'subjects' }) + legend(segs);
  }
  animateCharts(pageRoot());

  $('#logBtn').addEventListener('click', async () => {
    const mins = Number(prompt('How many minutes did you study?', '30'));
    if (!mins || mins < 0) return;
    await studySessions.add({ minutes: mins, source: 'manual' });
    toast(`${mins} minutes logged.`, 'success');
    render();
  });
  $('#refreshRecs').addEventListener('click', () => render());
}

async function buildRecommendations({ stats, results, subs, done, p }) {
  const out = [];

  if (!done) out.push({ icon: '🚀', title: 'Finish your first lesson', detail: 'Even one lesson unlocks tailored AI answers.', href: '/subjects.html' });

  const weakest = [...subs].filter((s) => (s.progress?.pct || 0) > 0).sort((a, b) => a.progress.pct - b.progress.pct)[0];
  if (weakest) out.push({ icon: '🎯', title: `Revise ${weakest.name}`, detail: `Only ${weakest.progress.pct}% complete — this is your biggest gap.`, href: `/subject.html?id=${weakest.id}` });

  if (results.length >= 3) {
    const worst = [...results].sort((a, b) => (a.scorePct || 0) - (b.scorePct || 0))[0];
    if ((worst.scorePct || 0) < 60) out.push({ icon: '🔁', title: 'Redo a weak quiz', detail: `“${worst.title}” scored ${Math.round(worst.scorePct)}%. Ask the AI what went wrong.`, href: '/quiz.html' });
  }

  if (!stats.streak) out.push({ icon: '🔥', title: 'Start a streak today', detail: 'Fifteen focused minutes is enough to begin.', href: '/ai-tutor.html' });
  else if (stats.streak >= 3) out.push({ icon: '🔥', title: `Keep the ${stats.streak}-day streak alive`, detail: 'Consistency beats intensity. Short session today.', href: '/ai-tutor.html' });

  if (!out.length) out.push({ icon: '✅', title: 'Everything is on track', detail: 'Try generating a study plan for the next two weeks.', href: '/study-plan.html' });

  try {
    const student = await profile.aiContext();
    const raw = await withAI(
      () => ai.recommendations({
        student,
        stats: {
          overall: stats.overall,
          streak: stats.streak,
          minutes7: stats.week,
          quizAvg: stats.quizAvg,
          lessonsDone: done,
          subjects: stats.subjectMap,
          weakTopics: stats.weakTopics,
        },
      }),
      { silent: true },
    );
    const parsed = typeof raw === 'string' ? JSON.parse(raw.match(/\{[\s\S]*\}/)?.[0] || 'null') : raw;
    const list = parsed?.recommendations
      || (Array.isArray(parsed) ? parsed : null)
      || (parsed?.headline ? [parsed] : null)
      || [];
    list.slice(0, 3).forEach((r) => {
      if (r?.title || r?.nextLesson) {
        out.push({
          icon: '🤖',
          title: r.title || r.nextLesson,
          detail: r.detail || r.studyTip || r.headline || 'Suggested by your AI tutor.',
          href: r.href || '/ai-tutor.html',
        });
      }
    });
  } catch { /* the offline rules above are enough on their own */ }

  return out.slice(0, 5);
}

loadPage(render, 'your progress');
