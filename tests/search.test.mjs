// Test the search bar of the main page and of the subject pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadPage, type } from './helpers.mjs';

const names = (document) => [...document.querySelectorAll('#resultlist .hit .name')].map((e) => e.textContent);
const key = (window, target, k, extra = {}) => target.dispatchEvent(new window.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...extra }));
// A click on a result link would start a navigation. Record the link instead.
function trackLinks(document) {
  const seen = [];
  document.addEventListener('click', (e) => {
    const a = e.target.closest && e.target.closest('a');
    if (a) { e.preventDefault(); seen.push(a.getAttribute('href')); }
  });
  return seen;
}

test('main page: the bar comes first and the sections are below it', async () => {
  const { dom, document, errors } = await loadPage('index.html');
  const bar = document.querySelector('.spot'), sections = document.getElementById('groups');
  assert.ok(bar.compareDocumentPosition(sections) & dom.window.Node.DOCUMENT_POSITION_FOLLOWING, 'the sections must follow the bar');
  assert.equal(document.getElementById('results').hidden, true, 'the panel is closed at the start');
  assert.equal(document.querySelectorAll('#groups .card').length, 8, 'all eight subjects show below the bar');
  assert.equal(document.getElementById('q').getAttribute('role'), 'combobox');
  assert.deepEqual(errors, []);
  dom.window.close();
});

test('main page: a typo still finds the trace, and the panel opens over the sections', async () => {
  const { dom, window, document, errors } = await loadPage('index.html');
  const q = document.getElementById('q');
  type(window, q, 'quiksort');
  assert.equal(names(document)[0], 'QuickSort');
  assert.equal(document.getElementById('results').hidden, false);
  assert.equal(q.getAttribute('aria-expanded'), 'true');
  assert.ok(document.body.classList.contains('searching'), 'the sections fade while the panel is open');
  assert.equal(document.getElementById('groups').hidden, false, 'the sections are not removed');
  assert.match(document.getElementById('stat').textContent, /^\d+ results?$/);
  type(window, q, '');
  assert.equal(document.getElementById('results').hidden, true);
  assert.equal(document.body.classList.contains('searching'), false);
  assert.deepEqual(errors, []);
  dom.window.close();
});

test('main page: a subject name finds the subject', async () => {
  const { dom, window, document } = await loadPage('index.html');
  type(window, document.getElementById('q'), 'operating systems');
  const first = document.querySelector('#resultlist a.hit');
  assert.match(first.getAttribute('href'), /^subjects\/operating-systems\/index\.html$/);
  dom.window.close();
});

test('main page: a word with no match shows a message', async () => {
  const { dom, window, document } = await loadPage('index.html');
  type(window, document.getElementById('q'), 'zzzzqqqq');
  const none = document.getElementById('none');
  assert.equal(none.hidden, false);
  assert.match(none.textContent, /Nothing matches/);
  assert.equal(document.getElementById('stat').textContent, 'No result');
  assert.equal(document.querySelectorAll('#resultlist li').length, 0);
  dom.window.close();
});

test('main page: arrow keys move the selection and Enter opens it', async () => {
  const { dom, window, document, errors } = await loadPage('index.html');
  const links = trackLinks(document), q = document.getElementById('q');
  type(window, q, 'sort');
  const total = document.querySelectorAll('#resultlist li').length;
  assert.ok(total >= 3, 'the word "sort" must give at least 3 results');
  const active = () => [...document.querySelectorAll('#resultlist li')].findIndex((li) => li.classList.contains('active'));
  assert.equal(active(), 0, 'the first result is selected at the start');
  assert.equal(q.getAttribute('aria-activedescendant'), 'hit-0');
  key(window, q, 'ArrowDown');
  assert.equal(active(), 1);
  assert.equal(q.getAttribute('aria-activedescendant'), 'hit-1');
  key(window, q, 'ArrowUp'); key(window, q, 'ArrowUp');
  assert.equal(active(), total - 1, 'Up from the first result goes to the last');
  key(window, q, 'ArrowDown');
  assert.equal(active(), 0, 'Down from the last result goes to the first');
  key(window, q, 'ArrowDown');
  const expected = document.querySelectorAll('#resultlist a.hit')[1].getAttribute('href');
  key(window, q, 'Enter');
  assert.deepEqual(links, [expected], 'Enter opens the selected result');
  assert.deepEqual(errors, []);
  dom.window.close();
});

test('main page: Escape clears the bar, then leaves it', async () => {
  const { dom, window, document } = await loadPage('index.html');
  const q = document.getElementById('q');
  q.focus();
  type(window, q, 'avl');
  key(window, q, 'Escape');
  assert.equal(q.value, '');
  assert.equal(document.getElementById('results').hidden, true);
  key(window, q, 'Escape');
  assert.notEqual(document.activeElement, q, 'a second Escape takes the focus away');
  dom.window.close();
});

test('main page: "/" and Ctrl+K focus the bar, but "/" inside the bar types a slash', async () => {
  const { dom, window, document } = await loadPage('index.html');
  const q = document.getElementById('q');
  assert.notEqual(document.activeElement, q);
  key(window, document.body, '/');
  assert.equal(document.activeElement, q);
  q.blur();
  key(window, document.body, 'k', { ctrlKey: true });
  assert.equal(document.activeElement, q);
  q.blur();
  key(window, document.body, 'k', { metaKey: true });
  assert.equal(document.activeElement, q);
  const slash = new window.KeyboardEvent('keydown', { key: '/', bubbles: true, cancelable: true });
  q.dispatchEvent(slash);
  assert.equal(slash.defaultPrevented, false, 'the slash must reach the text box');
  dom.window.close();
});

test('main page: the panel closes when the focus leaves the bar and opens again on focus', async () => {
  const { dom, window, document } = await loadPage('index.html');
  const q = document.getElementById('q');
  type(window, q, 'josephus');
  assert.equal(document.getElementById('results').hidden, false);
  q.dispatchEvent(new window.FocusEvent('focusout', { bubbles: true, relatedTarget: document.body }));
  assert.equal(document.getElementById('results').hidden, true);
  assert.equal(q.value, 'josephus', 'the text stays');
  q.dispatchEvent(new window.FocusEvent('focus'));
  assert.equal(document.getElementById('results').hidden, false);
  document.getElementById('clear').click();
  assert.equal(q.value, '');
  dom.window.close();
});

test('main page: every card count matches the manifest', async () => {
  const { dom, document } = await loadPage('index.html');
  const total = [...document.querySelectorAll('.card .foot span:first-child')].map((e) => e.textContent);
  assert.ok(total.includes('13 traces'));
  assert.equal(total.filter((t) => t === 'No traces yet').length, 7);
  dom.window.close();
});

test('subject page: the bar comes first, the chapters are below, and links keep the right path', async () => {
  const { dom, window, document, errors } = await loadPage('subjects/data-structures-and-algorithms/index.html');
  const bar = document.querySelector('.spot'), chapters = document.getElementById('chapters');
  assert.ok(bar.compareDocumentPosition(chapters) & window.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.equal(chapters.querySelectorAll('li').length, 13);
  type(window, document.getElementById('q'), 'bubel');
  assert.equal(names(document)[0], 'Bubble sort');
  assert.equal(document.querySelector('#resultlist a.hit').getAttribute('href'), '../../subjects/data-structures-and-algorithms/bubble-sort.html');
  assert.ok(document.body.classList.contains('searching'));
  assert.equal(chapters.hidden, false);
  type(window, document.getElementById('q'), '');
  assert.equal(document.body.classList.contains('searching'), false);
  assert.deepEqual(errors, []);
  dom.window.close();
});

test('subject page: the page of this subject is not a result, and its own traces come first', async () => {
  const { dom, window, document } = await loadPage('subjects/data-structures-and-algorithms/index.html');
  type(window, document.getElementById('q'), 'data structures');
  const hrefs = [...document.querySelectorAll('#resultlist a.hit')].map((a) => a.getAttribute('href'));
  assert.ok(!hrefs.includes('../../subjects/data-structures-and-algorithms/index.html'), 'no link to the page itself');
  dom.window.close();
});

test('a subject page with no traces still searches the whole site', async () => {
  const { dom, window, document, errors } = await loadPage('subjects/operating-systems/index.html');
  assert.ok(document.querySelector('.spot'), 'the bar is on every subject page');
  assert.match(document.querySelector('#chapters').textContent, /No animated traces here yet/);
  type(window, document.getElementById('q'), 'quicksort');
  assert.equal(names(document)[0], 'QuickSort');
  assert.equal(document.querySelector('#resultlist a.hit').getAttribute('href'), '../../subjects/data-structures-and-algorithms/quicksort.html');
  assert.deepEqual(errors, []);
  dom.window.close();
});

test('every subject page loads with no error', async () => {
  const { document: home, dom: d0 } = await loadPage('index.html');
  const hrefs = [...home.querySelectorAll('a.card')].map((a) => a.getAttribute('href'));
  d0.window.close();
  assert.equal(hrefs.length, 8);
  for (const h of hrefs) {
    const { dom, errors } = await loadPage(h);
    assert.deepEqual(errors, [], h);
    dom.window.close();
  }
});
