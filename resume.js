// /resume page: render RESUME.md, the top link, and Esc to go home
(function () {
  'use strict';

  // render RESUME.md, minus its own PDF section (the bar below covers it)
  fetch('/RESUME.md', { cache: 'no-cache' })
    .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
    .then(function (text) {
      text = text.replace(/\n## PDF[\s\S]*$/, '\n');
      document.getElementById('resume').innerHTML = window.MD.render(text);
    })
    .catch(function () {});

  // ↑ top: jump back up without adding #top to the address
  var top = document.getElementById('to-top');
  if (top) top.addEventListener('click', function (e) {
    e.preventDefault();
    window.scrollTo(0, 0);
  });

  // Esc goes home, like backing out of a man page
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !e.ctrlKey && !e.metaKey && !e.altKey) location.href = '/';
  });
})();
