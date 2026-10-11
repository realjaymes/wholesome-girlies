/* Stage picker on /tools/ (CLAUDE.md section 10). "Which stage are you in?" over five stops joined in life order.
   Tapping a stop shows only that stage's group, the search runs inside it, and "All stages" brings every group
   back. The choice sits in ?stage= so a link opens on that stage. It replaces the page's doFilter, so it loads
   after the inline search script. */
(function (w, d) {
  var COPY = {
    question: 'Which stage are you in?', all: 'All stages',
    empty: 'Nothing matches here, so try searching all stages.', showAll: 'Search all stages',
    none: 'No matches. Try another word, or scroll through the stages below.'
  };
  var STAGES = [
    { g: 'Relationships', key: 'relationships', emoji: '💛', plain: 'Dating or in love', c: 'var(--rust)', t: 'var(--rust-t)' },
    { g: 'Fertility', key: 'fertility', emoji: '🌱', plain: 'Trying for a baby', c: 'var(--olive)', t: 'var(--olive-t)' },
    { g: 'Pregnancy', key: 'pregnancy', emoji: '🤰🏾', plain: 'I am pregnant', c: 'var(--mustard)', t: 'var(--mustard-t)' },
    { g: 'Postpartum', key: 'postpartum', emoji: '🤱🏾', plain: 'I just gave birth', c: 'var(--peach)', t: 'var(--peach-t)' },
    { g: 'Parenting', key: 'parenting', emoji: '👶🏾', plain: 'I am raising children', c: 'var(--denim)', t: 'var(--denim-t)' }
  ];
  var groups = {}, empty = d.getElementById('noresults'), search = d.querySelector('.toolsearch');
  d.querySelectorAll('.tgroup').forEach(function (g) { groups[g.getAttribute('data-group')] = g; g.setAttribute('data-mt', g.style.marginTop); });
  if (!search || !empty || !Object.keys(groups).length) return;
  var sel = '', sm = w.location.search.match(/[?&]stage=([a-z]+)/);
  STAGES.forEach(function (s) { if (sm && s.key === sm[1] && groups[s.g]) sel = s.g; });

  var css = d.createElement('style');
  css.textContent =
    '.sp{margin:18px 0 0}.sp-label{margin:0 0 8px;font-weight:800;font-size:.92rem}' +
    '.sp-path{position:relative;display:grid;grid-template-columns:repeat(5,1fr);gap:4px}' +
    '.sp-path::before{content:"";position:absolute;left:10%;right:10%;top:21px;border-top:3px dashed var(--ink);opacity:.35}' +
    '.sp-stop{position:relative;background:none;border:0;padding:0;font:inherit;color:var(--ink);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;min-width:0;-webkit-tap-highlight-color:transparent}' +
    '.sp-dot{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-size:1.2rem;background:var(--t);border:2px solid var(--ink);transition:transform .15s}' +
    '.sp-stop[aria-pressed="true"] .sp-dot{background:var(--c);box-shadow:var(--sticker-sm);transform:scale(1.08)}' +
    '.sp-stop b{font-size:clamp(.6rem,2.65vw,.78rem);line-height:1.2;letter-spacing:-.01em;-webkit-hyphens:auto;hyphens:auto}' +
    '.sp-stop small{font-size:clamp(.6rem,2.45vw,.7rem);line-height:1.2;opacity:.75}' +
    '@media (max-width:420px){.sp-path{margin:0 -10px}}' +
    '.sp-all{margin-top:10px;text-align:center}.sp-all button,.sp-empty-all{background:none;border:0;padding:0;font:inherit;font-weight:800;text-decoration:underline;cursor:pointer;color:var(--ink)}' +
    '.sp-all button[aria-pressed="true"]{text-decoration:none;opacity:.55;cursor:default}' +
    '@media (min-width:760px){.sp-stop b{font-size:.9rem}.sp-stop small{font-size:.8rem}}' +
    '@media (prefers-reduced-motion:reduce){.sp-dot{transition:none}}';
  d.head.appendChild(css);

  w.doFilter = function () {
    var q = (d.getElementById('q').value || '').toLowerCase().trim(), any = false, first = null;
    Object.keys(groups).forEach(function (k) {
      var g = groups[k], anyIn = false;
      g.querySelectorAll('.ti').forEach(function (el) {
        var hay = ((el.getAttribute('data-name') || '') + ' ' + el.textContent).toLowerCase();
        var show = !q || hay.indexOf(q) > -1;
        el.style.display = show ? '' : 'none';
        if (show) anyIn = true;
      });
      var vis = (!sel || sel === k) && anyIn;
      g.style.display = vis ? '' : 'none';
      g.style.marginTop = g.getAttribute('data-mt') || '';
      if (vis) { any = true; if (!first) first = g; }
    });
    if (first && sel) first.style.marginTop = '0';
    empty.style.display = any ? 'none' : 'block';
    if (any) return;
    if (!sel) { empty.textContent = COPY.none; return; }
    empty.textContent = COPY.empty + ' ';
    var b = d.createElement('button'); b.type = 'button'; b.className = 'sp-empty-all'; b.textContent = COPY.showAll;
    b.addEventListener('click', function () { choose(''); });
    empty.appendChild(b);
  };

  var buttons = [];
  function choose(g) {
    sel = g;
    buttons.forEach(function (b) { b.setAttribute('aria-pressed', String(b.getAttribute('data-g') === sel)); });
    var u = new URL(w.location.href), s = STAGES.filter(function (x) { return x.g === sel; })[0];
    if (s) u.searchParams.set('stage', s.key); else u.searchParams.delete('stage');
    w.history.replaceState(w.history.state, '', u);
    w.doFilter();
  }
  function btn(s, cls, html) {
    var b = d.createElement('button'); b.type = 'button'; b.className = cls; b.setAttribute('data-g', s ? s.g : '');
    if (s) { b.style.setProperty('--c', s.c); b.style.setProperty('--t', s.t); }
    b.innerHTML = html; buttons.push(b);
    b.addEventListener('click', function () { choose(s ? s.g : ''); });
    return b;
  }

  var box = d.createElement('div'); box.className = 'sp';
  var label = d.createElement('p'); label.className = 'sp-label'; label.id = 'spLabel'; label.textContent = COPY.question;
  var path = d.createElement('div'); path.className = 'sp-path'; path.setAttribute('role', 'group'); path.setAttribute('aria-labelledby', 'spLabel');
  STAGES.forEach(function (s) {
    if (groups[s.g]) path.appendChild(btn(s, 'sp-stop', '<span class="sp-dot" aria-hidden="true">' + s.emoji + '</span><b>' + s.g + '</b><small>' + s.plain + '</small>'));
  });
  var all = d.createElement('div'); all.className = 'sp-all'; all.appendChild(btn(null, '', COPY.all));
  box.appendChild(label); box.appendChild(path); box.appendChild(all);
  search.parentNode.insertBefore(box, search.nextSibling);
  choose(sel);
})(window, document);
