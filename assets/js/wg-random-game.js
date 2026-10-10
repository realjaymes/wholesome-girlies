/* Random game button on /tools/ and /app/ (CLAUDE.md section 10). "Spin for a game" spins through the game names,
   stops on one card with its line and "Play it", and turns into "Spin again", so she chooses what to open.
   Pool: /assets/data/games.json, built from the Game and Quiz cards on /tools/ by scripts/build-game-pool.py.
   It never repeats the game she was last given, and pushes random_game to the dataLayer when she opens one. */
(function (w, d) {
  var path = w.location.pathname.replace(/\/$/, ''), surface = /^\/app/.test(path) ? 'app' : 'tools';
  var LAST = 'wg_random_last', pool = null, busy = false;
  var COPY = { btn: 'Spin for a game', again: 'Spin again', help: 'Spin, then play it or spin again.', spin: 'Picking your game...', play: 'Play it →' };

  function store(k, v) { try { if (v === undefined) return w.localStorage.getItem(k); w.localStorage.setItem(k, v); } catch (e) { return null; } }
  function push(g) {
    w.dataLayer = w.dataLayer || [];
    w.dataLayer.push({ event: 'random_game', random_path: g.path, random_surface: surface });
  }
  function load(cb) {
    if (pool) return cb();
    fetch('/assets/data/games.json?v=20261010a').then(function (r) { return r.json(); }).then(function (j) {
      pool = (j.games || []).filter(function (g) { return g.path.replace(/\/$/, '') !== path; }); cb();
    }).catch(function () { pool = []; cb(); });
  }
  function pick() {
    var last = store(LAST), from = pool.filter(function (g) { return g.path !== last; });
    if (!from.length) from = pool;
    var g = from[Math.floor(Math.random() * from.length)];
    if (g) store(LAST, g.path);
    return g;
  }

  var css = d.createElement('style');
  css.textContent = '.rg{margin:16px 0 0}.rg .btn{display:inline-flex;align-items:center;gap:8px}.rg-help{margin:8px 0 0;font-size:.9rem}' +
    '.rg-card{display:block;margin-top:12px;padding:14px 16px;background:#fff;color:var(--ink,#222);border:2px solid var(--ink,#222);border-radius:16px;box-shadow:var(--sticker-sm,3px 3px 0 #222);text-decoration:none}' +
    '.rg-card:hover{text-decoration:none}.rg-card .tag{display:inline-block;margin-bottom:6px;padding:2px 10px;border-radius:999px;background:var(--s,#6E7A3F);color:var(--s-on,#fff);font-size:.72rem;font-weight:800;text-transform:uppercase;letter-spacing:.04em}.rg-card b{display:block;font-size:1.05rem;line-height:1.25}.rg-card span.rg-line{display:block;margin-top:4px;font-size:.92rem}' +
    '.rg-card .rg-go{display:inline-block;margin-top:10px;font-weight:800;color:var(--ink,#222)}' +
    '.rg-card.spin b{animation:rgp .14s linear infinite}@keyframes rgp{0%{transform:translateY(-4px);opacity:.5}100%{transform:translateY(0);opacity:1}}' +
    '@media (prefers-reduced-motion:reduce){.rg-card.spin b{animation:none}}';
  d.head.appendChild(css);
  var box = d.createElement('div'); box.className = 'rg';
  var btn = d.createElement('button'); btn.type = 'button'; btn.className = 'btn btn-primary'; btn.textContent = COPY.btn;
  var help = d.createElement('p'); help.className = 'muted rg-help'; help.textContent = COPY.help;
  var card = d.createElement('a'); card.className = 'rg-card'; card.hidden = true; card.setAttribute('aria-live', 'polite');
  box.appendChild(btn); box.appendChild(help); box.appendChild(card);

  function fill(g, landed) {
    card.hidden = false; card.className = 'rg-card' + (landed ? '' : ' spin');
    card.innerHTML = '<span class="tag"></span><b></b><span class="rg-line"></span>';
    card.querySelector('.tag').textContent = landed ? 'Your game' : 'Spinning';
    card.querySelector('b').textContent = g.name;
    card.querySelector('.rg-line').textContent = landed ? g.line : COPY.spin;
    if (landed) { var go = d.createElement('span'); go.className = 'rg-go'; go.textContent = COPY.play; card.appendChild(go); }
  }
  btn.addEventListener('click', function () {
    if (busy) return; busy = true;
    load(function () {
      var g = pick();
      if (!g) { busy = false; return; }
      var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches, n = 0;
      function land() {
        card.href = g.path; fill(g, true); card.onclick = function () { push(g); };
        busy = false; btn.textContent = COPY.again;
      }
      if (reduce) return land();
      var iv = setInterval(function () {
        if (++n > 8) { clearInterval(iv); return land(); }
        fill(pool[Math.floor(Math.random() * pool.length)], false);
      }, 80);
    });
  });
  w.addEventListener('pageshow', function (e) { if (e.persisted) { busy = false; card.hidden = true; btn.textContent = COPY.btn; } });

  function mount() {
    var anchor = d.querySelector('.toolsearch'), hero = d.getElementById('appHero');
    if (anchor) anchor.parentNode.insertBefore(box, anchor);
    else if (hero) hero.parentNode.insertBefore(box, hero.nextSibling);
    else return;
    load(function () {});
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', mount); else mount();
})(window, document);
