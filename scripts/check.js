#!/usr/bin/env node
/**
 * scripts/check.js - project sanity check.
 *
 * The project has zero dependencies, so this walks every JavaScript file and
 * asks Node to parse it with `node --check`. It also verifies that the files
 * the app loads at runtime actually exist, and that browser modules only
 * import names their targets really export.
 *
 * Run: npm run check   (lint is an alias)
 */

import { readdirSync, statSync, existsSync, readFileSync } from 'node:fs';
import { join, relative, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { checkImports } from './impcheck.mjs';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const SKIP = new Set(['node_modules', '.git', '.vercel', '.opencode', 'data']);
const errors = [];
const warnings = [];

function rel(p) { return relative(ROOT, p).split('\\').join('/'); }

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (SKIP.has(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (extname(entry) === '.js') out.push(full);
  }
  return out;
}

/* ------------------------------------------------------- 1. syntax pass */
const files = walk(ROOT);
for (const file of files) {
  try {
    execFileSync(process.execPath, ['--check', file], { stdio: 'pipe' });
  } catch (err) {
    const out = String(err.stderr || err.stdout || err.message);
    const line = out.split('\n').find((l) => /Error/.test(l)) || out.split('\n')[0];
    errors.push(`${rel(file)}\n    ${line.trim()}`);
  }
}

/* ------------------------------------------- 2. required files exist */
const REQUIRED = [
  'index.html', 'login.html', 'register.html', 'forgot-password.html',
  'dashboard.html', 'subjects.html', 'subject.html', 'ai-tutor.html', 'quiz.html', 'assessment.html',
  'progress.html', 'notes.html', 'flashcards.html', 'study-plan.html', 'search.html',
  'notifications.html', 'profile.html', 'settings.html', 'privacy.html', 'terms.html', '404.html',
  'manifest.json', 'assets/favicon.svg',
  'css/base.css', 'css/layout.css', 'css/components.css',
  'js/config.js', 'js/store.js', 'js/shell.js', 'js/ai.js', 'js/ui.js', 'js/charts.js', 'js/icons.js',
  'js/data/curriculum.js', 'js/data/quizbank.js',
  'server/server.js', 'server/handler.js', 'server/ai-core.js', 'server/prompts.js', 'server/mongo-store.js',
  'api/ai.js', 'api/health.js', 'vercel.json', 'supabase/schema.sql', 'README.md',
];
const PAGES = [
  'landing', 'login', 'register', 'forgot', 'dashboard', 'subjects', 'subject',
  'ai-tutor', 'quiz', 'assessment', 'progress', 'notes', 'flashcards', 'study-plan', 'search',
  'notifications', 'profile', 'settings',
].map((n) => `js/pages/${n}.js`);

const missing = [...REQUIRED, ...PAGES].filter((f) => !existsSync(join(ROOT, f)));
if (missing.length) errors.push(`Missing required files:\n    - ${missing.join('\n    - ')}`);

/* ------------------------------- 3. browser imports must be real exports */
function exportedNames(file) {
  const src = readFileSync(file, 'utf8');
  const names = new Set();
  for (const m of src.matchAll(/^\s*export\s+(?:async\s+)?(?:function|class|const|let|var)\s+([\w$]+)/gm)) names.add(m[1]);
  for (const m of src.matchAll(/^\s*export\s*\{([^}]+)\}/gm)) {
    m[1].split(',').forEach((part) => {
      const n = part.trim().split(/\s+as\s+/).pop().trim();
      if (n) names.add(n);
    });
  }
  if (/^\s*export\s+default\b/m.test(src)) names.add('default');
  return names;
}

const exportCache = new Map();
for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const isBrowser = rel(file).startsWith('js/');
  if (!isBrowser) continue;

  const re = /import\s*\{([^}]+)\}\s*from\s*['"]([^'"]+)['"]/g;
  for (const m of src.matchAll(re)) {
    const spec = m[2];
    if (!spec.startsWith('.')) continue; // bare specifier = CDN, skip
    const target = join(file, '..', spec);
    if (!existsSync(target)) {
      errors.push(`${rel(file)}\n    imports "${spec}" which does not exist`);
      continue;
    }
    if (!exportCache.has(target)) exportCache.set(target, exportedNames(target));
    const have = exportCache.get(target);
    for (const raw of m[1].split(',')) {
      const name = raw.trim().split(/\s+as\s+/)[0].trim();
      if (name && !have.has(name)) {
        errors.push(`${rel(file)}\n    imports { ${name} } from "${spec}" but that module does not export it`);
      }
    }
  }
}

/* -------------------------------- 4. internal links in HTML must resolve */
const htmlFiles = [];
(function collect(dir) {
  for (const e of readdirSync(dir)) {
    if (SKIP.has(e)) continue;
    const full = join(dir, e);
    if (statSync(full).isDirectory()) collect(full);
    else if (extname(e) === '.html') htmlFiles.push(full);
  }
})(ROOT);

const notFound = ['index.html', 'dashboard.html', 'subjects.html', 'subject.html', 'ai-tutor.html',
  'quiz.html', 'assessment.html', 'progress.html', 'notes.html', 'flashcards.html', 'study-plan.html', 'search.html',
  'notifications.html', 'profile.html', 'settings.html', 'login.html', 'register.html',
  'forgot-password.html', 'privacy.html', 'terms.html', '404.html'];

for (const file of htmlFiles) {
  const src = readFileSync(file, 'utf8');
  for (const m of src.matchAll(/(?:href|src)="(\/[^"#?]*)/g)) {
    const target = m[1];
    if (target === '/' || target.startsWith('/api/')) continue;
    if (existsSync(join(ROOT, target))) continue;
    if (notFound.some((n) => target.startsWith('/' + n))) continue;
    warnings.push(`${rel(file)}\n    links to "${target}" which does not exist`);
  }
}

/* ------------------------------------------------- 5. stray template text */
for (const file of htmlFiles) {
  const src = readFileSync(file, 'utf8');
  const line = src.split('\n').findIndex((l) => /\$\{/.test(l));
  if (line !== -1) errors.push(`${rel(file)}:${line + 1}\n    contains a literal "\${" template placeholder`);
}

/* --------------------------------------------------------- 6. AI key hygiene */
for (const file of files) {
  if (rel(file).startsWith('js/')) {
    const src = readFileSync(file, 'utf8');
    if (/sk-[A-Za-z0-9]{20,}/.test(src)) errors.push(`${rel(file)}\n    appears to contain a hard-coded API key`);
    if (/AI_API_KEY\s*=\s*['"][^'"]+['"]/.test(src)) errors.push(`${rel(file)}\n    hard-codes AI_API_KEY in browser code`);
  }
}

/* --------------------------- 7. project symbols used but never imported */
/* A missing import is invisible to the syntax pass and usually surfaces as a
   ReferenceError deep inside a try/catch, so it gets its own static audit. */
const importAudit = checkImports(ROOT);
for (const line of importAudit.lines) {
  errors.push(`${line.split(/\s{2,}/)[0]}\n    used but never imported (would throw ReferenceError at runtime)`);
}


const OK = '[ok]';
const WARN = '[warn]';
const FAIL = '[fail]';

if (errors.length) {
  console.error(`\n${FAIL} ${errors.length} problem(s) found across ${files.length} files:\n`);
  errors.forEach((e) => console.error('  ' + e));
  process.exit(1);
}

if (warnings.length) {
  console.log(`\n${WARN} ${warnings.length} warning(s):\n`);
  warnings.forEach((w) => console.log('  ' + w));
  console.log('');
}

console.log(`${OK} Syntax OK - ${files.length} JavaScript files parsed cleanly.`);
console.log(`${OK} ${REQUIRED.length + PAGES.length} required files present.`);
console.log(`${OK} Browser imports resolve to real exports.`);
console.log(`${OK} No hard-coded AI keys in browser code.`);
console.log(`${OK} Every project symbol used is imported (no hidden ReferenceErrors).`);
console.log('\nAll checks passed.');
