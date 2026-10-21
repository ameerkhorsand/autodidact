// Shared player for every trace page. It draws the controls, the code panel, and the step note.
//
// The page defines window.TRACE before it loads this file:
//   code | getCode()   the source lines to show (an array of strings)
//   hl(line)           returns the HTML of one code line (with syntax colors)
//   simulate()         returns the array of steps. A step has: lines (array), title, note.
//   render(step, i)    draws the diagram, tables, and formulas for step number i
// Optional parts of window.TRACE:
//   init()             runs once, before the first build
//   onParam(el)        runs when a select.param changes, before the steps are built again
//   bind(rebuild)      lets the page add its own controls. Call rebuild() when an input changes.
//
// The page also defines COMPLEXITY (its own block between //COMPLEXITY-START and //COMPLEXITY-END).
// The player draws the Complexity card from it, above the controls. The fields are in README.md.
(function () {
  function $(id) { return document.getElementById(id); }
  function escHtml(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  var T = window.TRACE;
  if (!T) { throw new Error('player.js: window.TRACE is not defined. Load player.js after the page script.'); }

  function renderCode() {
    var code = T.getCode ? T.getCode() : T.code;
    var loops = (window.COMPLEXITY && window.COMPLEXITY.loops) || {};
    $('code').innerHTML = code.map(function (t, k) {
      var tag = loops[k + 1] ? '<span class="rep">' + escHtml(loops[k + 1]) + '</span>' : '';
      return '<li data-l="' + (k + 1) + '"><span class="no">' + (k + 1) + '</span><span>' + T.hl(t) + tag + '</span></li>';
    }).join('');
  }

  // ---------- Complexity card ----------
  // Drawn from window.COMPLEXITY. mountCard() runs when the steps are built. updateCard() runs at each step.
  function text(v, fin) { return typeof v === 'function' ? v(fin) : v; }
  function count(n, unit) { return n + ' ' + (n === 1 ? unit.replace(/s$/, '') : unit); }
  var C = window.COMPLEXITY, WHEN = { all: 'Every case', best: 'Best case', average: 'Average case', worst: 'Worst case' };
  function mountCard(list) {
    if (!C) return;
    var host = $('cx'), wasOpen = !window.matchMedia || window.matchMedia('(min-width: 861px)').matches;
    if (host) { var d0 = host.querySelector('details'); if (d0) wasOpen = d0.open; }
    else {
      host = document.createElement('section');
      host.id = 'cx'; host.className = 'panel cx'; host.setAttribute('aria-label', 'Complexity');
      var controls = document.querySelector('.controls');
      controls.parentNode.insertBefore(host, controls);
    }
    var fin = list[list.length - 1], here = C.caseOf ? C.caseOf(fin) : null, mark = here !== 'all' ? here : null, h = '<h2>Complexity</h2><div class="cx-top"><div class="cx-time"><p class="cx-h">Time</p><div class="cx-cases">';
    C.time.forEach(function (t) {
      h += '<div class="cx-cell' + (t.when === C.main ? ' main' : '') + (t.when === mark ? ' here' : '') + '"><span class="cx-when">' + WHEN[t.when] + (t.when === mark ? ' · this input' : '') + '</span>' +
        '<span class="cx-o">' + escHtml(t.o) + '</span><span class="cx-w">' + escHtml(t.words) + '</span></div>';
    });
    h += '</div></div><div class="cx-space"><p class="cx-h">Space</p><div class="cx-cell"><span class="cx-when">Extra memory</span><span class="cx-o">' + escHtml(C.space.o) + '</span><span class="cx-w">' + escHtml(C.space.words) + '</span></div></div></div>';
    h += '<div class="cx-meters" id="cx-meters">' + (C.meters || []).map(function (m, k) {
      return '<div class="cx-meter"><p class="cx-mt"><span>' + escHtml(m.label) + ' so far: <b id="cx-v' + k + '">0</b></span><span>at most <b id="cx-l' + k + '">0</b></span></p>' +
        '<div class="cx-bar" id="cx-b' + k + '" role="meter" aria-label="' + escHtml(m.label) + '" aria-valuemin="0"><i></i></div></div>';
    }).join('') + '</div>';
    h += '<details class="cx-more"' + (wasOpen ? ' open' : '') + '><summary>Why, best and worst case, growth</summary><div class="cx-cols">';
    h += '<div><p class="cx-h">Why</p>' + C.why.map(function (p) { return '<p>' + escHtml(p) + '</p>'; }).join('') + '</div>';
    h += '<div><p class="cx-h">Best and worst case</p><ul class="cx-list">' + C.cases.map(function (c) {
      var on = c.when === here && here !== 'all';
      return '<li' + (on ? ' class="here"' : '') + '><b>' + WHEN[c.when] + (on ? ' · this input' : '') + '</b><span>' + escHtml(c.input) + '</span><span class="cx-n">' + (c.bound ? 'at most ' : '') + escHtml(count(c.at(fin), C.unit)) + '</span></li>';
    }).join('') + (here === 'between' ? '<li class="here"><b>This input · between the two</b><span class="cx-n">' + escHtml(count(C.measured(fin), C.unit)) + '</span></li>' : '') + '</ul></div>';
    h += '<div><p class="cx-h">Growth: ' + escHtml(text(C.growth.label, fin)) + '</p><table class="cx-tab"><tr><th>n</th><th>Cost</th><th>Change</th></tr>';
    [8, 16, 32].forEach(function (n, k, a) {
      var v = C.growth.f(n, fin), p = k ? C.growth.f(a[k - 1], fin) : null;
      h += '<tr><td>' + n + '</td><td>' + v + '</td><td>' + (p ? '× ' + (Math.round(v / p * 100) / 100) : '') + '</td></tr>';
    });
    h += '</table><p class="cx-w">' + escHtml(text(C.growth.note, fin)) + '</p></div></div></details>';
    host.innerHTML = h;
  }
  function updateCard(s) {
    if (!C || !C.meters) return;
    C.meters.forEach(function (m, k) {
      var v = m.value(s), lim = m.limit(s), bar = $('cx-b' + k);
      $('cx-v' + k).textContent = v; $('cx-l' + k).textContent = lim;
      bar.setAttribute('aria-valuemax', lim); bar.setAttribute('aria-valuenow', v);
      bar.firstChild.style.width = (lim > 0 ? Math.min(100, v / lim * 100) : 0) + '%';
    });
  }

  var steps = [], i = 0, playing = false, timer = null;

  function lineLabel(ls) {
    if (!ls.length) return '';
    return ls.length === 1 ? 'Line ' + ls[0] : 'Lines ' + ls[0] + '–' + ls[ls.length - 1];
  }
  function update() {
    var s = steps[i], lis = document.querySelectorAll('#code li');
    for (var k = 0; k < lis.length; k++) {
      lis[k].classList.toggle('on', s.lines.indexOf(+lis[k].getAttribute('data-l')) >= 0);
    }
    $('title').textContent = s.title;
    $('lineref').textContent = lineLabel(s.lines);
    $('note').textContent = s.note;
    T.render(s, i);
    updateCard(s);
    $('scrub').value = i;
    $('stepno').textContent = 'Step ' + i + ' of ' + (steps.length - 1);
    $('prev').disabled = i === 0;
    $('reset').disabled = i === 0;
    $('next').disabled = i === steps.length - 1;
    $('play').textContent = playing ? 'Pause' : (i >= steps.length - 1 ? 'Replay' : 'Play');
  }
  function stop() { playing = false; if (timer) { clearInterval(timer); timer = null; } }
  function play() {
    if (i >= steps.length - 1) i = 0;
    playing = true;
    update();
    if (timer) clearInterval(timer);
    timer = setInterval(function () {
      if (i < steps.length - 1) { i++; if (i >= steps.length - 1) stop(); update(); } else { stop(); update(); }
    }, +$('speed').value);
  }
  function build() {
    stop();
    steps = T.simulate();
    mountCard(steps);
    renderCode();
    i = 0;
    $('scrub').max = steps.length - 1;
    update();
  }

  $('play').addEventListener('click', function () { if (playing) { stop(); update(); } else play(); });
  $('next').addEventListener('click', function () { stop(); if (i < steps.length - 1) i++; update(); });
  $('prev').addEventListener('click', function () { stop(); if (i > 0) i--; update(); });
  $('reset').addEventListener('click', function () { stop(); i = 0; update(); });
  $('scrub').addEventListener('input', function () { stop(); i = +this.value; update(); });
  $('speed').addEventListener('change', function () { if (playing) play(); });
  [].forEach.call(document.querySelectorAll('.param'), function (el) {
    el.addEventListener('change', function () { if (T.onParam) T.onParam(el); build(); });
  });
  if (T.bind) T.bind(build);
  document.addEventListener('keydown', function (e) {
    if (e.target.closest && e.target.closest('input,select,textarea,button')) return;
    if (e.key === 'ArrowRight') { stop(); if (i < steps.length - 1) i++; update(); }
    else if (e.key === 'ArrowLeft') { stop(); if (i > 0) i--; update(); }
    else if (e.key === ' ') { e.preventDefault(); if (playing) { stop(); update(); } else play(); }
  });

  if (T.init) T.init();
  build();
})();
