import { guard, mountApp, loadPage, pageRoot } from '../shell.js';
import { $, $$, esc, toast, confirmDialog, fmtMinutes } from '../ui.js';
import { subjects, studyPlans, studySessions, tasks, profile } from '../store.js';
import { ai, withAI } from '../ai.js';

await guard();
await mountApp({ title: 'Study Plan' });

let form = { goal: '', examDate: '', hoursPerDay: 2, days: 7, subjects: [] };

async function render() {
  // the store returns the saved record, with the plan itself nested under `plan`
  const record = await studyPlans.latest();
  const plan = record?.plan || record || null;
  const p = await profile.get();
  const all = await subjects.list();
  const stats = await studySessions.stats();
  if (!form.goal && p?.studyGoal) form.goal = p.studyGoal;
  if (!form.subjects.length) form.subjects = (p?.subjects || []).map((s) => (typeof s === 'string' ? s : s.name));

  pageRoot().innerHTML = `
    <div class="page-head">
      <div><h1>Study Plan</h1><p class="muted small mt-4">Tell the AI what you are facing and when. You get a day-by-day plan you can actually follow.</p></div>
    </div>

    <div class="grid plan-grid">
      <section class="card card-pad-lg">
        <h2 class="mb-20" style="font-size:1.05rem">Plan settings</h2>

        <div class="field">
          <label for="goal">What are you revising for?</label>
          <input class="input" id="goal" placeholder="e.g. Midterm exam covering all of chapter 4" value="${esc(form.goal)}" />
        </div>

        <div class="grid g-2" style="gap:0 14px">
          <div class="field">
            <label for="examDate">Exam / deadline</label>
            <input class="input" id="examDate" type="date" value="${esc(form.examDate)}" />
          </div>
          <div class="field">
            <label for="hours">Hours per day: <b id="hoursVal">${form.hoursPerDay}</b></label>
            <input type="range" id="hours" min="1" max="8" step="1" value="${form.hoursPerDay}" />
          </div>
        </div>

        <div class="field">
          <label>Subjects to include</label>
          <div class="row-wrap gap-8" id="planSubjects">
            ${all.map((s) => `<button type="button" class="chip ${form.subjects.includes(s.name) ? 'on' : ''}" data-sub="${esc(s.name)}">${s.emoji} ${esc(s.name)}</button>`).join('')}
          </div>
        </div>

        <button class="btn btn-primary btn-block btn-lg mt-8" id="genPlan">✨ Generate my plan</button>
        ${plan ? `<button class="btn btn-ghost btn-block mt-10" id="delPlan">Delete current plan</button>` : ''}
      </section>

      <section id="planOut">${plan ? planView(plan) : placeholder(stats)}</section>
    </div>`;

  wire();
}

function placeholder(stats) {
  return `<div class="card card-pad-lg" style="height:100%;display:grid;place-items:center;text-align:center">
    <div>
      <div class="ai-face" style="--fs:64px;margin:0 auto 16px"><span class="ai-face-eyes"></span></div>
      <h3 style="font-size:1.1rem">No plan yet</h3>
      <p class="muted small mt-8" style="max-width:40ch">You have logged ${fmtMinutes(stats.total)} in total. Fill in the settings and the AI will turn that into a realistic schedule.</p>
    </div>
  </div>`;
}

function planView(plan) {
  const days = plan.days || [];
  return `<div class="col gap-20">
    <div class="card card-pad-lg">
      <div class="row-between mb-12 wrap gap-10">
        <div><b>${esc(plan.goal || 'Study plan')}</b><p class="tiny dim">${days.length} days${plan.subjects?.length ? ` · ${esc(plan.subjects.join(', '))}` : ''}</p></div>
        <div class="row gap-8">
          <button class="btn btn-ghost btn-sm" id="addTasks">Add all to tasks</button>
          <button class="btn btn-ghost btn-sm" id="exportPlan">Export .txt</button>
        </div>
      </div>
      ${plan.notes ? `<div class="card" style="background:var(--surface-2)"><b class="small">Strategy</b><p class="small muted mt-6" style="white-space:pre-wrap">${esc(plan.notes)}</p></div>` : ''}
    </div>

    <div class="col gap-12">
      ${days.map((d, i) => `
        <div class="card card-pad plan-day">
          <div class="row gap-12 mb-12">
            <div class="day-badge">${i + 1}</div>
            <div class="grow">
              <b class="small">${esc(d.title || d.theme || `Day ${i + 1}`)}</b>
              <p class="tiny dim">${esc(d.focus || '')}</p>
            </div>
            <span class="chip-soft nowrap">${d.minutes || 60} min</span>
          </div>
          ${(d.blocks || []).length
              ? `<ul class="mini-list">${d.blocks.map((b) => `<li>
                  <b>${esc(b.time || '')}</b> ${esc(b.title)}${b.detail ? `<span class="tiny dim"> - ${esc(b.detail)}</span>` : ''}
                </li>`).join('')}</ul>`
              : (d.tasks || []).length
                ? `<ul class="mini-list">${d.tasks.map((t) => `<li>${esc(typeof t === 'string' ? t : t.title || t.task)}</li>`).join('')}</ul>`
                : ''}
        </div>`).join('')}
    </div>
  </div>`;
}

function wire() {
  $('#goal').addEventListener('input', (e) => (form.goal = e.target.value));
  $('#examDate').addEventListener('change', (e) => (form.examDate = e.target.value));
  $('#hours').addEventListener('input', (e) => { form.hoursPerDay = Number(e.target.value); $('#hoursVal').textContent = e.target.value; });
  $$('#planSubjects [data-sub]').forEach((b) => b.addEventListener('click', () => {
    const s = b.dataset.sub;
    if (form.subjects.includes(s)) form.subjects = form.subjects.filter((x) => x !== s);
    else form.subjects.push(s);
    b.classList.toggle('on');
  }));
  $('#genPlan').addEventListener('click', generate);
  $('#delPlan')?.addEventListener('click', async () => {
    if (!(await confirmDialog('Delete this study plan?', 'You can generate a new one at any time.', { danger: true }))) return;
    await studyPlans.remove();
    toast('Plan deleted.', 'info');
    render();
  });
  $('#addTasks')?.addEventListener('click', addAllTasks);
  $('#exportPlan')?.addEventListener('click', exportPlan);
}

async function generate() {
  if (!form.goal.trim() && !form.subjects.length) return toast('Add a goal or pick at least one subject.', 'info');

  const btn = $('#genPlan');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner spinner-sm"></span> Building your plan…';
  $('#planOut').innerHTML = `<div class="card card-pad-lg center"><span class="spinner" style="width:28px;height:28px;border-width:3px"></span><p class="small dim mt-16">Thinking through the best way to spend your time…</p></div>`;

  try {
    let days = 7;
    if (form.examDate) {
      const diff = Math.ceil((new Date(form.examDate) - Date.now()) / 86400000);
      days = Math.max(1, Math.min(30, diff));
      form.days = days;
    }
    const student = await profile.aiContext();
    const plan = await withAI(
      () => ai.studyPlan({ goal: form.goal, examDate: form.examDate || null, hoursPerDay: form.hoursPerDay, days, subjects: form.subjects, student }),
      { loadingText: 'building your plan' },
    );
    const parsed = typeof plan === 'string' ? JSON.parse(plan.match(/\{[\s\S]*\}/)?.[0] || '{}') : plan;
    const normalised = {
      goal: form.goal || 'Study plan',
      examDate: form.examDate || null,
      hoursPerDay: form.hoursPerDay,
      subjects: form.subjects,
      title: parsed.title || 'My Study Plan',
      summary: parsed.summary || '',
      days: (parsed.days || parsed.plan || []).map((d, i) => {
        // the AI returns timed `blocks`; keep them and derive flat task titles too
        const blocks = (Array.isArray(d.blocks) ? d.blocks : []).map((b) => ({
          time: String(b?.time || ''),
          title: String(b?.title || b?.task || '').trim() || 'Study block',
          type: b?.type || 'lesson',
          detail: String(b?.detail || ''),
        }));
        const tasks = blocks.length
          ? blocks.map((b) => b.title)
          : (Array.isArray(d.tasks) ? d.tasks : Array.isArray(d.activities) ? d.activities : []).map((t) =>
              typeof t === 'string' ? t : t.title || t.task || '',
            ).filter(Boolean);
        return {
          day: Number(d.day) || i + 1,
          label: d.label || `Day ${i + 1}`,
          title: d.title || d.theme || (typeof d.day === 'string' ? d.day : `Day ${Number(d.day) || i + 1}`),
          focus: d.focus || d.description || '',
          minutes: Number(d.minutes) || (blocks.length ? 45 * blocks.length : Math.round(form.hoursPerDay * 60)),
          blocks,
          tasks,
        };
      }),
      notes: parsed.notes || parsed.strategy || parsed.tips || '',
    };
    if (!normalised.days.length) throw new Error('The AI did not return a usable plan. Try again.');

    await studyPlans.save(normalised);
    toast('Plan ready.', 'success');
    render();
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = '✨ Generate my plan';
    $('#planOut').innerHTML = `<div class="card card-pad-lg" style="background:var(--danger-soft);border-color:rgba(248,113,113,.3)">
      <b class="small">Could not build the plan</b><p class="tiny dim mt-6">${esc(err.message)}</p></div>`;
    toast(err.message, 'error', 6000);
  }
}

async function addAllTasks() {
  const plan = await studyPlans.latest();
  if (!plan) return;
  const created = [];
  (plan.days || []).forEach((d, i) => {
    const when = new Date();
    when.setDate(when.getDate() + i);
    (d.tasks || []).slice(0, 3).forEach((t) => {
      created.push({ title: `${d.title || 'Study'}: ${typeof t === 'string' ? t : t.title}`, minutes: Math.max(10, Math.round((d.minutes || 60) / 3)), dueDate: when.toISOString() });
    });
  });
  await tasks.addMany(created);
  toast(`${created.length} tasks added to your list.`, 'success');
}

async function exportPlan() {
  const plan = await studyPlans.latest();
  if (!plan) return;
  const text = [
    `STUDY PLAN — ${plan.goal}`,
    plan.examDate ? `Exam: ${plan.examDate}` : '',
    `${plan.days.length} days · ${plan.hoursPerDay}h/day`,
    plan.subjects?.length ? `Subjects: ${plan.subjects.join(', ')}` : '',
    '',
    plan.notes ? `STRATEGY\n${plan.notes}\n` : '',
    ...plan.days.flatMap((d, i) => [
      `DAY ${i + 1} — ${d.title || ''} (${d.minutes || 60} min)`,
      d.focus ? `  Focus: ${d.focus}` : '',
      ...(d.tasks || []).map((t) => `  • ${typeof t === 'string' ? t : t.title}`),
      '',
    ]),
  ].filter(Boolean).join('\n');

  const blob = new Blob([text], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'study-plan.txt';
  a.click();
  URL.revokeObjectURL(a.href);
}

loadPage(render, 'your study plan');
