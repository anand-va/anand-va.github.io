// latte / mocha switch in the footer. a page can ask for a reload after
// switching with data-reload on the button (the home page replays its intro).
(function () {
  'use strict';
  var root = document.documentElement;
  var btn = document.getElementById('theme');
  var label = document.getElementById('theme-name');
  var meta = document.querySelector('meta[name="color-scheme"]');
  var system = matchMedia('(prefers-color-scheme: dark)');
  if (!btn || !label) return;

  var names = { light: 'latte', dark: 'mocha' };

  function current() {
    return root.dataset.theme || (system.matches ? 'dark' : 'light');
  }

  window.setTheme = function (next) {
    if (!names[next]) return;
    root.dataset.theme = next;
    if (meta) meta.content = next;
    label.textContent = names[next];
    try { localStorage.setItem('theme', next); } catch (e) {}
  };

  label.textContent = names[current()];

  // the OS can switch schemes at any time (e.g. at sunset); keep the label
  // right when no theme is pinned
  system.addEventListener('change', function () {
    label.textContent = names[current()];
  });

  btn.addEventListener('click', function () {
    window.setTheme(current() === 'dark' ? 'light' : 'dark');
    if (btn.hasAttribute('data-reload')) location.reload();
  });
})();
