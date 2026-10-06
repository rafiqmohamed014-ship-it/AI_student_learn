import { guard, mountApp, loadPage, pageRoot } from '../shell.js';
import { $, $$, esc, toast, progressBar, emptyState } from '../ui.js';
import { SUBJECTS } from '../data/curriculum.js';
import { subjects, profile } from '../store.js';

await guard();
await mountApp({ title: 'Subjects' });

let filter = 'all';

async function render() {
  const all = await subjects.list();
  const p = await profile.get();
  const mine = new Set((p?.subjects || []).map((s) => (typeof s === 'string' ? s : s.name)));

  const counts = { all: all.length, active: all.filter((s) => mine.has(s.name)).length, completed: all.filter((s) => (s.progress?.pct || 0) >= 100).length };

  pageRoot().innerHTML = `
    <div class="page-head">
      <div>
        <h1>Subjects</h1>
        <p class="muted small mt-4">${all.length} subjects · ${all.reduce((n, s) => n + s.topicCount, 0)} topics · tap any subject to start a lesson.</p>
      </div>
      <div class="row gap-10 wrap" style="flex:1 1 240px;min-width:0">
        <input class="input" id="subjectSearch" placeholder="Search subjects…" style="flex:1 1 150px;min-width:0" />
        <button class="btn btn-ghost" id="addSubjectBtn">＋ Add subject</button>
      </div>
    </div>

    <div class="row gap-8 mb-20" id="filters">
      ${[['all', 'All'], ['active', 'My subjects'], ['completed', 'Completed']].map(([k, l]) =>
        `<button class="chip ${filter === k ? 'on' : ''}" data-filter="${k}">${l} <b>${counts[k]}</b></button>`).join('')}
    </div>

    <div class="grid g-3" id="grid"></div>`;

  const grid = $('#grid');
  const list = all.filter((s) => {
    if (filter === 'active' && !mine.has(s.name)) return false;
    if (filter === 'completed' && (s.progress?.pct || 0) < 100) return false;
    return true;
  });

  if (!list.length) {
    grid.innerHTML = `<div style="grid-column:1/-1">${emptyState('Nothing here yet', 'Try a different filter, or add a subject of your own.', 'Add subject', '#addSubjectBtn')}</div>`;
  } else {
    grid.innerHTML = list.map((s) => {
      const pct = s.progress?.pct || 0;
      const isMine = mine.has(s.name);
      return `<a class="card card-hover subject-card" href="/subject.html?id=${s.id}">
        <div class="row-between" style="align-items:flex-start">
          <div class="icon-box" style="background:${s.color}22;color:${s.color}">${s.emoji}</div>
          <div class="col gap-6" style="align-items:flex-end">
            <span class="pill ${pct >= 100 ? 'good' : pct > 0 ? 'mid' : ''}">${pct}%</span>
            ${isMine ? '<span class="pill accent">Mine</span>' : ''}
          </div>
        </div>
        <h3 class="mt-16" style="font-size:1rem">${esc(s.name)}</h3>
        <p class="tiny dim" style="min-height:34px">${esc(s.description || '')}</p>
        <div class="mt-12">${progressBar(pct, 6)}</div>
        <div class="row-between mt-10">
          <span class="tiny dim">${s.lessonCount} lessons · ${s.topicCount} topics</span>
          <span class="link tiny">Open →</span>
        </div>
      </a>`;
    }).join('');
  }

  $$('#filters [data-filter]').forEach((b) => b.addEventListener('click', () => { filter = b.dataset.filter; render(); }));
  $('#subjectSearch').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    $$('.subject-card', grid).forEach((c) => {
      c.style.display = c.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });
  $('#addSubjectBtn').addEventListener('click', addCustom);
  $$('a[href="#addSubjectBtn"]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); addCustom(); }));
}

function addCustom() {
  const name = prompt('Subject name (e.g. Organic Chemistry)');
  if (!name?.trim()) return;
  const description = prompt('One-line description (optional)') || 'Added by you.';
  const color = ['#ff7a00', '#22d3ee', '#a78bfa', '#f472b6', '#34d399', '#facc15'][Math.floor(Math.random() * 6)];
  subjects.add({ name: name.trim(), description, color, custom: true, emoji: '📚' })
    .then(() => { toast('Subject added.', 'success'); render(); })
    .catch((e) => toast(e.message, 'error'));
}

loadPage(render, 'your subjects');
