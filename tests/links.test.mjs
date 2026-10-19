// Test that every local link, script, style sheet, and font in the project points to a file that exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { ROOT } from './helpers.mjs';

function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    if (f === 'node_modules' || f.startsWith('.')) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}
const files = walk(ROOT);
const isLocal = (u) => u && !/^(https?:|mailto:|data:|#|javascript:)/.test(u);
const strip = (u) => u.split('#')[0].split('?')[0];

test('every local reference in an HTML file exists', () => {
  const missing = [];
  for (const f of files.filter((p) => p.endsWith('.html'))) {
    const html = readFileSync(f, 'utf8');
    for (const m of html.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
      if (!isLocal(m[1])) continue;
      if (!existsSync(resolve(dirname(f), strip(m[1])))) missing.push(`${f.slice(ROOT.length + 1)} -> ${m[1]}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('every font file named in a CSS file exists', () => {
  const missing = [];
  for (const f of files.filter((p) => p.endsWith('.css'))) {
    const css = readFileSync(f, 'utf8');
    for (const m of css.matchAll(/url\(([^)]+)\)/g)) {
      const u = m[1].replace(/['"]/g, '');
      if (isLocal(u) && !existsSync(resolve(dirname(f), strip(u)))) missing.push(`${f.slice(ROOT.length + 1)} -> ${u}`);
    }
  }
  assert.deepEqual(missing, []);
});

test('no page loads anything from the network', () => {
  const found = [];
  for (const f of files.filter((p) => /\.(html|css|js)$/.test(p) && !p.includes('/tests/') && !p.includes('/scripts/'))) {
    const text = readFileSync(f, 'utf8');
    if (/(?:href|src)="https?:\/\//.test(text) || /@import\s+url\(\s*['"]?https?:/.test(text) || /url\(\s*['"]?https?:/.test(text)) found.push(f.slice(ROOT.length + 1));
  }
  assert.deepEqual(found, []);
});
