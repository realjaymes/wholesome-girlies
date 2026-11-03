/* Visual results for the cycle and due date tools (James's pick, 3 November 2026).
   Period Tracker and Ovulation Calculator: a month calendar she steps through, with her period days, fertile window,
   likely ovulation and today marked (option A). Due Date Calculator: a ring of the 40 weeks of pregnancy split into
   trimesters, with her week and her progress (option B).
   The dates follow each tool's own method: periods every cycle from the last period, ovulation 14 days before the
   next period, a fertile window from 5 days before ovulation to the day after, and a due date at 280 days adjusted
   for cycle length. A period is drawn as 5 days, the average length. Everything is drawn on her phone from the date
   in the form; nothing is saved or sent by this file. It draws after the tool's own calculate function runs. */
(function () {
  var p = location.pathname;
  var kind = /period-tracker/.test(p) ? 'period' : /ovulation-calculator/.test(p) ? 'ovulation' : /due-date-calculator/.test(p) ? 'due' : '';
  if (!kind) return;
  var CALC = { period: 'calcPeriods', ovulation: 'calcOvulation', due: 'calcDue' }[kind];
  var PERIOD_DAYS = 5, FERTILE = '#CDD4A6';
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var MON = MONTHS.map(function (m) { return m.slice(0, 3); });

  var css = '' +
    '.wgc{margin:4px 0 18px;font-family:var(--sans)}' +
    '.wgc-card{background:#fff;border:2px solid var(--ink);border-radius:16px;box-shadow:var(--sticker-sm);padding:14px 12px 12px}' +
    '.wgc-head{display:flex;align-items:center;justify-content:space-between;margin:0 2px 10px}' +
    '.wgc-head b{font-family:var(--serif);font-weight:400;font-size:1.15rem;color:var(--ink);white-space:nowrap}' +
    '.wgc-nav{width:36px;height:36px;border-radius:50%;border:2px solid var(--ink);background:var(--cream);color:var(--ink);cursor:pointer;display:grid;place-items:center;padding:0;flex:none}.wgc-nav svg{width:14px;height:14px}' +
    '.wgc-nav:disabled{opacity:.3;cursor:default}' +
    '.wgc-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center}' +
    '.wgc-dow{font-size:.68rem;font-weight:800;color:var(--plum-soft);letter-spacing:.04em;padding-bottom:2px}' +
    '.wgc-d{position:relative;aspect-ratio:1;display:grid;place-items:center;border-radius:50%;font-size:.88rem;font-weight:700;color:var(--ink)}' +
    '.wgc-d.out{visibility:hidden}' +
    '.wgc-d.per{background:var(--rust);color:#fff}' +
    '.wgc-d.fer{background:' + FERTILE + '}' +
    '.wgc-d.ov{background:var(--olive);color:#fff;box-shadow:0 0 0 3px var(--olive-t)}' +
    '.wgc-d.today{outline:2.5px solid var(--ink);outline-offset:1px}' +
    '.wgc-legend{display:flex;flex-wrap:wrap;gap:6px 14px;margin:12px 2px 0;font-size:.8rem;font-weight:700;color:var(--plum-soft)}' +
    '.wgc-legend span{display:inline-flex;align-items:center;gap:6px}' +
    '.wgc-legend i{width:14px;height:14px;border-radius:50%;display:inline-block}' +
    '.wgc-legend i.today{outline:2px solid var(--ink);background:#fff}' +
    '.wgc-sum{margin:10px 2px 0;font-size:.9rem;line-height:1.45}' +
    '.wgc-ring{display:block;margin:0 auto;width:100%;max-width:300px;height:auto}' +
    '.wgc-ring text{font-family:var(--sans);fill:var(--ink)}' +
    '.wgc-ring .big{font-family:var(--serif);font-size:44px}' +
    '.wgc-ring .sm{font-size:13px;font-weight:700;fill:var(--plum-soft)}' +
    '.wgc-next{margin:12px 0 0;padding:0;list-style:none;font-size:.9rem}' +
    '.wgc-next li{display:flex;gap:10px;align-items:center;padding:7px 2px;border-top:1px dashed var(--line)}' +
    '.wgc-next li:first-child{border-top:0}.wgc-next i{width:14px;height:14px;border-radius:50%;flex:none}' +
    '@media print{.wgc-nav{display:none}}';
  var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  function d0(iso) { var a = iso.split('-'); return new Date(+a[0], +a[1] - 1, +a[2]); }
  function add(d, n) { var x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate() + n); return x; }
  function key(d) { return d.getFullYear() + '-' + d.getMonth() + '-' + d.getDate(); }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function diff(a, b) { return Math.round((b - a) / 86400000); }
  function short(d) { return d.getDate() + ' ' + MON[d.getMonth()]; }
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  // ── the dates ──────────────────────────────────────────────────────────────
  function cycleLen() {
    try { if (typeof window.cycleNote === 'function') return window.cycleNote(); } catch (e) {}
    var c = document.getElementById('cyc'); return parseInt(c && c.value, 10) || 28;
  }
  function model() {
    var inp = document.getElementById('lmp'); if (!inp || !inp.value) return null;
    var L = d0(inp.value), C = cycleLen(), T = today(), marks = {}, m = { L: L, C: C, T: T, marks: marks };
    if (kind === 'due') { m.due = add(L, 280 + (C - 28)); return m; }
    function mark(d, c) { var k = key(d); (marks[k] = marks[k] || {})[c] = 1; }
    mark(T, 'today');
    m.cycles = [];
    for (var k = 0; k < 4; k++) {
      var s = add(L, k * C), ov = add(L, (k + 1) * C - 14), cy = { start: s, ov: ov, fA: add(ov, -5), fB: add(ov, 1) };
      m.cycles.push(cy);
      for (var i = 0; i < PERIOD_DAYS; i++) mark(add(s, i), 'per');
      for (var y = cy.fA; y <= cy.fB; y = add(y, 1)) mark(y, 'fer');
      mark(ov, 'ov');
    }
    return m;
  }

  // ── cycle tools: one month, step with the arrows ───────────────────────────
  function grid(m, y, mo) {
    var g = h('div', 'wgc-grid');
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(function (x) { g.appendChild(h('div', 'wgc-dow', x)); });
    var lead = (new Date(y, mo, 1).getDay() + 6) % 7, days = new Date(y, mo + 1, 0).getDate();
    for (var i = 0; i < lead; i++) g.appendChild(h('div', 'wgc-d out', ''));
    for (var d = 1; d <= days; d++) {
      var dt = new Date(y, mo, d), mk = m.marks[key(dt)] || {}, cls = 'wgc-d';
      if (mk.ov) cls += ' ov'; else if (mk.per) cls += ' per'; else if (mk.fer) cls += ' fer';
      if (mk.today) cls += ' today';
      var c = h('div', cls, String(d));
      c.setAttribute('aria-label', d + ' ' + MONTHS[mo] + (mk.per ? ', period' : '') + (mk.fer ? ', fertile window' : '') + (mk.ov ? ', likely ovulation' : '') + (mk.today ? ', today' : ''));
      g.appendChild(c);
    }
    return g;
  }
  function legend() {
    var l = h('div', 'wgc-legend');
    [['', 'var(--rust)', 'Period'], ['', FERTILE, 'Fertile window'], ['', 'var(--olive)', 'Likely ovulation'], ['today', '', 'Today']].forEach(function (it) {
      var s = h('span', ''), i = h('i', it[0]); if (it[1]) i.style.background = it[1]; s.appendChild(i); s.appendChild(document.createTextNode(it[2])); l.appendChild(s);
    });
    return l;
  }
  function month(m) {
    var nx = m.cycles.filter(function (c) { return c.start > m.T; })[0] || m.cycles[3];
    var fw = m.cycles.filter(function (c) { return c.fB >= m.T; })[0] || m.cycles[3];
    // Open on this month, unless everything still to come this cycle is next month.
    var y = m.T.getFullYear(), mo = m.T.getMonth();
    if (fw.fA > new Date(y, mo + 1, 0) && nx.start > new Date(y, mo + 1, 0)) { y = fw.fA.getFullYear(); mo = fw.fA.getMonth(); }
    var lo = new Date(m.L.getFullYear(), m.L.getMonth(), 1), last = add(m.cycles[3].start, PERIOD_DAYS), hi = new Date(last.getFullYear(), last.getMonth(), 1);
    var wrap = h('div', 'wgc-card');
    var ARROW = function (d) { return '<svg viewBox="0 0 14 14" aria-hidden="true"><path d="' + d + '" fill="none" stroke="currentColor" stroke-width="2.4"/></svg>'; };
    function paint() {
      wrap.innerHTML = '';
      var head = h('div', 'wgc-head'), prev = h('button', 'wgc-nav', ARROW('M9 2 4 7l5 5')), next = h('button', 'wgc-nav', ARROW('M5 2l5 5-5 5')), cur = new Date(y, mo, 1);
      prev.type = next.type = 'button'; prev.setAttribute('aria-label', 'Previous month'); next.setAttribute('aria-label', 'Next month');
      prev.disabled = cur <= lo; next.disabled = cur >= hi;
      prev.onclick = function () { mo--; if (mo < 0) { mo = 11; y--; } paint(); };
      next.onclick = function () { mo++; if (mo > 11) { mo = 0; y++; } paint(); };
      head.appendChild(prev); head.appendChild(h('b', '', MONTHS[mo] + ' ' + y)); head.appendChild(next);
      wrap.appendChild(head); wrap.appendChild(grid(m, y, mo)); wrap.appendChild(legend());
    }
    paint();
    var box = h('div', ''); box.appendChild(wrap);
    box.appendChild(h('p', 'wgc-sum', 'Next period around <b>' + short(nx.start) + '</b>. Fertile window <b>' + short(fw.fA) + ' to ' + short(fw.fB) + '</b>, most likely ovulation <b>' + short(fw.ov) + '</b>.'));
    return box;
  }

  // ── due date: the 40 weeks as a ring ───────────────────────────────────────
  function arc(cx, cy, r, a0, a1) {
    function pt(a) { var t = (a - 90) * Math.PI / 180; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; }
    var p0 = pt(a0), p1 = pt(a1), big = a1 - a0 > 180 ? 1 : 0;
    return 'M' + p0[0].toFixed(2) + ' ' + p0[1].toFixed(2) + ' A' + r + ' ' + r + ' 0 ' + big + ' 1 ' + p1[0].toFixed(2) + ' ' + p1[1].toFixed(2);
  }
  function ring(m) {
    var days = diff(m.L, m.T); // counted from her last period, as the tool's own week line counts it
    if (days < 0 || days > 45 * 7) return null; // the tool already says the date is in the future or too long ago
    var s = '', cx = 150, cy = 150, r = 112, sw = 30, wk = Math.min(40, days / 7);
    function seg(w0, w1, col) { s += '<path d="' + arc(cx, cy, r, w0 * 9 + .6, w1 * 9 - .6) + '" stroke="' + col + '" stroke-width="' + sw + '" fill="none"/>'; }
    seg(0, 13, 'var(--olive-t)'); seg(13, 28, 'var(--mustard-t)'); seg(28, 40, 'var(--rust-t)');
    if (wk > 0) s += '<path d="' + arc(cx, cy, r, .6, Math.max(1.2, wk * 9)) + '" stroke="var(--olive)" stroke-width="12" stroke-linecap="round" fill="none"/>';
    var t = (wk * 9 - 90) * Math.PI / 180;
    s += '<circle cx="' + (cx + r * Math.cos(t)).toFixed(1) + '" cy="' + (cy + r * Math.sin(t)).toFixed(1) + '" r="13" fill="#fff" stroke="var(--ink)" stroke-width="3"/>';
    var w = Math.floor(days / 7), dd = days % 7;
    s += '<text x="150" y="128" text-anchor="middle" class="sm">YOU ARE IN</text><text x="150" y="172" text-anchor="middle" class="big">Week ' + w + '</text><text x="150" y="198" text-anchor="middle" class="sm">and ' + dd + (dd === 1 ? ' day' : ' days') + '</text>';
    var card = h('div', 'wgc-card'), svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 300 300'); svg.setAttribute('class', 'wgc-ring'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Pregnancy ring: week ' + w + ' of 40, due around ' + short(m.due) + ' ' + m.due.getFullYear());
    svg.innerHTML = s; card.appendChild(svg);
    var ul = h('ul', 'wgc-next');
    [['var(--olive-t)', 'First trimester, weeks 1 to 12'], ['var(--mustard-t)', 'Second trimester, weeks 13 to 27'], ['var(--rust-t)', 'Third trimester, week 28 to birth'], ['var(--olive)', 'Due around ' + short(m.due) + ' ' + m.due.getFullYear()]].forEach(function (it) {
      var li = h('li', ''), i = h('i', ''); i.style.background = it[0]; li.appendChild(i); li.appendChild(document.createTextNode(it[1])); ul.appendChild(li);
    });
    card.appendChild(ul); return card;
  }

  function render() {
    var res = document.getElementById('res'); if (!res) return;
    var old = res.querySelector('.wgc'); if (old) old.remove();
    if (!res.classList.contains('show')) return;
    var m = model(); if (!m) return;
    var view = kind === 'due' ? ring(m) : month(m); if (!view) return;
    var holder = h('div', 'wgc'); holder.appendChild(view);
    var head = res.querySelector('h3'); if (head && head.nextSibling) res.insertBefore(holder, head.nextSibling); else res.appendChild(holder);
  }
  function hook() {
    var f = window[CALC];
    if (typeof f === 'function' && !f.__wgc) { var w = function () { var r = f.apply(this, arguments); try { render(); } catch (e) {} return r; }; w.__wgc = 1; window[CALC] = w; }
    try { render(); } catch (e) {}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', hook); else hook();
})();
