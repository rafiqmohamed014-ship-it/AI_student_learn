/**
 * js/store.js
 * ---------------------------------------------------------------------------
 * Single data access layer with TWO interchangeable backends:
 *
 *   1. SUPABASE  - used when js/config.js has a URL + anon key.
 *                  Real auth, real database, Row Level Security per student.
 *   2. MONGODB   - passwordless local accounts with app data synced to the
 *                  local MongoDB server through the same-origin API.
 *   3. LOCAL     - browser-only storage if MongoDB is unavailable.
 *
 * Every page talks ONLY to this module, so switching backends never changes
 * page code. `store.mode` tells you which one is live.
 *
 * IMPORTANT: passwords are never handled here. Local mode has no password at
 * all; Supabase mode delegates to Supabase Auth (which hashes passwords).
 */

import { CONFIG, isSupabaseConfigured } from './config.js';
import { SUBJECTS, SUBJECTS_BY_ID, LESSONS, LESSONS_BY_ID, lessonsFor } from './data/curriculum.js';
import { dayKey } from './ui.js';

const K = (name) => CONFIG.STORAGE_PREFIX + name;

/* ======================================================== local storage === */
function lsRead(key, fallback) {
  try {
    const raw = localStorage.getItem(K(key));
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}
function lsWrite(key, value) {
  try {
    localStorage.setItem(K(key), JSON.stringify(value));
    scheduleMongoSync();
    return true;
  } catch (e) {
    console.error('[store] localStorage write failed', e);
    return false;
  }
}
function lsCollection(name) {
  const value = lsRead(name, []);
  return Array.isArray(value) ? value.filter((x) => x && typeof x === 'object') : [];
}
const uid = (p = 'id') => `${p}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
const nowISO = () => new Date().toISOString();

let mongoReady = false;
let mongoSyncTimer = null;
let mongoSyncChain = Promise.resolve();
let mongoSyncErrorShown = false;

function readLocalSnapshot() {
  const data = {};
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key?.startsWith(CONFIG.STORAGE_PREFIX)) continue;
    data[key] = JSON.parse(localStorage.getItem(key));
  }
  return data;
}

async function putMongoSnapshot(data) {
  const response = await fetch('/api/data', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.error || `MongoDB save failed (HTTP ${response.status}).`);
  }
}

function scheduleMongoSync() {
  if (!mongoReady) return;
  clearTimeout(mongoSyncTimer);
  mongoSyncTimer = setTimeout(() => {
    const snapshot = readLocalSnapshot();
    mongoSyncChain = mongoSyncChain
      .catch(() => {})
      .then(() => putMongoSnapshot(snapshot))
      .then(() => {
        mongoSyncErrorShown = false;
      })
      .catch((err) => {
        console.error('[store] MongoDB sync failed', err);
        if (!mongoSyncErrorShown) {
          notice('Could not save changes to MongoDB. Your browser copy is still available; try again after reconnecting.', 'error');
          mongoSyncErrorShown = true;
        }
      });
  }, 150);
}

async function initMongoPersistence() {
  try {
    const response = await fetch('/api/data', { headers: { Accept: 'application/json' } });
    const result = await response.json();
    if (!response.ok || !result.ok) {
      throw new Error(result.error || `MongoDB connection failed (HTTP ${response.status}).`);
    }

    rt.mode = 'mongo';
    if (result.data && Object.keys(result.data).length) {
      for (const key of Object.keys(localStorage)) {
        if (key.startsWith(CONFIG.STORAGE_PREFIX)) localStorage.removeItem(key);
      }
      for (const [key, value] of Object.entries(result.data)) {
        localStorage.setItem(key, JSON.stringify(value));
      }
    } else {
      await putMongoSnapshot(readLocalSnapshot());
    }
    mongoReady = true;
  } catch (err) {
    rt.mode = 'local';
    console.error('[store] MongoDB persistence unavailable', err);
    notice('MongoDB is unavailable. The app is using browser-only storage for now.', 'warn');
  }
}

/* ============================================================== runtime === */
const rt = {
  mode: isSupabaseConfigured() ? 'supabase' : 'local',
  client: null,
  user: null,
  ready: null,
  noticeShown: false,
};

let noticeFn = null;
export function onStoreNotice(fn) { noticeFn = fn; }
function notice(msg, kind = 'info') { if (noticeFn) noticeFn(msg, kind); }

async function initSupabase() {
  const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2.49.1');
  rt.client = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  const { data } = await rt.client.auth.getSession();
  rt.user = data?.session?.user ?? null;
  return rt.client;
}

export const store = {
  get mode() { return rt.mode; },
  get isOnline() { return rt.mode === 'supabase' || rt.mode === 'mongo'; },
  ready: null,
};

/* ================================================================= AUTH === */
const LOCAL_SESSION = () => lsRead('session', null);

export const auth = {
  async init() {
    if (rt.mode === 'supabase') {
      try {
        await initSupabase();
        rt.client.auth.onAuthStateChange((_e, session) => {
          rt.user = session?.user ?? null;
        });
      } catch (err) {
        console.error('[store] Supabase failed to load, falling back to local mode', err);
        rt.mode = 'local';
        notice('Could not reach Supabase — running in local mode instead.', 'warn');
      }
    } else {
      rt.user = LOCAL_SESSION();
    }
    return rt.user;
  },

  get user() { return rt.user; },

  get isLocalMode() { return rt.mode !== 'supabase'; },
  get isMongoMode() { return rt.mode === 'mongo'; },

  async signUp(payload) {
    const { fullName, email, educationLevel, course, subjects = [], learningLevel, studyGoal } = payload;
    if (rt.mode === 'supabase') {
      const { data, error } = await rt.client.auth.signUp({
        email,
        password: payload.password,
        options: { data: { full_name: fullName } },
      });
      if (error) throw new Error(friendlyAuthError(error));
      rt.user = data.user;
      if (data.user) {
        await this.upsertProfile({
          fullName, email: data.user.email, educationLevel, course, subjects, learningLevel, studyGoal,
        });
      }
      return { user: data.user, needsEmailConfirm: !data.session };
    }

    /* local mode: no password is created or stored, ever */
    const existing = lsRead('profile', null);
    if (existing && existing.email === email) {
      return { user: LOCAL_SESSION() || { id: existing.id, email }, needsEmailConfirm: false, existing: true };
    }
    const profile = {
      id: uid('u'),
      fullName: fullName || (email || 'Student').split('@')[0],
      email: email || 'local@student.dev',
      educationLevel: educationLevel || 'Undergraduate',
      course: course || 'Not specified',
      subjects: Array.isArray(subjects) && subjects.length ? subjects : ['Programming'],
      learningLevel: learningLevel || 'beginner',
      studyGoal: studyGoal || 'Build strong foundations',
      dailyGoalMinutes: CONFIG.DEFAULT_DAILY_GOAL,
      avatarUrl: '',
      createdAt: nowISO(),
      preferences: defaultSettings(),
    };
    lsWrite('profile', profile);
    lsWrite('session', { id: profile.id, email: profile.email, createdAt: nowISO() });
    rt.user = LOCAL_SESSION();
    return { user: rt.user, needsEmailConfirm: false };
  },

  async signIn(payload) {
    const { email, password } = payload;
    if (rt.mode === 'supabase') {
      const { data, error } = await rt.client.auth.signInWithPassword({ email, password });
      if (error) throw new Error(friendlyAuthError(error));
      rt.user = data.user;
      await this.upsertProfile({ email: data.user.email });
      return data.user;
    }

    let profile = lsRead('profile', null);
    if (!profile || (email && profile.email !== email)) {
      // first-run convenience: create a local profile on the fly
      profile = {
        id: uid('u'),
        fullName: (email || 'local@student.dev').split('@')[0].replace(/[._-]+/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
        email: email || 'local@student.dev',
        educationLevel: 'Undergraduate',
        course: 'Not specified',
        subjects: ['Programming'],
        learningLevel: 'beginner',
        studyGoal: 'Build strong foundations',
        dailyGoalMinutes: CONFIG.DEFAULT_DAILY_GOAL,
        avatarUrl: '',
        createdAt: nowISO(),
        preferences: defaultSettings(),
      };
      lsWrite('profile', profile);
    }
    lsWrite('session', { id: profile.id, email: profile.email, createdAt: nowISO() });
    rt.user = LOCAL_SESSION();
    return rt.user;
  },

  async signOut() {
    if (rt.mode === 'supabase') {
      const { error } = await rt.client.auth.signOut();
      if (error) throw new Error(error.message);
    } else {
      localStorage.removeItem(K('session'));
      scheduleMongoSync();
    }
    rt.user = null;
  },

  async resetPassword(email) {
    if (rt.mode === 'supabase') {
      const { error } = await rt.client.auth.resetPasswordForEmail(email, {
        redirectTo: `${location.origin}/reset-password.html`,
      });
      if (error) throw new Error(friendlyAuthError(error));
      return true;
    }
    throw new Error('Password reset needs Supabase. In local mode no password is stored, so there is nothing to reset.');
  },

  async updatePassword(password) {
    if (rt.mode !== 'supabase') throw new Error('Local mode does not use passwords.');
    const { error } = await rt.client.auth.updateUser({ password });
    if (error) throw new Error(friendlyAuthError(error));
  },

  /* profile row lives in Supabase but is created lazily for existing users */
  async upsertProfile(patch) {
    if (rt.mode !== 'supabase' || !rt.user) return null;
    const row = {
      id: rt.user.id,
      email: rt.user.email,
      full_name: patch.fullName ?? undefined,
      education_level: patch.educationLevel ?? undefined,
      course: patch.course ?? undefined,
      subjects: patch.subjects ?? undefined,
      learning_level: patch.learningLevel ?? undefined,
      study_goal: patch.studyGoal ?? undefined,
      daily_goal_minutes: patch.dailyGoalMinutes ?? undefined,
      avatar_url: patch.avatarUrl ?? undefined,
      preferences: patch.preferences ?? undefined,
      updated_at: nowISO(),
    };
    Object.keys(row).forEach((k) => row[k] === undefined && delete row[k]);

    const { data, error } = await rt.client
      .from('profiles')
      .upsert(row, { onConflict: 'id' })
      .select()
      .single();
    if (error) {
      // If the profile row already exists with only some fields set, merge instead
      const { error: e2 } = await rt.client.from('profiles').update(row).eq('id', rt.user.id);
      if (e2) throw new Error(e2.message);
      return null;
    }
    return data;
  },
};

function friendlyAuthError(err) {
  const m = String(err?.message || err || '');
  if (/invalid login credentials/i.test(m)) return 'That email and password combination does not match our records.';
  if (/email not confirmed/i.test(m)) return 'Please confirm your email address first — check your inbox for the confirmation link.';
  if (/user already registered/i.test(m)) return 'An account with that email already exists. Try logging in instead.';
  if (/password should be at least/i.test(m)) return 'Password must be at least 6 characters long.';
  if (/unable to validate email|invalid email/i.test(m)) return 'That does not look like a valid email address.';
  if (/rate limit|too many requests/i.test(m)) return 'Too many attempts. Please wait a moment and try again.';
  if (/fetch|network/i.test(m)) return 'Could not reach the authentication server. Check your connection and try again.';
  return m || 'Something went wrong. Please try again.';
}

/* ============================================================= PROFILE === */
export function defaultSettings() {
  return {
    theme: 'dark',
    notifications: true,
    emailDigest: false,
    studyReminders: true,
    reminderTime: '18:00',
    language: 'English',
    aiVerbosity: 'balanced',
    aiShowThinking: true,
    showStreak: true,
    sound: false,
  };
}

function mapProfile(row) {
  if (!row) return null;
  return {
    id: row.id,
    fullName: row.full_name || row.fullName || '',
    email: row.email || '',
    educationLevel: row.education_level || '',
    course: row.course || '',
    subjects: row.subjects || [],
    learningLevel: row.learning_level || 'beginner',
    studyGoal: row.study_goal || '',
    dailyGoalMinutes: row.daily_goal_minutes || CONFIG.DEFAULT_DAILY_GOAL,
    avatarUrl: row.avatar_url || '',
    createdAt: row.created_at,
    preferences: { ...defaultSettings(), ...(row.preferences || {}) },
  };
}

export const profile = {
  async get() {
    if (rt.mode === 'supabase') {
      if (!rt.user) return null;
      const { data, error } = await rt.client.from('profiles').select('*').eq('id', rt.user.id).maybeSingle();
      if (error) throw new Error(error.message);
      return mapProfile(data);
    }
    let p = lsRead('profile', null);
    if (!p) {
      const session = LOCAL_SESSION();
      p = {
        id: session?.id || uid('u'),
        fullName: session?.email?.split('@')[0] || 'Student',
        email: session?.email || 'local@student.dev',
        educationLevel: 'Undergraduate',
        course: 'Not specified',
        subjects: ['Programming'],
        learningLevel: 'beginner',
        studyGoal: 'Build strong foundations',
        dailyGoalMinutes: CONFIG.DEFAULT_DAILY_GOAL,
        avatarUrl: '',
        createdAt: nowISO(),
        preferences: defaultSettings(),
      };
      lsWrite('profile', p);
    }
    p.preferences = { ...defaultSettings(), ...(p.preferences || {}) };
    return p;
  },

  async update(patch) {
    if (rt.mode === 'supabase') {
      const row = {
        full_name: patch.fullName,
        education_level: patch.educationLevel,
        course: patch.course,
        subjects: patch.subjects,
        learning_level: patch.learningLevel,
        study_goal: patch.studyGoal,
        daily_goal_minutes: patch.dailyGoalMinutes,
        avatar_url: patch.avatarUrl,
        preferences: patch.preferences,
        updated_at: nowISO(),
      };
      Object.keys(row).forEach((k) => row[k] === undefined && delete row[k]);
      const { data, error } = await rt.client.from('profiles').update(row).eq('id', rt.user.id).select().single();
      if (error) throw new Error(error.message);
      return mapProfile(data);
    }
    const cur = lsRead('profile', {}) || {};
    const next = { ...cur, ...patch, updatedAt: nowISO() };
    next.preferences = { ...defaultSettings(), ...(cur.preferences || {}), ...(patch.preferences || {}) };
    lsWrite('profile', next);
    return next;
  },

  /* snapshot used to personalise every AI request */
  async aiContext() {
    const p = await this.get();
    return p
      ? {
          fullName: p.fullName,
          educationLevel: p.educationLevel,
          course: p.course,
          subjects: p.subjects,
          learningLevel: p.learningLevel,
          studyGoal: p.studyGoal,
          dailyGoalMinutes: p.dailyGoalMinutes,
        }
      : {};
  },

  async getSettings() {
    const p = await this.get();
    return p?.preferences || defaultSettings();
  },

  async saveSettings(patch) {
    const cur = await this.getSettings();
    return this.update({ preferences: { ...cur, ...patch } });
  },
};

/* ============================================================ SUBJECTS === */
function customSubject(row) {
  return {
    id: row.id,
    name: row.name,
    emoji: row.emoji || '📘',
    description: row.description || '',
    topics: row.topics || [],
    icon: row.icon || 'book',
    custom: true,
    progress: row.progress || 0,
    createdAt: row.created_at,
  };
}

export const subjects = {
  /**
   * Static curriculum + the student's own subjects.
   * Each entry carries a `progress` object so the UI can render bars,
   * counters and "x of y complete" copy without recomputing anything:
   *   progress.pct   0-100 percentage
   *   progress.done  lessons completed
   *   progress.total lessons available
   */
  async list() {
    const progressMap = await lessonProgress.getMap();
    let custom = [];
    if (rt.mode === 'supabase' && rt.user) {
      const { data, error } = await rt.client.from('subjects').select('*').order('created_at');
      if (error) throw new Error(error.message);
      custom = (data || []).map(customSubject);
    } else {
      custom = lsCollection('customSubjects');
    }

    const shape = (s, ls, done, pct) => ({
      ...s,
      color: s.color || '#ff7a00',
      emoji: s.emoji || '📘',
      topicCount: (s.topics || []).length,
      lessonCount: ls.length,
      doneCount: done,
      progressPct: pct,
      progress: { pct, done, total: ls.length },
    });

    const builtin = SUBJECTS.map((s) => {
      const ls = lessonsFor(s.id);
      const done = ls.filter((l) => progressMap[l.id]?.done).length;
      return shape({ ...s, custom: false }, ls, done, ls.length ? Math.round((done / ls.length) * 100) : 0);
    });

    const customWithProgress = await Promise.all(
      custom.map(async (s) => {
        const ls = await lessons.list(s.id).catch(() => []);
        const done = ls.filter((l) => progressMap[l.id]?.done).length;
        const pct = ls.length ? Math.round((done / ls.length) * 100) : s.progress || 0;
        return shape(s, ls, done, pct);
      }),
    );

    return [...builtin, ...customWithProgress];
  },

  async get(id) {
    const all = await this.list();
    return all.find((s) => s.id === id) || SUBJECTS_BY_ID[id] || null;
  },

  async add(data) {
    if (rt.mode === 'supabase' && rt.user) {
      const { data: row, error } = await rt.client
        .from('subjects')
        .insert({
          user_id: rt.user.id,
          name: data.name,
          emoji: data.emoji || '📘',
          description: data.description || '',
          topics: data.topics || [],
          icon: 'book',
          is_custom: true,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return customSubject(row);
    }
    const row = {
      id: uid('sub'),
      name: data.name,
      emoji: data.emoji || '📘',
      description: data.description || '',
      topics: data.topics || [],
      icon: 'book',
      custom: true,
      progress: 0,
      createdAt: nowISO(),
    };
    lsWrite('customSubjects', [...lsCollection('customSubjects'), row]);
    return row;
  },

  async update(id, patch) {
    if (rt.mode === 'supabase' && rt.user) {
      const { data, error } = await rt.client.from('subjects').update(patch).eq('id', id).select().single();
      if (error) throw new Error(error.message);
      return customSubject(data);
    }
    const list = lsCollection('customSubjects');
    const next = list.map((s) => (s.id === id ? { ...s, ...patch } : s));
    lsWrite('customSubjects', next);
    return next.find((s) => s.id === id) || null;
  },

  async remove(id) {
    if (rt.mode === 'supabase' && rt.user) {
      const { error } = await rt.client.from('subjects').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    }
    lsWrite('customSubjects', lsCollection('customSubjects').filter((s) => s.id !== id));
    lsWrite('customLessons', lsCollection('customLessons').filter((l) => l.subjectId !== id));
    return true;
  },
};

/* ============================================================= LESSONS === */
export const lessonProgress = {
  async getMap() {
    if (rt.mode === 'supabase' && rt.user) {
      const { data, error } = await rt.client.from('lesson_progress').select('*').eq('user_id', rt.user.id);
      if (error) throw new Error(error.message);
      return Object.fromEntries((data || []).map((r) => [r.lesson_id, { done: r.completed, at: r.completed_at }]));
    }
    return lsRead('lessonProgress', {}) || {};
  },

  async set(lessonId, done) {
    const map = await this.getMap();
    map[lessonId] = { done: !!done, at: nowISO() };
    if (rt.mode === 'supabase' && rt.user) {
      const { error } = await rt.client.from('lesson_progress').upsert(
        { user_id: rt.user.id, lesson_id: lessonId, completed: !!done, completed_at: nowISO() },
        { onConflict: 'user_id,lesson_id' },
      );
      if (error) throw new Error(error.message);
    } else {
      lsWrite('lessonProgress', map);
    }
    return map[lessonId];
  },

  async countDone() {
    const map = await this.getMap();
    return Object.values(map).filter((v) => v.done).length;
  },
};

function customLesson(row) {
  return {
    id: row.id,
    subjectId: row.subject_id,
    title: row.title,
    summary: row.summary || '',
    minutes: row.minutes || 10,
    topics: row.topics || [],
    sections: Array.isArray(row.content?.sections) ? row.content.sections : [],
    keyPoints: row.content?.keyPoints || [],
    examples: row.content?.examples || [],
    practice: row.content?.practice || [],
    custom: true,
  };
}

export const lessons = {
  async list(subjectId) {
    const map = await lessonProgress.getMap();
    let custom = [];
    if (rt.mode === 'supabase' && rt.user) {
      const q = rt.client.from('lessons').select('*').order('position');
      const { data, error } = subjectId ? await q.eq('subject_id', subjectId) : await q;
      if (error) throw new Error(error.message);
      custom = (data || []).map(customLesson);
    } else {
      custom = lsCollection('customLessons').filter((l) => (subjectId ? l.subjectId === subjectId : true));
    }
    const all = [...(subjectId ? lessonsFor(subjectId) : LESSONS), ...custom];
    return all
      .map((l) => ({ ...l, completed: !!map[l.id]?.done, completedAt: map[l.id]?.at || null }))
      .sort((a, b) => a.id.localeCompare(b.id));
  },

  async get(id) {
    const staticOne = LESSONS_BY_ID[id];
    if (staticOne) {
      const map = await lessonProgress.getMap();
      return { ...staticOne, completed: !!map[id]?.done };
    }
    if (rt.mode === 'supabase' && rt.user) {
      const { data, error } = await rt.client.from('lessons').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? { ...customLesson(data), completed: !!(await lessonProgress.getMap())[id]?.done } : null;
    }
    const found = lsCollection('customLessons').find((l) => l.id === id);
    if (!found) return null;
    const map = await lessonProgress.getMap();
    return { ...found, completed: !!map[id]?.done };
  },

  async add(data) {
    if (rt.mode === 'supabase' && rt.user) {
      const { data: row, error } = await rt.client
        .from('lessons')
        .insert({
          user_id: rt.user.id,
          subject_id: data.subjectId,
          title: data.title,
          summary: data.summary || '',
          minutes: data.minutes || 10,
          topics: data.topics || [],
          content: { sections: data.sections || [], keyPoints: data.keyPoints || [], examples: data.examples || [], practice: data.practice || [] },
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return customLesson(row);
    }
    const row = {
      id: uid('les'),
      subjectId: data.subjectId,
      title: data.title,
      summary: data.summary || '',
      minutes: data.minutes || 10,
      topics: data.topics || [],
      sections: data.sections || [],
      keyPoints: data.keyPoints || [],
      examples: data.examples || [],
      practice: data.practice || [],
      custom: true,
    };
    lsWrite('customLessons', [...lsCollection('customLessons'), row]);
    return row;
  },

  async remove(id) {
    if (rt.mode === 'supabase' && rt.user) {
      const { error } = await rt.client.from('lessons').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    }
    lsWrite('customLessons', lsCollection('customLessons').filter((l) => l.id !== id));
    return true;
  },

  async setComplete(lessonId, done) {
    await lessonProgress.set(lessonId, done);
    // a completed lesson is real study time
    if (done) await studySessions.add({ minutes: 10, lessonId, source: 'lesson' });
    return true;
  },

  /** Flat text of a lesson, used as AI context so answers stay on-topic. */
  toContext(lesson) {
    if (!lesson) return '';
    const parts = [
      `TITLE: ${lesson.title}`,
      lesson.summary ? `SUMMARY: ${lesson.summary}` : '',
      ...(lesson.sections || []).map((s) => `${s.h}\n${s.b}`),
      (lesson.keyPoints || []).length ? `KEY POINTS:\n${lesson.keyPoints.map((k) => `- ${k}`).join('\n')}` : '',
    ];
    return parts.filter(Boolean).join('\n\n');
  },
};

/* ================================================================ NOTES === */
const mapNote = (r) => ({
  id: r.id,
  subjectId: r.subject_id || null,
  subject: r.subject || '',
  title: r.title,
  content: r.content,
  tags: r.tags || [],
  pinned: !!r.pinned,
  createdAt: r.created_at,
  updatedAt: r.updated_at || r.created_at,
});

export const notes = {
  async list({ subjectId = null, query = '' } = {}) {
    let rows;
    if (rt.mode === 'supabase' && rt.user) {
      let q = rt.client.from('notes').select('*').order('updated_at', { ascending: false });
      if (subjectId) q = q.eq('subject_id', subjectId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      rows = (data || []).map(mapNote);
    } else {
      rows = lsCollection('notes').map(mapNote);
    }
    if (query) {
      const s = query.toLowerCase();
      rows = rows.filter(
        (n) => n.title.toLowerCase().includes(s) || n.content.toLowerCase().includes(s) ||
          (n.tags || []).some((t) => t.toLowerCase().includes(s)),
      );
    }
    return rows.sort((a, b) => (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0) || String(b.updatedAt).localeCompare(String(a.updatedAt)));
  },

  async get(id) {
    if (rt.mode === 'supabase' && rt.user) {
      const { data, error } = await rt.client.from('notes').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapNote(data) : null;
    }
    const r = lsCollection('notes').find((n) => n.id === id);
    return r ? mapNote(r) : null;
  },

  async save(data) {
    if (rt.mode === 'supabase' && rt.user) {
      if (data.id) {
        const { data: row, error } = await rt.client
          .from('notes')
          .update({
            title: data.title, content: data.content, subject_id: data.subjectId ?? null,
            subject: data.subject ?? '', tags: data.tags || [], pinned: !!data.pinned, updated_at: nowISO(),
          })
          .eq('id', data.id).select().single();
        if (error) throw new Error(error.message);
        return mapNote(row);
      }
      const { data: row, error } = await rt.client
        .from('notes')
        .insert({
          user_id: rt.user.id, title: data.title, content: data.content,
          subject_id: data.subjectId ?? null, subject: data.subject ?? '',
          tags: data.tags || [], pinned: !!data.pinned, updated_at: nowISO(),
        })
        .select().single();
      if (error) throw new Error(error.message);
      return mapNote(row);
    }
    const list = lsCollection('notes');
    if (data.id) {
      const i = list.findIndex((n) => n.id === data.id);
      if (i === -1) throw new Error('Note not found.');
      list[i] = { ...list[i], ...data, updatedAt: nowISO() };
      lsWrite('notes', list);
      return mapNote(list[i]);
    }
    const row = { id: uid('note'), ...data, tags: data.tags || [], pinned: false, createdAt: nowISO(), updatedAt: nowISO() };
    lsWrite('notes', [row, ...list]);
    return mapNote(row);
  },

  async remove(id) {
    if (rt.mode === 'supabase' && rt.user) {
      const { error } = await rt.client.from('notes').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    }
    lsWrite('notes', lsCollection('notes').filter((n) => n.id !== id));
    return true;
  },
};

/* =============================================================== QUIZZES == */
const mapQuiz = (r) => ({
  id: r.id,
  subject: r.subject || '',
  subjectId: r.subject_id || null,
  subjectName: r.subject || r.subject_id || '',
  topic: r.topic || 'General',
  difficulty: r.difficulty || 'medium',
  source: r.source || 'builtin',
  title: r.title || `${r.topic} quiz`,
  questions: r.questions || [],
  createdAt: r.created_at,
});

export const quizzes = {
  async list({ subjectId = null } = {}) {
    if (rt.mode === 'supabase' && rt.user) {
      let q = rt.client.from('quizzes').select('*').order('created_at', { ascending: false }).limit(50);
      if (subjectId) q = q.eq('subject_id', subjectId);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data || []).map(mapQuiz);
    }
    return lsCollection('quizzes').map(mapQuiz);
  },

  async get(id) {
    if (rt.mode === 'supabase' && rt.user) {
      const { data, error } = await rt.client.from('quizzes').select('*').eq('id', id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? mapQuiz(data) : null;
    }
    const r = lsCollection('quizzes').find((q) => q.id === id);
    return r ? mapQuiz(r) : null;
  },

  async save(data) {
    if (rt.mode === 'supabase' && rt.user) {
      const { data: row, error } = await rt.client
        .from('quizzes')
        .insert({
          user_id: rt.user.id, subject: data.subjectName || data.subject || '',
          subject_id: data.subjectId ?? null, topic: data.topic || 'General',
          difficulty: data.difficulty || 'medium', source: data.source || 'ai',
          title: data.title || `${data.topic} quiz`, questions: data.questions || [],
        })
        .select().single();
      if (error) throw new Error(error.message);
      return mapQuiz(row);
    }
    const row = {
      id: uid('qz'), createdAt: nowISO(),
      subjectId: data.subjectId ?? null,
      questions: data.questions || [], ...data,
    };
    lsWrite('quizzes', [row, ...lsCollection('quizzes')].slice(0, 60));
    return mapQuiz(row);
  },

  async remove(id) {
    if (rt.mode === 'supabase' && rt.user) {
      const { error } = await rt.client.from('quizzes').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    }
    lsWrite('quizzes', lsCollection('quizzes').filter((q) => q.id !== id));
    return true;
  },
};

/**
 * Normalises one quiz result. Reads the database shape (snake_case) or the
 * camelCase shape the UI passes in, and exposes both to callers so pages can
 * use whichever reads best (`percentage` or `scorePct`, `score` or `correctCount`).
 */
const mapResult = (r = {}) => {
  const total = Number(r.total) || 0;
  const score = Number(r.score ?? r.correctCount) || 0;
  const percentage = Number(r.percentage ?? r.scorePct) || (total ? Math.round((score / total) * 100) : 0);
  const subject = r.subject || '';
  const topic = r.topic || 'General';
  const difficulty = r.difficulty || 'medium';
  const durationSeconds = Number(r.duration_seconds ?? r.durationSec) || 0;
  return {
    id: r.id,
    quizId: r.quiz_id ?? r.quizId ?? null,
    subject,
    subjectId: r.subject_id ?? r.subjectId ?? null,
    topic,
    difficulty,
    title: r.title || `${subject ? subject + ' · ' : ''}${topic}`.trim(),
    score,
    correctCount: score,
    total,
    percentage,
    scorePct: percentage,
    answers: r.answers || [],
    wrongTopics: r.wrong_topics ?? r.wrongTopics ?? [],
    durationSeconds,
    durationSec: durationSeconds,
    createdAt: r.created_at ?? r.createdAt ?? null,
  };
};

export const quizResults = {
  async list({ limit = 50 } = {}) {
    let rows;
    if (rt.mode === 'supabase' && rt.user) {
      const { data, error } = await rt.client
        .from('quiz_results').select('*').order('created_at', { ascending: false }).limit(limit);
      if (error) throw new Error(error.message);
      rows = (data || []).map(mapResult);
    } else {
      rows = lsCollection('quizResults').map(mapResult);
    }
    return rows
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, limit);
  },

  async add(result = {}) {
    const total = Number(result.total) || 0;
    const score = Number(result.score ?? result.correctCount) || 0;
    const percentage = Number(result.percentage ?? result.scorePct) || (total ? Math.round((score / total) * 100) : 0);
    const durationSeconds = Number(result.durationSeconds ?? result.durationSec) || 0;
    const values = {
      quizId: result.quizId ?? null,
      subject: result.subject || '',
      subjectId: result.subjectId ?? null,
      topic: result.topic || 'General',
      difficulty: result.difficulty || 'medium',
      title: result.title || `${result.subject ? result.subject + ' · ' : ''}${result.topic || 'General'}`.trim(),
      score,
      total,
      percentage,
      answers: result.answers || [],
      wrongTopics: result.wrongTopics || [],
      durationSeconds,
    };

    if (rt.mode === 'supabase' && rt.user) {
      const { data: row, error } = await rt.client
        .from('quiz_results')
        .insert({
          user_id: rt.user.id, quiz_id: values.quizId, subject: values.subject,
          subject_id: values.subjectId, topic: values.topic, difficulty: values.difficulty,
          score: values.score, total: values.total, percentage: values.percentage,
          answers: values.answers, wrong_topics: values.wrongTopics,
          duration_seconds: values.durationSeconds,
        })
        .select().single();
      if (error) throw new Error(error.message);
      return mapResult(row);
    }
    const row = { id: uid('res'), createdAt: nowISO(), ...values };
    lsWrite('quizResults', [row, ...lsCollection('quizResults')].slice(0, 200));
    return mapResult(row);
  },
};

/* ========================================================== ASSESSMENTS == */

/**
 * Normalises one assessment attempt. Same two-shape contract as mapResult():
 * reads the database columns (snake_case) or the camelCase the UI passes in.
 */
const mapAttempt = (a = {}) => {
  const total = Number(a.total) || 0;
  const correct = Number(a.correct_count ?? a.correctCount) || 0;
  const percentage = Number(a.percentage ?? a.score_pct ?? a.scorePct) || (total ? Math.round((correct / total) * 100) : 0);
  const durationSeconds = Number(a.duration_seconds ?? a.duration_sec ?? a.durationSec ?? a.durationSeconds) || 0;
  const timeLimitSeconds = Number(a.time_limit_seconds ?? a.time_limit_sec ?? a.timeLimitSec ?? a.timeLimitSeconds) || 0;
  return {
    id: a.id,
    userId: a.user_id ?? a.userId ?? null,
    subject: a.subject || '',
    subjectId: a.subject_id ?? a.subjectId ?? null,
    topic: a.topic || 'General',
    difficulty: a.difficulty || 'medium',
    title: a.title || `${a.subject || 'Assessment'} · ${a.topic || 'General'}`,
    correct,
    correctCount: correct,
    total,
    percentage,
    scorePct: percentage,
    durationSeconds,
    durationSec: durationSeconds,
    timeLimitSeconds,
    answers: a.answers || [],
    wrongTopics: a.wrong_topics ?? a.wrongTopics ?? [],
    createdAt: a.created_at ?? a.createdAt ?? null,
  };
};

/**
 * Timed assessment attempts plus the cross-student leaderboard.
 *
 * The leaderboard is the only place the app reads another student's rows, and
 * it never does so through a normal SELECT: `quiz_results_own_all`-style RLS
 * stays owner-only, and the board comes from the SECURITY DEFINER function
 * `assessment_leaderboard()` in supabase/schema.sql, which exposes aggregated
 * numbers and display names only - never raw answers.
 *
 * In local/mongo mode there is no shared database, so the board falls back to
 * the signed-in student's own attempts ranked together. That keeps the UI
 * honest instead of showing an empty board.
 */
export const assessments = {
  /** Saves one finished attempt. Used by the assessment page on submit. */
  async save(attempt = {}) {
    const values = mapAttempt(attempt);

    if (rt.mode === 'supabase' && rt.user) {
      const { data: row, error } = await rt.client
        .from('assessment_attempts')
        .insert({
          user_id: rt.user.id,
          subject: values.subject,
          subject_id: values.subjectId,
          topic: values.topic,
          difficulty: values.difficulty,
          title: values.title,
          total: values.total,
          correct_count: values.correct,
          percentage: values.percentage,
          duration_seconds: values.durationSeconds,
          time_limit_seconds: values.timeLimitSeconds,
          answers: values.answers,
          wrong_topics: values.wrongTopics,
        })
        .select()
        .single();
      if (error) throw new Error(error.message);
      return mapAttempt(row);
    }

    const row = { id: uid('asm'), userId: rt.user?.id ?? 'local', createdAt: nowISO(), ...values };
    lsWrite('assessmentAttempts', [row, ...lsCollection('assessmentAttempts')].slice(0, 200));
    return mapAttempt(row);
  },

  /** The signed-in student's own attempts, newest first. */
  async listMine({ limit = 50 } = {}) {
    let rows;
    if (rt.mode === 'supabase' && rt.user) {
      const { data, error } = await rt.client
        .from('assessment_attempts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);
      if (error) throw new Error(error.message);
      rows = (data || []).map(mapAttempt);
    } else {
      rows = lsCollection('assessmentAttempts').map(mapAttempt);
    }
    return rows
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, limit);
  },

  /**
   * Ranked board of every student's best attempt.
   * @param {{limit?:number, subjectId?:string|null}} opts
   * @returns {Promise<Array<{rank:number,name:string,subject:string,topic:string,
   *   difficulty:string,score:number,total:number,correct:number,durationSeconds:number,
   *   timeLimitSeconds:number,isMe:boolean,createdAt:string|null}>>}
   */
  async leaderboard({ limit = 25, subjectId = null } = {}) {
    let rows = [];

    if (rt.mode === 'supabase' && rt.user) {
      const { data, error } = await rt.client.rpc('assessment_leaderboard', {
        p_limit: limit,
        p_subject_id: subjectId || null,
      });
      if (error) throw new Error(error.message);
      rows = data || [];
    } else {
      // No shared database in local mode: rank this student's own attempts so
      // the board still shows real numbers instead of pretending to be global.
      const mine = await this.listMine({ limit: 100 });
      rows = rankLocally(
        mine.map((m) => ({ ...m, full_name: 'You' })),
        limit,
      );
    }

    return rows.map((r, i) => ({
      rank: Number(r.rank) || i + 1,
      name: r.full_name || r.name || 'Student',
      subject: r.subject || '',
      subjectId: r.subject_id ?? r.subjectId ?? null,
      topic: r.topic || 'General',
      difficulty: r.difficulty || 'medium',
      score: Math.round(Number(r.percentage ?? r.score) || 0),
      total: Number(r.total) || 0,
      correct: Number(r.correct_count ?? r.correct) || 0,
      durationSeconds: Number(r.duration_seconds ?? r.durationSec) || 0,
      timeLimitSeconds: Number(r.time_limit_seconds ?? r.timeLimitSec) || 0,
      isMe: rt.user ? r.user_id === rt.user.id || r.userId === rt.user.id : true,
      createdAt: r.created_at ?? r.createdAt ?? null,
    }));
  },
};

/**
 * Fallback ranking used when there is no shared leaderboard function: one best
 * row per student, ordered the same way the SQL function orders it - most
 * correct first, then fastest.
 */
function rankLocally(rows, limit) {
  const best = new Map();
  for (const r of rows) {
    const key = r.user_id ?? r.userId ?? 'local';
    const prev = best.get(key);
    if (!prev || betterAttempt(r, prev)) best.set(key, r);
  }
  return [...best.values()]
    .sort((a, b) => {
      const c = Number(b.correct_count ?? b.correct ?? 0) - Number(a.correct_count ?? a.correct ?? 0);
      if (c !== 0) return c;
      return (Number(a.duration_seconds ?? a.durationSec ?? 0) || 0) - (Number(b.duration_seconds ?? b.durationSec ?? 0) || 0);
    })
    .slice(0, limit)
    .map((r, i) => ({ ...r, rank: i + 1 }));
}

function betterAttempt(a, b) {
  const ac = Number(a.correct_count ?? a.correct ?? 0);
  const bc = Number(b.correct_count ?? b.correct ?? 0);
  if (ac !== bc) return ac > bc;
  return (Number(a.duration_seconds ?? a.durationSec ?? 0) || 0) < (Number(b.duration_seconds ?? b.durationSec ?? 0) || 0);
}

/* ======================================================= STUDY SESSIONS == */
export const studySessions = {
  async add({ minutes = 0, subjectId = null, lessonId = null, source = 'study' }) {
    const mins = Math.max(0, Math.round(minutes));
    if (!mins) return null;
    if (rt.mode === 'supabase' && rt.user) {
      const { data, error } = await rt.client
        .from('study_sessions')
        .insert({ user_id: rt.user.id, minutes: mins, subject_id: subjectId, lesson_id: lessonId, source, created_at: nowISO() })
        .select().single();
      if (error) throw new Error(error.message);
      return data;
    }
    const row = { id: uid('ses'), minutes: mins, subjectId, lessonId, source, createdAt: nowISO() };
    lsWrite('studySessions', [...lsCollection('studySessions'), row].slice(-800));
    return row;
  },

  async list() {
    if (rt.mode === 'supabase' && rt.user) {
      const { data, error } = await rt.client
        .from('study_sessions').select('*').order('created_at', { ascending: false }).limit(500);
      if (error) throw new Error(error.message);
      return (data || []).map((r) => ({ id: r.id, minutes: r.minutes, subjectId: r.subject_id, lessonId: r.lesson_id, source: r.source, createdAt: r.created_at }));
    }
    return lsCollection('studySessions');
  },

  /**
   * Everything the dashboards need, in one pass.
   *
   * Shape (minutes unless stated):
   *   today, week, total   minute totals
   *   days                 last 90 days, oldest first -> [{ key, date, label, minutes }]
   *   weekDays             the last 7 entries of `days`
   *   streak, bestStreak   consecutive days with study time
   *   activeDays, avgPerDay
   */
  async stats() {
    const [sessions, results, doneLessons, subs] = await Promise.all([
      this.list(), quizResults.list({ limit: 200 }), lessonProgress.countDone(), subjects.list(),
    ]);

    const byDay = {};
    sessions.forEach((s) => {
      const k = dayKey(s.createdAt);
      byDay[k] = (byDay[k] || 0) + (s.minutes || 0);
    });

    /* 90-day series, oldest first: enough for the 14-day line chart and the 12-week heatmap. */
    const days = [];
    for (let i = 89; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const k = dayKey(d);
      days.push({
        key: k,
        date: d.toISOString(),
        label: d.toLocaleDateString(undefined, { weekday: 'short' }),
        minutes: byDay[k] || 0,
      });
    }
    const weekDays = days.slice(-7);

    const minutesToday = byDay[dayKey()] || 0;
    const week = weekDays.reduce((a, d) => a + d.minutes, 0);
    const monthKeys = new Set(days.slice(-30).map((d) => d.key));
    const minutes30 = days.slice(-30).reduce((a, d) => a + d.minutes, 0);

    /* streak: consecutive days ending today (or yesterday, so today is still winnable) */
    const set = new Set(Object.keys(byDay).filter((k) => byDay[k] > 0));
    const cursor = new Date();
    if (!set.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
    let streak = 0;
    while (set.has(dayKey(cursor))) {
      streak++;
      cursor.setDate(cursor.getDate() - 1);
    }

    /* best streak ever, walking the real history backwards */
    const allDays = [...new Set(sessions.map((s) => dayKey(s.createdAt)))].sort();
    let bestStreak = 0;
    let run = 0;
    let prev = null;
    allDays.forEach((k) => {
      const d = new Date(`${k}T00:00:00`);
      run = prev && Math.round((d - prev) / 86400000) === 1 ? run + 1 : 1;
      prev = d;
      if (run > bestStreak) bestStreak = run;
    });

    const graded = results.filter((r) => r.total > 0);
    const quizAvg = graded.length
      ? Math.round(graded.reduce((a, r) => a + r.percentage, 0) / graded.length)
      : 0;

    const totalMinutes = sessions.reduce((a, s) => a + (s.minutes || 0), 0);
    const activeDays = allDays.length;
    const avgPerDay = activeDays ? Math.round(totalMinutes / activeDays) : 0;
    const overall = subs.length
      ? Math.round(subs.reduce((a, s) => a + s.progressPct, 0) / subs.length)
      : 0;

    const subjectMap = {};
    subs.forEach((s) => { subjectMap[s.name] = s.progressPct; });

    const topicMisses = {};
    graded.forEach((r) => (r.wrongTopics || []).forEach((t) => { topicMisses[t] = (topicMisses[t] || 0) + 1; }));
    const weakTopics = Object.entries(topicMisses).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([t, n]) => ({ topic: t, misses: n }));

    return {
      days,
      weekDays,
      today: minutesToday,
      week,
      total: totalMinutes,
      minutesToday,
      minutes30,
      totalMinutes,
      streak,
      bestStreak,
      activeDays,
      avgPerDay,
      quizAvg,
      quizzesTaken: graded.length,
      lessonsDone: doneLessons,
      overall,
      subjectMap,
      weakTopics,
      best: graded.length ? Math.max(...graded.map((r) => r.percentage)) : 0,
    };
  },
};

/* ================================================================ TASKS == */
const mapTask = (r) => ({
  id: r.id,
  title: r.title,
  subjectId: r.subject_id || null,
  subject: r.subject || '',
  dueDate: r.due_date || '',
  done: !!r.done,
  completedAt: r.completed_at || null,
  createdAt: r.created_at,
});

export const tasks = {
  async list({ includeDone = true } = {}) {
    let rows;
    if (rt.mode === 'supabase' && rt.user) {
      const { data, error } = await rt.client.from('study_tasks').select('*').order('created_at', { ascending: false }).limit(100);
      if (error) throw new Error(error.message);
      rows = (data || []).map(mapTask);
    } else {
      rows = lsCollection('tasks').map(mapTask);
    }
    return includeDone ? rows : rows.filter((t) => !t.done);
  },

  async add(data) {
    if (rt.mode === 'supabase' && rt.user) {
      const { data: row, error } = await rt.client
        .from('study_tasks')
        .insert({ user_id: rt.user.id, title: data.title, subject_id: data.subjectId ?? null, subject: data.subject || '', due_date: data.dueDate || '', done: false })
        .select().single();
      if (error) throw new Error(error.message);
      return mapTask(row);
    }
    const row = { id: uid('task'), done: false, createdAt: nowISO(), ...data };
    lsWrite('tasks', [row, ...lsCollection('tasks')]);
    return row;
  },

  async toggle(id) {
    const list = await this.list();
    const t = list.find((x) => x.id === id);
    if (!t) throw new Error('Task not found.');
    const done = !t.done;
    if (rt.mode === 'supabase' && rt.user) {
      const { error } = await rt.client.from('study_tasks').update({ done, completed_at: done ? nowISO() : null }).eq('id', id);
      if (error) throw new Error(error.message);
    } else {
      lsWrite('tasks', list.map((x) => (x.id === id ? { ...x, done, completedAt: done ? nowISO() : null } : x)));
    }
    return { ...t, done };
  },

  async remove(id) {
    if (rt.mode === 'supabase' && rt.user) {
      const { error } = await rt.client.from('study_tasks').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    }
    lsWrite('tasks', lsCollection('tasks').filter((t) => t.id !== id));
    return true;
  },
};

/* =========================================================== CONVERSATION */
const mapConv = (r) => ({
  id: r.id,
  title: r.title,
  mode: r.mode || 'chat',
  lessonId: r.lesson_id || null,
  messageCount: r.message_count ?? undefined,
  createdAt: r.created_at,
  updatedAt: r.updated_at || r.created_at,
});

export const conversations = {
  async list() {
    let rows;
    if (rt.mode === 'supabase' && rt.user) {
      const { data, error } = await rt.client
        .from('ai_conversations').select('*').order('updated_at', { ascending: false }).limit(50);
      if (error) throw new Error(error.message);
      rows = (data || []).map(mapConv);
    } else {
      rows = lsCollection('conversations').map(mapConv);
    }
    return rows.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
  },

  async create({ title = 'New chat', mode = 'chat', lessonId = null }) {
    if (rt.mode === 'supabase' && rt.user) {
      const { data: row, error } = await rt.client
        .from('ai_conversations')
        .insert({ user_id: rt.user.id, title, mode, lesson_id: lessonId })
        .select().single();
      if (error) throw new Error(error.message);
      return mapConv(row);
    }
    const row = { id: uid('conv'), title, mode, lessonId, createdAt: nowISO(), updatedAt: nowISO() };
    lsWrite('conversations', [row, ...lsCollection('conversations')]);
    return row;
  },

  async rename(id, title) {
    if (rt.mode === 'supabase' && rt.user) {
      const { error } = await rt.client.from('ai_conversations').update({ title, updated_at: nowISO() }).eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    }
    lsWrite('conversations', lsCollection('conversations').map((c) => (c.id === id ? { ...c, title, updatedAt: nowISO() } : c)));
    return true;
  },

  async touch(id) {
    if (rt.mode === 'supabase' && rt.user) {
      await rt.client.from('ai_conversations').update({ updated_at: nowISO() }).eq('id', id);
    } else {
      lsWrite('conversations', lsCollection('conversations').map((c) => (c.id === id ? { ...c, updatedAt: nowISO() } : c)));
    }
  },

  async remove(id) {
    if (rt.mode === 'supabase' && rt.user) {
      await rt.client.from('ai_messages').delete().eq('conversation_id', id);
      const { error } = await rt.client.from('ai_conversations').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    }
    lsWrite('messages', lsCollection('messages').filter((m) => m.conversationId !== id));
    lsWrite('conversations', lsCollection('conversations').filter((c) => c.id !== id));
    return true;
  },
};

export const messages = {
  async list(conversationId) {
    let rows;
    if (rt.mode === 'supabase' && rt.user) {
      const { data, error } = await rt.client
        .from('ai_messages').select('*').eq('conversation_id', conversationId).order('created_at');
      if (error) throw new Error(error.message);
      rows = (data || []).map((r) => ({ id: r.id, conversationId: r.conversation_id, role: r.role, content: r.content, mode: r.mode, createdAt: r.created_at }));
    } else {
      rows = lsCollection('messages').filter((m) => m.conversationId === conversationId);
    }
    return rows.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)));
  },

  async add(conversationId, role, content, mode = 'chat') {
    if (rt.mode === 'supabase' && rt.user) {
      const { data: row, error } = await rt.client
        .from('ai_messages')
        .insert({ user_id: rt.user.id, conversation_id: conversationId, role, content, mode })
        .select().single();
      if (error) throw new Error(error.message);
      await conversations.touch(conversationId);
      return row;
    }
    const row = { id: uid('msg'), conversationId, role, content, mode, createdAt: nowISO() };
    lsWrite('messages', [...lsCollection('messages'), row].slice(-600));
    await conversations.touch(conversationId);
    return row;
  },

  /** Replace the last assistant message (used by "regenerate"). */
  async replaceLast(conversationId, content) {
    if (rt.mode === 'supabase' && rt.user) {
      const list = await this.list(conversationId);
      const last = [...list].reverse().find((m) => m.role === 'assistant');
      if (!last) return this.add(conversationId, 'assistant', content);
      const { error } = await rt.client.from('ai_messages').update({ content }).eq('id', last.id);
      if (error) throw new Error(error.message);
      return { ...last, content };
    }
    const list = lsCollection('messages');
    for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].conversationId === conversationId && list[i].role === 'assistant') {
        list[i] = { ...list[i], content };
        lsWrite('messages', list);
        return list[i];
      }
    }
    return this.add(conversationId, 'assistant', content);
  },
};

/* ============================================================ FLASHCARDS == */
const mapCard = (r) => ({
  id: r.id,
  deck: r.deck || 'General',
  subjectId: r.subject_id || null,
  front: r.front,
  back: r.back,
  topic: r.topic || 'General',
  rating: r.rating || 0,
  createdAt: r.created_at,
});

export const flashcards = {
  async list({ subjectId = null, deck = null } = {}) {
    let rows;
    if (rt.mode === 'supabase' && rt.user) {
      let q = rt.client.from('flashcards').select('*').order('created_at', { ascending: false }).limit(400);
      if (subjectId) q = q.eq('subject_id', subjectId);
      if (deck) q = q.eq('deck', deck);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      rows = (data || []).map(mapCard);
    } else {
      rows = lsCollection('flashcards').map(mapCard)
        .filter((c) => (subjectId ? c.subjectId === subjectId : true))
        .filter((c) => (deck ? c.deck === deck : true));
    }
    return rows;
  },

  async decks() {
    const all = await this.list();
    const map = new Map();
    all.forEach((c) => {
      if (!map.has(c.deck)) map.set(c.deck, { name: c.deck, count: 0, subjectId: c.subjectId });
      map.get(c.deck).count++;
    });
    return [...map.values()].sort((a, b) => b.count - a.count);
  },

  async addMany(cards, { deck = 'General', subjectId = null } = {}) {
    if (!cards.length) return [];
    if (rt.mode === 'supabase' && rt.user) {
      const rows = cards.map((c) => ({
        user_id: rt.user.id, deck, subject_id: subjectId, front: c.front, back: c.back, topic: c.topic || 'General', rating: 0,
      }));
      const { data, error } = await rt.client.from('flashcards').insert(rows).select();
      if (error) throw new Error(error.message);
      return (data || []).map(mapCard);
    }
    const rows = cards.map((c) => ({ id: uid('fc'), deck, subjectId, front: c.front, back: c.back, topic: c.topic || 'General', rating: 0, createdAt: nowISO() }));
    lsWrite('flashcards', [...rows, ...lsCollection('flashcards')].slice(0, 800));
    return rows;
  },

  async rate(id, rating) {
    if (rt.mode === 'supabase' && rt.user) {
      const { error } = await rt.client.from('flashcards').update({ rating }).eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    }
    lsWrite('flashcards', lsCollection('flashcards').map((c) => (c.id === id ? { ...c, rating } : c)));
    return true;
  },

  async remove(id) {
    if (rt.mode === 'supabase' && rt.user) {
      const { error } = await rt.client.from('flashcards').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    }
    lsWrite('flashcards', lsCollection('flashcards').filter((c) => c.id !== id));
    return true;
  },

  async removeDeck(name) {
    if (rt.mode === 'supabase' && rt.user) {
      const { error } = await rt.client.from('flashcards').delete().eq('deck', name);
      if (error) throw new Error(error.message);
      return true;
    }
    lsWrite('flashcards', lsCollection('flashcards').filter((c) => c.deck !== name));
    return true;
  },
};

/* ========================================================== NOTIFICATIONS = */
const mapNotif = (r) => ({
  id: r.id, title: r.title, body: r.body || '', icon: r.icon || 'bell',
  kind: r.kind || 'info', link: r.link || '', read: !!r.read, createdAt: r.created_at,
});

export const notifications = {
  async list() {
    let rows;
    if (rt.mode === 'supabase' && rt.user) {
      const { data, error } = await rt.client
        .from('notifications').select('*').order('created_at', { ascending: false }).limit(40);
      if (error) throw new Error(error.message);
      rows = (data || []).map(mapNotif);
    } else {
      rows = lsCollection('notifications').map(mapNotif);
    }
    return rows.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  },

  async push(n) {
    if (rt.mode === 'supabase' && rt.user) {
      const { data: row, error } = await rt.client
        .from('notifications')
        .insert({ user_id: rt.user.id, title: n.title, body: n.body, icon: n.icon, kind: n.kind, link: n.link, read: false, created_at: nowISO() })
        .select().single();
      if (error) throw new Error(error.message);
      return mapNotif(row);
    }
    const row = { id: uid('ntf'), read: false, createdAt: nowISO(), ...n };
    lsWrite('notifications', [row, ...lsCollection('notifications')].slice(0, 60));
    return row;
  },

  async markRead(id) {
    if (rt.mode === 'supabase' && rt.user) {
      const { error } = await rt.client.from('notifications').update({ read: true }).eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    }
    lsWrite('notifications', lsCollection('notifications').map((n) => (n.id === id ? { ...n, read: true } : n)));
    return true;
  },

  async markAllRead() {
    if (rt.mode === 'supabase' && rt.user) {
      const { error } = await rt.client.from('notifications').update({ read: true }).eq('read', false);
      if (error) throw new Error(error.message);
      return true;
    }
    lsWrite('notifications', lsCollection('notifications').map((n) => ({ ...n, read: true })));
    return true;
  },

  async clear() {
    if (rt.mode === 'supabase' && rt.user) {
      const { error } = await rt.client.from('notifications').delete().neq('id', '00000000-0000-0000-0000-000000000000');
      if (error) throw new Error(error.message);
      return true;
    }
    lsWrite('notifications', []);
    return true;
  },

  /** Derive genuinely useful notifications from real data (once per day each). */
  async sync() {
    try {
      const settings = await profile.getSettings();
      if (!settings.notifications) return;
      const [stats, list, openTasks, subs] = await Promise.all([
        studySessions.stats(), this.list(), tasks.list({ includeDone: false }), subjects.list(),
      ]);
      const existingKinds = new Set(list.filter((n) => dayKey(n.createdAt) === dayKey()).map((n) => n.kind));
      const add = async (kind, n) => {
        if (existingKinds.has(kind)) return;
        existingKinds.add(kind);
        await this.push({ ...n, kind });
      };

      if (stats.streak >= 2) {
        await add('streak', {
          title: `🔥 You're on a ${stats.streak}-day streak!`,
          body: 'Keep it alive — even 10 focused minutes today counts.',
          icon: 'flame', link: '/progress.html',
        });
      }

      const p = await profile.get();
      const goal = p?.dailyGoalMinutes || 60;
      if (stats.minutesToday < goal) {
        await add('reminder', {
          title: '⏰ Don’t forget today’s study session',
          body: `${Math.max(0, goal - stats.minutesToday)} minutes left to hit your ${goal} min goal.`,
          icon: 'clock', link: '/dashboard.html',
        });
      }

      const remaining = subs.reduce((a, s) => a + Math.max(0, (s.lessonCount || 0) - (s.doneCount || 0)), 0);
      if (remaining > 0 && openTasks.length === 0 && stats.minutesToday < goal) {
        await add('lessons', {
          title: `📚 You have ${Math.min(remaining, 5)} lesson${remaining > 1 ? 's' : ''} in progress`,
          body: 'Pick one small topic and finish it today.',
          icon: 'book', link: '/subjects.html',
        });
      }

      const results = await quizResults.list({ limit: 10 });
      for (let i = 0; i < results.length - 1; i++) {
        const diff = results[i].percentage - results[i + 1].percentage;
        if (diff >= 10 && results[i].topic === results[i + 1].topic) {
          await add('score-up', {
            title: `🧠 Your ${results[i].topic} quiz score improved by ${diff}%`,
            body: `You went from ${results[i + 1].percentage}% to ${results[i].percentage}%.`,
            icon: 'trend', link: '/progress.html',
          });
          break;
        }
      }
    } catch (err) {
      console.warn('[store] notification sync skipped:', err.message);
    }
  },
};

/* ============================================================ STUDY PLAN == */
const mapPlan = (r) => ({
  id: r.id, title: r.title, plan: r.payload || {}, createdAt: r.created_at, updatedAt: r.updated_at,
});

export const studyPlans = {
  async latest() {
    if (rt.mode === 'supabase' && rt.user) {
      const { data, error } = await rt.client
        .from('study_plans').select('*').order('created_at', { ascending: false }).limit(1);
      if (error) throw new Error(error.message);
      return data?.length ? mapPlan(data[0]) : null;
    }
    const list = lsCollection('studyPlans');
    if (!list.length) return null;
    const sorted = [...list].sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
    return mapPlan(sorted[0]);
  },

  async save(plan) {
    const title = plan?.title || 'My Study Plan';
    if (rt.mode === 'supabase' && rt.user) {
      const { data: row, error } = await rt.client
        .from('study_plans')
        .insert({ user_id: rt.user.id, title, payload: plan, updated_at: nowISO() })
        .select().single();
      if (error) throw new Error(error.message);
      return mapPlan(row);
    }
    const row = { id: uid('plan'), title, payload: plan, createdAt: nowISO() };
    lsWrite('studyPlans', [row, ...lsCollection('studyPlans')].slice(0, 10));
    return mapPlan(row);
  },

  async remove(id) {
    if (rt.mode === 'supabase' && rt.user) {
      const { error } = await rt.client.from('study_plans').delete().eq('id', id);
      if (error) throw new Error(error.message);
      return true;
    }
    lsWrite('studyPlans', lsCollection('studyPlans').filter((p) => p.id !== id));
    return true;
  },
};

/* ============================================================== SEARCH === */
export const search = {
  async all(query) {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return { subjects: [], lessons: [], notes: [], topics: [], quizzes: [] };
    const [subs, allLessons, noteList] = await Promise.all([
      subjects.list(), lessons.list(), notes.list({ query }),
    ]);

    const matchedSubs = subs.filter(
      (s) => s.name.toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q),
    );
    const matchedLessons = allLessons.filter(
      (l) => l.title.toLowerCase().includes(q) || (l.summary || '').toLowerCase().includes(q) ||
        (l.topics || []).some((t) => String(t).toLowerCase().includes(q)),
    ).slice(0, 12);

    const topicSet = new Map();
    subs.forEach((s) => (s.topics || []).forEach((t) => {
      if (String(t).toLowerCase().includes(q) && !topicSet.has(t)) topicSet.set(t, s.name);
    }));
    allLessons.forEach((l) => (l.topics || []).forEach((t) => {
      if (String(t).toLowerCase().includes(q) && !topicSet.has(t)) topicSet.set(t, 'Lesson topic');
    }));

    return {
      subjects: matchedSubs.slice(0, 8),
      lessons: matchedLessons,
      notes: noteList.slice(0, 10),
      topics: [...topicSet.entries()].slice(0, 10).map(([topic, subject]) => ({ topic, subject })),
      quizzes: [],
    };
  },
};

/* ============================================================== DEMO === */
export const demo = {
  available() { return rt.mode === 'local' || rt.mode === 'mongo'; },
  async seed() {
    if (rt.mode !== 'local' && rt.mode !== 'mongo') return false;
    const now = Date.now();
    const iso = (d) => new Date(now - d * 86400000).toISOString();

    // progress on a few lessons
    const map = lsRead('lessonProgress', {}) || {};
    ['prog-1', 'prog-2', 'prog-3', 'math-1', 'math-2', 'sec-1', 'web-1', 'ai-1'].forEach((id, i) => {
      map[id] = { done: true, at: iso(i + 1) };
    });
    lsWrite('lessonProgress', map);

    // study history for the last 14 days
    const sessions = [];
    for (let d = 13; d >= 0; d--) {
      const n = [45, 70, 30, 90, 60, 0, 55, 80, 40, 65, 95, 0, 50, 75][d];
      if (n > 0) sessions.push({ id: uid('ses'), minutes: n, subjectId: null, lessonId: null, source: 'study', createdAt: iso(d) });
    }
    lsWrite('studySessions', [...lsCollection('studySessions'), ...sessions]);

    // quiz results
    const results = [
      ['Programming', 'Recursion', 3, 4, 75, 5],
      ['Mathematics', 'Probability', 4, 5, 80, 6],
      ['Programming', 'Recursion', 4, 4, 100, 7],
      ['Cyber Security', 'Web Attacks', 2, 4, 50, 9],
      ['Mathematics', 'Probability', 3, 4, 75, 11],
      ['Programming', 'Data Structures', 3, 5, 60, 12],
    ].map(([subject, topic, score, total, pct, d]) => ({
      id: uid('res'), quizId: null, subject, subjectId: subject.toLowerCase().replace(/\s+/g, '-'),
      topic, difficulty: 'medium', score, total, percentage: pct,
      answers: [], wrongTopics: pct < 70 ? [topic] : [], durationSeconds: 300 + d, createdAt: iso(d),
    }));
    lsWrite('quizResults', [...results, ...lsCollection('quizResults')]);

    // notes
    const notesList = [
      ['Recursion cheat sheet', 'A recursive function needs a base case and a strictly smaller recursive call. Trace fib(4) by hand to see the call tree. Stack depth grows linearly with input size.', ['Programming', 'Recursion']],
      ['Probability formulas', 'P(A ∪ B) = P(A)+P(B)−P(A∩B). Bayes: P(D|S) = P(S|D)·P(D) / P(S). Base rates dominate when the condition is rare.', ['Mathematics', 'Probability']],
      ['XSS checklist', 'Escape on output, add CSP, mark cookies HttpOnly+Secure+SameSite, never innerHTML user data, sanitise rich text with DOMPurify.', ['Cyber Security']],
    ].map(([title, content, tags], i) => ({
      id: uid('note'), title, content, tags, subject: tags[0], subjectId: null, pinned: i === 0,
      createdAt: iso(i + 1), updatedAt: iso(i + 1),
    }));
    lsWrite('notes', [...notesList, ...lsCollection('notes')]);

    // tasks
    lsWrite('tasks', [
      { id: uid('task'), title: 'Complete JavaScript functions lesson', subject: 'Programming', dueDate: dayKey(), done: false, createdAt: nowISO() },
      { id: uid('task'), title: 'Take Mathematics probability quiz', subject: 'Mathematics', dueDate: dayKey(), done: false, createdAt: nowISO() },
      { id: uid('task'), title: "Review yesterday's notes", subject: '', dueDate: dayKey(), done: false, createdAt: nowISO() },
    ]);

    // flashcard deck
    lsWrite('flashcards', [
      { id: uid('fc'), deck: 'Recursion basics', subjectId: 'programming', front: 'What is a base case?', back: 'The simplest input a recursive function can return directly — it is what terminates the recursion.', topic: 'Recursion', rating: 1, createdAt: nowISO() },
      { id: uid('fc'), deck: 'Recursion basics', subjectId: 'programming', front: 'What does a closure capture?', back: 'References to the variables of the scope where the function was created, keeping them alive after that scope exits.', topic: 'Scope', rating: 0, createdAt: nowISO() },
      { id: uid('fc'), deck: 'Probability formulas', subjectId: 'mathematics', front: 'State Bayes’ theorem.', back: 'P(D|E) = P(E|D)·P(D) / P(E) — reverses a known likelihood into the posterior.', topic: 'Probability', rating: 2, createdAt: nowISO() },
    ]);

    return true;
  },

  async reset() {
    if (rt.mode !== 'local' && rt.mode !== 'mongo') return false;
    ['lessonProgress', 'studySessions', 'quizResults', 'assessmentAttempts', 'notes', 'tasks', 'flashcards',
      'conversations', 'messages', 'notifications', 'quizzes', 'customSubjects', 'customLessons',
      'studyPlans'].forEach((k) => {
      localStorage.removeItem(K(k));
    });
    await persistMongoSnapshot();
    return true;
  },
};

/* ============================================================= BOOTSTRAP = */
async function persistMongoSnapshot() {
  clearTimeout(mongoSyncTimer);
  if (!mongoReady) return;
  const snapshot = readLocalSnapshot();
  mongoSyncChain = mongoSyncChain.catch(() => {}).then(() => putMongoSnapshot(snapshot));
  await mongoSyncChain;
}

export async function clearStoredData() {
  for (const key of Object.keys(localStorage)) {
    if (key.startsWith(CONFIG.STORAGE_PREFIX)) localStorage.removeItem(key);
  }
  await persistMongoSnapshot();
}

let storeInitPromise;
export async function initStore() {
  if (!storeInitPromise) {
    storeInitPromise = (async () => {
      if (rt.mode !== 'supabase') await initMongoPersistence();
      await auth.init();
      return rt.user;
    })();
  }
  return storeInitPromise;
}

export { rt as __runtime };
