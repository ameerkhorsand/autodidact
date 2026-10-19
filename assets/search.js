// Search for the main page and for every subject page.
// It reads window.HUB_DATA (assets/hub-data.js, written by scripts/build.mjs) and needs fuzzy.js.
// The page tells it where it is: <body data-root="../../" data-subject="id">.
// Use: type to search, Up and Down to move, Enter to open, Esc to clear. "/" and Ctrl+K (or Cmd+K) focus the bar.
(function () {
  var $ = function (id) { return document.getElementById(id); };
  var body = document.body;
  var ROOT = body.getAttribute('data-root') || '';
  var CURRENT = body.getAttribute('data-subject') || '';
  var q = $('q'), clear = $('clear'), hint = $('hint'), panel = $('results'), stat = $('stat'),
      list = $('resultlist'), none = $('none'), spot = q.closest('.spot');

  // On a subject page, that subject has no use as a result. Its traces rank first.
  var DATA = (window.HUB_DATA || []).filter(function (d) { return !(d.type === 'subject' && d.subjectId === CURRENT); });
  DATA.forEach(function (d) { d.f = FUZ.prep(d.name, d.tags.join(' '), d.desc, d.kw, d.subjectName); });

  var hits = [], active = -1;

  var ICON = {
    subject: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="5.5" height="5.5" rx="1.2" fill="currentColor"/><rect x="9" y="1.5" width="5.5" height="5.5" rx="1.2" fill="currentColor"/><rect x="1.5" y="9" width="5.5" height="5.5" rx="1.2" fill="currentColor"/><rect x="9" y="9" width="5.5" height="5.5" rx="1.2" fill="currentColor"/></svg>',
    trace: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4 2.5 L13 8 L4 13.5 Z" fill="currentColor"/></svg>'
  };
  function el(tag, cls, text) { var e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; }

  function setOpen(state) {
    panel.hidden = !state;
    q.setAttribute('aria-expanded', state ? 'true' : 'false');
    body.classList.toggle('searching', state);
  }
  function setActive(i, scroll) {
    var items = list.children;
    if (items[active]) { items[active].classList.remove('active'); items[active].setAttribute('aria-selected', 'false'); }
    active = items.length ? i : -1;
    if (items[active]) {
      items[active].classList.add('active');
      items[active].setAttribute('aria-selected', 'true');
      q.setAttribute('aria-activedescendant', items[active].id);
      if (scroll && items[active].scrollIntoView) items[active].scrollIntoView({ block: 'nearest' });
    } else {
      q.removeAttribute('aria-activedescendant');
    }
  }
  function render() {
    list.innerHTML = '';
    hits.forEach(function (h, i) {
      var d = h.d, li = el('li'), a = el('a', 'hit'), ico = el('span', 'ico'), text = el('div', 'text'), side = el('div', 'side');
      li.id = 'hit-' + i; li.setAttribute('role', 'option'); li.setAttribute('aria-selected', 'false');
      a.href = ROOT + d.href; a.tabIndex = -1;
      ico.innerHTML = ICON[d.type];
      text.appendChild(el('p', 'name', d.name));
      text.appendChild(el('p', 'desc', d.desc));
      side.appendChild(el('span', 'ctx', d.type === 'subject' ? 'Subject' : d.subjectName));
      var ret = el('kbd', 'ret', '↵'); ret.setAttribute('aria-hidden', 'true'); side.appendChild(ret);
      a.appendChild(ico); a.appendChild(text); a.appendChild(side);
      li.appendChild(a); list.appendChild(li);
    });
  }
  function update() {
    var v = q.value.trim();
    clear.hidden = !v; hint.hidden = !!v;
    if (!v) { hits = []; list.innerHTML = ''; setActive(-1); setOpen(false); return; }
    hits = [];
    DATA.forEach(function (d) {
      var sc = FUZ.score(d.f, v);
      if (sc > 0) hits.push({ d: d, s: sc + (d.type === 'subject' ? 3 : 0) + (CURRENT && d.subjectId === CURRENT ? 2 : 0) });
    });
    hits.sort(function (a, b) { return b.s - a.s || (a.d.name < b.d.name ? -1 : 1); });
    render();
    list.hidden = !hits.length;
    none.hidden = hits.length > 0;
    stat.textContent = hits.length ? hits.length + (hits.length === 1 ? ' result' : ' results') : 'No result';
    if (!hits.length) none.textContent = 'Nothing matches “' + v + '”. Try a shorter word, a subject name, or an algorithm name such as quicksort, AVL, or Floyd.';
    setActive(hits.length ? 0 : -1, false);
    setOpen(true);
  }
  function move(step) {
    if (!hits.length) return;
    setActive((active + step + hits.length) % hits.length, true);
  }

  q.addEventListener('input', update);
  q.addEventListener('focus', function () { if (q.value.trim()) setOpen(true); });
  q.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (panel.hidden && q.value.trim()) setOpen(true); else move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') {
      var li = !panel.hidden && list.children[active];
      if (li) { e.preventDefault(); li.querySelector('a').click(); }
    } else if (e.key === 'Escape') {
      if (q.value) { e.preventDefault(); q.value = ''; update(); } else { q.blur(); }
    }
  });
  clear.addEventListener('click', function () { q.value = ''; update(); q.focus(); });

  // Hover moves the selection. A click on the panel must not take the focus from the bar.
  list.addEventListener('mousemove', function (e) {
    var li = e.target.closest && e.target.closest('li');
    if (li && li.parentNode === list) { var i = [].indexOf.call(list.children, li); if (i !== active) setActive(i, false); }
  });
  panel.addEventListener('mousedown', function (e) { if (!(e.target.closest && e.target.closest('a'))) e.preventDefault(); });
  spot.addEventListener('focusout', function (e) { if (!spot.contains(e.relatedTarget)) setOpen(false); });
  document.addEventListener('mousedown', function (e) { if (!spot.contains(e.target)) setOpen(false); });

  document.addEventListener('keydown', function (e) {
    var typing = e.target.closest && e.target.closest('input,textarea,select,[contenteditable]');
    if ((e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K'))) {
      e.preventDefault(); q.focus(); q.select();
    }
  });
  window.addEventListener('pageshow', update); // The browser can restore the text of the bar when the user goes back.

  var apple = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
  hint.textContent = apple ? '⌘K' : 'Ctrl K';
  update();
  if (body.hasAttribute('data-autofocus') && window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches) q.focus();
})();
