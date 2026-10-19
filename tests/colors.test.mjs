// Guard the colors. Every color is in assets/theme.css, one line each, with light-dark().
// If a trace page (or any other file) has its own color value, night mode breaks on that page.
// These tests fail when that happens.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..'); // no jsdom needed here

const THEME = 'assets/theme.css';

// ---------- The CSS color names ----------
const NAMES = `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood
cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray darkgreen
darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray
darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue firebrick floralwhite forestgreen fuchsia
gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender
lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink
lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon
mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise
mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red
rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow
springgreen steelblue tan teal thistle tomato turquoise violet wheat white whitesmoke yellow yellowgreen`.split(/\s+/);
const NAME_RE = new RegExp(`(?<![\\w-])(?:${NAMES.join('|')})(?![\\w-])`, 'i');

// Properties and attributes that hold a color. A color name in one of them is a color value.
const COLOR_PROPS =
  '(?:color|background(?:-color|-image)?|background|fill|stroke|border(?:-(?:top|right|bottom|left|block|inline)(?:-color)?)?(?:-color)?|' +
  'outline(?:-color)?|box-shadow|text-shadow|text-decoration(?:-color)?|caret-color|accent-color|column-rule(?:-color)?|' +
  'stop-color|flood-color|lighting-color|bgcolor)';
// A CSS declaration (fill: red) or an attribute with quotes (fill="red"). Code like `color = RED` is not a match.
const DECL_RE = new RegExp(`(?<![\\w-])${COLOR_PROPS}\\s*(?::|=\\s*["'])\\s*([^;}"'\\n]*)`, 'gi');

// ---------- The detector ----------
// Returns a list of { kind, text } for each color value in the text.
export function findColors(text) {
  const found = [];
  const add = (kind, m) => found.push({ kind, text: m[0].trim(), index: m.index });

  // 1. A hex color: #fff, #FFB3B5, #ff000080. Skip HTML entities (&#8644;), url(#id), and CSS selectors (#bad .x { ... }).
  for (const m of text.matchAll(/(?<![\w&\-/])#(?:[0-9a-fA-F]{8}|[0-9a-fA-F]{6}|[0-9a-fA-F]{3,4})(?![\w-])/g)) {
    const before = text.slice(Math.max(0, m.index - 6), m.index);
    if (/url\(\s*['"]?$/.test(before)) continue;
    if (/(?:href|id|for|xlink:href)=["']$/.test(text.slice(Math.max(0, m.index - 12), m.index))) continue;
    const prev = text[m.index - 1];
    const startsSelector = prev === undefined || /[\s,}]/.test(prev);
    if (startsSelector && /^[^;}\n]*\{/.test(text.slice(m.index + m[0].length))) continue;
    add('hex', m);
  }
  // 2. A color function, or light-dark(). Only theme.css may have these.
  for (const m of text.matchAll(/(?<![\w.$-])(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|light-dark)\(/g)) add('function', m);
  for (const m of text.matchAll(/(?<![\w.$-])color\(\s*(?:srgb|srgb-linear|display-p3|a98-rgb|prophoto-rgb|rec2020|xyz|xyz-d50|xyz-d65)\b/g)) add('function', m);
  // 3. A color name in a color property: fill: white; stroke="red"; border: 1px solid black.
  for (const m of text.matchAll(DECL_RE)) {
    const value = m[1].replace(/var\([^)]*\)|url\([^)]*\)|color-mix\([^)]*\)/gi, ' ');
    const name = value.match(NAME_RE);
    if (name) found.push({ kind: 'name', text: m[0].trim(), index: m.index });
  }
  return found;
}

// ---------- The files to scan ----------
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    if (f === 'node_modules' || f === 'tests' || f === 'scripts' || f === 'fonts' || f.startsWith('.')) continue;
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(css|html|js)$/.test(f)) out.push(p);
  }
  return out;
}
const rel = (p) => relative(ROOT, p).split(sep).join('/');
const files = walk(ROOT).filter((p) => rel(p) !== THEME);

test('the file list is not empty (the test can find the pages)', () => {
  assert.ok(files.some((p) => rel(p).startsWith('subjects/') && p.endsWith('.html')), 'no page found');
  assert.ok(files.some((p) => rel(p) === 'assets/trace.css'), 'trace.css not found');
});

test(`no color value outside ${THEME}`, () => {
  const bad = [];
  for (const p of files) {
    const text = readFileSync(p, 'utf8');
    for (const c of findColors(text)) {
      const line = text.slice(0, c.index).split('\n').length;
      bad.push(`${rel(p)}:${line}  ${c.kind}  ${c.text}`);
    }
  }
  assert.deepEqual(bad, [], `Move each color into ${THEME} as one light-dark() line, and use var(--name) here:\n  ${bad.join('\n  ')}\n`);
});

test(`only ${THEME} chooses light or dark`, () => {
  const bad = [];
  for (const p of files.filter((f) => /\.(css|html)$/.test(f))) {
    const text = readFileSync(p, 'utf8');
    if (/prefers-color-scheme/.test(text)) bad.push(`${rel(p)}  uses prefers-color-scheme`);
    if (/\[data-theme/.test(text)) bad.push(`${rel(p)}  has a [data-theme] selector`);
    if (/color-scheme\s*:/.test(text)) bad.push(`${rel(p)}  sets color-scheme`);
  }
  assert.deepEqual(bad, [], `Light and dark are chosen in ${THEME}. Do not write a dark block in another file:\n  ${bad.join('\n  ')}\n`);
});

test(`${THEME}: each color is one line with both values`, () => {
  const css = readFileSync(join(ROOT, THEME), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  const bad = [];
  const names = [];
  for (const line of css.split('\n')) {
    const m = line.match(/^\s*(--[\w-]+)\s*:(.*)$/);
    if (!m) continue;
    const [, name, value] = m;
    names.push(name);
    // The line must be: --name: light-dark(LIGHT, DARK);  where LIGHT and DARK are colors.
    const parts = value.match(/^\s*light-dark\(\s*(.+?)\s*,\s*((?:rgba?\([^)]*\)|[^,()]+))\s*\)\s*;\s*$/);
    if (!parts) { bad.push(`${name}: write it as one line: light-dark(LIGHT, DARK);`); continue; }
    for (const side of [parts[1], parts[2]]) {
      if (!/^(?:#[0-9a-fA-F]{3,8}|(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch)\([^)]*\))$/.test(side)) bad.push(`${name}: "${side}" is not a color`);
    }
  }
  assert.ok(names.length > 10, 'no color tokens found in theme.css');
  assert.equal(new Set(names).size, names.length, 'a color token is defined two times in theme.css');
  assert.deepEqual(bad, []);
});

// The detector must catch what it should and ignore what it should. A broken detector is a silent failure.
test('the detector finds colors', () => {
  const must = [
    'fill: #fff;', 'fill="#FFB3B5"', 'color: #ff000080;', '--x: #abc;', 'stroke: rgb(1, 2, 3)', 'x{background: rgba(0,0,0,.4)}',
    'color: hsl(10 20% 30%)', 'color: oklch(60% 0.2 30)', 'color: color(display-p3 1 0 0)', 'a { color: light-dark(#fff, #000) }',
    'fill: white;', 'stroke="red"', 'border: 1px solid black', 'style="fill:white"', 'box-shadow: 0 0 4px gray',
    'background-color: Tomato', 'bgcolor="navy"',
  ];
  for (const s of must) assert.ok(findColors(s).length > 0, `not found: ${s}`);
});

test('the detector ignores what is not a color', () => {
  const fine = [
    '&#8644; and &#8212;', 'fill: url(#hatch)', 'href="#add"', '#bad .x { fill: var(--ink); }', '#cafe, #bad { margin: 0 }',
    'fill: var(--accent)', 'stroke: var(--done); stroke-width: 1.4', 'background: color-mix(in srgb, var(--accent) 24%, transparent)',
    'outline: 2px solid transparent', 'fill: none', 'color: currentColor', 'border: 1px solid var(--line)',
    'background: var(--paper) url(red.png)', 'font: 700 15px var(--font-mono)', 'border-color: var(--accent)', 'const color = 1; color(x)',
    'getElementById("red")', 'class="red"', '.rn.red circle { fill: var(--rbred); }', 'document.createElement("tan")',
  ];
  for (const s of fine) assert.deepEqual(findColors(s), [], `false alarm: ${s}`);
});
