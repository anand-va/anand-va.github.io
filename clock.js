// footer clock: Anand's local time in Bengaluru, plus how far ahead or
// behind the visitor is (hidden when they're on the same time)
(function () {
  'use strict';

  var TZ = 'Asia/Kolkata';
  var clock = document.getElementById('clock');
  var diffEl = document.getElementById('tzdiff');
  if (!clock) return;

  // minutes a time zone is ahead of UTC at a given moment
  function offsetMinutes(timeZone, date) {
    var parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timeZone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit'
    }).formatToParts(date);
    var v = {};
    parts.forEach(function (p) { v[p.type] = p.value; });
    var asUTC = Date.UTC(+v.year, +v.month - 1, +v.day, +v.hour, +v.minute);
    return Math.round((asUTC - Math.floor(date.getTime() / 60000) * 60000) / 60000);
  }

  function span(mins) {
    var h = Math.floor(mins / 60), m = mins % 60;
    return (h ? h + 'h' : '') + (h && m ? ' ' : '') + (m ? m + 'm' : '');
  }

  function tick() {
    var now = new Date();
    clock.textContent = now.toLocaleTimeString('en-GB', {
      hour: '2-digit', minute: '2-digit', timeZone: TZ
    });
    if (!diffEl) return;
    // positive: Bengaluru is ahead of the visitor
    var diff = offsetMinutes(TZ, now) - (-now.getTimezoneOffset());
    diffEl.textContent = diff === 0 ? ''
      : 'you’re ' + span(Math.abs(diff)) + (diff > 0 ? ' behind' : ' ahead');
  }

  tick();
  setInterval(tick, 15000);
})();
