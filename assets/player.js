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
(function () {
  function $(id) { return document.getElementById(id); }
  var T = window.TRACE;
  if (!T) { throw new Error('player.js: window.TRACE is not defined. Load player.js after the page script.'); }

  function renderCode() {
    var code = T.getCode ? T.getCode() : T.code;
    $('code').innerHTML = code.map(function (t, k) {
      return '<li data-l="' + (k + 1) + '"><span class="no">' + (k + 1) + '</span><span>' + T.hl(t) + '</span></li>';
    }).join('');
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
