// Theme: Auto (follows the system), Light, or Dark. The button on every page changes it.
// Load this file in <head>, before the page draws. Then the page never flashes the wrong theme.
// The choice is saved in the browser. A browser can block storage. The code still works then.
(function () {
  var KEY = 'autodidact-theme';
  var ORDER = ['auto', 'light', 'dark'];
  var LABEL = { auto: 'Auto', light: 'Light', dark: 'Dark' };
  var ICON = {
    auto: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="7" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 3 A7 7 0 0 1 10 17 Z" fill="currentColor"/></svg>',
    light: '<svg viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="10" r="3.6" fill="none" stroke="currentColor" stroke-width="1.7"/><path d="M10 2.2v2.2M10 15.6v2.2M2.2 10h2.2M15.6 10h2.2M4.5 4.5l1.6 1.6M13.9 13.9l1.6 1.6M4.5 15.5l1.6-1.6M13.9 6.1l1.6-1.6" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>',
    dark: '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="M16.5 11.6A6.8 6.8 0 0 1 8.4 3.5a6.8 6.8 0 1 0 8.1 8.1Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/></svg>'
  };
  var root = document.documentElement;

  function read() {
    try { var v = window.localStorage.getItem(KEY); return v === 'light' || v === 'dark' ? v : 'auto'; } catch (e) { return 'auto'; }
  }
  function save(mode) {
    try { if (mode === 'auto') window.localStorage.removeItem(KEY); else window.localStorage.setItem(KEY, mode); } catch (e) { /* storage is blocked */ }
  }
  var mode = read();
  function apply() {
    if (mode === 'auto') root.removeAttribute('data-theme'); else root.setAttribute('data-theme', mode);
  }
  apply();

  function addButton() {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'theme-toggle';
    function paint() {
      var next = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
      b.innerHTML = ICON[mode];
      b.setAttribute('data-mode', mode);
      b.title = 'Theme: ' + LABEL[mode];
      b.setAttribute('aria-label', 'Theme: ' + LABEL[mode] + '. Switch to ' + LABEL[next] + '.');
    }
    b.addEventListener('click', function () {
      mode = ORDER[(ORDER.indexOf(mode) + 1) % ORDER.length];
      save(mode); apply(); paint();
    });
    // Another tab or page changed the theme.
    window.addEventListener('storage', function (e) {
      if (e.key === KEY || e.key === null) { mode = read(); apply(); paint(); }
    });
    paint();
    document.body.appendChild(b);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButton); else addButton();
})();
