import { guard, mountApp, loadPage, pageRoot, applyThemeFromSettings } from '../shell.js';
import { $, $$, esc, toast, confirmDialog, promptDialog } from '../ui.js';
import { isSupabaseConfigured } from '../config.js';
import { auth, store, clearStoredData, profile, subjects, notes, quizzes, quizResults, studySessions, tasks, conversations, flashcards, notifications, studyPlans, demo } from '../store.js';
import { ai, aiHealth } from '../ai.js';

await guard();
await mountApp({ title: 'Settings' });

async function render() {
  const s = await profile.getSettings();
  const p = await profile.get();
  const health = await aiHealth();

  pageRoot().innerHTML = `
    <div class="page-head"><div><h1>Settings</h1><p class="muted small mt-4">Appearance, AI behaviour, notifications and your data.</p></div></div>

    <div class="settings-grid">
      <section class="card card-pad-lg">
        <h2 class="mb-20" style="font-size:1.05rem">Appearance</h2>
        <div class="field">
          <label>Theme</label>
          <div class="row gap-10" id="themePick">
            <button class="option ${s.theme === 'dark' ? 'on' : ''}" data-theme-val="dark"><b>🌙 Dark</b><span class="tiny dim" style="display:block">Default</span></button>
            <button class="option ${s.theme === 'light' ? 'on' : ''}" data-theme-val="light"><b>☀️ Light</b><span class="tiny dim" style="display:block">Bright</span></button>
          </div>
        </div>
        <div class="field">
          <label class="check"><input type="checkbox" id="reduceMotion" ${s.reduceMotion ? 'checked' : ''} /><span>Reduce animations</span></label>
        </div>
      </section>

      <section class="card card-pad-lg">
        <h2 class="mb-20" style="font-size:1.05rem">AI tutor</h2>
        <div class="card mb-20" style="background:${health.configured ? 'var(--success-soft)' : 'var(--warn-soft)'};border-color:transparent">
          <div class="row gap-10" style="align-items:flex-start">
            <span>${health.configured ? '✅' : '⚠️'}</span>
            <div class="grow">
              <b class="small">${health.configured ? `Connected — ${esc(health.provider || '')}` : 'AI is not configured'}</b>
              <p class="tiny dim mt-4">${health.configured ? `Model: ${esc(health.model || 'default')}` : esc(health.reason || 'Add your provider and key to the .env file, then restart the server.')}</p>
            </div>
          </div>
        </div>
        <div class="field">
          <label for="aiTemp">Explanation style: <b id="tempVal">${s.aiTemperature}</b></label>
          <input type="range" id="aiTemp" min="0" max="100" step="10" value="${Math.round(s.aiTemperature * 100)}" />
          <div class="hint">Lower is more factual and exam-focused. Higher is more conversational.</div>
        </div>
        <div class="field">
          <label for="aiLang">Preferred language</label>
          <select class="select" id="aiLang">
            ${['English', 'Spanish', 'French', 'German', 'Portuguese', 'Hindi', 'Arabic', 'Urdu', 'Chinese'].map((l) => `<option ${s.aiLanguage === l ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        <div class="field">
          <label for="aiDetail">Answer length</label>
          <select class="select" id="aiDetail">
            ${['short', 'balanced', 'detailed'].map((l) => `<option value="${l}" ${s.aiDetail === l ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        <button class="btn btn-ghost btn-block" id="testAI">Send a test message</button>
      </section>

      <section class="card card-pad-lg">
        <h2 class="mb-20" style="font-size:1.05rem">Notifications</h2>
        ${[
          ['notifyStreak', 'Streak reminders', 'Tell me when I am about to lose a streak'],
          ['notifyQuiz', 'Quiz results', 'Summarise my score after each attempt'],
          ['notifyPlan', 'Plan reminders', 'Nudge me about today’s study plan'],
          ['notifyWeekly', 'Weekly summary', 'A short recap every Sunday'],
        ].map(([k, label, hint]) => `
          <div class="row-between setting-row">
            <div class="grow"><b class="small">${label}</b><p class="tiny dim">${hint}</p></div>
            <label class="switch"><input type="checkbox" data-set="${k}" ${s[k] ? 'checked' : ''} /><span></span></label>
          </div>`).join('')}
      </section>

      <section class="card card-pad-lg">
        <h2 class="mb-20" style="font-size:1.05rem">Subjects</h2>
        <p class="tiny dim mb-16">These decide what the AI emphasises when it answers.</p>
        <div class="row-wrap gap-8" id="setSubjects"></div>
        <button class="btn btn-ghost btn-sm mt-16" id="addSubject">＋ Add a custom subject</button>
      </section>

      <section class="card card-pad-lg">
        <h2 class="mb-20" style="font-size:1.05rem">Account &amp; data</h2>
        <div class="row-between small mb-16"><span class="dim">Signed in as</span><b>${esc(p?.email || '—')}</b></div>
        <div class="row-between small mb-16"><span class="dim">Storage</span><b>${store.mode === 'mongo' ? 'MongoDB (local)' : auth.isLocalMode ? 'This browser only' : 'Supabase (cloud)'}</b></div>
        ${!isSupabaseConfigured() ? `<div class="card mb-16" style="background:var(--surface-2)"><p class="tiny dim">Want real accounts and sync across devices? Add <code class="mono">SUPABASE_URL</code> and <code class="mono">SUPABASE_ANON_KEY</code> to <code class="mono">js/config.js</code>, then run <code class="mono">supabase/schema.sql</code>.</p></div>` : ''}

        ${auth.isLocalMode && demo.available() ? '<button class="btn btn-ghost btn-block mb-10" id="seedBtn">Load sample data</button>' : ''}
        <button class="btn btn-ghost btn-block mb-10" id="exportBtn">Export all my data (JSON)</button>
        ${auth.isLocalMode ? `<button class="btn btn-danger btn-block mb-10" id="wipeBtn">${store.mode === 'mongo' ? 'Delete all MongoDB data' : 'Delete all local data'}</button>` : ''}
        <button class="btn btn-ghost btn-block" id="logoutBtn">Sign out</button>
      </section>
    </div>`;

  wire(p, health);
}

function wire(p, health) {
  $$('[data-theme-val]').forEach((b) => b.addEventListener('click', async () => {
    await profile.saveSettings({ theme: b.dataset.themeVal });
    applyThemeFromSettings(await profile.getSettings());
    toast('Theme updated.', 'success', 1500);
    render();
  }));

  $('#reduceMotion').addEventListener('change', (e) => profile.saveSettings({ reduceMotion: e.target.checked }));
  $('#aiTemp').addEventListener('change', (e) => {
    $('#tempVal').textContent = e.target.value / 100;
    profile.saveSettings({ aiTemperature: Number(e.target.value) / 100 });
  });
  $('#aiLang').addEventListener('change', (e) => profile.saveSettings({ aiLanguage: e.target.value }));
  $('#aiDetail').addEventListener('change', (e) => profile.saveSettings({ aiDetail: e.target.value }));

  $$('[data-set]').forEach((c) => c.addEventListener('change', () => {
    const patch = { [c.dataset.set]: c.checked };
    profile.saveSettings(patch).then(() => toast('Saved.', 'success', 1200));
  }));

  /* subjects */
  const { SUBJECTS } = window.__SUBJECTS__ || {};
  import('../data/curriculum.js').then(({ SUBJECTS }) => {
    const host = $('#setSubjects');
    const current = new Set((p?.subjects || []).map((s) => (typeof s === 'string' ? s : s.name)));
    host.innerHTML = SUBJECTS.map((s) => {
      const on = current.has(s.name);
      return `<button class="chip ${on ? 'on' : ''}" data-sub="${esc(s.name)}">${s.emoji} ${esc(s.name)}</button>`;
    }).join('');
    host.querySelectorAll('[data-sub]').forEach((b) => b.addEventListener('click', async () => {
      const name = b.dataset.sub;
      if (current.has(name)) current.delete(name);
      else current.add(name);
      b.classList.toggle('on');
      await profile.update({ subjects: [...current] });
      toast('Subjects updated — the AI will use these now.', 'success', 2000);
    }));
  });

  $('#addSubject').addEventListener('click', async () => {
    const raw = await promptDialog(
      'Add subject',
      [{ name: 'name', label: 'Subject name', placeholder: 'e.g. Organic Chemistry' }],
      { submitLabel: 'Add', validate: (d) => (d.name ? '' : 'A name is required.') },
    );
    const name = raw?.name?.trim();
    if (!name) return;
    const color = ['#ff7a00', '#22d3ee', '#a78bfa', '#f472b6', '#34d399', '#facc15'][Math.floor(Math.random() * 6)];
    await subjects.add({ name: name.trim(), description: 'Added by you.', color, emoji: '📚', custom: true });
    await profile.update({ subjects: [...current, name.trim()] });
    toast('Subject added.', 'success');
    render();
  });

  /* AI test */
  $('#testAI').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner spinner-sm"></span> Testing…';
    try {
      const reply = await ai.chat({ prompt: 'In one sentence, what is photosynthesis?', student: await profile.aiContext(), history: [] });
      toast(String(reply).slice(0, 120), 'success', 6000);
    } catch (err) {
      toast(err.message, 'error', 7000);
    } finally {
      btn.disabled = false;
      btn.textContent = 'Send a test message';
    }
  });

  /* data */
  $('#seedBtn')?.addEventListener('click', async () => {
    await demo.seed();
    toast('Sample data loaded.', 'success');
    setTimeout(() => location.reload(), 800);
  });
  $('#exportBtn').addEventListener('click', exportAll);
  $('#wipeBtn')?.addEventListener('click', async () => {
    const destination = store.mode === 'mongo' ? 'MongoDB' : 'this browser';
    if (!(await confirmDialog('Delete everything?', `All notes, progress, quizzes and settings stored in ${destination} will be permanently removed.`, { danger: true, confirmLabel: 'Delete everything' }))) return;
    try {
      await clearStoredData();
      location.href = '/index.html';
    } catch (err) {
      toast(`Could not clear saved data: ${err.message}`, 'error');
    }
  });
  $('#logoutBtn').addEventListener('click', async () => {
    if (!(await confirmDialog('Sign out?', 'Your data stays saved.', { danger: false, confirmLabel: 'Sign out' }))) return;
    await auth.signOut();
    location.href = '/index.html';
  });
}

async function exportAll() {
  const data = {
    exportedAt: new Date().toISOString(),
    profile: await profile.get(),
    subjects: await subjects.list(),
    notes: await notes.list(),
    quizzes: await quizzes.list(),
    quizResults: await quizResults.list({ limit: 9999 }),
    studySessions: await studySessions.list(),
    tasks: await tasks.list(),
    conversations: await conversations.list(),
    flashcards: await flashcards.list(),
    studyPlan: await studyPlans.latest(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `edunova-export-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('Export downloaded.', 'success');
}

loadPage(render, 'your settings');
