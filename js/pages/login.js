/**
 * js/pages/login.js — sign in, or continue as a local guest.
 */

import { $, $$, toast } from '../ui.js';
import { initStore, auth } from '../store.js';

const form = $('#loginForm');

$$('[data-toggle]').forEach((btn) => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.toggle);
    const show = input.type === 'password';
    input.type = show ? 'text' : 'password';
    btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
  });
});

function setError(name, msg) {
  const el = document.querySelector(`[data-for="${name}"]`);
  if (el) el.textContent = msg || '';
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function configureMode() {
  await initStore();

  if (auth.isLocalMode) {
    $('#modeNotice').innerHTML = `
      <div class="card" style="background:var(--primary-soft);border-color:var(--primary-line);margin-bottom:20px">
        <div class="row gap-10" style="align-items:flex-start">
          <div class="icon-box plain" style="width:36px;height:36px">💾</div>
          <div>
            <b class="small">Local mode</b>
            <p class="tiny muted" style="margin-top:4px">${auth.isMongoMode
              ? 'Leave the password blank, or press Continue without an account. Your profile and study data are saved to the local MongoDB database.'
              : 'Leave the password blank, or press Continue without an account. Your profile is created in this browser and never sent anywhere.'}</p>
          </div>
        </div>
      </div>`;
    $('#password').placeholder = 'Not required in local mode';
    $('#passwordHint')?.remove();
  }

  if (auth.user) {
    toast('Already signed in — taking you to your dashboard.', 'info');
    setTimeout(() => (location.href = '/dashboard.html'), 700);
  }
}

configureMode();

/* ---------------------------------------------------------------- submit */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#email').value.trim().toLowerCase();
  const password = $('#password').value;
  setError('email', '');
  setError('password', '');

  if (!EMAIL_RE.test(email)) return setError('email', 'Please enter a valid email address.');
  if (!auth.isLocalMode && !password) return setError('password', 'Enter your password to continue.');

  const btn = $('#submitBtn');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner spinner-sm"></span> Signing in…';

  try {
    await auth.signIn({ email, password, remember: $('#remember').checked });
    toast('Signed in. Let’s go.', 'success');
    setTimeout(() => (location.href = '/dashboard.html'), 600);
  } catch (err) {
    btn.disabled = false;
    btn.innerHTML = original;
    console.error(err);
    const msg = err.message || 'Could not sign in.';
    setError('password', msg);
    toast(msg, 'error', 5000);
  }
});

/* ------------------------------------------------------------------ guest */
$('#guestBtn').addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner spinner-sm"></span> Preparing your profile…';
  try {
    await initStore();
    if (auth.isLocalMode && !auth.user) {
      await auth.signUp({ email: `student@local.app`, fullName: 'Local Student', subjects: [] });
    }
    location.href = '/dashboard.html';
  } catch (err) {
    btn.disabled = false;
    btn.textContent = 'Continue without an account';
    toast(err.message || 'Could not start a local session.', 'error');
  }
});
