import { guard, mountApp, loadPage, pageRoot } from '../shell.js';
import { $, $$, esc, toast, emptyState, relTime, confirmDialog, promptDialog } from '../ui.js';
import { SUBJECTS } from '../data/curriculum.js';
import { notes, subjects, profile } from '../store.js';
import { ai, withAI } from '../ai.js';

await guard();
await mountApp({ title: 'Notes' });

const params = new URLSearchParams(location.search);
let openId = params.get('note');
let filterSubject = '';
let query = '';

async function render() {
  const all = await notes.list({ subjectId: filterSubject || null, query });
  const list = openId ? all.filter((n) => n.id === openId) : [];
  const note = all.find((n) => n.id === openId) || list[0] || null;

  pageRoot().innerHTML = `
    <div class="page-head">
      <div><h1>Notes</h1><p class="muted small mt-4">Write during class, then let the AI condense or expand it.</p></div>
      <button class="btn btn-primary" id="newNote">＋ New note</button>
    </div>

    <div class="notes-layout">
      <aside class="card notes-list-panel">
        <div class="pad-12 col gap-10" style="border-bottom:1px solid var(--line)">
          <input class="input" id="noteSearch" placeholder="Search notes…" value="${esc(query)}" />
          <select class="select" id="noteSubject">
            <option value="">All subjects</option>
            ${SUBJECTS.map((s) => `<option value="${s.id}" ${s.id === filterSubject ? 'selected' : ''}>${s.emoji} ${esc(s.name)}</option>`).join('')}
          </select>
        </div>
        <div class="col" id="noteItems" style="padding:8px">
          ${all.length ? all.map((n) => `
            <button class="note-item ${n.id === openId ? 'on' : ''}" data-note="${n.id}">
              <b class="small ellipsis">${esc(n.title)}</b>
              <span class="tiny dim ellipsis" style="display:block">${esc((n.content || '').slice(0, 60) || 'Empty')}</span>
              <span class="tiny dim">${relTime(n.updatedAt || n.createdAt)}</span>
            </button>`).join('') : '<p class="tiny dim center" style="padding:24px">No notes yet.</p>'}
        </div>
      </aside>

      <section id="editorHost">${note ? editor(note) : `<div class="card card-pad-lg" style="height:100%;display:grid;place-items:center">${emptyState('Select or create a note', 'Your notes are private to your profile and can be summarised with AI.', 'New note', '#newNote')}</div>`}</section>
    </div>`;

  wire();
}

function editor(n) {
  return `<div class="card card-pad-lg note-editor">
    <div class="row-between mb-16 gap-10 wrap">
      <select class="select" id="edSubject" style="width:auto">
        <option value="">No subject</option>
        ${SUBJECTS.map((s) => `<option value="${s.id}" ${s.id === n.subjectId ? 'selected' : ''}>${s.emoji} ${esc(s.name)}</option>`).join('')}
      </select>
      <div class="row gap-8">
        <button class="btn btn-ghost btn-sm" data-ai="summarize">✨ Summarise</button>
        <button class="btn btn-ghost btn-sm" data-ai="keypoints">🔑 Key points</button>
        <button class="btn btn-ghost btn-sm" data-ai="flashcards">🃏 Flashcards</button>
        <button class="icon-btn" id="delNote" aria-label="Delete note">🗑</button>
      </div>
    </div>
    <input class="input input-title" id="edTitle" placeholder="Note title" value="${esc(n.title)}" />
    <textarea class="input note-body" id="edBody" placeholder="Start writing…">${esc(n.content || '')}</textarea>
    <div class="row-between mt-12">
      <span class="tiny dim" id="saveState">Saved ${relTime(n.updatedAt || n.createdAt)}</span>
      <button class="btn btn-primary btn-sm" id="saveNote">Save</button>
    </div>
    <div id="aiOut" class="mt-16"></div>
  </div>`;
}

function wire() {
  $$('[data-note]').forEach((b) => b.addEventListener('click', () => { openId = b.dataset.note; render(); }));
  $('#newNote').addEventListener('click', async () => {
    const n = await notes.save({ title: 'Untitled note', content: '', subjectId: filterSubject || null });
    openId = n.id;
    render();
  });
  $('#noteSearch').addEventListener('input', (e) => { query = e.target.value; clearTimeout(window.__nt); window.__nt = setTimeout(render, 250); });
  $('#noteSubject').addEventListener('change', (e) => { filterSubject = e.target.value; render(); });

  if (openId) {
    const id = openId;
$('#saveNote').addEventListener('click', async () => {
        const btn = $('#saveNote');
        btn.disabled = true;
        try {
          const saved = await notes.save({
            id,
            title: $('#edTitle').value.trim() || 'Untitled note',
            content: $('#edBody').value,
            subjectId: $('#edSubject').value || null,
          });
          if (saved?.id) openId = saved.id;
          toast('Note saved.', 'success', 1500);
          render(); // refresh the list so the saved title/preview appears
        } catch (err) {
          console.error('[notes] save failed', err);
          toast(err.message || 'Could not save the note.', 'error', 4000);
        } finally {
          btn.disabled = false;
        }
      });
    $('#delNote').addEventListener('click', async () => {
      if (!(await confirmDialog('Delete this note?', 'This cannot be undone.', { danger: true }))) return;
      await notes.remove(id);
      openId = null;
      toast('Note deleted.', 'info');
      render();
    });
    $$('[data-ai]').forEach((b) => b.addEventListener('click', () => runAI(b.dataset.ai)));
  }
}

async function runAI(kind) {
  const text = $('#edBody').value.trim();
  if (!text) return toast('Write something first.', 'info');
  const out = $('#aiOut');
  const p = await profile.get();
  const subjectName = SUBJECTS.find((s) => s.id === $('#edSubject').value)?.name;

  const buttons = $$('[data-ai]');
  buttons.forEach((x) => (x.disabled = true));
  out.innerHTML = `<div class="card" style="background:var(--surface-2)"><span class="spinner spinner-sm"></span> <span class="small dim">AI is working…</span></div>`;

  try {
    let result;
    if (kind === 'flashcards') result = await withAI(() => ai.flashcards({ topic: subjectName || 'this note', text, count: 10 }), { loadingText: 'building cards' });
    else {
      const style = kind === 'keypoints' ? 'key points' : 'summary';
      const student = await profile.aiContext();
      result = await withAI(() => ai.summarize({ text, student, style }), { loadingText: 'summarising' });
    }

    out.innerHTML = `<div class="card" style="background:var(--primary-soft);border-color:var(--primary-line)">
      <div class="row-between mb-12"><b class="small">${kind === 'flashcards' ? 'Generated flashcards' : 'AI result'}</b>
        <div class="row gap-8">
          <button class="btn btn-ghost btn-sm" id="appendOut">Insert into note</button>
          <button class="btn btn-ghost btn-sm" id="saveCards" data-kind="${kind}">${kind === 'flashcards' ? 'Save deck' : 'Replace note'}</button>
        </div>
      </div>
      <div class="prose small">${formatResult(result, kind)}</div>
    </div>`;

const cardList = (r) => {
        if (Array.isArray(r)) return r;
        if (r && Array.isArray(r.cards)) return r.cards;
        if (typeof r === 'string') {
          try { return JSON.parse(r.match(/[\s\S]*\}/)?.[0] || '{}').cards || []; } catch { return []; }
        }
        return [];
      };
      $('#appendOut')?.addEventListener('click', () => {
        const body = $('#edBody');
        const text = kind === 'flashcards'
          ? cardList(result).map((c) => `${c.front || c.q || ''} - ${c.back || c.a || ''}`).join('\n')
          : stripMd(String(result));
        if (!text) return toast('Nothing to insert.', 'info');
        body.value += `\n\n${text}`;
        toast('Inserted into your note.', 'success');
      });
      $('#saveCards')?.addEventListener('click', async () => {
        if (kind === 'flashcards') {
          const cards = cardList(result);
        await flashcardsAdd(cards, subjectName);
      } else {
        $('#edBody').value = stripMd(String(result));
        toast('Note replaced with the summary.', 'success');
      }
    });
  } catch (err) {
    out.innerHTML = `<div class="card" style="background:var(--danger-soft);border-color:rgba(248,113,113,.3)"><b class="small">AI unavailable</b><p class="tiny dim mt-6">${esc(err.message)}</p></div>`;
    toast(err.message, 'error');
  } finally {
    buttons.forEach((x) => (x.disabled = false));
  }
}

async function flashcardsAdd(cards, subjectName) {
  const { flashcards } = await import('../store.js');
  const subjectId = SUBJECTS.find((s) => s.name === subjectName)?.id || null;
  await flashcards.addMany(
    cards.map((c) => ({ front: c.front || c.q, back: c.back || c.a, hint: c.hint || '' })),
    { deck: subjectName || 'Note deck', subjectId },
  );
  toast('Deck saved to Flashcards.', 'success');
}

function formatResult(result, kind) {
  if (kind === 'flashcards') {
    // ai.flashcards() already unwraps to an array of cards; tolerate raw text too
    let cards = Array.isArray(result) ? result : [];
    if (!cards.length && typeof result === 'string') {
      const parsed = JSON.parse(result.match(/[\s\S]*\}/)?.[0] || '{}');
      cards = parsed.cards || [];
    }
    if (!cards.length) return '<p class="small dim">The AI returned no cards. Try again.</p>';
    return cards.map((c) => `<div class="flash-mini"><b>${esc(c.front)}</b><span class="dim">${esc(c.back)}</span></div>`).join('');
  }
  return String(result).replace(/\n/g, '<br>');
}

function stripMd(s) {
  return s.replace(/[*_`#]/g, '').trim();
}

loadPage(render, 'your notes');
