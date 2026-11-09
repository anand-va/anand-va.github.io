(function () {
  'use strict';

  // ---- files on this "machine" -------------------------------------------
  // Real files served next to index.html. Directories list their entries.
  var FS = {
    'SKILLS.md': { type: 'file', src: 'SKILLS.md' },
    'certs/': { type: 'dir', entries: ['google-cybersecurity.crt', 'google-ai-essentials.crt', 'redhat-do180.crt'] }
  };

  var SUGGESTIONS = ['ls', 'mdv SKILLS.md', 'ls -al', 'ls certs', 'help'];
  var COMMANDS = ['ls', 'mdv', 'cat', 'openssl', 'whoami', 'theme', 'clear', 'help'];
  var reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  var term = document.getElementById('term');
  var form = document.getElementById('next');
  var input = document.getElementById('cmdline');
  var hint = document.getElementById('run-hint');
  var intro = term.innerHTML; // the whoami block, for re-running whoami

  var cache = {};
  var history = [];
  var histPos = 0;

  // ---- helpers -------------------------------------------------------------
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function el(tag, cls, html) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (html != null) n.innerHTML = html;
    return n;
  }

  // a clickable piece of output that runs a command
  function runBtn(label, command, cls) {
    return '<button type="button" class="run' + (cls ? ' ' + cls : '') +
      '" data-cmd="' + esc(command) + '">' + esc(label) + '</button>';
  }

  function promptLine(text) {
    return '<div class="line"><span class="ps1"><span class="arrow">&#10140;</span>&nbsp; ' +
      '<span class="dir">~</span></span> ' + esc(text) + '</div>';
  }

  function print(html, cls) {
    var n = el('div', 'output' + (cls ? ' ' + cls : ''), html);
    term.appendChild(n);
    return n;
  }

  function scrollToPrompt() {
    form.scrollIntoView({ block: 'nearest' });
  }

  function load(name) {
    if (cache[name] != null) return Promise.resolve(cache[name]);
    return fetch(FS[name] ? FS[name].src : name, { cache: 'no-cache' })
      .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
      .then(function (t) { cache[name] = t; return t; });
  }

  function resolve(arg) {
    if (!arg) return null;
    var name = arg.replace(/^\.\//, '');
    if (FS[name]) return name;
    if (FS[name + '/']) return name + '/';
    // files inside directories, e.g. certs/foo.crt
    for (var dir in FS) {
      if (FS[dir].type !== 'dir') continue;
      for (var i = 0; i < FS[dir].entries.length; i++) {
        if (dir + FS[dir].entries[i] === name) return name;
      }
    }
    return null;
  }

  function openCommand(name) {
    if (/\/$/.test(name)) return 'ls ' + name.replace(/\/$/, '');
    if (/\.md$/i.test(name)) return 'mdv ' + name;
    return 'cat ' + name;
  }

  function sizeOf(name) {
    var t = cache[name];
    if (t == null) return '-';
    var b = new Blob([t]).size;
    return b < 1024 ? b + 'B' : (b / 1024).toFixed(1) + 'K';
  }

  // ---- markdown viewer (mdv) ----------------------------------------------
  function inline(s) {
    return esc(s)
      .replace(/`([^`]+)`/g, '<code>$1</code>')
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2">$1</a>');
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
    items.forEach(function (it) { parts = parts.concat(/:/.test(it) ? [it] : splitList(it)); });
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

  function renderMarkdown(text) {
    var lines = text.replace(/\r/g, '').split('\n');
    var html = '';
    var i = 0;
    if (lines[0] === '---') {
      html += '<div class="md-front">';
      for (i = 1; i < lines.length && lines[i] !== '---'; i++) {
        var m = lines[i].match(/^([\w-]+):\s*(.*)$/);
        html += m
          ? '<div class="md-field"><span class="md-key">' + esc(m[1]) + '</span><span>' + esc(m[2]) + '</span></div>'
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
        html += '<div class="md-h md-h' + h[1].length + '"><span class="md-title">' +
          inline(h[2]) + '</span><span class="md-fill" aria-hidden="true"></span></div>';
      } else if (line.trim()) {
        html += '<div class="md-p">' + inline(line) + '</div>';
      }
    }
    flush();
    return html;
  }

  // ---- commands ------------------------------------------------------------
  var commands = {
    help: function () {
      var rows = [
        ['ls [-al] [dir]', 'list files', 'ls'],
        ['mdv <file>', 'render a markdown file', 'mdv SKILLS.md'],
        ['cat <file>', 'print a file as-is', 'cat SKILLS.md'],
        ['openssl x509 -in <file>', 'inspect a certificate', 'openssl x509 -in certs/google-cybersecurity.crt -text'],
        ['whoami', 'who is this?', 'whoami'],
        ['theme <latte|mocha>', 'switch colours', 'theme'],
        ['clear', 'clear the screen', 'clear'],
        ['help', 'this list', 'help']
      ];
      print('<div class="table">' + rows.map(function (r) {
        return '<div>' + runBtn(r[0], r[2]) + '</div><div class="muted">' + esc(r[1]) + '</div>';
      }).join('') + '</div><div class="muted tip">tip: click anything underlined, ' +
        'use tab to complete, and up/down for history.</div>');
    },

    ls: function (args) {
      var flags = args.filter(function (a) { return a[0] === '-'; }).join('');
      var target = args.filter(function (a) { return a[0] !== '-'; })[0];
      var long = /l/.test(flags);
      var all = /a/.test(flags);
      var names, prefix = '';

      if (target) {
        var r = resolve(target);
        if (!r) return print(esc('ls: ' + target + ': No such file or directory'), 'err');
        if (FS[r] && FS[r].type === 'dir') {
          prefix = r;
          names = FS[r].entries.slice();
          if (!names.length && !long) {
            return print('<span class="muted">' + esc(r) + ' is empty.</span>');
          }
        } else {
          names = [r];
        }
      } else {
        names = Object.keys(FS);
      }

      if (!long) {
        return print('<div class="ls">' + names.map(function (n) {
          var full = prefix + n;
          return runBtn(n, openCommand(full), /\/$/.test(n) ? 'dir' : '');
        }).join('') + '</div>');
      }

      // long listing; load files first so sizes are real
      var files = names.filter(function (n) { return !/\/$/.test(n); });
      return Promise.all(files.map(function (n) { return load(prefix + n).catch(function () {}); }))
        .then(function () {
          var date = 'Nov  9 2026';
          var rows = [];
          if (all) {
            rows.push(['drwxr-xr-x', '-', '.', null]);
            rows.push(['drwxr-xr-x', '-', '..', null]);
          }
          names.forEach(function (n) {
            var full = prefix + n;
            var isDir = /\/$/.test(n);
            rows.push([isDir ? 'drwxr-xr-x' : '-rw-r--r--', isDir ? '-' : sizeOf(full), n, openCommand(full)]);
          });
          print('<div class="ls-long">' + rows.map(function (r) {
            return '<span class="muted">' + r[0] + '  anand  staff  ' +
              ('     ' + r[1]).slice(-5) + '  ' + date + '</span>  ' +
              (r[3] ? runBtn(r[2], r[3], /\/$/.test(r[2]) ? 'dir' : '') : '<span>' + esc(r[2]) + '</span>');
          }).join('\n') + '</div>');
        });
    },

    mdv: function (args) { return show(args, true, 'mdv'); },
    cat: function (args) { return show(args, false, 'cat'); },

    whoami: function () {
      var wrap = el('div', 'output', intro);
      var first = wrap.querySelector('.line');
      if (first) first.remove();
      var p = wrap.querySelector('#out');
      if (p) p.removeAttribute('id');
      term.appendChild(wrap);
    },

    theme: function (args) {
      var map = { latte: 'light', mocha: 'dark' };
      if (!args[0] || !map[args[0]]) {
        return print('usage: theme ' + runBtn('latte', 'theme latte') + ' | ' + runBtn('mocha', 'theme mocha'));
      }
      window.setTheme(map[args[0]]);
      print('<span class="muted">switched to ' + esc(args[0]) + '.</span>');
    },

    clear: function () {
      term.innerHTML = '';
    },

    // openssl x509 -in certs/foo.crt [-text] [-noout]: shows the certificate
    openssl: function (args) {
      var i = args.indexOf('-in');
      if (args[0] !== 'x509' || i < 0 || !args[i + 1]) {
        return print('usage: openssl x509 -in &lt;file&gt; -text. try ' +
          runBtn('ls certs', 'ls certs'));
      }
      return show([args[i + 1]], false, 'openssl');
    },

    sudo: function () {
      print(esc('anand is not in the sudoers file. This incident will be reported.'), 'err');
    },

    cd: function () {
      print('<span class="muted">everything lives right here. try </span>' + runBtn('ls', 'ls'));
    }
  };

  function show(args, render, cmd) {
    var arg = args[0];
    if (!arg) return print('usage: ' + cmd + ' &lt;file&gt;. try ' + runBtn(cmd + ' SKILLS.md', cmd + ' SKILLS.md'));
    var name = resolve(arg);
    if (!name) return print(esc(cmd + ': ' + arg + ': No such file or directory'), 'err');
    if (FS[name] && FS[name].type === 'dir') {
      return print(esc(cmd + ': ' + name + ': Is a directory') + '. try ' + runBtn('ls ' + name, 'ls ' + name), 'err');
    }
    return load(name).then(function (text) {
      print(render && /\.md$/i.test(name) ? '<div class="md">' + renderMarkdown(text) + '</div>'
        : '<pre class="raw">' + linkify(esc(text.replace(/\s+$/, ''))) + '</pre>');
    }, function () {
      print(esc(cmd + ': ' + name + ': could not be read'), 'err');
    });
  }

  // make bare https:// URLs in plain-text output clickable
  function linkify(escaped) {
    return escaped.replace(/https?:\/\/[^\s<]+/g, function (u) {
      return '<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>';
    });
  }

  function notFound(name) {
    print(esc('zsh: command not found: ' + name) + '<div class="muted">try one of these: ' +
      SUGGESTIONS.slice(0, 3).map(function (s) { return runBtn(s, s); }).join('  ') +
      '  ' + runBtn('help', 'help') + '</div>', 'err');
  }

  var busy = Promise.resolve();
  function run(raw) {
    var text = raw.trim();
    busy = busy.then(function () {
      term.insertAdjacentHTML('beforeend', promptLine(text));
      if (text) {
        if (history[history.length - 1] !== text) history.push(text);
        histPos = history.length;
        var parts = text.split(/\s+/);
        var name = parts[0].toLowerCase();
        var fn = commands[name];
        var result;
        try { result = fn ? fn(parts.slice(1)) : notFound(parts[0]); }
        catch (e) { print('something broke: ' + esc(e.message), 'err'); }
        return Promise.resolve(result);
      }
    }).then(scrollToPrompt, scrollToPrompt);
    return busy;
  }

  // ---- input handling ------------------------------------------------------
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var value = input.value.trim() || currentSuggestion;
    input.value = '';
    updateHint();
    run(value);
  });

  hint.addEventListener('click', function () {
    form.requestSubmit ? form.requestSubmit() : form.dispatchEvent(new Event('submit'));
    input.focus();
  });

  input.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowUp') {
      if (!history.length) return;
      e.preventDefault();
      histPos = Math.max(0, histPos - 1);
      input.value = history[histPos];
      updateHint();
    } else if (e.key === 'ArrowDown') {
      if (!history.length) return;
      e.preventDefault();
      histPos = Math.min(history.length, histPos + 1);
      input.value = history[histPos] || '';
      updateHint();
    } else if (e.key === 'Tab') {
      e.preventDefault();
      complete();
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      commands.clear();
    }
  });

  input.addEventListener('input', updateHint);

  function complete() {
    var v = input.value;
    if (!v.trim()) { input.value = currentSuggestion; updateHint(); return; }
    var parts = v.split(/\s+/);
    var last = parts[parts.length - 1];
    var pool;
    if (parts.length === 1) {
      pool = COMMANDS;
    } else {
      pool = [];
      Object.keys(FS).forEach(function (n) {
        pool.push(n);
        if (FS[n].type === 'dir') FS[n].entries.forEach(function (c) { pool.push(n + c); });
      });
      if (parts[0] === 'theme') pool = ['latte', 'mocha'];
    }
    var matches = pool.filter(function (p) { return p.toLowerCase().indexOf(last.toLowerCase()) === 0; });
    if (matches.length === 1) {
      parts[parts.length - 1] = matches[0];
      input.value = parts.join(' ') + (/\/$/.test(matches[0]) ? '' : ' ');
    } else if (matches.length > 1) {
      // fill in the shared beginning first, like a real shell
      var common = matches.reduce(function (a, b) {
        var k = 0;
        while (k < a.length && k < b.length && a[k].toLowerCase() === b[k].toLowerCase()) k++;
        return a.slice(0, k);
      });
      if (common.length > last.length) {
        parts[parts.length - 1] = common;
        input.value = parts.join(' ');
        updateHint();
        return;
      }
      busy = busy.then(function () {
        term.insertAdjacentHTML('beforeend', promptLine(v));
        print('<div class="ls">' + matches.map(function (m) {
          return runBtn(m, parts.slice(0, -1).concat(m).join(' '));
        }).join('') + '</div>');
      }).then(scrollToPrompt);
    }
    updateHint();
  }

  // clicking any [data-cmd] runs it
  document.addEventListener('click', function (e) {
    var b = e.target.closest('button.run');
    if (!b) return;
    run(b.getAttribute('data-cmd'));
    if (matchMedia('(pointer: fine)').matches) input.focus({ preventScroll: true });
  });

  // clicking empty space in the terminal focuses the prompt, like a real terminal
  document.querySelector('main').addEventListener('click', function (e) {
    if (e.target.closest('a, button, input')) return;
    if (String(window.getSelection())) return;
    input.focus({ preventScroll: true });
  });

  // ---- cycling, typed-out suggestions -------------------------------------
  var currentSuggestion = SUGGESTIONS[0];
  var sIndex = 0;
  var timer = null;

  function updateHint() {
    hint.classList.toggle('hidden', input.value.length > 0);
  }

  function setPlaceholder(t) { input.setAttribute('placeholder', t); }

  function cycle() {
    clearTimeout(timer);
    var word = SUGGESTIONS[sIndex % SUGGESTIONS.length];
    currentSuggestion = word;
    if (reduceMotion) {
      setPlaceholder(word);
      timer = setTimeout(function () { sIndex++; cycle(); }, 3000);
      return;
    }
    var i = 0;
    (function type() {
      setPlaceholder(word.slice(0, ++i));
      if (i < word.length) { timer = setTimeout(type, 80 + Math.random() * 70); return; }
      timer = setTimeout(function erase() {
        setPlaceholder(word.slice(0, --i));
        if (i > 0) { timer = setTimeout(erase, 35); return; }
        sIndex++;
        timer = setTimeout(cycle, 350);
      }, 2200);
    })();
  }

  // ---- intro: type "whoami", then reveal the answer and the prompt --------
  function startPrompt() {
    form.classList.remove('hidden');
    cycle();
    // preload file sizes for ls -al
    Object.keys(FS).forEach(function (n) { if (FS[n].type === 'file') load(n).catch(function () {}); });
    if (matchMedia('(pointer: fine)').matches) input.focus({ preventScroll: true });
  }

  (function introAnimation() {
    var cmd = document.getElementById('cmd');
    var out = document.getElementById('out');
    if (reduceMotion || !cmd) return startPrompt();
    var word = cmd.textContent;
    cmd.textContent = '';
    cmd.classList.add('typing');
    out.classList.add('hidden');
    form.classList.add('hidden');
    var i = 0;
    setTimeout(function step() {
      cmd.textContent = word.slice(0, ++i);
      if (i < word.length) return setTimeout(step, 70 + Math.random() * 80);
      setTimeout(function () {
        cmd.classList.remove('typing');
        out.classList.remove('hidden');
        startPrompt();
      }, 250);
    }, 400);
  })();
})();
