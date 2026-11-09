(function () {
  'use strict';

  // ---- files on this "machine" -------------------------------------------
  // Real files served next to index.html. Directories list their entries.
  var FS = {
    // hidden: still openable by name, but never listed. resume.txt is the way in
    'resume.txt': { type: 'file', src: 'resume.txt' },
    'RESUME.md': { type: 'file', src: 'RESUME.md', hidden: true },
    'SKILLS.md': { type: 'file', src: 'SKILLS.md' },
    'resume.pdf': { type: 'file', src: 'resume.pdf', binary: true, hidden: true },
    'certs/': { type: 'dir', entries: ['google-cybersecurity.crt', 'google-ai-essentials.crt', 'redhat-do180.crt'] }
  };

  var SUGGESTIONS = ['ls', 'cat resume.txt', 'mdv SKILLS.md', 'ls -al', 'ls certs', 'help'];
  var COMMANDS = ['ls', 'mdv', 'cat', 'open', 'echo', 'base64', 'openssl', 'whoami', 'theme', 'clear', 'help'];

  function visible(name) { return !(FS[name] && FS[name].hidden); }
  var sizes = {}; // byte sizes of binary files, from a HEAD request
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

  // after a command: if the command and its whole answer fit on screen, just
  // make sure the prompt is visible; if the answer is taller than the screen,
  // put the command line at the top so people start reading from the beginning
  function scrollToResponse(line) {
    if (!line || !line.isConnected) return scrollToPrompt();
    var behavior = 'auto'; // jump instantly, like a real terminal
    var top = line.getBoundingClientRect().top;
    var bottom = form.getBoundingClientRect().bottom;
    if (bottom - top <= window.innerHeight - 24) {
      form.scrollIntoView({ block: 'nearest', behavior: behavior });
    } else {
      line.scrollIntoView({ block: 'start', behavior: behavior });
    }
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
    if (/\.pdf$/i.test(name)) return 'open ' + name;
    return 'cat ' + name;
  }

  function sizeOf(name) {
    var b = sizes[name];
    if (b == null) {
      var t = cache[name];
      if (t == null) return '-';
      b = new Blob([t]).size;
    }
    if (b < 1024) return b + 'B';
    var k = b / 1024;
    return (k < 100 ? k.toFixed(1) : Math.round(k)) + 'K';
  }

  function headSize(name) {
    return fetch(FS[name].src, { method: 'HEAD', cache: 'no-cache' }).then(function (r) {
      var n = parseInt(r.headers.get('content-length'), 10);
      if (r.ok && n) sizes[name] = n;
    }).catch(function () {});
  }

  // ---- markdown viewer (mdv): shared renderer in md.js --------------------
  var renderMarkdown = window.MD.render;

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
        names = Object.keys(FS).filter(visible);
      }

      if (!long) {
        return print('<div class="ls">' + names.map(function (n) {
          var full = prefix + n;
          return runBtn(n, openCommand(full), /\/$/.test(n) ? 'dir' : '');
        }).join('') + '</div>');
      }

      // long listing; load files first so sizes are real
      var files = names.filter(function (n) { return !/\/$/.test(n); });
      return Promise.all(files.map(function (n) {
        var full = prefix + n;
        if (FS[full] && FS[full].binary) return sizes[full] != null ? null : headSize(full);
        return load(full).catch(function () {});
      }))
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

    echo: function (args) {
      print(esc(args.join(' ')));
    },

    base64: function (args) {
      var flag = args[0];
      if ((flag !== '-d' && flag !== '--decode') || !args[1]) {
        return print('usage: base64 -d &lt;text&gt;, or echo &lt;text&gt; | base64 -d');
      }
      return decode64(args[1]);
    },

    open: function (args) {
      var name = resolve(args[0] || '');
      if (!args[0]) return print('usage: open &lt;file&gt;. try ' + runBtn('ls', 'ls'));
      if (!name) return print(esc('open: ' + args[0] + ': No such file or directory'), 'err');
      if (/\/$/.test(name)) return commands.ls([name]);
      if (!FS[name] || !FS[name].binary) return show([name], /\.md$/i.test(name), 'open');
      window.open(FS[name].src, '_blank', 'noopener');
      print('<span class="muted">opened ' + esc(name) + ' in a new tab. </span>' +
        '<a href="' + esc(FS[name].src) + '" download>download it</a>');
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
    if (FS[name] && FS[name].binary) {
      return print(esc(cmd + ': ' + name + ': binary file. try ') + runBtn('open ' + name, 'open ' + name), 'err');
    }
    if (FS[name] && FS[name].type === 'dir') {
      return print(esc(cmd + ': ' + name + ': Is a directory') + '. try ' + runBtn('ls ' + name, 'ls ' + name), 'err');
    }
    return load(name).then(function (text) {
      var body = linkify(esc(text.replace(/\s+$/, '')));
      // in .txt clue files, dim the # comment lines
      if (/\.txt$/i.test(name)) body = body.replace(/^(#.*)$/gm, '<span class="muted">$1</span>');
      print(render && /\.md$/i.test(name) ? '<div class="md">' + renderMarkdown(text) + '</div>'
        : '<pre class="raw">' + body + '</pre>');
    }, function () {
      print(esc(cmd + ': ' + name + ': could not be read'), 'err');
    });
  }

  // make bare https:// URLs, site paths (/resume) and pdf names clickable
  function linkify(escaped) {
    return escaped
      .replace(/https?:\/\/[^\s<]+/g, function (u) {
        return '<a href="' + u + '" target="_blank" rel="noopener">' + u + '</a>';
      })
      .replace(/(^|\s)(\/[\w\-\/]*[\w\-]|[\w\-]+\.pdf)(?=\s|$)/gm, function (m, pre, p) {
        var href = p[0] === '/' ? p : '/' + p;
        var extra = /\.pdf$/i.test(p) ? ' target="_blank" rel="noopener"' : '';
        return pre + '<a href="' + href + '"' + extra + '>' + p + '</a>';
      });
  }

  // base64 -d, for the puzzle in resume.txt
  function decode64(s) {
    var out;
    try {
      out = decodeURIComponent(escape(atob(s.replace(/^["']|["']$/g, ''))));
    } catch (e) {
      return print(esc('base64: invalid input'), 'err');
    }
    print('<pre class="raw">' + linkify(esc(out)) + '</pre>');
  }

  function notFound(name) {
    print(esc('zsh: command not found: ' + name) + '<div class="muted">try one of these: ' +
      SUGGESTIONS.slice(0, 3).map(function (s) { return runBtn(s, s); }).join('  ') +
      '  ' + runBtn('help', 'help') + '</div>', 'err');
  }

  var busy = Promise.resolve();
  function run(raw) {
    var text = raw.trim();
    var line = null;
    var after = function () { scrollToResponse(line); };
    busy = busy.then(function () {
      term.insertAdjacentHTML('beforeend', promptLine(text));
      line = term.lastElementChild;
      if (text) {
        if (history[history.length - 1] !== text) history.push(text);
        histPos = history.length;
        // the one pipe this shell understands: echo <text> | base64 -d
        var pipe = text.match(/^echo\s+(\S+)\s*\|\s*base64\s+(-d|--decode)\s*$/i);
        if (pipe) return Promise.resolve(decode64(pipe[1]));
        if (/\|/.test(text)) {
          print('<span class="muted">this shell only knows one pipe: echo &lt;text&gt; | base64 -d</span>');
          return;
        }
        var parts = text.split(/\s+/);
        var name = parts[0].toLowerCase();
        var fn = commands[name];
        var result;
        try { result = fn ? fn(parts.slice(1)) : notFound(parts[0]); }
        catch (e) { print('something broke: ' + esc(e.message), 'err'); }
        return Promise.resolve(result);
      }
    }).then(after, after);
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
      Object.keys(FS).filter(visible).forEach(function (n) {
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

  // is the click point actually on a character of text (not just inside a
  // text block's empty area)? so people can still select text to copy it
  function onText(x, y) {
    var node, offset;
    if (document.caretPositionFromPoint) {
      var p = document.caretPositionFromPoint(x, y);
      if (!p) return false;
      node = p.offsetNode; offset = p.offset;
    } else if (document.caretRangeFromPoint) {
      var r0 = document.caretRangeFromPoint(x, y);
      if (!r0) return false;
      node = r0.startContainer; offset = r0.startOffset;
    } else {
      return false;
    }
    if (!node || node.nodeType !== 3 || !node.textContent.trim()) return false;
    var range = document.createRange();
    var len = node.textContent.length;
    // check the character on each side of the caret
    for (var o = Math.max(0, offset - 1); o <= Math.min(len - 1, offset); o++) {
      range.setStart(node, o);
      range.setEnd(node, o + 1);
      var rects = range.getClientRects();
      for (var i = 0; i < rects.length; i++) {
        var b = rects[i];
        if (x >= b.left - 2 && x <= b.right + 2 && y >= b.top - 2 && y <= b.bottom + 2) return true;
      }
    }
    return false;
  }

  // clicking anywhere except text, links, buttons and the footer focuses the
  // prompt, like a real terminal
  document.addEventListener('click', function (e) {
    if (e.target.closest('a, button, input, label, footer')) return;
    if (String(window.getSelection())) return;
    if (onText(e.clientX, e.clientY)) return;
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
    Object.keys(FS).forEach(function (n) {
      if (FS[n].type !== 'file') return;
      if (FS[n].binary) headSize(n); else load(n).catch(function () {});
    });
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
