// show the path that wasn't found. textContent only, so a crafted URL
// can't inject markup into the page.
(function () {
  'use strict';
  var p = location.pathname;
  try { p = decodeURIComponent(p); } catch (e) {} // malformed %-escapes
  p = p.slice(0, 80) || '/';
  ['path', 'path2'].forEach(function (id) {
    var el = document.getElementById(id);
    if (el) el.textContent = p;
  });
})();
