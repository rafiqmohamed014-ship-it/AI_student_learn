import { guard, mountApp, loadPage, pageRoot } from '../shell.js';
import { $, esc, toast, avatarHTML, initials, progressBar, fmtDate, ring } from '../ui.js';
import { SUBJECTS } from '../data/curriculum.js';
import { profile, auth, store, subjects, studySessions, lessonProgress, quizResults } from '../store.js';

await guard();
await mountApp({ title: 'Profile' });

async function render() {
  const p = await profile.get();
  const stats = await studySessions.stats();
  const results = await quizResults.list({ limit: 100 });
  const done = await lessonProgress.countDone();
  const allSubjects = await subjects.list();
  const pct = (p?.subjects || []).length ? Math.round(allSubjects.filter((s) => (s.progress?.pct || 0) > 0).length / Math.max(1, (p?.subjects || []).length) * 100) : 0;
  const avg = results.length ? Math.round(results.reduce((s, r) => s + (r.scorePct || 0), 0) / results.length) : null;

  pageRoot().innerHTML = `
    <div class="page-head"><div><h1>Profile</h1><p class="muted small mt-4">Everything the AI knows about you, so you can correct it.</p></div></div>

    <div class="grid g-2">
      <section class="card card-pad-lg center">
        ${avatarHTML(p?.fullName || '', p?.avatarUrl || '', 'avatar-lg')}
        <h2 class="mt-16" style="font-size:1.25rem">${esc(p?.fullName || 'Student')}</h2>
        <p class="muted small">${esc(p?.email || '')}</p>
        <div class="row gap-8 mt-12" style="justify-content:center;flex-wrap:wrap">
          <span class="chip-soft">${esc(p?.educationLevel || 'No level set')}</span>
          ${p?.course ? `<span class="chip-soft">${esc(p.course)}</span>` : ''}
          <span class="chip-soft accent">${esc(p?.learningLevel || 'intermediate')}</span>
        </div>
        <p class="small muted mt-16">${esc(p?.studyGoal ? `Goal: ${p.studyGoal}` : 'No study goal set — add one so the AI can target it.')}</p>
        <button class="btn btn-ghost mt-20" id="editBtn">Edit profile</button>
      </section>

      <div class="col gap-20">
        <section class="card card-pad-lg">
          <div class="row gap-20 wrap center">
            ${ring(pct, 120, 11, `${pct}%`, 'subjects started')}
            <div class="col gap-14 grow" style="align-items:flex-start">
              <div><b style="font-size:1.4rem">${stats.streak || 0}</b><span class="tiny dim" style="display:block">day streak</span></div>
              <div><b style="font-size:1.4rem">${done}</b><span class="tiny dim" style="display:block">lessons completed</span></div>
              <div><b style="font-size:1.4rem">${avg === null ? '—' : `${avg}%`}</b><span class="tiny dim" style="display:block">average quiz score</span></div>
            </div>
          </div>
        </section>

        <section class="card card-pad-lg">
          <h3 class="mb-16" style="font-size:1rem">Subjects the AI focuses on</h3>
          ${(p?.subjects || []).length ? `<div class="row-wrap gap-8">${p.subjects.map((s) => {
            const name = typeof s === 'string' ? s : s.name;
            const sub = SUBJECTS.find((x) => x.name === name);
            return `<a class="chip" href="${sub ? `/subject.html?id=${sub.id}` : '/subjects.html'}">${sub?.emoji || '📚'} ${esc(name)}</a>`;
          }).join('')}</div>` : `<p class="small dim">No subjects selected. <a class="link" href="/settings.html">Add some</a> so answers stay on-topic.</p>`}
        </section>

        <section class="card card-pad-lg">
          <h3 class="mb-12" style="font-size:1rem">Account</h3>
          <div class="row-between small"><span class="dim">Storage mode</span><b>${store.mode === 'mongo' ? 'MongoDB (local)' : auth.isLocalMode ? 'Local (this browser)' : 'Supabase (cloud)'}</b></div>
          <div class="row-between small mt-8"><span class="dim">Member since</span><b>${fmtDate(p?.createdAt || new Date().toISOString())}</b></div>
          <div class="row-between small mt-8"><span class="dim">Profile completeness</span><span class="grow" style="max-width:120px">${progressBar(profileCompleteness(p), 5)}</span></div>
        </section>
      </div>
    </div>

    <div id="editHost"></div>`;

  $('#editBtn').addEventListener('click', () => showEditor(p));
}

function profileCompleteness(p) {
  const fields = [p?.fullName, p?.educationLevel, p?.course, p?.studyGoal, p?.subjects?.length && true, p?.learningLevel];
  return Math.round((fields.filter(Boolean).length / fields.length) * 100);
}

function showEditor(p) {
  const host = $('#editHost');
  host.innerHTML = `
    <div class="card card-pad-lg mt-24">
      <h2 class="mb-20" style="font-size:1.05rem">Edit profile</h2>
      <div class="grid g-2" style="gap:0 14px">
        <div class="field"><label for="pName">Full name</label><input class="input" id="pName" value="${esc(p?.fullName || '')}" /></div>
        <div class="field"><label>Email</label><input class="input" value="${esc(p?.email || '')}" disabled /></div>
      </div>
      <div class="grid g-2" style="gap:0 14px">
        <div class="field"><label for="pLevel">Education level</label>
          <select class="select" id="pLevel">${['High School', 'Undergraduate', 'Postgraduate', 'Diploma / Vocational', 'Self-taught'].map((o) => `<option ${p?.educationLevel === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
        <div class="field"><label for="pCourse">Course / Degree</label><input class="input" id="pCourse" value="${esc(p?.course || '')}" /></div>
      </div>
      <div class="grid g-2" style="gap:0 14px">
        <div class="field"><label for="pAbility">Current level</label>
          <select class="select" id="pAbility">${['beginner', 'intermediate', 'advanced'].map((o) => `<option value="${o}" ${p?.learningLevel === o ? 'selected' : ''}>${o}</option>`).join('')}</select></div>
        <div class="field"><label for="pGoal">Study goal</label><input class="input" id="pGoal" value="${esc(p?.studyGoal || '')}" /></div>
      </div>
      <div class="field"><label>Subjects</label>
        <div class="row-wrap gap-8" id="pSubjects">${SUBJECTS.map((s) => {
          const on = (p?.subjects || []).some((x) => (typeof x === 'string' ? x : x.name) === s.name);
          return `<button type="button" class="chip ${on ? 'on' : ''}" data-sub="${esc(s.name)}">${s.emoji} ${esc(s.name)}</button>`;
        }).join('')}</div></div>
      <div class="row gap-10 mt-16">
        <button class="btn btn-primary" id="saveProfile">Save changes</button>
        <button class="btn btn-ghost" id="cancelEdit">Cancel</button>
      </div>
    </div>`;

  const chosen = new Set((p?.subjects || []).map((x) => (typeof x === 'string' ? x : x.name)));
  host.querySelectorAll('[data-sub]').forEach((b) => b.addEventListener('click', () => {
    if (chosen.has(b.dataset.sub)) chosen.delete(b.dataset.sub);
    else chosen.add(b.dataset.sub);
    b.classList.toggle('on');
  }));
  $('#cancelEdit').addEventListener('click', () => (host.innerHTML = ''));
  $('#saveProfile').addEventListener('click', async () => {
    await profile.update({
      fullName: $('#pName').value.trim(),
      educationLevel: $('#pLevel').value,
      course: $('#pCourse').value.trim(),
      learningLevel: $('#pAbility').value,
      studyGoal: $('#pGoal').value.trim(),
      subjects: [...chosen],
    });
    toast('Profile updated. The AI will use this straight away.', 'success');
    host.innerHTML = '';
    render();
  });
}

loadPage(render, 'your profile');
