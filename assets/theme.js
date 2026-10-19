// Theme for every page. Load it in the <head>, as a plain script (no defer, no async), after the style sheets:
//   <script src="../../assets/theme.js"></script>
// It runs before the page draws, so there is no flash of the wrong theme. It does three things:
//   1. It reads the saved choice. With no saved choice, it follows the system setting.
//   2. It sets data-theme="light" or "dark" on <html>. assets/theme.css turns that into the colors.
//   3. When the page is ready, it adds the toggle button.
// The choice is saved in localStorage. If the browser blocks storage, the toggle still works for the page.
(function () {
  var KEY = 'autodidact-theme';
  var root = document.documentElement;
  var query = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  var button = null;

  function saved() {
    try {
      var v = localStorage.getItem(KEY);
      return v === 'light' || v === 'dark' ? v : null;
    } catch (e) { return null; }
  }
  function save(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* storage is blocked: keep the choice in the page only */ } }
  function system() { return query && query.matches ? 'dark' : 'light'; }
  function current() { return root.getAttribute('data-theme') === 'dark' ? 'dark' : 'light'; }

  function apply(theme) {
    root.setAttribute('data-theme', theme);
    if (button) {
      button.setAttribute('aria-pressed', String(theme === 'dark'));
      button.title = theme === 'dark' ? 'Switch to light mode' : 'Switch to night mode';
    }
  }

  apply(saved() || system());

  // Follow a change of the system setting, and a change made in another tab, unless the reader chose a theme.
  function follow() { apply(saved() || system()); }
  if (query) {
    if (query.addEventListener) query.addEventListener('change', follow);
    else if (query.addListener) query.addListener(follow);
  }
  window.addEventListener('storage', function (e) { if (e.key === KEY || e.key === null) follow(); });

  function addButton() {
    button = document.createElement('button');
    button.type = 'button';
    button.className = 'theme-toggle';
    button.setAttribute('aria-label', 'Night mode');
    button.innerHTML =
      '<svg class="moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8.5 8.5 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>' +
      '<svg class="sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5M5.3 5.3l1.8 1.8M16.9 16.9l1.8 1.8M5.3 18.7l1.8-1.8M16.9 7.1l1.8-1.8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>';
    button.addEventListener('click', function () {
      var next = current() === 'dark' ? 'light' : 'dark';
      save(next);
      apply(next);
    });
    document.body.appendChild(button);
    apply(current());
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', addButton);
  else addButton();
})();
