// runs in <head> before paint, so the saved theme applies without a flash.
// only the two known values are accepted from storage.
try {
  var t = localStorage.getItem('theme');
  if (t === 'light' || t === 'dark') document.documentElement.dataset.theme = t;
} catch (e) {}
