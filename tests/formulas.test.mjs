// Run the simulate() code of each trace page and compare the result with the formulas.
//
// The test takes the code between //SIM-START and //SIM-END of a page and runs it in Node.
// It does not use a browser. Each check uses a reference that the test writes itself (a plain
// loop, a closed form, or a rule such as "the AVL tree stays balanced"), so a mistake in the
// page cannot hide behind the same mistake in a formula of the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT } from './helpers.mjs';

const DIR = 'subjects/data-structures-and-algorithms/';
const html = (file) => readFileSync(join(ROOT, DIR, file), 'utf8');

// ---------- helpers ----------
const cache = new Map();
function sim(file) {
  if (!cache.has(file)) {
    const h = html(file);
    const a = h.indexOf('//SIM-START'), b = h.indexOf('//SIM-END');
    assert.ok(a >= 0 && b > a, `${file}: no //SIM-START and //SIM-END`);
    const ctx = vm.createContext({ console });
    vm.runInContext(h.slice(a, b), ctx);
    cache.set(file, ctx);
  }
  const ctx = cache.get(file);
  return {
    ctx,
    get: (expr) => vm.runInContext(expr, ctx),
    run(fn, ...args) { ctx.__args = args; return vm.runInContext(`${fn}.apply(null, __args)`, ctx); },
  };
}
const last = (steps) => steps[steps.length - 1];
// The values a page offers in one <select>. The tests run every value, so a new option is tested too.
function options(file, id) {
  const m = html(file).match(new RegExp(`<select id="${id}"[^>]*>(.*?)</select>`, 's'));
  assert.ok(m, `${file}: no select ${id}`);
  return [...m[1].matchAll(/<option value="([^"]*)"/g)].map((x) => x[1]);
}
const sortedOf = (st) => st.order.map((id) => st.vals[id]);
const ascending = (a) => a.every((v, i) => i === 0 || a[i - 1] <= v);
const inversions = (a) => { let c = 0; for (let p = 0; p < a.length; p++) for (let q = p + 1; q < a.length; q++) if (a[p] > a[q]) c++; return c; };
// Arrays made inside vm have another Array prototype, so a strict deep compare fails. Compare the JSON text instead.
const eq = (actual, expected, msg) => assert.equal(JSON.stringify(actual), JSON.stringify(expected), msg);
const sameSet = (a, b) => assert.deepEqual([...a].sort((x, y) => x - y), [...b].sort((x, y) => x - y));

// Every trace needs a formula test. Add a name here and a test below when you add a trace.
const COVERED = new Set([
  'array-address.html', 'avl-tree-rotations.html', 'bubble-sort.html', 'build-max-heap.html', 'doubly-linked-list-insert.html',
  'floyd-cycle-detection.html', 'insertion-sort.html', 'josephus.html', 'linked-list-reversal.html',
  'max-heapify.html', 'merge-sort.html', 'order-statistic-tree.html', 'quicksort.html', 'red-black-tree-insertion.html',
  'tree-from-preorder-postorder.html',
]);
test('every trace in manifest.json has a formula test', () => {
  const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
  const files = manifest.subjects.flatMap((s) => s.traces.map((t) => t.file));
  assert.deepEqual(files.filter((f) => !COVERED.has(f)), [], 'add a formula test for these traces in tests/formulas.test.mjs');
});

// ---------- bubble sort ----------
function refBubble(input, flag) {
  const a = input.slice(), n = a.length;
  let cmp = 0, swp = 0, passes = 0;
  for (let i = 0; i < n - 1; i++) {
    passes++;
    let swapped = false;
    for (let j = 0; j < n - 1 - i; j++) {
      cmp++;
      if (a[j] > a[j + 1]) { const t = a[j]; a[j] = a[j + 1]; a[j + 1] = t; swp++; swapped = true; }
    }
    if (flag && !swapped) break;
  }
  return { cmp, swp, passes };
}
test('bubble sort: comparisons, swaps, and passes', () => {
  const s = sim('bubble-sort.html');
  const presets = s.get('PRESETS');
  for (const version of options('bubble-sort.html', 'selVersion')) {
    presets.forEach((input, pi) => {
      const end = last(s.run('simulate', version, pi));
      const ref = refBubble(input, version === 'flag');
      const where = `${version} input ${pi} [${input}]`;
      assert.ok(ascending(sortedOf(end)), `${where}: not sorted`);
      assert.equal(end.cmp, ref.cmp, `${where}: comparisons`);
      assert.equal(end.swp, ref.swp, `${where}: swaps`);
      assert.equal(end.swp, inversions(input), `${where}: swaps must equal the inversions`);
      assert.equal(end.pass, ref.passes, `${where}: passes`);
      if (version !== 'flag') assert.equal(end.cmp, input.length * (input.length - 1) / 2, `${where}: n(n-1)/2`);
      // The formulas that the page shows:
      if (version === 'flag') assert.equal(end.cmp, s.run('cmpFlag', input), `${where}: page formula`);
    });
  }
});

// ---------- insertion sort ----------
function refInsertion(input) {
  const a = input.slice();
  let cmp = 0, shifts = 0;
  for (let i = 1; i < a.length; i++) {
    const key = a[i];
    let j = i - 1;
    while (j >= 0) {
      cmp++;
      if (a[j] > key) { a[j + 1] = a[j]; shifts++; j--; } else break;
    }
    a[j + 1] = key;
  }
  return { cmp, shifts };
}
test('insertion sort: comparisons and shifts', () => {
  const s = sim('insertion-sort.html');
  const presets = s.get('PRESETS');
  for (const version of options('insertion-sort.html', 'selVersion')) {
    presets.forEach((input, pi) => {
      const end = last(s.run('simulate', version, pi));
      const where = `${version} input ${pi} [${input}]`;
      assert.ok(ascending(sortedOf(end)), `${where}: not sorted`);
      assert.equal(end.shifts, inversions(input), `${where}: shifts must equal the inversions`);
      if (version === 'std') {
        const ref = refInsertion(input);
        assert.equal(end.cmp, ref.cmp, `${where}: comparisons`);
        assert.equal(end.cmp, s.run('cmpIns', input), `${where}: page formula`);
      } else {
        const n = input.length;
        assert.ok(end.cmp >= s.run('binMin', n) && end.cmp <= s.run('binMax', n), `${where}: comparisons ${end.cmp} are outside the binary-search bounds`);
      }
    });
  }
});

// ---------- merge sort ----------
function refMerge(input) {
  const a = input.slice();
  let cmp = 0, moved = 0;
  (function sort(lo, hi) {
    if (lo >= hi) return;
    const mid = (lo + hi) >> 1;
    sort(lo, mid); sort(mid + 1, hi);
    const tmp = [];
    let i = lo, j = mid + 1;
    while (i <= mid && j <= hi) { cmp++; tmp.push(a[i] <= a[j] ? a[i++] : a[j++]); }
    while (i <= mid) tmp.push(a[i++]);
    while (j <= hi) tmp.push(a[j++]);
    for (let k = 0; k < tmp.length; k++) a[lo + k] = tmp[k];
    moved += tmp.length;
  })(0, a.length - 1);
  return { cmp, moved };
}
test('merge sort: comparisons stay between the best case and the worst case', () => {
  const s = sim('merge-sort.html');
  s.get('PRESETS').forEach((input, pi) => {
    const end = last(s.run('simulate', pi));
    const ref = refMerge(input), n = input.length;
    assert.ok(ascending(sortedOf(end)), `input ${pi}: not sorted`);
    assert.equal(end.cmp, ref.cmp, `input ${pi}: comparisons`);
    assert.equal(end.mv, ref.moved, `input ${pi}: moves`);
    assert.ok(end.cmp >= s.run('bestCmp', n) && end.cmp <= s.run('worstCmp', n), `input ${pi}: outside the best and worst case`);
  });
  // The best case is (n / 2) log2 n for a power of 2. The worst case is n log2 n - n + 1.
  for (const n of [2, 4, 8, 16, 32]) {
    const lg = Math.log2(n);
    assert.equal(s.run('bestCmp', n), (n / 2) * lg, `bestCmp(${n})`);
    assert.equal(s.run('worstCmp', n), n * lg - n + 1, `worstCmp(${n})`);
  }
});

// ---------- quicksort ----------
test('quicksort: the result is sorted and the comparisons are inside the bounds', () => {
  const s = sim('quicksort.html');
  for (const scheme of options('quicksort.html', 'selScheme')) {
    s.get('PRESETS').forEach((input, pi) => {
      const end = last(s.run('simulate', scheme, pi)), n = input.length;
      const where = `${scheme} input ${pi} [${input}]`;
      assert.ok(ascending(sortedOf(end)), `${where}: not sorted`);
      assert.ok(end.fin.every(Boolean), `${where}: not every value is final`);
      assert.ok(end.cmp >= n - 1, `${where}: at least n-1 comparisons`);
      if (scheme === 'lomuto') {
        assert.ok(end.cmp <= n * (n - 1) / 2, `${where}: more than n(n-1)/2 comparisons`);
        assert.ok(end.cmp >= s.run('bestCmp', n), `${where}: fewer than the best case`);
      }
    });
  }
});

// ---------- Josephus ----------
function refJosephus(n, k) {
  const list = Array.from({ length: n }, (_, i) => i + 1), out = [];
  let idx = 0;
  while (list.length > 1) { idx = (idx + k - 1) % list.length; out.push(list.splice(idx, 1)[0]); }
  return { out, survivor: list[0] };
}
test('Josephus: survivor, order of removal, recurrence, and closed form', () => {
  const s = sim('josephus.html');
  for (const n of options('josephus.html', 'selN').map(Number)) {
    for (const k of options('josephus.html', 'selK').map(Number)) {
      const end = last(s.run('simulate', n, k)), ref = refJosephus(n, k);
      assert.equal(end.survivor, ref.survivor, `n=${n} k=${k}: survivor`);
      eq(end.out, ref.out, `n=${n} k=${k}: order of removal`);
      // J(1) = 1, J(n) = ((J(n-1) + k - 1) mod n) + 1
      let j = 1; for (let m = 2; m <= n; m++) j = ((j + k - 1) % m) + 1;
      assert.equal(j, ref.survivor, `n=${n} k=${k}: recurrence`);
      if (k === 2) {
        const closed = 2 * (n - 2 ** Math.floor(Math.log2(n))) + 1;
        assert.equal(closed, ref.survivor, `n=${n}: closed form for k=2`);
        assert.equal(s.run('jClosed', n).j, ref.survivor, `n=${n}: page closed form`);
      }
    }
  }
});

// ---------- Floyd ----------
test("Floyd's cycle detection: meeting step, start of the cycle, and the tail length", () => {
  const s = sim('floyd-cycle-detection.html');
  s.get('PRESETS').forEach((p, pi) => {
    const end = last(s.run('simulate', pi)), { t, c } = p;
    if (c === 0) {
      assert.equal(end.result, 'none', `input ${pi}: a list with no cycle`);
      assert.equal(end.start, null, `input ${pi}: no start`);
      return;
    }
    // The slow pointer is at the meeting point after i steps. i is the first multiple of c with i >= t (and i >= 1).
    const meet = c * Math.max(1, Math.ceil(t / c));
    assert.equal(end.result, 'start', `input ${pi}`);
    assert.equal(end.iter, meet, `input ${pi}: steps to the meeting`);
    assert.equal(end.iter, s.run('meetSteps', t, c), `input ${pi}: page formula`);
    assert.equal(end.start, t + 1, `input ${pi}: the first node of the cycle is node t+1`);
    assert.equal(end.moves, t, `input ${pi}: the second phase takes t steps`);
    assert.equal(end.slow, end.fast, `input ${pi}: both pointers end at the same node`);
  });
});

// ---------- tree from preorder and postorder ----------
const pre = (t) => (t ? [t[0], ...pre(t[1]), ...pre(t[2])] : []);
const post = (t) => (t ? [...post(t[1]), ...post(t[2]), t[0]] : []);
const size = (t) => (t ? 1 + size(t[1]) + size(t[2]) : 0);
const levels = (t) => (t ? 1 + Math.max(levels(t[1]), levels(t[2])) : 0);
const ser = (n) => (n ? [n.val, n.left || n.right ? ser(n.left) : undefined, n.left || n.right ? ser(n.right) : undefined].filter((x, i) => i === 0 || x !== undefined) : null);
const norm = (t) => (t ? (t.length === 1 ? [t[0]] : [t[0], norm(t[1]), norm(t[2])]) : null);
// A full tree: every node has 0 or 2 children.
const isFull = (t) => t.length === 1 || (t.length === 3 && t[1] !== null && t[2] !== null && isFull(t[1]) && isFull(t[2]));
test('tree from preorder and postorder: the built tree fits the two lists', () => {
  const s = sim('tree-from-preorder-postorder.html');
  s.get('TREES').forEach((tr, ti) => {
    const t = norm(tr.t), end = last(s.run('simulate', ti)), n = size(t);
    const where = `tree ${ti} "${tr.name}"`;
    eq(end.pre, pre(t), `${where}: preorder`);
    eq(end.post, post(t), `${where}: postorder`);
    assert.equal(end.n, n);
    assert.equal(end.edges.length, n - 1, `${where}: n-1 edges`);
    assert.equal(end.shape.leaves, end.shape.two + 1, `${where}: leaves = two-child nodes + 1`);
    assert.equal(end.shape.leaves + end.shape.two + end.shape.one, n, `${where}: the shapes add up to n`);
    const built = ser(end.built);
    // In every case, the built tree must give the same two lists.
    eq(pre(built), pre(t), `${where}: preorder of the built tree`);
    eq(post(built), post(t), `${where}: postorder of the built tree`);
    if (isFull(t)) {
      // One tree fits the lists, and the build makes one call for each node.
      eq(built, t, `${where}: built tree`);
      assert.equal(end.calls, n, `${where}: one call for each node`);
      assert.equal(end.maxDepth, levels(t), `${where}: depth of the calls`);
      assert.equal(end.shape.one, 0, `${where}: a full tree has no node with one child`);
    } else {
      // Many trees fit the lists. The page shows this. The build makes extra calls for the empty ranges.
      assert.ok(end.shape.one > 0, `${where}: this tree has a node with one child`);
      assert.ok(end.calls > n, `${where}: extra calls for the empty ranges`);
    }
  });
  // Catalan numbers: C(m) = (2m)! / (m! (m+1)!)
  const fact = (x) => (x <= 1 ? 1 : x * fact(x - 1));
  for (let m = 0; m <= 8; m++) assert.equal(s.run('catalan', m), fact(2 * m) / (fact(m) * fact(m + 1)), `catalan(${m})`);
});

// ---------- AVL and red-black trees ----------
// Read the final tree of a step into { key, left, right } nodes. A left child has the smaller key.
function treeOf(step) {
  const by = new Map(step.nodes.map((n) => [n.id, { ...n, left: null, right: null }]));
  const hasParent = new Set();
  for (const [p, c] of step.edges) {
    const P = by.get(p), C = by.get(c);
    assert.ok(P && C, 'an edge points to a node that does not exist');
    assert.ok(!hasParent.has(c), `node ${c} has two parents`);
    hasParent.add(c);
    if (C.key < P.key) { assert.equal(P.left, null, 'two left children'); P.left = C; } else { assert.equal(P.right, null, 'two right children'); P.right = C; }
  }
  const roots = [...by.values()].filter((n) => !hasParent.has(n.id));
  assert.equal(roots.length, step.nodes.length ? 1 : 0, 'the tree must have exactly one root');
  return { root: roots[0] || null, nodes: [...by.values()] };
}
const inorder = (n) => (n ? [...inorder(n.left), n, ...inorder(n.right)] : []);
const height = (n) => (n ? 1 + Math.max(height(n.left), height(n.right)) : 0);

test('AVL: the final tree is a balanced search tree and the rotations match the case', () => {
  const s = sim('avl-tree-rotations.html');
  s.get('PRESETS').forEach((p, pi) => {
    for (const detail of options('avl-tree-rotations.html', 'selDetail')) {
      const end = last(s.run('simulate', pi, detail)), where = `"${p.name}" (${detail})`;
      const { root, nodes } = treeOf(end);
      // The keys that must be in the tree: the setup keys, then each insert and delete.
      const expected = new Set(p.setup);
      for (const [op, key] of p.ops) op === 'i' ? expected.add(key) : expected.delete(key);
      sameSet(nodes.map((n) => n.key), [...expected]);
      const keys = inorder(root).map((n) => n.key);
      assert.deepEqual(keys, [...keys].sort((a, b) => a - b), `${where}: not a search tree`);
      assert.deepEqual(inorder(root).map((n) => n.rank), keys.map((_, i) => i), `${where}: ranks must follow the in-order`);
      for (const n of nodes) {
        assert.equal(n.h, height(n), `${where}: height of ${n.key}`);
        assert.ok(Math.abs(height(n.left) - height(n.right)) <= 1, `${where}: node ${n.key} is out of balance`);
        assert.equal(Math.abs(n.bf), Math.abs(height(n.left) - height(n.right)), `${where}: balance factor of ${n.key}`);
      }
      assert.equal(end.height, height(root), `${where}: height of the tree`);
      const c = end.counts;
      assert.equal(c.rot, c.LL + c.RR + 2 * (c.LR + c.RL), `${where}: a single rotation counts 1 and a double rotation counts 2`);
      const named = /^(LL|RR|LR|RL)\b/.exec(p.name);
      if (named) for (const kind of ['LL', 'RR', 'LR', 'RL']) assert.equal(c[kind], kind === named[1] ? 1 : 0, `${where}: case ${kind}`);
    }
  });
});

test('red-black tree: the final tree follows the five rules and the cases are counted', () => {
  const s = sim('red-black-tree-insertion.html');
  s.get('PRESETS').forEach((p, pi) => {
    for (const detail of options('red-black-tree-insertion.html', 'selDetail')) {
      const end = last(s.run('simulate', pi, detail)), where = `"${p.name}" (${detail})`;
      const { root, nodes } = treeOf(end);
      sameSet(nodes.map((n) => n.key), [...p.setup, ...p.keys]);
      const keys = inorder(root).map((n) => n.key);
      assert.deepEqual(keys, [...keys].sort((a, b) => a - b), `${where}: not a search tree`);
      assert.equal(root.red, false, `${where}: the root must be black`);
      // No red node has a red child. Every path from the root to a missing child has the same number of black nodes.
      const blackHeight = (n) => {
        if (!n) return 0;
        if (n.red) assert.ok(!(n.left && n.left.red) && !(n.right && n.right.red), `${where}: red node ${n.key} has a red child`);
        const l = blackHeight(n.left), r = blackHeight(n.right);
        assert.equal(l, r, `${where}: black heights differ below node ${n.key}`);
        return l + (n.red ? 0 : 1);
      };
      assert.equal(blackHeight(root), end.bh, `${where}: black height`);
      assert.equal(end.height, height(root), `${where}: height`);
      assert.ok(height(root) <= 2 * Math.log2(nodes.length + 1), `${where}: height is more than 2 log2(n+1)`);
      const c = end.counts;
      assert.equal(c.rot, c.c2 + c.c3, `${where}: case 2 and case 3 each make one rotation`);
      // The presets that name a case must show that case.
      if (/^Case 1/.test(p.name)) assert.ok(c.c1 >= 1, `${where}: case 1 (red uncle) must happen`);
      if (/^Case 3/.test(p.name)) { assert.equal(c.c3, 1, `${where}: one case 3`); assert.equal(c.c2, 0, `${where}: no case 2`); assert.equal(c.rot, 1, `${where}: one rotation`); }
      if (/^(Case 2 then case 3|Mirror)/.test(p.name)) { assert.equal(c.c2, 1, `${where}: one case 2`); assert.equal(c.c3, 1, `${where}: one case 3`); assert.equal(c.rot, 2, `${where}: two rotations`); }
    }
  });
});

// ---------- order-statistic tree ----------
test('order-statistic tree: Select and both Rank versions agree with the sorted keys', () => {
  const s = sim('order-statistic-tree.html');
  s.get('TREES').forEach((tr, ti) => {
    const sorted = [...tr.keys].sort((a, b) => a - b), n = sorted.length;
    // The sizes in the tree: size = 1 + size(left) + size(right), and idx is the place in the sorted order.
    const first = s.run('simulate', ti, 'select', 1)[0].tree.root;
    (function check(node) {
      if (!node) return 0;
      const sz = 1 + check(node.left) + check(node.right);
      assert.equal(node.size, sz, `tree ${ti}: size of ${node.key}`);
      assert.equal(node.idx, sorted.indexOf(node.key) + 1, `tree ${ti}: place of ${node.key}`);
      return sz;
    })(first);
    assert.equal(first.size, n);
    for (let i = 1; i <= n; i++) assert.equal(last(s.run('simulate', ti, 'select', i)).result, sorted[i - 1], `tree ${ti}: Select(${i})`);
    for (const key of sorted) {
      for (const op of ['rank', 'down']) assert.equal(last(s.run('simulate', ti, op, key)).result, sorted.indexOf(key) + 1, `tree ${ti}: ${op} of ${key}`);
    }
  });
});

// ---------- address of an array element ----------
test('array address: the address matches the offset formula for row-major and column-major order', () => {
  const s = sim('array-address.html');
  const bases = options('array-address.html', 'selB').map(Number), sizes = options('array-address.html', 'selM').map(Number);
  let checked = 0;
  for (const d of [2, 3]) for (const order of ['row', 'col']) for (const lo of [0, 1]) {
    for (const [R, C, H] of d === 2 ? [[2, 3, 1], [4, 3, 1], [3, 4, 1]] : [[2, 3, 2], [4, 3, 3], [3, 4, 2]]) {
      for (const m of [sizes[0], sizes[sizes.length - 1]]) for (const base of [bases[0], bases[bases.length - 1]]) {
        for (let i = lo; i < lo + R; i++) for (let j = lo; j < lo + C; j++) for (let k = lo; k < lo + (d === 3 ? H : 1); k++) {
          const c = { d, order, R, C, H, m, base, lo, i, j, k };
          const model = s.run('model', c);
          const a = i - lo, b = j - lo, e = k - lo;
          let index;
          if (d === 2) index = order === 'row' ? a * C + b : b * R + a;
          else index = order === 'row' ? (a * C + b) * H + e : (e * C + b) * R + a;
          const where = JSON.stringify(c);
          assert.equal(model.index, index, `${where}: index`);
          assert.equal(model.addr, base + m * index, `${where}: address`);
          assert.equal(model.bytes, m * index, `${where}: bytes before the element`);
          assert.equal(model.N, R * C * (d === 3 ? H : 1), `${where}: element count`);
          assert.equal(model.terms.reduce((x, t) => x + t.skip, 0), index, `${where}: the skipped parts add up to the index`);
          checked++;
        }
      }
    }
  }
  assert.ok(checked > 1000);
  // The simulation must run to the end for a sample.
  const end = last(s.run('simulate', { d: 3, order: 'row', R: 4, C: 3, H: 3, m: 4, base: 1000, lo: 0, i: 2, j: 1, k: 2 }));
  assert.equal(end.done, true);
});

// ---------- doubly linked list ----------
test('doubly linked list: the new node is between its neighbors in both directions', () => {
  const s = sim('doubly-linked-list-insert.html');
  for (const g of [0, 1, 2]) {
    const end = last(s.run('simulate', g)), nodes = end.nodes;
    const base = end.base, expected = [...base.slice(0, g + 1), { 0: 7, 1: 20, 2: 35 }[g], ...base.slice(g + 1)];
    const ids = Object.keys(nodes);
    const head = ids.find((id) => nodes[id].prev === null), tail = ids.find((id) => nodes[id].next === null);
    const forward = [];
    for (let id = head, guard = 0; id !== null && guard < 20; id = nodes[id].next, guard++) forward.push(nodes[id].val);
    const backward = [];
    for (let id = tail, guard = 0; id !== null && guard < 20; id = nodes[id].prev, guard++) backward.push(nodes[id].val);
    assert.deepEqual(forward, expected, `gap ${g}: forward chain`);
    assert.deepEqual(backward, [...expected].reverse(), `gap ${g}: backward chain`);
    assert.equal(end.linked, true);
  }
});

// ---------- linked list reversal ----------
test('linked list reversal: every link turns around and the new head is the old tail', () => {
  const s = sim('linked-list-reversal.html');
  for (const n of [2, 3, 4, 5]) {
    const steps = s.run('simulate', n), end = last(steps);
    assert.equal(end.ret, n, `n=${n}: the new head is node ${n}`);
    assert.equal(end.links[1], null, `n=${n}: the old head points to NULL`);
    for (let id = 2; id <= n; id++) assert.equal(end.links[id], id - 1, `n=${n}: node ${id} points back`);
    assert.equal(Math.max(...steps.map((st) => st.stack.length)), n, `n=${n}: the call stack gets n frames deep`);
    eq(end.stack, [], `n=${n}: the stack is empty at the end`);
  }
});

// ---------- heaps: Max-Heapify and Build-Max-Heap ----------
// A reference that the test writes itself: sift down with a plain loop. Positions are 1 to n.
function refSiftDown(a, n, i0) {
  let i = i0, cmp = 0, swp = 0, calls = 0;
  for (;;) {
    calls++;
    const l = 2 * i, r = l + 1;
    let largest = i;
    if (l <= n) { cmp++; if (a[l] > a[largest]) largest = l; }
    if (r <= n) { cmp++; if (a[r] > a[largest]) largest = r; }
    if (largest === i) break;
    [a[i], a[largest]] = [a[largest], a[i]]; swp++;
    i = largest;
  }
  return { cmp, swp, calls };
}
function refBuild(input) {
  const n = input.length, a = [null, ...input];
  const out = { cmp: 0, swp: 0, calls: 0, perCall: [] };
  for (let i = Math.floor(n / 2); i >= 1; i--) {
    const c = refSiftDown(a, n, i);
    out.cmp += c.cmp; out.swp += c.swp; out.calls += c.calls; out.perCall[i] = c.swp;
  }
  out.a = a.slice(1);
  return out;
}
const isHeapArray = (a) => a.every((v, k) => k === 0 || a[Math.floor((k + 1) / 2) - 1] >= v);
// The height of node i by a plain search of the tree.
const bruteHeight = (i, n) => (2 * i > n ? 0 : 1 + Math.max(bruteHeight(2 * i, n), 2 * i + 1 <= n ? bruteHeight(2 * i + 1, n) : 0));
const ones = (n) => n.toString(2).replace(/0/g, '').length;
// A small seeded random generator, so that a failure can be repeated.
function rng(seed) { let t = seed >>> 0; return () => { t = (t + 0x6D2B79F5) >>> 0; let x = Math.imul(t ^ (t >>> 15), 1 | t); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; }; };
const randomArray = (rand, n) => Array.from({ length: n }, () => Math.floor(rand() * 90) + 1);
const nums = (v) => Array.from(v);

test('Build-Max-Heap: the example gives the max-heap that we find by hand', () => {
  const s = sim('build-max-heap.html');
  const ex = nums(s.get('EXAMPLE'));
  assert.deepEqual(ex, [5, 3, 17, 10, 84, 19, 6, 22, 9]);
  const end = last(s.run('simulate', 'build', ex));
  assert.deepEqual(nums(end.vals), [84, 22, 19, 10, 3, 17, 6, 5, 9]);
  assert.equal(end.swp, 6);
  assert.equal(end.cmp, 12);
  assert.equal(end.calls, 10);
  assert.deepEqual(nums(end.perCall).slice(1), [3, 1, 1, 1], 'swaps for the nodes 1, 2, 3, 4');
  assert.equal(end.done, true);
  // The array just before each call of maxHeapify that buildMaxHeap makes.
  const states = s.run('callStates', ex);
  assert.deepEqual(nums(states[4]), [5, 3, 17, 10, 84, 19, 6, 22, 9], 'the first call sees the array of the example');
  assert.deepEqual(nums(states[3]), [5, 3, 17, 22, 84, 19, 6, 10, 9]);
  assert.deepEqual(nums(states[2]), [5, 3, 19, 22, 84, 17, 6, 10, 9]);
  assert.deepEqual(nums(states[1]), [5, 84, 19, 22, 3, 17, 6, 10, 9]);
});

test('Build-Max-Heap: random arrays match the reference, and the counts follow the formulas', () => {
  const s = sim('build-max-heap.html'), rand = rng(2024);
  for (let n = 1; n <= 40; n++) {
    for (let rep = 0; rep < 6; rep++) {
      const input = randomArray(rand, n), end = last(s.run('simulate', 'build', input)), ref = refBuild(input);
      const where = `n=${n} [${input}]`;
      assert.deepEqual(nums(end.vals), ref.a, `${where}: final array`);
      assert.ok(isHeapArray(nums(end.vals)), `${where}: not a max-heap`);
      assert.deepEqual(nums(end.vals).sort((x, y) => x - y), [...input].sort((x, y) => x - y), `${where}: the values must be the same values`);
      assert.equal(end.swp, ref.swp, `${where}: swaps`);
      assert.equal(end.cmp, ref.cmp, `${where}: comparisons`);
      assert.equal(end.calls, ref.calls, `${where}: calls`);
      // The formulas on the page.
      const sumH = Array.from({ length: n }, (_, k) => bruteHeight(k + 1, n)).reduce((x, y) => x + y, 0);
      assert.equal(s.run('sumHeights', n), sumH, `${where}: the heights add up to n minus the 1 bits of n`);
      assert.equal(sumH, n - ones(n));
      assert.ok(end.swp <= sumH, `${where}: swaps are more than the sum of the heights`);
      assert.ok(end.cmp <= 2 * sumH, `${where}: comparisons are more than twice the sum of the heights`);
      assert.equal(end.calls, Math.floor(n / 2) + end.swp, `${where}: calls = n/2 + swaps`);
      for (let i = 1; i <= Math.floor(n / 2); i++) assert.ok(end.perCall[i] <= bruteHeight(i, n), `${where}: node ${i} used more swaps than its height`);
    }
  }
});

test('Build-Max-Heap: the limit on swaps is exact for a sorted array that fills the tree', () => {
  const s = sim('build-max-heap.html');
  for (let k = 1; k <= 6; k++) {
    const n = 2 ** k - 1, input = Array.from({ length: n }, (_, v) => v + 1);
    assert.equal(last(s.run('simulate', 'build', input)).swp, n - k, `n=${n}: the worst case uses n minus the 1 bits of n swaps`);
  }
});

test('heap formulas: the height of a node and the number of nodes at a height', () => {
  const s = sim('build-max-heap.html');
  for (let n = 1; n <= 64; n++) {
    const count = {};
    for (let i = 1; i <= n; i++) {
      assert.equal(s.run('heightOf', i, n), bruteHeight(i, n), `heightOf(${i}, ${n})`);
      assert.equal(s.run('heightOf', i, n), Math.floor(Math.log2(n / i) + 1e-12), `heightOf(${i}, ${n}) = floor(log2(n / i))`);
      count[bruteHeight(i, n)] = (count[bruteHeight(i, n)] || 0) + 1;
    }
    for (const [h, c] of Object.entries(count)) assert.ok(c <= s.run('maxAtHeight', n, +h), `n=${n}: too many nodes of height ${h}`);
  }
});

test('Max-Heapify: every call of the example, and random calls, match the reference', () => {
  const s = sim('max-heapify.html'), rand = rng(77);
  const ex = nums(s.get('EXAMPLE'));
  const check = (input, i, where) => {
    const n = input.length, end = last(s.run('simulate', 'heapify', input, i));
    const a = [null, ...input], ref = refSiftDown(a, n, i), h = bruteHeight(i, n);
    assert.deepEqual(nums(end.vals), a.slice(1), `${where}: final array`);
    assert.equal(end.swp, ref.swp, `${where}: swaps`);
    assert.equal(end.cmp, ref.cmp, `${where}: comparisons`);
    assert.equal(end.calls, ref.calls, `${where}: calls`);
    assert.ok(end.swp <= h && end.cmp <= 2 * h && end.calls <= h + 1, `${where}: more work than the height allows`);
    assert.equal(end.calls, end.swp + 1, `${where}: one call, and one more for each swap`);
    // Only the subtree of node i can change.
    const inSub = (p) => { while (p > i) p = Math.floor(p / 2); return p === i; };
    input.forEach((v, k) => { if (!inSub(k + 1)) assert.equal(end.vals[k], v, `${where}: node ${k + 1} is outside the subtree and must not change`); });
    // The subtree of node i is a max-heap again.
    assert.equal(s.run('isMaxHeap', nums(end.vals), n, i), true, `${where}: the subtree is not a max-heap`);
  };
  const states = s.run('callStates', ex);
  for (const i of [4, 3, 2, 1]) check(nums(states[i]), i, `example, node ${i}`);
  // The call at node 1 is the long one: 84 goes up, 5 sinks 3 levels.
  const long = last(s.run('simulate', 'heapify', nums(states[1]), 1));
  assert.deepEqual(nums(long.vals), [84, 22, 19, 10, 3, 17, 6, 5, 9]);
  assert.equal(long.swp, 3);
  for (let n = 1; n <= 30; n++) for (let rep = 0; rep < 4; rep++) {
    const st = s.run('callStates', randomArray(rand, n));
    for (let i = 1; i <= Math.floor(n / 2); i++) check(nums(st[i]), i, `n=${n} node ${i}`);
  }
});

test('heap pages: each step keeps the same values, and only a swap changes the array', () => {
  for (const [file, mode, call] of [['build-max-heap.html', 'build'], ['max-heapify.html', 'heapify', 1]]) {
    const s = sim(file), ex = nums(s.get('EXAMPLE'));
    const input = mode === 'build' ? ex : nums(s.run('callStates', ex)[call]);
    const steps = mode === 'build' ? s.run('simulate', 'build', input) : s.run('simulate', 'heapify', input, call);
    steps.forEach((st, k) => {
      assert.deepEqual(nums(st.vals).sort((x, y) => x - y), [...input].sort((x, y) => x - y), `${file} step ${k}: values`);
      if (k === 0) return;
      const prev = steps[k - 1];
      assert.ok(st.cmp >= prev.cmp && st.swp >= prev.swp && st.calls >= prev.calls, `${file} step ${k}: a counter went down`);
      const changed = nums(st.vals).map((v, p) => (v !== prev.vals[p] ? p + 1 : null)).filter(Boolean);
      if (st.title === 'Swap') {
        assert.deepEqual([...changed].sort(), [...st.swapped].sort(), `${file} step ${k}: a swap changes exactly the two positions`);
        assert.equal(st.swp, prev.swp + 1);
      } else assert.deepEqual(changed, [], `${file} step ${k} (${st.title}): the array must not change`);
    });
  }
});

test('heap pages: every highlighted line of code is the line that the note talks about', () => {
  for (const [file, mode] of [['build-max-heap.html', 'build'], ['max-heapify.html', 'heapify']]) {
    const s = sim(file), code = Array.from(vm.runInNewContext(html(file).match(/var CODE = (\[[\s\S]*?\n\]);/)[1]));
    const ex = nums(s.get('EXAMPLE'));
    const steps = mode === 'build' ? s.run('simulate', 'build', ex) : s.run('simulate', 'heapify', nums(s.run('callStates', ex)[1]), 1);
    const expect = {
      'Call maxHeapify': mode === 'build' ? ['maxHeapify(a, n, i);'] : ['void maxHeapify'],
      'Find the children': ['int l = 2 * i;', 'int r = 2 * i + 1;', 'int largest = i;'],
      'Compare with the left child': ['if (l <= n && a[l] > a[largest])'],
      'Compare with the right child': ['if (r <= n && a[r] > a[largest])'],
      'A child is larger': ['if (largest != i) {'],
      'No swap needed': ['if (largest != i) {'],
      'Swap': ['swap(&a[i], &a[largest]);'],
      'Recursive call': ['maxHeapify(a, n, largest);'],
      'A leaf: nothing to do': ['if (l <= n', 'if (r <= n', 'if (largest != i) {'],
      'Start the loop': ['for (int i = n / 2; i >= 1; i--)'],
      'Next node': ['for (int i = n / 2; i >= 1; i--)'],
      'The loop ends': ['for (int i = n / 2; i >= 1; i--)'],
    };
    let checked = 0;
    for (const st of steps) {
      for (const l of st.lines) assert.ok(l >= 1 && l <= code.length && code[l - 1].trim() !== '', `${file}: "${st.title}" marks line ${l}, which is not a line of code`);
      const want = expect[st.title];
      if (!want) continue;
      const text = nums(st.lines).map((l) => code[l - 1].trim());
      for (const w of want) assert.ok(text.some((t) => t.startsWith(w)), `${file}: "${st.title}" must mark "${w}". It marks ${JSON.stringify(text)}`);
      checked++;
    }
    assert.ok(checked > 10);
  }
});

test('the two heap pages have the same simulation code', () => {
  const block = (f) => { const h = html(f); return h.slice(h.indexOf('//SIM-START'), h.indexOf('//SIM-END')); };
  assert.equal(block('max-heapify.html'), block('build-max-heap.html'), 'change both pages when you change one');
});
