/**
 * js/pages/landing.js — public marketing page behaviour.
 */

import { SUBJECTS } from '../data/curriculum.js';
import { $, $$ } from '../ui.js';

document.getElementById('year').textContent = new Date().getFullYear();

/* --------------------------------------------------- subject preview grid */
const grid = document.getElementById('subjectGrid');
if (grid) {
  grid.innerHTML = SUBJECTS.map(
    (s) => `<a class="card card-hover" href="/subjects.html?subject=${s.id}" style="text-align:center">
      <div style="font-size:2rem;line-height:1">${s.emoji}</div>
      <div class="strong" style="margin-top:8px;font-size:.95rem">${s.name}</div>
      <div class="tiny dim" style="margin-top:4px">${s.topics.length} topics</div>
    </a>`,
  ).join('');
}

/* ------------------------------------------------------------- sticky nav */
const nav = document.getElementById('pubNav');
const onScroll = () => nav?.classList.toggle('scrolled', window.scrollY > 12);
addEventListener('scroll', onScroll, { passive: true });
onScroll();

/* ------------------------------------------------------------- count up */
const counters = $$('[data-count]');
if (counters.length) {
  const run = (el) => {
    const target = Number(el.dataset.count);
    const dur = 900;
    const t0 = performance.now();
    const step = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  };
  const io = new IntersectionObserver(
    (entries) => entries.forEach((e) => {
      if (e.isIntersecting) { run(e.target); io.unobserve(e.target); }
    }),
    { threshold: 0.4 },
  );
  counters.forEach((c) => io.observe(c));
}

/* ------------------------------------------------ smooth in-page scrolling */
$$('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href').slice(1);
    const el = document.getElementById(id);
    if (!el) return;
    e.preventDefault();
    window.scrollTo({ top: el.offsetTop - 70, behavior: 'smooth' });
    history.replaceState(null, '', `#${id}`);
  });
});

/* ------------------------------------- send already-logged-in visitors on */
(async () => {
  try {
    const { initStore, auth } = await import('../store.js');
    await initStore();
    if (auth.user) {
      const start = document.getElementById('heroStart');
      if (start) {
        start.textContent = 'Go to my dashboard →';
        start.href = '/dashboard.html';
      }
      const tutor = document.getElementById('heroTutor');
      if (tutor && auth.isLocalMode) {
        tutor.href = '/dashboard.html';
        tutor.childNodes[0].textContent = 'Open my AI tutor ';
      }
    }
  } catch { /* marketing page must never break */ }
})();
