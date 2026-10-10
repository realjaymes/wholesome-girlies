/* Daily word puzzle: the date picks the puzzle, so everyone sees the same one and no server is needed.
   The first day is #1 on the epoch date. Day n shows bank[(n - 1) mod bank.length], so a bank only ever grows at the END
   (re-ordering or inserting changes every future day). The page hands over the bank and the engine does the rest.

   WGDaily.init({
     root: element,                 // where the game is drawn
     bank: [{ s, a, w:[3], f, c, p }],  // s = start of the line, a = missing word (a-z), w = 3 wrong options, f = full line, c = clue
     epoch: '2026-10-01',           // the date of puzzle #1 (YYYY-MM-DD)
     tries: 4, storeKey: 'wg_daily_mummy',
     name: "Finish Mummy's Sentence", url: 'https://wholesomegirlies.xyz/parenting/tools/finish-mummys-sentence'
   })
   ?d=YYYY-MM-DD on the page address previews that day without saving anything.
   WGDaily.dayNumber(y, m, d, epoch), WGDaily.pick(n, bank) and WGDaily.grade(guess, answer) are exposed for tests.
   Storage holds her streak and today's tries on her phone only. Shares carry the day number and one square per try. */
(function (w, d) {
  var DAY = 86400000;

  function parseKey(k) { var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(k || ''); return m ? [+m[1], +m[2] - 1, +m[3]] : null; }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function keyOf(y, m, dd) { return y + '-' + pad(m + 1) + '-' + pad(dd); }
  function dayNumber(y, m, dd, epoch) {
    var e = parseKey(epoch);
    return Math.round((Date.UTC(y, m, dd) - Date.UTC(e[0], e[1], e[2])) / DAY) + 1;
  }
  function pickPuzzle(n, bank) { var L = bank.length; return bank[(((n - 1) % L) + L) % L]; }

  /* Wordle grading: greens first, then yellows by remaining letter count. Returns a string of g (right place), y (in the word), x (not there). */
  function grade(guess, answer) {
    var res = [], left = {}, i;
    for (i = 0; i < answer.length; i++) { res.push('x'); }
    for (i = 0; i < answer.length; i++) {
      if (guess[i] === answer[i]) res[i] = 'g'; else left[answer[i]] = (left[answer[i]] || 0) + 1;
    }
    for (i = 0; i < answer.length; i++) {
      if (res[i] === 'g') continue;
      if (left[guess[i]] > 0) { res[i] = 'y'; left[guess[i]]--; }
    }
    return res.join('');
  }

  var CSS =
    '.wgd{max-width:560px;margin:0 auto}.wgd *{box-sizing:border-box}.wgd [hidden]{display:none!important}' +
    '.wgd-top{display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;font-weight:800;font-size:.92rem;margin:0 0 14px}' +
    '.wgd-top span{background:var(--st,#E3E6CC);border:2px solid var(--ink,#33322A);border-radius:999px;padding:5px 12px}' +
    '.wgd-line{font-family:var(--serif,"DM Serif Display",Georgia,serif);font-size:clamp(1.5rem,6.2vw,2.1rem);line-height:1.25;margin:6px 0 14px}' +
    '.wgd-blank{display:inline-block;min-width:3.2ch;border-bottom:4px solid var(--s,#6E7A3F);padding:0 .15em;letter-spacing:.12em;color:var(--s,#6E7A3F)}' +
    '.wgd-pid{display:inline-block;font-size:.72rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;background:var(--mustard-t,#F6E4BC);border:1.5px solid var(--ink,#33322A);border-radius:999px;padding:2px 9px;margin:0 0 8px}' +
    '.wgd-board{display:grid;gap:7px;margin:0 0 16px}' +
    '.wgd-row{display:flex;gap:6px;justify-content:center;min-height:50px}' +
    '.wgd-t{width:46px;height:50px;border:2px solid var(--line,#E4E1CE);border-radius:9px;display:grid;place-items:center;font-weight:800;font-size:1.3rem;text-transform:uppercase;background:#fff}' +
    '.wgd-t.g{background:var(--olive,#6E7A3F);border-color:var(--ink,#33322A);color:#fff}' +
    '.wgd-t.y{background:var(--mustard,#D49A2A);border-color:var(--ink,#33322A);color:var(--ink,#33322A)}' +
    '.wgd-t.x{background:#D9D6C3;border-color:var(--ink,#33322A);color:var(--ink,#33322A)}' +
    '.wgd-pickrow{width:100%;border:2px solid var(--ink,#33322A);border-radius:12px;padding:12px 14px;font-weight:800;text-align:center;align-self:center}' +
    '.wgd-pickrow.g{background:var(--olive,#6E7A3F);color:#fff}.wgd-pickrow.x{background:#D9D6C3}' +
    '.wgd-empty{border:2px dashed var(--line,#E4E1CE);border-radius:12px;width:100%;min-height:50px}' +
    '.wgd-tabs{display:flex;gap:8px;margin:0 0 12px}' +
    '.wgd-tab{flex:1;padding:11px 8px;border:2px solid var(--ink,#33322A);border-radius:999px;background:#fff;font:800 .95rem/1 var(--sans,"Nunito Sans",sans-serif);cursor:pointer}' +
    '.wgd-tab[aria-selected="true"]{background:var(--s,#6E7A3F);color:var(--s-on,#fff);box-shadow:3px 3px 0 var(--ink,#33322A)}' +
    '.wgd-form{display:flex;gap:8px}' +
    '.wgd-in{flex:1;min-width:0;padding:13px 15px;border:2px solid var(--ink,#33322A);border-radius:12px;font:700 1.15rem/1.2 var(--sans,"Nunito Sans",sans-serif);letter-spacing:.14em;text-transform:uppercase;background:#fff}' +
    '.wgd-opts{display:grid;grid-template-columns:1fr 1fr;gap:8px}' +
    '.wgd-opt{padding:12px 8px;border:2px solid var(--ink,#33322A);border-radius:12px;background:#fff;font:800 1.05rem/1.2 var(--sans,"Nunito Sans",sans-serif);cursor:pointer;text-align:center}' +
    '.wgd-opt[disabled]{background:#D9D6C3;text-decoration:line-through;cursor:default;opacity:.7}' +
    '.wgd-msg{min-height:1.4em;font-weight:700;margin:10px 0 0;font-size:.95rem}' +
    '.wgd-clue{background:var(--mustard-t,#F6E4BC);border:2px solid var(--ink,#33322A);border-radius:12px;padding:10px 14px;margin:0 0 14px;font-weight:700}' +
    '.wgd-link{background:none;border:0;padding:6px 0;font:800 .9rem/1 var(--sans,"Nunito Sans",sans-serif);color:var(--ink,#33322A);text-decoration:underline;cursor:pointer}' +
    '.wgd-end{margin:20px 0 0;padding:20px;background:var(--st,#E3E6CC);border:2px solid var(--ink,#33322A);border-radius:16px;box-shadow:var(--sticker,5px 5px 0 #33322A)}' +
    '.wgd-end h3{margin:0 0 6px;font-family:var(--serif,"DM Serif Display",Georgia,serif);font-size:1.5rem}' +
    '.wgd-full{font-weight:800;font-size:1.1rem;margin:0 0 10px}' +
    '.wgd-grid{font-size:1.7rem;letter-spacing:.1em;margin:6px 0 12px}' +
    '.wgd-share{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 14px}' +
    '.wgd-stats{display:grid;grid-template-columns:repeat(4,1fr);gap:8px;text-align:center;margin:12px 0 4px}' +
    '.wgd-stats b{display:block;font-family:var(--serif,"DM Serif Display",Georgia,serif);font-size:1.7rem;font-weight:400}' +
    '.wgd-stats span{font-size:.78rem;font-weight:700}' +
    '.wgd-next{font-weight:800;margin:10px 0 0}' +
    '.wgd-prev{font-size:.82rem;font-weight:800;margin:0 0 10px;opacity:.75}' +
    '@media (max-width:400px){.wgd-t{width:40px;height:44px}.wgd-row{min-height:44px}.wgd-empty{min-height:44px}.wgd-board{gap:5px}.wgd-top{font-size:.84rem;margin-bottom:10px}.wgd-top span{padding:4px 10px}.wgd-form .btn{padding:12px 18px}}';

  function el(tag, cls, txt) { var e = d.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; }

  function init(cfg) {
    var root = cfg.root, bank = cfg.bank, TRIES = cfg.tries || 4, KEY = cfg.storeKey || 'wg_daily';
    if (!root || !bank || !bank.length) return;
    if (!d.getElementById('wg-daily-css')) {
      var s = d.createElement('style'); s.id = 'wg-daily-css'; s.textContent = CSS; d.head.appendChild(s);
    }
    var preview = null;
    try { preview = parseKey(new URLSearchParams(w.location.search).get('d')); } catch (e) {}

    function today() {
      if (preview) return { y: preview[0], m: preview[1], dd: preview[2] };
      var t = new Date(); return { y: t.getFullYear(), m: t.getMonth(), dd: t.getDate() };
    }
    function loadStore() {
      var empty = { streak: 0, best: 0, last: '', played: 0, won: 0, dist: [0, 0, 0, 0, 0], today: null };
      if (preview) return empty;
      try { var o = JSON.parse(localStorage.getItem(KEY)); if (o && typeof o === 'object') { o.dist = o.dist || [0, 0, 0, 0, 0]; return o; } } catch (e) {}
      return empty;
    }
    function saveStore() { if (preview) return; try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }

    var store = loadStore(), day, puzzle, ans, N, alts, game, timer = null;

    function setDay() {
      var t = today();
      day = { key: keyOf(t.y, t.m, t.dd), n: dayNumber(t.y, t.m, t.dd, cfg.epoch), t: t };
      puzzle = pickPuzzle(day.n, bank);
      ans = puzzle.a; N = ans.length; alts = puzzle.x || [];
      if (store.today && store.today.key === day.key) game = store.today;
      else { game = { key: day.key, n: day.n, guesses: [], done: false, won: false }; store.today = preview ? null : game; }
    }

    function yesterdayKey() {
      var t = day.t, ms = Date.UTC(t.y, t.m, t.dd) - DAY, x = new Date(ms);
      return keyOf(x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate());
    }

    function finish(won) {
      game.done = true; game.won = won;
      var k = won ? game.guesses.length - 1 : 4;
      if (store.last !== day.key) {
        store.streak = (store.last === yesterdayKey()) ? (store.streak || 0) + 1 : 1;
        store.best = Math.max(store.best || 0, store.streak);
        store.last = day.key; store.played = (store.played || 0) + 1;
        if (won) store.won = (store.won || 0) + 1;
        store.dist[Math.min(4, k)] = (store.dist[Math.min(4, k)] || 0) + 1;
      }
      store.today = game;
      saveStore();
      try { w.dataLayer = w.dataLayer || []; w.dataLayer.push({ event: 'daily_puzzle_done', puzzle_game: 'mummys-sentence', puzzle_tries: won ? game.guesses.length : 'miss' }); } catch (e) {}
    }

    function squares() {
      return game.guesses.map(function (g) { return g.sq; }).join('');
    }
    function shareText(ref) {
      var score = game.won ? game.guesses.length + '/' + TRIES : 'X/' + TRIES;
      return cfg.name + ' #' + game.n + ' ' + score + '\n' + squares() + '\n' + cfg.url + '?ref=' + ref;
    }

    /* ----- drawing ----- */
    var refs = {};
    function draw() {
      root.innerHTML = '';
      var app = el('div', 'wgd');
      var top = el('div', 'wgd-top');
      top.appendChild(el('span', '', 'Sentence #' + day.n + (preview ? ' (preview)' : '')));
      top.appendChild(el('span', '', (store.streak > 0 && !preview ? store.streak + (store.streak === 1 ? ' day' : ' days') + ' in a row' : 'Fresh sentence every day')));
      app.appendChild(top);
      if (puzzle.p) app.appendChild(el('span', 'wgd-pid', 'Pidgin'));
      var line = el('p', 'wgd-line');
      line.appendChild(d.createTextNode('“' + puzzle.s + ' '));
      var blank = el('span', 'wgd-blank');
      blank.textContent = game.done ? (game.won && game.guesses.length && alts.indexOf(game.guesses[game.guesses.length - 1].v) > -1 ? game.guesses[game.guesses.length - 1].v : ans) : new Array(N + 1).join('_ ').trim();
      blank.setAttribute('aria-label', game.done ? ans : N + ' letters');
      line.appendChild(blank);
      line.appendChild(d.createTextNode('”'));
      app.appendChild(line);

      var board = el('div', 'wgd-board'); board.setAttribute('aria-live', 'polite');
      app.appendChild(board); refs.board = board;
      drawBoard();

      if (!game.done) {
        var clue = el('p', 'wgd-clue'); clue.hidden = !game.clue; clue.textContent = 'Clue: ' + puzzle.c;
        var clueBtn = el('button', 'wgd-link', 'Show me a clue'); clueBtn.type = 'button';
        clueBtn.addEventListener('click', function () { game.clue = true; clue.hidden = false; clueBtn.hidden = true; saveStore(); });
        clueBtn.hidden = !!game.clue;
        app.appendChild(clue); app.appendChild(clueBtn);

        var tabs = el('div', 'wgd-tabs'); tabs.setAttribute('role', 'tablist');
        var tabT = el('button', 'wgd-tab', 'Type it'), tabP = el('button', 'wgd-tab', 'Pick from four');
        tabT.type = tabP.type = 'button'; tabT.setAttribute('role', 'tab'); tabP.setAttribute('role', 'tab');
        tabs.appendChild(tabT); tabs.appendChild(tabP); app.appendChild(tabs);

        var form = el('form', 'wgd-form'); form.setAttribute('autocomplete', 'off');
        var input = el('input', 'wgd-in'); input.type = 'text'; input.maxLength = Math.max.apply(null, [N].concat(alts.map(function (a) { return a.length; }))); input.placeholder = N + ' letters';
        input.setAttribute('autocapitalize', 'none'); input.setAttribute('autocorrect', 'off'); input.setAttribute('spellcheck', 'false');
        input.setAttribute('aria-label', 'Your guess, ' + N + ' letters'); input.setAttribute('enterkeyhint', 'go');
        var go = el('button', 'btn btn-primary', 'Check'); go.type = 'submit';
        form.appendChild(input); form.appendChild(go);
        var opts = el('div', 'wgd-opts');
        var order = puzzle.w.concat([ans]);
        var seed = day.n * 7919 % 997;
        order.sort(function (a, b) { return ((hash(a) + seed) % 101) - ((hash(b) + seed) % 101) || (a < b ? -1 : 1); });
        order.forEach(function (o) {
          var b = el('button', 'wgd-opt', o.charAt(0).toUpperCase() + o.slice(1)); b.type = 'button'; b.setAttribute('data-v', o);
          if (game.guesses.some(function (g) { return g.v === o; })) b.disabled = true;
          opts.appendChild(b);
        });
        app.appendChild(form); app.appendChild(opts);
        var msg = el('p', 'wgd-msg'); msg.setAttribute('role', 'status'); app.appendChild(msg);

        function mode(m) {
          tabT.setAttribute('aria-selected', String(m === 'type')); tabP.setAttribute('aria-selected', String(m === 'pick'));
          form.hidden = m !== 'type'; opts.hidden = m !== 'pick'; game.mode = m;
        }
        tabT.addEventListener('click', function () { mode('type'); input.focus(); });
        tabP.addEventListener('click', function () { mode('pick'); });
        mode(game.mode === 'pick' ? 'pick' : 'type');

        form.addEventListener('submit', function (e) {
          e.preventDefault();
          var v = input.value.toLowerCase().replace(/[^a-z]/g, '');
          var isAlt = alts.indexOf(v) > -1;
          if (v.length !== N && !isAlt) { msg.textContent = 'The word has ' + N + ' letters. You typed ' + v.length + '.'; return; }
          if (game.guesses.some(function (g) { return g.v === v; })) { msg.textContent = 'You already tried that one.'; return; }
          var res = isAlt ? new Array(v.length + 1).join('g') : grade(v, ans), hit = v === ans || isAlt, near = (res.replace(/x/g, '').length / N) >= 0.6;
          addGuess({ t: 'type', v: v, r: res, sq: hit ? '🟩' : (near ? '🟨' : '⬜') });
        });
        opts.addEventListener('click', function (e) {
          var b = e.target.closest && e.target.closest('.wgd-opt'); if (!b || b.disabled) return;
          var v = b.getAttribute('data-v'), hit = v === ans;
          addGuess({ t: 'pick', v: v, r: hit ? 'g' : 'x', sq: hit ? '🟩' : '⬜' });
        });
        refs.msg = msg;
      } else {
        app.appendChild(endBox());
      }
      root.appendChild(app);
    }

    function hash(s) { var h = 0, i; for (i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 9973; return h; }

    function addGuess(g) {
      game.guesses.push(g);
      var won = g.v === ans || alts.indexOf(g.v) > -1;
      if (won || game.guesses.length >= TRIES) finish(won); else saveStore();
      draw();
      if (!game.done) {
        var m = root.querySelector('.wgd-msg');
        if (m) m.textContent = g.t === 'pick' ? 'Not that one. ' + (TRIES - game.guesses.length) + (TRIES - game.guesses.length === 1 ? ' try' : ' tries') + ' left.'
          : (TRIES - game.guesses.length) + (TRIES - game.guesses.length === 1 ? ' try' : ' tries') + ' left. Green is the right place, yellow is in the word.';
        var inp = root.querySelector('.wgd-in'); if (inp && !inp.hidden && inp.offsetParent) inp.focus({ preventScroll: true });
      }
    }

    function drawBoard() {
      var b = refs.board; b.innerHTML = '';
      for (var r = 0; r < TRIES; r++) {
        var row = el('div', 'wgd-row'), g = game.guesses[r], i;
        if (g && g.t === 'type') {
          for (i = 0; i < g.v.length; i++) { var t = el('div', 'wgd-t ' + g.r.charAt(i), g.v.charAt(i)); row.appendChild(t); }
        } else if (g) {
          row.appendChild(el('div', 'wgd-pickrow ' + g.r, g.v.charAt(0).toUpperCase() + g.v.slice(1) + (g.r === 'g' ? '' : ': not that one')));
        } else {
          row.appendChild(el('div', 'wgd-empty'));
        }
        b.appendChild(row);
      }
    }

    function endBox() {
      var box = el('div', 'wgd-end');
      var h = game.won
        ? (game.guesses.length === 1 ? 'First try. Mummy is proud.' : game.guesses.length === TRIES ? 'On the last try. Mummy says that still counts.' : 'You got it in ' + game.guesses.length + '. Mummy nods.')
        : 'Mummy wins today.';
      box.appendChild(el('h3', '', h));
      box.appendChild(el('p', 'wgd-full', '“' + puzzle.f + '”'));
      box.appendChild(el('p', 'wgd-grid', squares()));
      var row = el('div', 'wgd-share');
      var copy = el('button', 'btn btn-primary', 'Copy my result'); copy.type = 'button';
      var wa = el('a', 'btn btn-ghost', 'Send on WhatsApp'); wa.href = 'https://wa.me/?text=' + encodeURIComponent(shareText('wa')); wa.target = '_blank'; wa.rel = 'noopener';
      row.appendChild(copy); row.appendChild(wa);
      if (navigator.share && /Android|iPhone|iPad/i.test(navigator.userAgent)) { var sh = el('button', 'btn btn-ghost', 'Share'); sh.type = 'button'; row.appendChild(sh);
        sh.addEventListener('click', function () {
          var t = shareText('link');
          function viaCopy() { copyNow(t); }
          try { navigator.share({ text: t }).catch(function (err) { if (!err || err.name !== 'AbortError') viaCopy(); }); } catch (e) { viaCopy(); }
        }); }
      box.appendChild(row);
      var note = el('p', 'wgd-prev', ''); note.setAttribute('role', 'status'); box.appendChild(note);
      function copyNow(txt) {
        function ok() { note.textContent = 'Copied. Paste it in your group chat.'; }
        function fallback() {
          var ta = d.createElement('textarea'); ta.value = txt; ta.style.position = 'fixed'; ta.style.opacity = '0'; d.body.appendChild(ta); ta.select();
          try { d.execCommand('copy'); ok(); } catch (e) { note.textContent = 'Copy did not work. Select the squares and copy them.'; } ta.remove();
        }
        if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(txt).then(ok, fallback); else fallback();
      }
      copy.addEventListener('click', function () { copyNow(shareText('link')); });
      var st = el('div', 'wgd-stats');
      [[store.streak || 0, 'days in a row'], [store.best || 0, 'best run'], [store.played || 0, 'played'], [store.won ? Math.round(100 * store.won / Math.max(1, store.played)) + '%' : '0%', 'found']].forEach(function (c) {
        var cell = el('div'); cell.appendChild(el('b', '', String(c[0]))); cell.appendChild(el('span', '', c[1])); st.appendChild(cell);
      });
      if (!preview) box.appendChild(st);
      var nx = el('p', 'wgd-next'); nx.setAttribute('aria-live', 'off'); refs.next = nx; box.appendChild(nx);
      tick();
      return box;
    }

    function tick() {
      if (!refs.next) return;
      var now = new Date(), t = today(), next;
      if (preview) { refs.next.textContent = 'This is a preview of another day.'; return; }
      next = new Date(t.y, t.m, t.dd + 1, 0, 0, 0, 0);
      var s = Math.max(0, Math.floor((next - now) / 1000));
      var hh = Math.floor(s / 3600), mm = Math.floor(s % 3600 / 60), ss = s % 60;
      refs.next.textContent = 'Next sentence in ' + pad(hh) + ':' + pad(mm) + ':' + pad(ss);
    }

    function boot() {
      setDay(); draw();
      if (timer) clearInterval(timer);
      timer = setInterval(function () {
        var t = today();
        if (!preview && keyOf(t.y, t.m, t.dd) !== day.key) { store = loadStore(); boot(); return; }
        tick();
      }, 1000);
    }
    boot();
    return { day: function () { return day; }, puzzle: function () { return puzzle; } };
  }

  w.WGDaily = { init: init, dayNumber: dayNumber, pick: pickPuzzle, grade: grade, keyOf: keyOf };
})(window, document);
