import { guard, mountApp, loadPage, pageRoot } from '../shell.js';
import { $, esc, emptyState, debounce, highlight } from '../ui.js';
import { search } from '../store.js';

await guard();
await mountApp({ title: 'Search' });

const q = new URLSearchParams(location.search).get('q') || '';

async function render(query = q) {
  const results = query.trim().length >= 2 ? await search.all(query) : null;

  pageRoot().innerHTML = `
    <div class="page-head"><div><h1>Search</h1><p class="muted small mt-4">Look across every subject, lesson, note and topic.</p></div></div>

    <div class="input-group mb-24" style="max-width:520px">
      <svg class="ico input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input class="input" id="q" placeholder="Search everything…" value="${esc(query)}" autofocus />
    </div>

    <div id="out">${
      query.trim().length < 2
        ? `<p class="small dim">Type at least two characters.</p>`
        : results && (results.subjects.length + results.lessons.length + results.notes.length)
          ? renderResults(results, query)
          : emptyState('Nothing matched “' + esc(query) + '”', 'Try a different word, or ask the AI tutor directly.', 'Ask the AI', '/ai-tutor.html')
    }</div>`;

  $('#q').addEventListener('input', debounce((e) => {
    history.replaceState(null, '', `?q=${encodeURIComponent(e.target.value)}`);
    render(e.target.value);
  }, 220));
}

function renderResults(r, query) {
  const group = (title, items, renderItem) => items.length
    ? `<section class="card card-pad-lg mb-20">
        <h2 class="mb-16" style="font-size:1rem">${title} <span class="chip-soft">${items.length}</span></h2>
        <div class="col gap-10">${items.map(renderItem).join('')}</div>
      </section>`
    : '';

  return (
    group('Subjects', r.subjects, (s) => `
      <a class="subject-row" href="/subject.html?id=${s.id}">
        <div class="icon-box" style="background:${s.color}22;color:${s.color}">${s.emoji}</div>
        <div class="grow"><b class="small">${highlight(s.name, query)}</b><span class="tiny dim" style="display:block">${highlight(s.description || '', query)}</span></div>
      </a>`) +
    group('Lessons', r.lessons, (l) => `
      <a class="subject-row" href="/subject.html?id=${l.subjectId}&lesson=${l.id}">
        <div class="icon-box plain">📖</div>
        <div class="grow"><b class="small">${highlight(l.title, query)}</b><span class="tiny dim" style="display:block">${highlight((l.summary || l.content || '').slice(0, 90), query)}</span></div>
      </a>`) +
    group('Notes', r.notes, (n) => `
      <a class="subject-row" href="/notes.html?note=${n.id}">
        <div class="icon-box plain">📓</div>
        <div class="grow"><b class="small">${highlight(n.title, query)}</b><span class="tiny dim" style="display:block">${highlight((n.content || '').slice(0, 90), query)}</span></div>
      </a>`)
  );
}

loadPage(() => render(), 'search');
