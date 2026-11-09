// latte / mocha switch in the footer. a page can ask for a reload after
// switching with data-reload on the button (the home page replays its intro).
(function () {
  'use strict';
  var root = document.documentElement;
  var btn = document.getElementById('theme');
  var label = document.getElementById('theme-name');
  if (!btn || !label) return;

  var names = { light: 'latte', dark: 'mocha' };

  function current() {
    return root.dataset.theme ||
      (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  }

  window.setTheme = function (next) {
    if (!names[next]) return;
    root.dataset.theme = next;
    label.textContent = names[next];
    try { localStorage.setItem('theme', next); } catch (e) {}
  };

  label.textContent = names[current()];
  btn.addEventListener('click', function () {
    window.setTheme(current() === 'dark' ? 'light' : 'dark');
    if (btn.hasAttribute('data-reload')) location.reload();
  });
})();
