/**
 * js/shell.js — the application chrome: sidebar, topbar, mobile bottom nav,
 * auth guard, notification badge and live AI status.
 *
 * Every authenticated page calls mountApp() once and then renders into
 * #pageRoot. That keeps navigation, guards and status consistent everywhere.
 */

import { CONFIG } from './config.js';
import { icon } from './icons.js';
import { esc, avatarHTML, $, toast, debounce } from './ui.js';
import { auth, profile, notifications, initStore, onStoreNotice } from './store.js';
import { aiHealth } from './ai.js';

export const NAV = [
  {
    section: 'Learn',
    items: [
      { href: '/dashboard.html', label: 'Dashboard', icon: 'home', key: 'dashboard' },
      { href: '/subjects.html', label: 'Subjects', icon: 'book', key: 'subjects' },
      { href: '/ai-tutor.html', label: 'AI Tutor', icon: 'sparkles', key: 'ai-tutor', accent: true },
    ],
  },
  {
    section: 'Practice',
    items: [
      { href: '/assessment.html', label: 'Assessment', icon: 'trophy', key: 'assessment' },
      { href: '/quiz.html', label: 'Quizzes', icon: 'quiz', key: 'quiz' },
      { href: '/flashcards.html', label: 'Flashcards', icon: 'layers', key: 'flashcards' },
      { href: '/notes.html', label: 'Notes', icon: 'note', key: 'notes' },
    ],
  },
  {
    section: 'Plan',
    items: [
      { href: '/study-plan.html', label: 'Study Plan', icon: 'calendar', key: 'study-plan' },
      { href: '/progress.html', label: 'Progress', icon: 'chart', key: 'progress' },
    ],
  },
  {
    section: 'Account',
    items: [
      { href: '/profile.html', label: 'Profile', icon: 'user', key: 'profile' },
      { href: '/settings.html', label: 'Settings', icon: 'settings', key: 'settings' },
    ],
  },
];

const BOTTOM_NAV = [
  { href: '/dashboard.html', label: 'Home', icon: 'home', key: 'dashboard' },
  { href: '/subjects.html', label: 'Subjects', icon: 'book', key: 'subjects' },
  { href: '/ai-tutor.html', label: 'AI Tutor', icon: 'sparkles', key: 'ai-tutor', accent: true },
  { href: '/quiz.html', label: 'Quizzes', icon: 'quiz', key: 'quiz' },
  { href: '/profile.html', label: 'Profile', icon: 'user', key: 'profile' },
];

let mounted = false;

/* ---------------------------------------------------------------- guard -- */
/**
 * Ensures the visitor is signed in. Returns the user or redirects.
 * @param {{requireAuth?:boolean}} opts
 */
export async function guard({ requireAuth = true } = {}) {
  await initStore();

  if (!requireAuth) return auth.user;

  if (!auth.user) {
    const next = encodeURIComponent(location.pathname.split('/').pop() + location.search);
    location.replace(`/login.html?next=${next}`);
    return null;
  }
  try {
    await notifications.sync();
  } catch { /* non-critical */ }
  return auth.user;
}

/* ---------------------------------------------------------------- mount -- */
/**
 * @param {{key:string, title:string, crumb?:string, actions?:string, wide?:boolean, auth?:boolean}} opts
 */
export async function mountApp(opts) {
  if (mounted) return document.getElementById('pageRoot');
  mounted = true;

  const host = document.getElementById('app');
  if (!host) {
    console.error('[shell] #app container missing');
    return null;
  }

  const p = (await profile.get().catch(() => null)) || {};
  const unread = await notifications.list().then((l) => l.filter((n) => !n.read).length).catch(() => 0);
  const health = await aiHealth();

  host.innerHTML = `
    <div class="bg-fx"><div class="bg-grid"></div></div>
    <div class="app">
      <aside class="sidebar" id="sidebar" aria-label="Main navigation">
        <div class="sidebar-head">
          <a class="brand" href="/dashboard.html" aria-label="${esc(CONFIG.APP_NAME)} home">
            <span class="brand-mark">${icon('cap')}</span>
            <span class="brand-name">Kalvi<span>AI</span></span>
          </a>
          <button class="icon-btn hide-lg" id="closeNav" aria-label="Close navigation" style="margin-left:auto">${icon('x')}</button>
        </div>
        <nav class="sidebar-nav">
          <a class="nav-item ${opts.key === 'notifications' ? 'active' : ''}" href="/notifications.html" data-key="notifications">
            ${icon('bell')}<span>Notifications</span>
            ${unread ? `<span class="nav-badge" data-unread>${unread > 9 ? '9+' : unread}</span>` : ''}
          </a>
          <a class="nav-item" href="/search.html" data-key="search">${icon('search')}<span>Search</span></a>
          ${NAV.map(
            (g) => `
            <div class="nav-section">${g.section}</div>
            ${g.items
              .map(
                (it) => `<a class="nav-item ${opts.key === it.key ? 'active' : ''}" href="${it.href}" data-key="${it.key}">
                  ${icon(it.icon)}<span>${it.label}</span>
                  ${it.accent ? '<span class="badge badge-orange" style="margin-left:auto">AI</span>' : ''}
                </a>`,
              )
              .join('')}`,
          ).join('')}
        </nav>
        <div class="sidebar-foot">
          <div class="ai-status ${health.configured ? 'ok' : 'bad'}" id="aiStatus" title="${esc(health.message || '')}">
            <span class="dot"></span>
            <div class="grow" style="min-width:0">
              <b>${health.configured ? 'AI connected' : 'AI offline'}</b>
              <div class="tiny dim truncate">${esc(health.configured ? `${health.provider} · ${health.model}` : 'Not configured')}</div>
            </div>
          </div>
        </div>
      </aside>
      <div class="scrim" id="scrim"></div>

      <div class="main">
        <header class="topbar">
          <button class="icon-btn burger" id="openNav" aria-label="Open navigation">${icon('menu')}</button>
          <div class="grow" style="min-width:0">
            <h1 class="truncate">${esc(opts.title || 'Dashboard')}</h1>
            ${opts.crumb ? `<div class="crumb truncate">${esc(opts.crumb)}</div>` : ''}
          </div>
          <div class="search-box hide-md" style="width:min(280px,34vw)">
            ${icon('search', 's-ico')}
            <input class="input" id="globalSearch" type="search" placeholder="Search everything…"
              aria-label="Search subjects, lessons, notes" autocomplete="off" />
          </div>
          <button class="icon-btn" id="openSearch" aria-label="Search" style="display:none">${icon('search')}</button>
          <a class="icon-btn" href="/notifications.html" aria-label="Notifications" id="notifBtn">
            ${icon('bell')}${unread ? '<span class="pip"></span>' : ''}
          </a>
          <a href="/profile.html" aria-label="Your profile" class="hide-xs">${avatarHTML(p.fullName, p.avatarUrl)}</a>
        </header>

        <main class="view ${opts.wide ? '' : 'view-narrow'}" id="pageRoot"></main>
      </div>

      <nav class="bottomnav" aria-label="Quick navigation">
        ${BOTTOM_NAV.map(
          (b) => `<a class="bn-item ${opts.key === b.key ? 'active' : ''}" href="${b.href}">
            ${icon(b.icon)}<span>${b.label}</span>
          </a>`,
        ).join('')}
      </nav>
    </div>`;

  wireNav(opts);
  wireSearch();
  applyThemeFromSettings();
  return document.getElementById('pageRoot');
}

function wireNav() {
  const sidebar = document.getElementById('sidebar');
  const scrim = document.getElementById('scrim');
  const open = () => { sidebar.classList.add('open'); scrim.classList.add('show'); };
  const close = () => { sidebar.classList.remove('open'); scrim.classList.remove('show'); };

  document.getElementById('openNav')?.addEventListener('click', open);
  document.getElementById('closeNav')?.addEventListener('click', close);
  scrim?.addEventListener('click', close);
  sidebar?.querySelectorAll('a').forEach((a) => a.addEventListener('click', close));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') close();
  });

  // On mobile the search box is hidden; show the icon instead.
  const setMode = () => {
    const mobile = matchMedia('(max-width: 1024px)').matches;
    const box = document.querySelector('.topbar .search-box');
    const btn = document.getElementById('openSearch');
    if (box) box.style.display = mobile ? 'none' : '';
    if (btn) btn.style.display = mobile ? 'grid' : 'none';
  };
  setMode();
  addEventListener('resize', debounce(setMode, 150));
  document.getElementById('openSearch')?.addEventListener('click', () => (location.href = '/search.html'));
}

function wireSearch() {
  const input = document.getElementById('globalSearch');
  if (!input) return;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && input.value.trim()) {
      location.href = `/search.html?q=${encodeURIComponent(input.value.trim())}`;
    }
  });
  // "/" focuses search, like a proper power tool
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) {
      e.preventDefault();
      input.focus();
    }
  });
}

/* --------------------------------------------------------------- theme --- */
export function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme === 'light' ? 'light' : 'dark');
}

export async function applyThemeFromSettings() {
  try {
    const s = await profile.getSettings();
    applyTheme(s.theme);
  } catch { /* default dark */ }
}

/* ------------------------------------------------------------ helpers --- */
export const pageRoot = () => document.getElementById('pageRoot');

export function showPageLoading(text = 'Loading…') {
  const root = pageRoot();
  if (!root) return;
  root.innerHTML = `<div class="center" style="padding:70px 20px">
    <div class="spinner spinner-lg" style="margin:0 auto 16px"></div>
    <div class="muted small">${esc(text)}</div>
  </div>`;
}

export function showErrorState(message, onRetry) {
  const root = pageRoot();
  if (!root) return;
  root.innerHTML = `<div class="card" style="max-width:520px;margin:40px auto;text-align:center">
    <div class="empty-ico" style="margin-bottom:14px">${icon('alert')}</div>
    <h3>Something went wrong</h3>
    <p class="muted small" style="margin:10px 0 18px">${esc(message)}</p>
    ${onRetry ? `<button class="btn btn-primary" id="retryBtn">${icon('refresh')} Try again</button>` : ''}
  </div>`;
  const btn = document.getElementById('retryBtn');
  if (btn) btn.addEventListener('click', onRetry);
}

/** Wraps a page loader: shows an error card instead of a blank screen. */
export async function loadPage(fn, label = 'this page') {
  showPageLoading(`Loading ${label}…`);
  try {
    await fn();
  } catch (err) {
    console.error(`[page] ${label} failed`, err);
    showErrorState(err?.message || 'Please try again.', () => loadPage(fn, label));
  }
}

onStoreNotice((msg, kind) => toast(msg, kind));
