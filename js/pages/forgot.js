/**
 * js/pages/forgot.js — request a password reset link.
 * In local mode there is no account to recover, so the page explains that
 * rather than pretending to send an email.
 */

import { $, toast } from '../ui.js';
import { initStore, auth } from '../store.js';

const form = $('#forgotForm');
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

(async () => {
  await initStore();
  if (auth.isLocalMode) {
    $('#modeNotice').innerHTML = `
      <div class="card" style="background:var(--warn-soft);border-color:rgba(251,191,36,.3);margin-bottom:20px">
        <b class="small">No account server in local mode</b>
        <p class="tiny muted" style="margin-top:6px">
          Local mode keeps your profile in this browser, so there is no password to reset.
          If you have finished exploring, the fastest route is to start fresh —
          Settings → Data will let you wipe and rebuild your profile.
        </p>
      </div>`;
    $('#submitBtn').textContent = 'Start a fresh local profile';
    $('#submitBtn').classList.remove('btn-primary');
    $('#submitBtn').classList.add('btn-ghost');
  }
})();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const email = $('#email').value.trim().toLowerCase();
  const err = document.querySelector('[data-for="email"]');
  if (!EMAIL_RE.test(email)) { err.textContent = 'Please enter a valid email address.'; return; }
  err.textContent = '';

  const btn = $('#submitBtn');
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner spinner-sm"></span> Working…';

  try {
    if (auth.isLocalMode) {
      await auth.signUp({ email, fullName: email.split('@')[0].replace(/[._]/g, ' '), subjects: [] });
      $('#sentCard').style.display = '';
      form.style.display = 'none';
      toast('Local profile ready.', 'success');
      setTimeout(() => (location.href = '/dashboard.html'), 1400);
      return;
    }
    await auth.resetPassword(email);
    $('#sentCard').style.display = '';
    form.style.display = 'none';
    toast('Reset link sent. Check your inbox.', 'success');
  } catch (e2) {
    btn.disabled = false;
    btn.innerHTML = original;
    console.error(e2);
    toast(e2.message || 'Could not send the reset link.', 'error', 6000);
  }
});
