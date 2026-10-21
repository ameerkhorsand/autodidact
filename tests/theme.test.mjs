// Test the theme: one file for all colors, and a button that switches Auto, Light, and Dark.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { JSDOM } from 'jsdom';
import { ROOT, loadPage } from './helpers.mjs';

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    if (f === 'node_modules' || f.startsWith('.')) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const rel = (p) => relative(ROOT, p);
const all = walk(ROOT);
const text = (p) => readFileSync(p, 'utf8');
// The files that the site sends to the browser, except the data file and the theme file.
const site = all.filter((p) => /\.(html|css|js)$/.test(p) && !/^(tests|scripts)\//.test(rel(p)) && rel(p) !== 'assets/theme.css' && rel(p) !== 'assets/hub-data.js');
const themeCss = text(join(ROOT, 'assets/theme.css'));

// ---------- the rule: all colors are in assets/theme.css ----------
const NAMED = 'white|black|red|green|blue|gray|grey|orange|yellow|purple|pink|brown|cyan|magenta|silver|gold|navy|teal|maroon|olive|lime|aqua|fuchsia';
function colorLiterals(src) {
  // Remove what looks like a color but is not one: HTML entities, page links, and ids.
  const clean = src
    .replace(/&#x?[0-9A-Fa-f]+;/g, '')
    .replace(/(?:href|xlink:href|id|for|aria-controls|aria-labelledby)="[^"]*"/g, '')
    .replace(/url\(#[^)]*\)/g, '');
  const found = [];
  for (const m of clean.matchAll(/(?<![\w&])#[0-9A-Fa-f]{3,8}\b/g)) found.push(m[0]);
  for (const m of clean.matchAll(/\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\(/g)) found.push(m[0]);
  for (const m of clean.matchAll(/(?<![-\w])color\(/g)) found.push(m[0]);
  // A named color in CSS (color: red) or in an SVG attribute (fill="white").
  // Pseudocode in a code panel, such as "node.color = RED", is not a color of the page.
  const prop = '(?:fill|stroke|color|background(?:-color)?|border(?:-[a-z]+)?-color|stop-color|outline-color)';
  for (const m of clean.matchAll(new RegExp(`(?<![\\w.])${prop}\\s*:\\s*(?:${NAMED})\\b`, 'gi'))) found.push(m[0]);
  for (const m of clean.matchAll(new RegExp(`(?<![\\w.-])(?:fill|stroke|stop-color)="(?:${NAMED})"`, 'g'))) found.push(m[0]);
  return found;
}
test('no page, style, or script has a color of its own. All colors are in assets/theme.css', () => {
  const bad = [];
  for (const p of site) {
    const f = colorLiterals(text(p));
    if (f.length) bad.push(`${rel(p)}: ${[...new Set(f)].slice(0, 5).join(' ')}`);
  }
  assert.deepEqual(bad, [], 'move these colors to assets/theme.css and use var(--name)');
});

test('the color finder finds colors (so the rule above has teeth)', () => {
  assert.deepEqual(colorLiterals('a { color: #fff; }'), ['#fff']);
  assert.deepEqual(colorLiterals('a { fill: rgba(1,2,3,.4); }'), ['rgba(']);
  assert.deepEqual(colorLiterals('<rect fill="white">'), ['fill="white"']);
  assert.deepEqual(colorLiterals('a { background-color: Red; }'), ['background-color: Red']);
  assert.deepEqual(colorLiterals("'if node.color = RED:'"), [], 'pseudocode in a code panel is not a color');
  assert.deepEqual(colorLiterals('<a href="#main">&#8644; url(#arrow)</a>'), []);
  assert.deepEqual(colorLiterals('a { color: var(--ink); background: color-mix(in srgb, var(--accent) 20%, transparent); }'), []);
});

// ---------- the structure of assets/theme.css ----------
function splitArgs(inner) {
  const args = []; let depth = 0, cur = '';
  for (const ch of inner) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { args.push(cur.trim()); cur = ''; } else cur += ch;
  }
  args.push(cur.trim());
  return args;
}
test('theme.css: every color has one light value and one dark value', () => {
  const decls = [...themeCss.matchAll(/^\s*(--[a-z0-9-]+):\s*(.+?);\s*$/gm)];
  assert.ok(decls.length >= 20, 'the palette is missing');
  for (const [, name, value] of decls) {
    const m = value.match(/^light-dark\((.*)\)$/);
    assert.ok(m, `${name} must be light-dark(LIGHT, DARK)`);
    const args = splitArgs(m[1]);
    assert.equal(args.length, 2, `${name} needs exactly two values`);
  }
  assert.match(themeCss, /:root\s*\{\s*color-scheme:\s*light dark;\s*\}/);
  assert.match(themeCss, /:root\[data-theme="light"\]\s*\{\s*color-scheme:\s*light;\s*\}/);
  assert.match(themeCss, /:root\[data-theme="dark"\]\s*\{\s*color-scheme:\s*dark;\s*\}/);
});

test('every color name that a page uses with var() is defined', () => {
  const defined = new Set();
  const used = new Map();
  for (const p of [...site, join(ROOT, 'assets/theme.css')]) {
    const t = text(p);
    for (const m of t.matchAll(/(--[a-z0-9-]+)\s*:/g)) defined.add(m[1]);
    for (const m of t.matchAll(/setProperty\(\s*['"](--[a-z0-9-]+)/g)) defined.add(m[1]);
    for (const m of t.matchAll(/var\((--[a-z0-9-]+)\s*\)/g)) if (!used.has(m[1])) used.set(m[1], rel(p));
  }
  const missing = [...used].filter(([n]) => !defined.has(n)).map(([n, f]) => `${n} (in ${f})`);
  assert.deepEqual(missing, []);
});

test('every page loads theme.css, then theme.js in the head, and declares both color schemes', () => {
  const pages = all.filter((p) => p.endsWith('.html'));
  assert.ok(pages.length >= 22);
  const bad = [];
  for (const p of pages) {
    const t = text(p), head = t.slice(0, t.indexOf('<body'));
    if (!/assets\/theme\.css"/.test(head)) bad.push(`${rel(p)}: no theme.css`);
    if (!/<script src="[./]*assets\/theme\.js"><\/script>/.test(head)) bad.push(`${rel(p)}: theme.js is not in the head`);
    if (!/<meta name="color-scheme" content="light dark">/.test(head)) bad.push(`${rel(p)}: no color-scheme meta`);
  }
  assert.deepEqual(bad, []);
});

// ---------- the button ----------
const themeJs = text(join(ROOT, 'assets/theme.js'));
async function themeDom({ stored, beforeEval, waitForLoad = true } = {}) {
  const dom = new JSDOM('<!doctype html><html><head></head><body></body></html>', { url: 'http://localhost/', runScripts: 'outside-only' });
  const { window } = dom;
  if (stored !== undefined) window.localStorage.setItem('autodidact-theme', stored);
  if (beforeEval) beforeEval(window);
  if (waitForLoad) await new Promise((r) => (window.document.readyState === 'complete' ? r() : window.addEventListener('load', r)));
  window.eval(themeJs);
  if (!waitForLoad) await new Promise((r) => window.addEventListener('load', r));
  const root = window.document.documentElement;
  return { window, document: window.document, root, button: () => window.document.querySelector('.theme-toggle') };
}

test('theme button: the start is Auto, and the click goes Light, Dark, Auto', async () => {
  const { window, root, button } = await themeDom();
  assert.equal(root.hasAttribute('data-theme'), false);
  assert.equal(button().getAttribute('data-mode'), 'auto');
  assert.match(button().getAttribute('aria-label'), /Switch to Light/);
  button().click();
  assert.equal(root.getAttribute('data-theme'), 'light');
  assert.equal(window.localStorage.getItem('autodidact-theme'), 'light');
  assert.match(button().getAttribute('aria-label'), /Theme: Light\. Switch to Dark/);
  button().click();
  assert.equal(root.getAttribute('data-theme'), 'dark');
  assert.equal(window.localStorage.getItem('autodidact-theme'), 'dark');
  button().click();
  assert.equal(root.hasAttribute('data-theme'), false, 'Auto removes the attribute');
  assert.equal(window.localStorage.getItem('autodidact-theme'), null, 'Auto removes the saved choice');
  assert.equal(window.document.querySelectorAll('.theme-toggle').length, 1);
  window.close();
});

test('theme button: a saved choice shows at once, before the page body exists', async () => {
  const { window, root, button } = await themeDom({ stored: 'dark', waitForLoad: false });
  assert.equal(root.getAttribute('data-theme'), 'dark');
  assert.equal(button().getAttribute('data-mode'), 'dark');
  window.close();
});

test('theme button: a bad saved value means Auto', async () => {
  const { window, root, button } = await themeDom({ stored: 'purple' });
  assert.equal(root.hasAttribute('data-theme'), false);
  assert.equal(button().getAttribute('data-mode'), 'auto');
  window.close();
});

test('theme button: it still works when the browser blocks storage', async () => {
  const { window, root, button } = await themeDom({
    beforeEval: (w) => {
      w.Storage.prototype.getItem = () => { throw new w.DOMException('blocked', 'SecurityError'); };
      w.Storage.prototype.setItem = () => { throw new w.DOMException('blocked', 'SecurityError'); };
      w.Storage.prototype.removeItem = () => { throw new w.DOMException('blocked', 'SecurityError'); };
    },
  });
  button().click();
  assert.equal(root.getAttribute('data-theme'), 'light');
  button().click();
  assert.equal(root.getAttribute('data-theme'), 'dark');
  window.close();
});

test('theme button: a change in another tab updates this page', async () => {
  const { window, root, button } = await themeDom();
  window.localStorage.setItem('autodidact-theme', 'dark');
  window.dispatchEvent(new window.StorageEvent('storage', { key: 'autodidact-theme', newValue: 'dark' }));
  assert.equal(root.getAttribute('data-theme'), 'dark');
  assert.equal(button().getAttribute('data-mode'), 'dark');
  window.localStorage.removeItem('autodidact-theme');
  window.dispatchEvent(new window.StorageEvent('storage', { key: 'autodidact-theme', newValue: null }));
  assert.equal(root.hasAttribute('data-theme'), false);
  window.close();
});

test('theme button: it is on the main page, a subject page, and a trace page, with no script error', async () => {
  for (const page of ['index.html', 'subjects/statistics/index.html', 'subjects/data-structures-and-algorithms/quicksort.html']) {
    const { dom, document, errors } = await loadPage(page);
    const b = document.querySelectorAll('.theme-toggle');
    assert.equal(b.length, 1, page);
    b[0].click(); // file:// pages cannot save the choice in some browsers. The click must still work.
    assert.equal(document.documentElement.getAttribute('data-theme'), 'light', page);
    assert.deepEqual(errors, [], page);
    dom.window.close();
  }
});
