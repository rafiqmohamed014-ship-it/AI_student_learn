/**
 * js/pages/register.js — account creation.
 *
 * Never handles a password itself: in Supabase mode the value is handed to
 * Supabase Auth (which hashes it), and in local mode the field is hidden
 * entirely because no password is created or stored.
 */

import { SUBJECTS } from '../data/curriculum.js';
import { $, $$, toast } from '../ui.js';
import { initStore, auth, profile } from '../store.js';
import { isSupabaseConfigured } from '../config.js';

const form = $('#registerForm');
const picker = $('#subjectPicker');
const selected = new Set();

/* ----------------------------------------------------- subject selection */
function renderPicker() {
  picker.innerHTML = SUBJECTS.map(
    (s) => `<button type="button" class="chip" data-subject="${s.id}" aria-pressed="false">${s.emoji} ${s.name}</button>`,
  ).join('');
}
renderPicker();

picker.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-subject]');
  if (!btn) return;
  const id = btn.dataset.subject;
  if (selected.has(id)) selected.delete(id);
  else selected.add(id);
  btn.setAttribute('aria-pressed', String(selected.has(id)));
  setError('subjects', '');
});

/* ------------------------------------------------- password show / hide */
$$('[data-toggle]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.toggle);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
    btn.innerHTML = show
      ? `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><path d="M14.12 14.12a3 3 0 1 1-4.24-4.24M1 1l22 22"/></svg>`
      : `<svg class="ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/></svg>`;
  });
});

/* ------------------------------------------------------------- helpers */
function setError(name, msg) {
  const el = document.querySelector(`[data-for="${name}"]`);
  if (el) el.textContent = msg || '';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(data) {
  let ok = true;
  const err = (n, m) => { setError(n, m); if (m) ok = false; };

  if (data.fullName.length < 2) err('fullName', 'Please enter your name.');
  if (!EMAIL_RE.test(data.email)) err('email', 'Please enter a valid email address.');
  if (auth.isLocalMode === false && data.password.length < 6) err('password', 'Password must be at least 6 characters.');
  if (!data.educationLevel) err('educationLevel', 'Please choose your education level.');
  if (selected.size === 0) err('subjects', 'Choose at least one subject.');
  if (!data.terms) err('terms', 'Please accept the terms to continue.');
  return ok;
}

/* ------------------------------------------------------------- local mode */
async function configureMode() {
  await initStore();
  if (auth.isLocalMode) {
    $('#modeNotice').innerHTML = `
      <div class="card" style="background:var(--primary-soft);border-color:var(--primary-line);margin-bottom:20px">
        <div class="row gap-10" style="align-items:flex-start">
          <div class="icon-box plain" style="width:36px;height:36px">💾</div>
          <div>
            <b class="small">Local mode</b>
            <p class="tiny muted" style="margin-top:4px">
              ${auth.isMongoMode
                ? 'Your profile and learning data are saved in the local MongoDB database. This local mode does not use passwords.'
                : 'No database is connected, so your profile is stored in this browser only. There is no password — and none is stored.'}
            </p>
          </div>
        </div>
      </div>`;
    $('#passwordField').style.display = 'none';
  } else {
    $('#modeNotice').innerHTML = `
      <div class="card" style="background:var(--success-soft);border-color:rgba(52,211,153,.3);margin-bottom:20px">
        <div class="row gap-10" style="align-items:flex-start">
          <div class="icon-box plain" style="width:36px;height:36px">☁️</div>
          <div>
            <b class="small">Connected to Supabase</b>
            <p class="tiny muted" style="margin-top:4px">Your account and learning data are stored securely with row-level access control.</p>
          </div>
        </div>
      </div>`;
  }

  // already signed in?
  if (auth.user) {
    const p = await profile.get();
    if (p && (p.educationLevel || p.subjects?.length)) {
      toast(`You're already signed in as ${p.fullName}.`, 'info');
      setTimeout(() => (location.href = '/dashboard.html'), 900);
    }
  }
}

configureMode();

/* ---------------------------------------------------------------- submit */
form.addEventListener('submit', async (e) => {
  e.preventDefault();

  const data = {
    fullName: $('#fullName').value.trim(),
    email: $('#email').value.trim().toLowerCase(),
    password: $('#password').value,
    educationLevel: $('#educationLevel').value,
    course: $('#course').value.trim(),
    learningLevel: $('#learningLevel').value,
    studyGoal: $('#studyGoal').value.trim(),
    terms: $('#terms').checked,
  };

  ['fullName', 'email', 'password', 'educationLevel', 'subjects', 'terms'].forEach((n) => setError(n, ''));
  if (!validate(data)) return;

  const btn = $('#submitBtn');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner spinner-sm"></span> Creating your account…';

  try {
    const subjects = [...selected].map((id) => SUBJECTS.find((s) => s.id === id)?.name).filter(Boolean);
    const res = await auth.signUp({ ...data, subjects });

    if (res?.needsEmailConfirm) {
      btn.disabled = false;
      btn.innerHTML = original;
      toast('Check your inbox and confirm your email, then log in.', 'success', 7000);
      setTimeout(() => (location.href = '/login.html'), 1800);
      return;
    }

    toast('Account created. Setting up your dashboard…', 'success');
    setTimeout(() => (location.href = '/dashboard.html'), 700);
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = original;
    console.error(err);
    const msg = err.message || 'Something went wrong. Please try again.';
    setError('email', /email|account|login/i.test(msg) ? msg : '');
    if (!/email|account|login/i.test(msg)) toast(msg, 'error', 6000);
  }
});

/* redirect already-authenticated users quickly */
if (!isSupabaseConfigured()) { /* no-op, handled in configureMode */ }
