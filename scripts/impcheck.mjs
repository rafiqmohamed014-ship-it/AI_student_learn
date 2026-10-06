/**
 * scripts/impcheck.mjs - static audit for one specific class of runtime bug:
 * a symbol exported by one of our own modules that is used in another module
 * but never imported there ("ReferenceError: promptDialog is not defined").
 *
 * Those errors are invisible to `node --check` and easy to miss at runtime
 * because the throw often happens inside a try/catch that shows a generic
 * message. `scripts/check.js` runs this on every check.
 *
 * Comments, strings, template literals and regex literals are blanked out
 * first (newline-preserving, so reported line numbers match the real file),
 * which keeps prose in the source from producing false positives.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, extname, relative } from 'node:path';
import { pathToFileURL } from 'node:url';

/* ------------------------------------------------------------- strip code */
function strip(src) {
  let out = '';
  let i = 0;
  const n = src.length;
  const modes = []; // 'interp' | 'sq' | 'dq' | 'tmpl'
  const top = () => modes[modes.length - 1];

  while (i < n) {
    const c = src[i];
    const d = src[i + 1];
    const mode = top();

    if (mode === 'interp' && c === '}') { modes.pop(); out += '}'; i++; continue; }

    if (mode === undefined || mode === 'interp') {
      if (c === '/' && d === '/') { while (i < n && src[i] !== '\n') i++; continue; }
      if (c === '/' && d === '*') {
        i += 2;
        while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { if (src[i] === '\n') out += '\n'; i++; }
        i += 2;
        continue;
      }
      if (c === '/') {
        // a regex literal may only follow something that cannot end a value
        let k = out.length - 1;
        while (k >= 0 && /\s/.test(out[k])) k--;
        const prev = k >= 0 ? out[k] : '';
        const regexAllowed = prev === '' || '(,{;=:!&|?+-*%~^<>'.includes(prev);
        let j = i + 1;
        let cls = false;
        let ok = false;
        if (regexAllowed) {
          // scan to the first unescaped "/" outside a character class
          while (j < n && src[j] !== '\n') {
            const e = src[j];
            if (e === '\\') { j += 2; continue; }
            if (e === '[') cls = true;
            else if (e === ']') cls = false;
            else if (e === '/' && !cls) { ok = true; break; }
            j++;
          }
        }
        if (ok) {
          i = j + 1;
          while (i < n && /[gimsuyd]/.test(src[i])) i++;
          out += 'RE';
          continue;
        }
      }
      if (c === "'") { modes.push('sq'); out += '""'; i++; continue; }
      if (c === '"') { modes.push('dq'); out += '""'; i++; continue; }
      if (c === '`') { modes.push('tmpl'); out += '``'; i++; continue; }
      out += c; i++;
      continue;
    }

    if (mode === 'sq' || mode === 'dq') {
      const q = mode === 'sq' ? "'" : '"';
      if (c === '\\') { i += 2; continue; }
      if (c === '\n') { out += '\n'; modes.pop(); i++; continue; }
      if (c === q) { modes.pop(); i++; continue; }
      i++;
      continue;
    }

    // mode === 'tmpl'
    if (c === '\\') { i += 2; continue; }
    if (c === '$' && d === '{') { modes.push('interp'); i += 2; continue; }
    if (c === '\n') { out += '\n'; i++; continue; }
    if (c === '`') { modes.pop(); out += '``'; i++; continue; }
    i++;
  }
  return out;
}

const GLOBALS = new Set(`window document console fetch setTimeout clearTimeout setInterval clearInterval
requestAnimationFrame cancelAnimationFrame performance navigator location history localStorage sessionStorage
alert confirm prompt structuredClone TextEncoder TextDecoder crypto URL URLSearchParams AbortController
Blob FormData File FileReader Image Event CustomEvent DOMParser ResizeObserver IntersectionObserver
Promise JSON Math Date Object Array String Number Boolean Error TypeError RangeError SyntaxError RegExp Map Set
WeakMap WeakSet Symbol Intl BigInt Proxy Reflect Infinity NaN isNaN isFinite parseInt parseFloat
encodeURIComponent decodeURIComponent encodeURI decodeURI btoa atob globalThis
import export default from as async await return if else for of in while do switch case break continue
try catch finally throw new typeof instanceof class extends this super null undefined true false
function const let var static get set void delete yield`.split(/\s+/).filter(Boolean));

/**
 * @returns {{ problems: number, lines: string[] }}
 */
export function checkImports(ROOT = '.') {
  const files = [];
  (function walk(d) {
    for (const e of readdirSync(d)) {
      if (e === 'node_modules' || e === '.git') continue;
      const p = join(d, e);
      if (statSync(p).isDirectory()) walk(p);
      else if (extname(p) === '.js') files.push(p);
    }
  })(join(ROOT, 'js'));

  const sources = new Map(files.map((f) => [f, strip(readFileSync(f, 'utf8'))]));

  /* every name our own modules export */
  const exported = new Map();
  for (const [f, src] of sources) {
    const names = new Set();
    for (const m of src.matchAll(/\bexport\s+(?:async\s+)?(?:function|class)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
    for (const m of src.matchAll(/\bexport\s+(?:const|let|var)\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
    for (const m of src.matchAll(/\bexport\s*\{([^}]*)\}/g)) {
      for (const part of m[1].split(',')) {
        const nm = part.trim().split(/\s+as\s+/).pop()?.trim();
        if (nm) names.add(nm);
      }
    }
    if (names.size) exported.set(f, names);
  }

  let problems = 0;
  const lines = [];

  for (const [f, src] of sources) {
    const declared = new Set(GLOBALS);

    for (const m of src.matchAll(/\bimport\s+([\w$]+)?\s*(?:,\s*)?(?:\{([^}]*)\})?\s*from/g)) {
      if (m[1]) declared.add(m[1]);
      if (m[2]) for (const p of m[2].split(',')) { const nm = p.trim().split(/\s+as\s+/).pop()?.trim(); if (nm) declared.add(nm); }
    }
    for (const m of src.matchAll(/\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
    for (const m of src.matchAll(/\b(?:const|let|var)\s*\{([^}]*)\}\s*=/g)) {
      for (const p of m[1].split(',')) { const nm = p.trim().split(/[:=]/)[0].trim(); if (nm) declared.add(nm); }
    }
    for (const m of src.matchAll(/\b(?:const|let|var)\s*\[([^\]]*)\]\s*=/g)) {
      for (const p of m[1].split(',')) { const nm = p.trim().split(/[:=]/)[0].trim(); if (nm) declared.add(nm); }
    }
    for (const m of src.matchAll(/([A-Za-z_$][\w$]*)\s*=>/g)) declared.add(m[1]);
    for (const m of src.matchAll(/\(([^()]*)\)\s*=>/g)) {
      for (const p of m[1].split(',')) { const nm = p.trim().replace(/[^\w$].*$/, '').trim(); if (nm) declared.add(nm); }
    }
    for (const m of src.matchAll(/\bfunction\s*\*?\s*[A-Za-z_$][\w$]*?\s*\(([^)]*)\)/g)) {
      for (const p of m[1].split(',')) {
        const nm = p.trim().replace(/[^\w$].*$/, '').replace(/^\.\.\./, '').trim();
        if (nm) declared.add(nm);
      }
    }
    // object-literal / class method shorthand:  name(...) {  or  get name() {
    for (const m of src.matchAll(/[{,]\s*(?:get\s+|set\s+|async\s+)?([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{/g)) declared.add(m[1]);
    for (const m of src.matchAll(/^\s*([A-Za-z_$][\w$]*)\s*\([^()]*\)\s*\{/gm)) declared.add(m[1]);
    for (const m of src.matchAll(/\bcatch\s*\(\s*([A-Za-z_$][\w$]*)/g)) declared.add(m[1]);
    for (const m of src.matchAll(/\bfor\s*\(\s*(?:const|let|var)\s*\[([^\]]*)\]/g)) {
      for (const p of m[1].split(',')) { const nm = p.trim().replace(/[^\w$].*$/, '').trim(); if (nm) declared.add(nm); }
    }

    const rows = src.split('\n');
    for (let ln = 0; ln < rows.length; ln++) {
      const line = rows[ln];
      for (const m of line.matchAll(/(?<![.\w$'"`])([A-Za-z_$][\w$]*)/g)) {
        const name = m[1];
        if (declared.has(name)) continue;
        // an object-literal / class-field key ("name: ...") is a declaration
        if (/^\s*:(?!:)/.test(line.slice(m.index + m[0].length))) continue;
        const owners = [...exported.entries()]
          .filter(([ff, s]) => s.has(name) && ff !== f)
          .map(([ff]) => relative(ROOT, ff).replace(/\\/g, '/'));
        if (!owners.length) continue;
        problems++;
        lines.push(`${relative(ROOT, f).replace(/\\/g, '/')}:${ln + 1}  "${name}" used but never imported (exported by ${owners.join(', ')})`);
      }
    }
  }

  return { problems, lines };
}

/* ------------------------------------------------------------------- CLI */
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { problems, lines } = checkImports(process.argv[2] || '.');
  if (lines.length) {
    lines.forEach((l) => console.log(`[warn] ${l}`));
    console.log(`\n[warn] ${problems} unimported project symbol(s)`);
    process.exit(1);
  }
  console.log('[ok] every project symbol used is imported');
}
