// runs in <head> before paint, so the saved theme applies without a flash.
// only the two known values are accepted from storage. the color-scheme meta
// follows a pinned theme so the browser paints the right canvas straight away.
try {
  var t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') {
    document.documentElement.dataset.theme = t;
    var m = document.querySelector('meta[name="color-scheme"]');
    if (m) m.content = t;
  }
} catch (e) {}
