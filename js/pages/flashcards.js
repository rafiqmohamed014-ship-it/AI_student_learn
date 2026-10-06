import { guard, mountApp, loadPage, pageRoot } from '../shell.js';
import { $, $$, esc, toast, emptyState, progressBar, confirmDialog, promptDialog } from '../ui.js';
import { SUBJECTS } from '../data/curriculum.js';
import { flashcards, profile } from '../store.js';
import { ai, withAI } from '../ai.js';

await guard();
await mountApp({ title: 'Flashcards' });

let deck = null;
let subjectId = '';
let index = 0;
let flipped = false;

async function render() {
  const decks = await flashcards.decks();
  const cards = await flashcards.list({ subjectId: subjectId || null, deck: deck || null });
  const current = cards[index];

  pageRoot().innerHTML = `
    <div class="page-head">
      <div><h1>Flashcards</h1><p class="muted small mt-4">Flip, rate yourself, and come back tomorrow — spaced repetition without the fuss.</p></div>
      <button class="btn btn-primary" id="genBtn">✨ Generate with AI</button>
    </div>

    <div class="row gap-10 mb-20 wrap">
      <select class="select" id="deckSel" style="width:auto">
        <option value="">All decks</option>
        ${decks.map((d) => `<option value="${esc(d.deck || d.name)}" ${(deck || '') === (d.deck || d.name) ? 'selected' : ''}>${esc(d.deck || d.name)} (${d.count})</option>`).join('')}
      </select>
      <select class="select" id="subjSel" style="width:auto">
        <option value="">All subjects</option>
        ${SUBJECTS.map((s) => `<option value="${s.id}" ${s.id === subjectId ? 'selected' : ''}>${s.emoji} ${esc(s.name)}</option>`).join('')}
      </select>
      ${deck ? `<button class="btn btn-ghost btn-sm" id="delDeck">Delete deck</button>` : ''}
      <span class="chip-soft">${cards.length} card${cards.length === 1 ? '' : 's'}</span>
    </div>

    <div class="card card-pad-lg">
      ${current ? `
        <div class="row-between mb-20">
          <span class="tiny dim">Card ${index + 1} of ${cards.length}</span>
          <span class="tiny dim">${current.easy ? '✓ marked easy' : current.hard ? '↻ marked difficult' : 'not rated'}</span>
        </div>
        <div class="flashcard ${flipped ? 'flipped' : ''}" id="card" role="button" tabindex="0" aria-label="Flip card">
          <div class="flashcard-inner">
            <div class="flashcard-face front">
              <span class="tiny dim">Question</span>
              <p>${esc(current.front)}</p>
              <span class="tiny dim" style="margin-top:auto">Tap to reveal</span>
            </div>
            <div class="flashcard-face back">
              <span class="tiny dim">Answer</span>
              <p>${esc(current.back)}</p>
              ${current.hint ? `<span class="tiny dim" style="margin-top:auto">${esc(current.hint)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="row gap-10 mt-24" style="justify-content:center">
          <button class="btn btn-ghost" id="prev">←</button>
          <button class="btn" id="hard" style="border-color:rgba(248,113,113,.4);color:#f87171">↻ Difficult</button>
          <button class="btn" id="easy" style="border-color:rgba(52,211,153,.4);color:#34d399">✓ Easy</button>
          <button class="btn btn-ghost" id="next">→</button>
        </div>`
        : emptyState(deck || subjectId ? 'No cards match this filter' : 'No flashcards yet', 'Generate a deck with AI, or import one from a note.', 'Generate with AI', '#genBtn')}
    </div>`;

  wire();
}

function wire() {
  $('#deckSel').addEventListener('change', (e) => { deck = e.target.value || null; index = 0; flipped = false; render(); });
  $('#subjSel').addEventListener('change', (e) => { subjectId = e.target.value; index = 0; flipped = false; render(); });
  $('#delDeck')?.addEventListener('click', async () => {
    if (!(await confirmDialog(`Delete deck “${deck}”?`, 'All cards in it will be removed.', { danger: true }))) return;
    await flashcards.removeDeck(deck);
    deck = null;
    toast('Deck deleted.', 'info');
    render();
  });
  $('#genBtn').addEventListener('click', generate);
  $('#card')?.addEventListener('click', () => { flipped = !flipped; render(); });
  $('#card')?.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flipped = !flipped; render(); } });
  $('#prev')?.addEventListener('click', () => { index = Math.max(0, index - 1); flipped = false; render(); });
  $('#next')?.addEventListener('click', () => { index = Math.min(9999, index + 1); flipped = false; render(); });
  $('#easy')?.addEventListener('click', () => rate('easy'));
  $('#hard')?.addEventListener('click', () => rate('hard'));
}

async function rate(value) {
  const cards = await flashcards.list({ subjectId: subjectId || null, deck: deck || null });
  if (!cards[index]) return;
  // the store and Supabase keep a numeric score, so map the button to one
  const score = value === 'easy' ? 5 : value === 'hard' ? 2 : Number(value) || 0;
  await flashcards.rate(cards[index].id, score);
  index = Math.min(cards.length - 1, index + 1);
  flipped = false;
  render();
}

async function generate() {
  const raw = await promptDialog(
    'Generate flashcards',
    [{ name: 'topic', label: 'Topic', placeholder: 'e.g. Photosynthesis, or: Quadratic equations' }],
    { submitLabel: 'Generate', validate: (d) => (d.topic ? '' : 'Tell me which topic to use.') },
  );
  const topic = raw?.topic?.trim();
  if (!topic) return;

  const btn = $('#genBtn');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner spinner-sm"></span> Generating…';

  try {
    const student = await profile.aiContext();
    const result = await withAI(
      () => ai.flashcards({ topic, count: 12, student }),
      { loadingText: 'writing cards' },
    );
    const parsed = typeof result === 'string' ? JSON.parse(result.match(/\{[\s\S]*\}/)?.[0] || '{}') : result;
    const cards = (parsed.cards || parsed.items || []).map((c) => ({ front: c.front || c.q, back: c.back || c.a, hint: c.hint || '' })).filter((c) => c.front && c.back);
    if (!cards.length) throw new Error('The AI did not return usable cards.');

    const subject = SUBJECTS.find((s) => s.id === subjectId);
    await flashcards.addMany(cards, { deck: topic, subjectId: subject?.id || null });
    deck = topic;
    index = 0;
    flipped = false;
    toast(`${cards.length} cards added to “${topic}”.`, 'success');
  } catch (err) {
    toast(err.message || 'Could not generate cards.', 'error', 6000);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '✨ Generate with AI';
  }
}

loadPage(render, 'your flashcards');
