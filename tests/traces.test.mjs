// Test every trace page: it loads with no error, and every step of every input shows on the page.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT, loadPage } from './helpers.mjs';

const manifest = JSON.parse(readFileSync(join(ROOT, 'manifest.json'), 'utf8'));
const pages = manifest.subjects.flatMap((s) => s.traces.map((t) => `subjects/${s.id}/${t.file}`));

const $ = (doc, id) => doc.getElementById(id);

// Every input the page offers: each option of each select.param, and each button of #seg.
async function scenarios(page) {
  const { dom, document } = await loadPage(page);
  const list = [{ name: 'default' }];
  for (const sel of document.querySelectorAll('select.param')) {
    for (const o of sel.options) list.push({ name: `${sel.id}=${o.value}`, id: sel.id, value: o.value });
  }
  document.querySelectorAll('#seg button').forEach((_, i) => list.push({ name: `seg ${i}`, seg: i }));
  dom.window.close();
  return list;
}

for (const page of pages) {
  test(page, async (t) => {
    const first = await loadPage(page);
    assert.deepEqual(first.errors, [], 'the page has script errors');
    first.dom.window.close();

    for (const sc of await scenarios(page)) {
      await t.test(sc.name, async () => {
        const { dom, window, document, errors } = await loadPage(page);
        if (sc.id) {
          const el = $(document, sc.id);
          el.value = sc.value;
          el.dispatchEvent(new window.Event('change', { bubbles: true }));
        }
        if (sc.seg !== undefined) document.querySelectorAll('#seg button')[sc.seg].click();

        const total = +$(document, 'scrub').max;
        assert.ok(total >= 2, 'a trace needs at least 3 steps');
        assert.match($(document, 'stepno').textContent, new RegExp(`^Step 0 of ${total}$`));
        assert.equal($(document, 'prev').disabled, true);
        assert.ok($(document, 'code').children.length > 0, 'the code panel is empty');

        // Next: every step has a title, a note, and a drawing.
        for (let i = 0; i <= total; i++) {
          assert.ok($(document, 'title').textContent.length > 0, `step ${i} has no title`);
          assert.ok($(document, 'note').textContent.length > 0, `step ${i} has no note`);
          assert.ok($(document, 'stage').innerHTML.length > 0, `step ${i} has no diagram`);
          assert.equal($(document, 'stepno').textContent, `Step ${i} of ${total}`);
          if (i < total) $(document, 'next').click();
        }
        assert.equal($(document, 'next').disabled, true);
        assert.equal($(document, 'play').textContent, 'Replay');

        // Back, scrub, and Reset.
        $(document, 'prev').click();
        assert.equal($(document, 'stepno').textContent, `Step ${total - 1} of ${total}`);
        const scrub = $(document, 'scrub');
        scrub.value = '1';
        scrub.dispatchEvent(new window.Event('input', { bubbles: true }));
        assert.equal($(document, 'stepno').textContent, `Step 1 of ${total}`);
        $(document, 'reset').click();
        assert.equal($(document, 'stepno').textContent, `Step 0 of ${total}`);

        // Keys.
        document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
        assert.equal($(document, 'stepno').textContent, `Step 1 of ${total}`);
        document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }));
        assert.equal($(document, 'stepno').textContent, `Step 0 of ${total}`);

        assert.deepEqual(errors, [], 'the page has script errors');
        dom.window.close();
      });
    }
  });

  test(`${page}: Play moves forward and Pause stops`, async () => {
    const { dom, document, errors } = await loadPage(page);
    // Choose the fastest speed that the page offers.
    const speed = $(document, 'speed');
    speed.value = [...speed.options].map((o) => o.value).sort((a, b) => a - b)[0];
    speed.dispatchEvent(new dom.window.Event('change'));
    const ms = +speed.value;
    $(document, 'play').click();
    assert.equal($(document, 'play').textContent, 'Pause');
    await new Promise((r) => setTimeout(r, ms + 200));
    assert.match($(document, 'stepno').textContent, /^Step [1-9]/);
    assert.equal($(document, 'play').textContent, 'Pause', 'the trace must still run (it has more than 2 steps)');
    $(document, 'play').click();
    assert.equal($(document, 'play').textContent, 'Play');
    assert.deepEqual(errors, []);
    dom.window.close();
  });
}
