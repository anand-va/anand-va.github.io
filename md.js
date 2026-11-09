// mdv-style markdown renderer, shared by the terminal and /resume
(function () {
  'use strict';

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // only http(s), mailto and same-site paths are allowed as link targets
  function safeHref(h) {
    return /^(https?:\/\/|mailto:|\/(?!\/)|\.\/)/.test(h) || !/:/.test(h);
  }

  function link(text, href) {
    if (!safeHref(href)) return text;
    var attrs = ' href="' + href + '"';
    if (/^download$/i.test(text)) attrs += ' download';
    else if (/^https?:|\.pdf$/i.test(href)) attrs += ' target="_blank" rel="noopener"';
    return '<a' + attrs + '>' + text + '</a>';
  }

  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (m, t, h) { return link(t, h); });
  }

  // front-matter values: make emails and web addresses clickable
  function fieldValue(v) {
    var e = esc(v);
    if (/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(v)) return '<a href="mailto:' + e + '">' + e + '</a>';
    if (/^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i.test(v) && /\//.test(v)) {
      var href = /^https?:/.test(v) ? e : 'https://' + e;
      return '<a href="' + href + '" target="_blank" rel="noopener">' + e + '</a>';
    }
    return e;
  }

  // split "a, b, c" into items, but not commas inside parentheses
  function splitList(s) {
    var out = [], depth = 0, cur = '';
    for (var i = 0; i < s.length; i++) {
      var c = s[i];
      if (c === '(') depth++;
      if (c === ')') depth--;
      if (c === ',' && depth === 0) { out.push(cur.trim()); cur = ''; } else cur += c;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }

  // short items become tags; anything long stays a bullet list
  function renderList(items) {
    var parts = [];
    items.forEach(function (it) { parts = parts.concat(/[:\[]/.test(it) ? [it] : splitList(it)); });
    var short = parts.every(function (p) { return p.length <= 40; });
    if (short) {
      return '<div class="md-tags">' + parts.map(function (p) {
        return '<span class="md-tag">' + inline(p) + '</span>';
      }).join('') + '</div>';
    }
    return '<ul class="md-list">' + items.map(function (it) {
      return '<li>' + inline(it) + '</li>';
    }).join('') + '</ul>';
  }

  function render(text) {
    var lines = text.replace(/\r/g, '').split('\n');
    var html = '';
    var i = 0;
    if (lines[0] === '---') {
      html += '<div class="md-front">';
      for (i = 1; i < lines.length && lines[i] !== '---'; i++) {
        var m = lines[i].match(/^([\w-]+):\s*(.*)$/);
        html += m
          ? '<div class="md-field"><span class="md-key">' + esc(m[1]) + '</span><span>' + fieldValue(m[2]) + '</span></div>'
          : '<div>' + esc(lines[i]) + '</div>';
      }
      html += '</div>';
      i++;
    }
    var list = [];
    function flush() { if (list.length) { html += renderList(list); list = []; } }
    for (; i < lines.length; i++) {
      var line = lines[i];
      var li = line.match(/^\s*[-*]\s+(.*)$/);
      if (li) { list.push(li[1]); continue; }
      flush();
      var h = line.match(/^(#{1,3})\s+(.*)$/);
      if (h) {
        // "### Title | date" puts the date on the right instead of a rule
        var parts = h[2].split(' | ');
        var right = parts.length > 1
          ? '<span class="md-fill" aria-hidden="true"></span><span class="md-date">' + inline(parts.slice(1).join(' | ')) + '</span>'
          : '<span class="md-fill" aria-hidden="true"></span>';
        html += '<div class="md-h md-h' + h[1].length + '"><span class="md-title">' +
          inline(parts[0]) + '</span>' + right + '</div>';
      } else if (line.trim()) {
        html += '<div class="md-p">' + inline(line) + '</div>';
      }
    }
    flush();
    return html;
  }

  window.MD = { render: render, esc: esc };
})();
