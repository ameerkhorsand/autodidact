// Test the Complexity card. The claims in COMPLEXITY of each page are compared with the counts of its simulation,
// and with references that this test writes itself (a plain loop, a brute-force search, or a known construction).
//
// A page that is not in scripts/complexity-pending.json must have COMPLEXITY, and a driver in DRIVERS below.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadPage } from './helpers.mjs';

const DIR = 'subjects/data-structures-and-algorithms/';
const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const pending = new Set(JSON.parse(readFileSync(join(ROOT, 'scripts', 'complexity-pending.json'), 'utf8')));
const allFiles = manifest.subjects.flatMap((s) => s.traces.map((t) => t.file));
const doneFiles = allFiles.filter((f) => !pending.has(f));
const html = (file) => readFileSync(join(ROOT, DIR, file), 'utf8');
const last = (a) => a[a.length - 1];

// Load the simulation and COMPLEXITY of a page in Node.
const cache = new Map();
function sim(file) {
  if (!cache.has(file)) {
    const h = html(file), a = h.indexOf('//SIM-START'), b = h.indexOf('//COMPLEXITY-END');
    assert.ok(a >= 0 && b > a, `${file}: no //SIM-START ... //COMPLEXITY-END`);
    assert.ok(h.indexOf('//SIM-END') < h.indexOf('//COMPLEXITY-START'), `${file}: COMPLEXITY must come after //SIM-END`);
    const ctx = vm.createContext({ console });
    vm.runInContext(h.slice(a, b), ctx);
    cache.set(file, ctx);
  }
  const ctx = cache.get(file);
  return { ctx, get: (e) => vm.runInContext(e, ctx), run(fn, ...args) { ctx.__args = args; return vm.runInContext(`${fn}.apply(null, __args)`, ctx); } };
}
const plain = (v) => JSON.parse(JSON.stringify(v));

// The runs of each page: a name and the steps. Add a line here when you add COMPLEXITY to a page.
const DRIVERS = {
  'merge-sort.html': (s) => s.get('PRESETS').map((_, pi) => ({ name: `input ${pi}`, steps: s.run('simulate', pi) })),
  'max-heapify.html': (s) => {
    const st = s.run('callStates', s.get('EXAMPLE'));
    return [4, 3, 2, 1].map((i) => ({ name: `node ${i}`, steps: s.run('simulate', 'heapify', Array.from(st[i]), i) }));
  },
  'build-max-heap.html': (s) => [{ name: 'example', steps: s.run('simulate', 'build', s.get('EXAMPLE')) }],
  'josephus.html': (s) => {
    const runs = [];
    for (let n = 2; n <= 12; n++) for (let k = 2; k <= 5; k++) runs.push({ name: `n=${n} k=${k}`, steps: s.run('simulate', n, k) });
    return runs;
  },
  'array-address.html': (s) => {
    const runs = [];
    for (const d of [2, 3]) for (const order of ['row', 'col']) for (const lo of [0, 1]) {
      const c = { d, order, R: 4, C: 3, H: 3, m: 4, base: 1000, lo, i: 2 + lo, j: 1 + lo, k: d === 3 ? 2 + lo : lo };
      runs.push({ name: JSON.stringify(c), steps: s.run('simulate', c), c });
    }
    return runs;
  },
  'linked-list-reversal.html': (s) => [2, 3, 4, 5].map((n) => ({ name: `n=${n}`, steps: s.run('simulate', n) })),
  'floyd-cycle-detection.html': (s) => s.get('PRESETS').map((_, pi) => ({ name: `shape ${pi}`, steps: s.run('simulate', pi) })),
};

// The source lines of a page: "var CODE = [...]", "var MS_CODE = [...]", or "code: [...]" inside TRACE.
function codeOf(file) {
  const h = html(file);
  const m = h.match(/var (?:MS_)?CODE = (\[[\s\S]*?\n\s*\]);/) || h.match(/\n  code: (\[[\s\S]*?\n  \]),/);
  assert.ok(m, `${file}: cannot find the code array`);
  return Array.from(vm.runInNewContext(m[1]));
}

// ---------- the rule ----------
test('every trace page has COMPLEXITY, except the pages in scripts/complexity-pending.json', () => {
  for (const f of allFiles) {
    const h = html(f), has = h.includes('//COMPLEXITY-START') && /var COMPLEXITY\s*=/.test(h);
    assert.equal(has, !pending.has(f), pending.has(f) ? `${f} has COMPLEXITY: remove it from the pending list` : `${f} has no COMPLEXITY`);
  }
  for (const f of doneFiles) assert.ok(DRIVERS[f], `${f}: add a driver to tests/complexity.test.mjs`);
});

// ---------- the shape ----------
for (const file of doneFiles) {
  test(`${file}: COMPLEXITY has every field, and the claims agree with the simulation`, () => {
    const s = sim(file), C = s.get('COMPLEXITY');
    const WHEN = ['all', 'best', 'average', 'worst'];
    assert.ok(C.time.length >= 1 && C.time.length <= 3);
    const whens = C.time.map((t) => t.when);
    assert.equal(new Set(whens).size, whens.length, 'a case is listed two times');
    for (const t of C.time) {
      assert.ok(WHEN.includes(t.when), `unknown case ${t.when}`);
      assert.match(t.o, /^O\(.+\)$/, `"${t.o}" must be written as O(...)`);
      assert.ok(t.words.length > 10, 'the plain words are missing');
    }
    if (whens.includes('all')) assert.equal(whens.length, 1, '"all" cannot go with other cases');
    assert.ok(whens.includes(C.main), 'main must be one of the cases of time');
    assert.match(C.space.o, /^O\(.+\)$/);
    assert.ok(C.space.words.length > 10);
    assert.ok(C.why.length >= 2 && C.why.length <= 4, 'Why needs 2 to 4 short parts');
    assert.ok(C.unit && typeof C.measured === 'function' && typeof C.caseOf === 'function');
    assert.ok(['["all"]', '["best","worst"]'].includes(JSON.stringify(Array.from(C.cases, (c) => c.when))), 'cases: [all] or [best, worst]');
    for (const c of C.cases) assert.ok(c.input.length > 10 && typeof c.at === 'function');
    assert.ok(C.meters.length >= 1 && C.meters.length <= 2);
    assert.ok(typeof C.growth.f === 'function' && C.growth.label && C.growth.note);

    // The growth table: positive, and growing, for n = 8, 16, 32.
    const fin0 = last(DRIVERS[file](s)[0].steps);
    assert.ok(typeof C.growth.label === 'function' ? C.growth.label(fin0) : C.growth.label);
    const g = [8, 16, 32].map((n) => C.growth.f(n, fin0));
    g.forEach((v, k) => {
      assert.ok(Number.isInteger(v) && v > 0, `growth(${[8, 16, 32][k]}) = ${v}`);
      if (k) assert.ok(C.growth.flat ? v === g[k - 1] : v > g[k - 1], C.growth.flat ? 'a flat cost must stay the same' : 'the cost must grow with n');
    });

    // The tags of code lines are on real lines of code.
    const code = Object.keys(C.loops).length ? codeOf(file) : [];
    for (const [line, text] of Object.entries(C.loops)) {
      assert.ok(+line >= 1 && +line <= code.length && code[line - 1].trim() !== '' && code[line - 1].trim() !== '}', `loops[${line}] is not a line of code`);
      assert.ok(text.length > 5 && text.length < 40, `loops[${line}] must be a short tag`);
    }
  });

  test(`${file}: the meters, the best case, and the worst case match every run`, () => {
    const s = sim(file), C = s.get('COMPLEXITY');
    for (const run of DRIVERS[file](s)) {
      const where = `${file} ${run.name}`, fin = last(run.steps);
      const best = C.cases[0].at(fin), worst = C.cases[C.cases.length - 1].at(fin), got = C.measured(fin);
      assert.ok(best <= got && got <= worst, `${where}: ${got} is outside ${best}..${worst}`);
      const kind = C.caseOf(fin);
      assert.ok(['best', 'worst', 'between', 'all'].includes(kind), `${where}: caseOf gives "${kind}"`);
      if (C.cases.length === 1) { assert.equal(kind, 'all'); assert.equal(got, best, `${where}: every run costs the same`); }
      if (kind === 'best') assert.equal(got, best, `${where}: best`);
      if (kind === 'worst') assert.equal(got, worst, `${where}: worst`);
      if (kind === 'between') assert.ok(got > best && got < worst, `${where}: between`);
      for (const m of C.meters) {
        let prev = 0;
        run.steps.forEach((st, k) => {
          const v = m.value(st), lim = m.limit(st);
          assert.ok(v >= prev, `${where} step ${k}: the meter "${m.label}" went down`);
          assert.ok(v <= lim, `${where} step ${k}: "${m.label}" ${v} is above the limit ${lim}`);
          assert.equal(lim, m.limit(run.steps[0]), `${where}: the limit of "${m.label}" must not change`);
          prev = v;
        });
      }
    }
  });
}

// ---------- references that this test writes itself ----------
function refMergeCmp(input) {
  const a = input.slice();
  let cmp = 0;
  (function sort(lo, hi) {
    if (lo >= hi) return;
    const mid = (lo + hi) >> 1;
    sort(lo, mid); sort(mid + 1, hi);
    const tmp = [];
    let i = lo, j = mid + 1;
    while (i <= mid && j <= hi) { cmp++; tmp.push(a[i] <= a[j] ? a[i++] : a[j++]); }
    while (i <= mid) tmp.push(a[i++]);
    while (j <= hi) tmp.push(a[j++]);
    tmp.forEach((v, k) => { a[lo + k] = v; });
  })(0, a.length - 1);
  return cmp;
}
// The worst input of merge sort: undo a merge that takes turns. The left half gets the even places, the right half the odd places.
function worstMergeInput(sorted) {
  if (sorted.length <= 1) return sorted;
  const left = sorted.filter((_, k) => k % 2 === 0), right = sorted.filter((_, k) => k % 2 === 1);
  return [...worstMergeInput(left), ...worstMergeInput(right)];
}
test('merge sort: the best case and the worst case are reached, and the growth table is the exact worst case', () => {
  const s = sim('merge-sort.html'), C = s.get('COMPLEXITY');
  for (const n of [8, 16, 32, 64]) {
    const sorted = Array.from({ length: n }, (_, k) => k + 1), reverse = sorted.slice().reverse();
    assert.equal(refMergeCmp(sorted), s.run('bestCmp', n), `sorted, n=${n}`);
    assert.equal(refMergeCmp(reverse), s.run('bestCmp', n), `reverse, n=${n}`);
    assert.equal(refMergeCmp(worstMergeInput(sorted)), s.run('worstCmp', n), `worst input, n=${n}`);
    if (n <= 32) assert.equal(C.growth.f(n), refMergeCmp(worstMergeInput(sorted)), `growth table, n=${n}`);
  }
  // For n = 8, no input of the 40320 needs more than the worst case, and one input reaches it.
  let max = 0;
  (function perm(a, k) {
    if (k === a.length) { max = Math.max(max, refMergeCmp(a)); return; }
    for (let i = k; i < a.length; i++) { [a[k], a[i]] = [a[i], a[k]]; perm(a, k + 1); [a[k], a[i]] = [a[i], a[k]]; }
  })([1, 2, 3, 4, 5, 6, 7, 8], 0);
  assert.equal(max, C.growth.f(8));
  // The work grows like n log n: when n doubles, the ratio of the cost is between 2 and 3, and it goes down to 2.
  const r = (n) => C.growth.f(2 * n) / C.growth.f(n);
  assert.ok(r(8) > 2 && r(8) < 3 && r(1024) > 2 && r(1024) < r(8));
  // The copies to tmp: n times the number of levels.
  const copies = C.meters[1];
  for (const run of DRIVERS['merge-sort.html'](s)) assert.ok(copies.value(last(run.steps)) <= copies.limit(last(run.steps)));
});

// Plain sift-down. Positions 1 to n.
function siftDown(a, n, i0) {
  let i = i0, cmp = 0, swp = 0;
  for (;;) {
    const l = 2 * i, r = l + 1;
    let g = i;
    if (l <= n) { cmp++; if (a[l] > a[g]) g = l; }
    if (r <= n) { cmp++; if (a[r] > a[g]) g = r; }
    if (g === i) break;
    [a[i], a[g]] = [a[g], a[i]]; swp++; i = g;
  }
  return { cmp, swp };
}
function buildHeap(input) {
  const n = input.length, a = [null, ...input];
  let cmp = 0, swp = 0;
  for (let i = n >> 1; i >= 1; i--) { const r = siftDown(a, n, i); cmp += r.cmp; swp += r.swp; }
  return { cmp, swp };
}
const ones = (n) => n.toString(2).replace(/0/g, '').length;
function allPerms(n, fn) {
  (function perm(a, k) {
    if (k === a.length) { fn(a); return; }
    for (let i = k; i < a.length; i++) { [a[k], a[i]] = [a[i], a[k]]; perm(a, k + 1); [a[k], a[i]] = [a[i], a[k]]; }
  })(Array.from({ length: n }, (_, k) => k + 1), 0);
}

test('Build-Max-Heap: the best case is n - 1 comparisons, and the limit holds for every input', () => {
  const s = sim('build-max-heap.html'), C = s.get('COMPLEXITY');
  const st = (n) => ({ n, vals: new Array(n) });
  for (const n of [7, 8, 9]) {
    let minC = Infinity, maxC = 0, maxS = 0;
    allPerms(n, (p) => { const r = buildHeap(p); minC = Math.min(minC, r.cmp); maxC = Math.max(maxC, r.cmp); maxS = Math.max(maxS, r.swp); });
    assert.equal(minC, C.cases[0].at(st(n)), `n=${n}: best case`);
    assert.ok(maxC <= C.cases[1].at(st(n)), `n=${n}: the limit of comparisons`);
    assert.equal(maxS, n - ones(n), `n=${n}: the limit of swaps is reached`);
  }
  // For n = 2^k - 1, the limit is reached by the ascending array.
  for (const n of [7, 15, 31, 63]) {
    const r = buildHeap(Array.from({ length: n }, (_, k) => k + 1));
    assert.equal(r.cmp, C.growth.f(n), `n=${n}: ascending input reaches the limit`);
  }
  // The growth is linear: the limit is 2 (n - ones(n)), and the ratio is about 2 and not more.
  for (const n of [8, 16, 32]) assert.equal(C.growth.f(n), 2 * (n - ones(n)));
  const ratio = C.growth.f(2048) / C.growth.f(1024);
  assert.ok(ratio > 1.99 && ratio < 2.01, `ratio ${ratio}`);
  // Random inputs of the sizes of the table stay inside the limit.
  let t = 1;
  const rand = () => { t = (t * 48271) % 2147483647; return t / 2147483647; };
  for (const n of [8, 16, 32]) for (let rep = 0; rep < 200; rep++) {
    const r = buildHeap(Array.from({ length: n }, () => Math.floor(rand() * 1000)));
    assert.ok(r.cmp <= C.growth.f(n) && r.swp <= n - ones(n));
  }
});

test('Max-Heapify: the cases (in swaps) and the limit of node 1 (in comparisons) hold for every input', () => {
  const s = sim('max-heapify.html'), C = s.get('COMPLEXITY');
  const st = (n, i) => ({ n, startI: i, vals: new Array(n) });
  // All arrays of 7 and 8 values in which both subtrees of node 1 are heaps.
  for (const n of [7, 8]) {
    let minS = Infinity, maxS = 0, maxC = 0, any = 0;
    allPerms(n, (p) => {
      const a = [null, ...p];
      const okSub = (root) => {
        let good = true;
        (function walk(x) { if (x > n) return; if ((2 * x <= n && a[2 * x] > a[x]) || (2 * x + 1 <= n && a[2 * x + 1] > a[x])) good = false; walk(2 * x); walk(2 * x + 1); })(root);
        return good;
      };
      if (!okSub(2) || !okSub(3)) return;
      any++;
      const r = siftDown(a.slice(), n, 1);
      minS = Math.min(minS, r.swp); maxS = Math.max(maxS, r.swp); maxC = Math.max(maxC, r.cmp);
    });
    assert.ok(any > 0);
    assert.equal(minS, C.cases[0].at(st(n, 1)), `n=${n}: best case (swaps)`);
    assert.ok(maxS <= C.cases[1].at(st(n, 1)), `n=${n}: worst case (swaps)`);
    assert.ok(maxC <= C.growth.f(n), `n=${n}: limit of comparisons`);
    if (n === 7) { assert.equal(maxS, C.cases[1].at(st(n, 1))); assert.equal(maxC, C.growth.f(n), 'n=7: the limit is reached'); }
  }
  // A perfect tree reaches the limit: the root is the smallest value, and the rest is a descending heap.
  for (const n of [7, 15, 31, 63]) {
    const a = [null, 0, ...Array.from({ length: n - 1 }, (_, k) => n - k)];
    const r = siftDown(a, n, 1);
    assert.equal(r.cmp, C.growth.f(n), `n=${n}`);
    assert.equal(r.swp, C.cases[1].at(st(n, 1)), `n=${n}`);
  }
  // Double n: 2 more comparisons.
  assert.equal(C.growth.f(16) - C.growth.f(8), 2);
  assert.equal(C.growth.f(32) - C.growth.f(16), 2);
});


// ---------- Josephus ----------
// A plain array simulation. It counts every step from one person to the next.
function refJosephus(n, k) {
  const ring = Array.from({ length: n }, (_, i) => i + 1);
  let at = 0, moves = 0;
  while (ring.length > 1) {
    for (let c = 1; c < k; c++) { at = (at + 1) % ring.length; moves++; }
    ring.splice(at, 1);
    if (at === ring.length) at = 0;
  }
  return { moves, survivor: ring[0] };
}
test('Josephus: the pointer moves are (n - 1)(k - 1) for every n and k, and the table is exact', () => {
  const s = sim('josephus.html'), C = s.get('COMPLEXITY');
  for (let n = 2; n <= 40; n++) for (let k = 2; k <= 6; k++) {
    const ref = refJosephus(n, k), end = last(s.run('simulate', n, k));
    assert.equal(end.moves, ref.moves, `n=${n} k=${k}`);
    assert.equal(end.moves, (n - 1) * (k - 1), `n=${n} k=${k}: formula`);
    assert.equal(end.survivor, ref.survivor);
    for (const m of [8, 16, 32]) assert.equal(C.growth.f(m, end), refJosephus(m, k).moves, `table m=${m} k=${k}`);
  }
});

// ---------- Floyd ----------
// Plain walk of the two phases on a list with mu nodes before the cycle and lambda nodes in it (lambda = 0: no cycle).
function refFloyd(mu, lam) {
  const N = lam > 0 ? mu + lam : mu, nx = (i) => (i < N ? i + 1 : lam > 0 ? mu + 1 : null);
  let slow = 1, fast = 1, p1 = 0, p2 = 0;
  while (fast !== null && nx(fast) !== null) {
    slow = nx(slow); fast = nx(nx(fast)); p1++;
    if (slow === fast) { slow = 1; while (slow !== fast) { slow = nx(slow); fast = nx(fast); p2++; } return { p1, p2, start: slow }; }
  }
  return { p1, p2: 0, start: null };
}
test('Floyd: the passes of both phases match a plain walk, and the best and worst case are exact for every list', () => {
  const s = sim('floyd-cycle-detection.html'), C = s.get('COMPLEXITY');
  s.get('PRESETS').forEach((pr, pi) => {
    const end = last(s.run('simulate', pi)), ref = refFloyd(pr.t, pr.c);
    assert.equal(end.iter, ref.p1, `shape ${pi}: phase 1`);
    assert.equal(end.moves, ref.p2, `shape ${pi}: phase 2`);
    assert.ok(end.iter <= end.N, `shape ${pi}: phase 1 limit`);
    assert.ok(end.moves <= (pr.c > 0 ? pr.t : 0), `shape ${pi}: phase 2 limit`);
  });
  for (let n = 2; n <= 40; n++) {
    let min = Infinity, max = 0;
    const none = refFloyd(n, 0); min = none.p1 + none.p2; max = min;
    for (let lam = 1; lam <= n; lam++) { const r = refFloyd(n - lam, lam), tot = r.p1 + r.p2; min = Math.min(min, tot); max = Math.max(max, tot); }
    const st = { N: n };
    assert.equal(min, C.cases[0].at(st), `n=${n}: best case`);
    assert.equal(max, C.cases[1].at(st), `n=${n}: worst case`);
  }
  for (const n of [8, 16, 32]) assert.equal(C.growth.f(n), 2 * (n - 1));
});


// ---------- array address ----------
// Count the operators (* + -) in the generated C code, line by line. This is a count of the text of the code.
function operatorsInCode(lines) {
  const body = lines.filter((l) => /^\s+(long \w+ =|return)/.test(l));
  return body.reduce((a, l) => a + (l.replace(/^\s+(long \w+ =|return)/, '').match(/[*+\-]/g) || []).length, 0);
}
test('array address: the operations of the card are the operators in the code, for every layout and size', () => {
  const s = sim('array-address.html'), C = s.get('COMPLEXITY');
  for (const d of [2, 3]) for (const order of ['row', 'col']) for (const lo of [0, 1]) {
    let first = null;
    for (const [R, C2, H] of [[2, 2, 2], [4, 3, 3], [6, 5, 4], [3, 6, 2]]) {
      const c = { d, order, R, C: C2, H, m: 4, base: 1000, lo, i: lo, j: lo, k: lo };
      const steps = s.run('simulate', c), end = last(steps), count = operatorsInCode(s.run('codeFor', c).lines);
      assert.equal(end.opsMax, count, `${JSON.stringify(c)}: the count of operators in the code`);
      assert.equal(end.ops, count, `${JSON.stringify(c)}: the meter ends at the count`);
      if (first === null) first = count;
      assert.equal(count, first, `${JSON.stringify(c)}: the size of the array must not change the cost`);
    }
    // 2D: 4 operations. 3D: 7. A first index of 1 adds one subtraction for each index.
    assert.equal(first, (d === 2 ? 4 : 7) + (lo ? d : 0), `d=${d} lo=${lo}`);
  }
});

// ---------- list reversal ----------
test('list reversal: n calls, 2(n - 1) link writes, and n frames at the deepest point, for the sizes of the table', () => {
  const s = sim('linked-list-reversal.html'), C = s.get('COMPLEXITY');
  for (const n of [2, 3, 4, 5, 8, 16, 32]) {
    const steps = s.run('simulate', n), end = last(steps);
    assert.equal(end.calls, n, `n=${n}: calls`);
    assert.equal(end.writes, 2 * (n - 1), `n=${n}: link writes`);
    assert.equal(Math.max(...steps.map((st) => st.stack.length)), n, `n=${n}: the stack gets n frames deep`);
    if ([8, 16, 32].includes(n)) assert.equal(C.growth.f(n, end), end.calls, `n=${n}: growth table`);
  }
  // Plain loop reference: reverse an array of links and count the writes.
  for (const n of [2, 5, 9]) {
    const link = Array.from({ length: n }, (_, i) => (i + 1 < n ? i + 1 : null));
    let prev = null, cur = 0, w = 0;
    while (cur !== null) { const nx = link[cur]; link[cur] = prev; w++; prev = cur; cur = nx; }
    assert.equal(w, n, 'the iterative version writes each link one time and needs no stack');
    link.forEach((v, i) => assert.equal(v, i === 0 ? null : i - 1));
  }
});

// ---------- the card on the page ----------
for (const file of allFiles) {
  const page = DIR + file;
  if (pending.has(file)) {
    test(`${file}: has no Complexity card yet`, async () => {
      const { dom, document, errors } = await loadPage(page);
      assert.equal(document.getElementById('cx'), null);
      assert.deepEqual(errors, []);
      dom.window.close();
    });
    continue;
  }
  test(`${file}: the card is above the controls, and the meter follows the steps`, async () => {
    const { dom, window, document, errors } = await loadPage(page);
    const cx = document.getElementById('cx'), controls = document.querySelector('.controls'), header = document.querySelector('header');
    assert.ok(cx, 'no card');
    assert.equal(cx.nextElementSibling, controls, 'the card must be just above the controls');
    assert.equal(header.nextElementSibling, cx, 'the card must be just under the title');
    const C = window.COMPLEXITY;
    for (const t of C.time) assert.ok(cx.textContent.includes(t.o), `the card does not show ${t.o}`);
    assert.ok(cx.textContent.includes(C.space.o));
    assert.equal(cx.querySelectorAll('.cx-o').length, C.time.length + 1);
    assert.equal(cx.querySelectorAll('.cx-cell.main').length, 1, 'one case has the accent');
    assert.equal(cx.querySelectorAll('.cx-tab tr').length, 4, 'the growth table has a header and 3 rows');
    assert.equal(document.querySelectorAll('#code .rep').length, Object.keys(C.loops).length);

    // The meter shows the counts of the simulation, step by step, and the bar does not go over 100%.
    const steps = window.TRACE.simulate(), total = steps.length - 1;
    for (let i = 0; i <= total; i++) {
      C.meters.forEach((m, k) => {
        assert.equal(+document.getElementById(`cx-v${k}`).textContent, m.value(steps[i]), `step ${i}: ${m.label}`);
        assert.equal(+document.getElementById(`cx-l${k}`).textContent, m.limit(steps[i]));
        const w = parseFloat(document.getElementById(`cx-b${k}`).firstChild.style.width);
        assert.ok(w >= 0 && w <= 100, `step ${i}: bar ${w}`);
      });
      if (i < total) document.getElementById('next').click();
    }
    document.getElementById('reset').click();
    assert.equal(+document.getElementById('cx-v0').textContent, 0);
    // Exactly one item says "this input" in the list of cases, or the list says "between".
    const here = cx.querySelectorAll('.cx-list li.here');
    assert.equal(here.length, C.cases.length === 1 ? 0 : 1);
    assert.deepEqual(errors, []);
    dom.window.close();
  });
}

test('merge sort: the card follows the chosen input', async () => {
  const { dom, window, document, errors } = await loadPage(DIR + 'merge-sort.html');
  const sel = document.getElementById('selInput');
  const want = { 0: 'between', 1: 'best', 2: 'best', 3: 'worst', 4: 'between' };
  for (const [v, kind] of Object.entries(want)) {
    sel.value = v; sel.dispatchEvent(new window.Event('change', { bubbles: true }));
    const li = document.querySelector('#cx .cx-list li.here').textContent;
    const label = { best: 'Best case', worst: 'Worst case', between: 'between the two' }[kind];
    assert.ok(li.includes(label), `input ${v}: "${li}" must say "${label}"`);
  }
  assert.deepEqual(errors, []);
  dom.window.close();
});

// ---------- the highlighted lines of merge sort ----------
test('merge sort: every highlighted line of code is the line that the note talks about', () => {
  const s = sim('merge-sort.html');
  const code = Array.from(vm.runInNewContext(html('merge-sort.html').match(/var MS_CODE = (\[[\s\S]*?\n\]);/)[1]));
  const expect = {
    'First call': ['void mergesort'],
    Test: ['if (lo < hi)'], 'One element': ['if (lo < hi)'],
    'Find the middle': ['int mid'],
    'Sort the left half': ['mergesort(a, tmp, lo, mid)'],
    'Sort the right half': ['mergesort(a, tmp, mid + 1, hi)'],
    'Call merge': ['merge(a, tmp, lo, mid, hi)'],
    'Set i, j, k': ['int i = lo'],
    'Compare and take': ['while (i <= mid && j <= hi)'],
    'Copy back': ['for (k = lo'],
  };
  let copyI = 0, copyJ = 0, checked = 0;
  for (let pi = 0; pi < 5; pi++) for (const st of s.run('simulate', pi)) {
    for (const l of st.lines) assert.ok(l >= 1 && l <= code.length && code[l - 1].trim() !== '' && code[l - 1].trim() !== '}', `"${st.title}" marks line ${l}: "${code[l - 1]}"`);
    const text = Array.from(st.lines).map((l) => code[l - 1].trim());
    if (st.title === 'Copy the rest') {
      const wantI = st.rows.includes('i');
      assert.ok(text.some((t) => t.startsWith(wantI ? 'while (i <= mid)' : 'while (j <= hi)')), `"Copy the rest" marks ${JSON.stringify(text)}`);
      if (wantI) copyI++; else copyJ++;
      continue;
    }
    if (st.title === 'Compare and take') {
      assert.ok(text.some((t) => t.startsWith(st.note.includes('Yes.') ? 'if (a[i] <= a[j]) tmp[k++] = a[i++]' : 'else')), `"Compare and take" marks ${JSON.stringify(text)}`);
    }
    for (const w of expect[st.title] || []) assert.ok(text.some((t) => t.startsWith(w)), `"${st.title}" must mark "${w}". It marks ${JSON.stringify(text)}`);
    if (expect[st.title]) checked++;
  }
  assert.ok(checked > 50 && copyI > 0 && copyJ > 0);
});
