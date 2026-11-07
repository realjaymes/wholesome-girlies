/* Wholesome Girlies: the rule book. One main action for every woman, on every surface (window.WGNext).
 *
 * Vault: Wholesome Girlies/Site & App, note 07 "One next action for every woman" and note 02 "Where the logic is heading".
 * Loaded on every page (scripts/add-app-tags.py) just before wg-app.js. Nothing here sends anything anywhere except the
 * public campaign count (GET /first1000/status). Everything is worked out on her phone.
 *
 *   WGNext.ready(opts)      resolves with WGNext once the program table is loaded (assets/data/program-flags.json, the one
 *                           program table) and the page has loaded. opts.status:true also waits for the campaign count.
 *   WGNext.state()          her state: visitor, engaged, known, buyer, bundle, member, both or lapsed, plus the stage she is in,
 *                           the program she holds for each stage (own) and the stages whose free months have ended (lapsed).
 *   WGNext.offer(stage)     what fills the offer slot for a stage: none, own, lapsed, f1k, paid or tools.
 *   WGNext.next(surface, o) the single main action for a surface (SURFACES below is the site-wide table in note 07).
 *   WGNext.card(desc)       the one offer card every surface renders: eyebrow, cover beside the title and topic line, the free
 *                           months or price line, the count, and a full-width button.
 *
 * She holds a program when her phone has a flag wg_<stage>_home ({u, l, gift?, ends?}) or her cached account lists it. "Member"
 * means a campaign member only: a program with an end date carries gift:true, and a gifted program is never a bought one (no
 * bundle coupon, no buyer hand-offs, no paid offer during her months). Quiet pages (loss, warning signs, the check-ins) show no offer.
 * Every page keeps its plain HTML default, and this file only swaps it, so the page still works if the file fails.
 */
(function (w, d) {
  'use strict';
  var DATA_V = '20261110a';
  var PAY = 'https://wg-pay.realjaymes.workers.dev';
  // On localhost only, a wrangler dev server can stand in for the payment server: localStorage.wg_pay_api = 'http://localhost:8787'.
  try {
    if (/^(localhost|127\.0\.0\.1)$/.test(w.location.hostname)) { var po = w.localStorage.getItem('wg_pay_api'); if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(po || '')) PAY = po; }
  } catch (e) {}
  var path = w.location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
  var STAGES = ['relationships', 'fertility', 'pregnancy', 'postpartum', 'parenting'];
  var MOTHER = ['fertility', 'pregnancy', 'postpartum', 'parenting'];
  var DAY = 864e5;

  // ── storage ─────────────────────────────────────────────────────────────
  function ls(k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } }
  function jr(k) { try { var o = JSON.parse(ls(k) || 'null'); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmtN(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function mk(tag, cls, text) { var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function loc(n) { return /^(localhost|127\.0\.0\.1)$/.test(w.location.hostname) ? n : null; }

  // ── the program table (one source: assets/data/program-flags.json) ─────────
  var DATA = null, dataP = null;
  function load() {
    if (dataP) return dataP;
    dataP = w.fetch ? w.fetch('/assets/data/program-flags.json?v=' + DATA_V).then(function (r) { return r.json(); }).then(function (x) { DATA = x && x.programs ? x : null; return DATA; }).catch(function () { return null; }) : Promise.resolve(null);
    return dataP;
  }
  load();
  var domP = new Promise(function (res) { if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { res(); }); else res(); });

  // ── the campaign count (the public number, GET /first1000/status) ──────────
  // Localhost only: ?f1kcap=C sets the cap (default 100), ?f1ktaken=T the places taken, ?f1kleft=N the places left. A check only, never on the live site.
  function previewStatus() {
    if (!loc(1)) return null;
    var c = /[?&]f1kcap=(\d{2,4})/.exec(w.location.search), t = /[?&]f1ktaken=(\d{1,4})/.exec(w.location.search), l = /[?&]f1kleft=(\d{1,4})/.exec(w.location.search);
    if (!c && !t && !l) return null;
    var cap = c ? +c[1] : 100, taken = t ? +t[1] : l ? cap - +l[1] : 0;
    taken = Math.min(cap, Math.max(0, taken));
    return { ok: true, taken: taken, cap: cap, left: cap - taken, open: cap - taken > 0 };
  }
  var statusP = null, STATUS = null;
  // status(true) asks the server again (the claim form does, after a refusal); every other caller shares the first answer.
  function status(fresh) {
    if (statusP && !fresh) return statusP;
    var pre = previewStatus();
    statusP = (pre ? Promise.resolve(pre) : (w.fetch ? w.fetch(PAY + '/first1000/status').then(function (r) { return r.json(); }) : Promise.resolve(null)))
      .then(function (j) { STATUS = j && j.ok && typeof j.cap === 'number' ? j : null; return STATUS; }).catch(function () { return null; });
    // A slow or silent server never holds a page up: after 5 seconds the count is unknown and the slot falls back to the paid program.
    statusP = Promise.race([statusP, new Promise(function (res) { setTimeout(function () { res(null); }, 5000); })]);
    return statusP;
  }
  // The campaign fills the offer slot only while it is open and has places. Paused, full or silent, the slot holds the paid program.
  function campaignOpen() { return !!(STATUS && STATUS.open && STATUS.left > 0); }

  // ── her facts ───────────────────────────────────────────────────────────
  function token() { return !!ls('wg_session_v1'); }
  function account() { var c = jr('wg_account_v1'); return token() && c && c.v === 1 && c.account ? c.account : null; }
  function slugOf(url) { var m = /\/programs\/([a-z0-9-]+)\/(?:thank-you|read)/.exec(url || ''); return m ? m[1] : ''; }
  function baseOf(slug) { return String(slug || '').replace(/-diaspora$/, ''); }
  function memberEnds(a) { var m = a && a.member; return m && m.ends ? Date.parse(m.ends) : NaN; }
  function quiet() {
    if (w.WGApp && w.WGApp.quiet) return !!w.WGApp.quiet();
    var q = DATA && DATA.quiet; var bare = path.replace(/\/$/, '');
    return !!(q && (q.paths.indexOf(bare) > -1 || new RegExp(q.rx).test(path)));
  }

  // Every program flag on her phone, read without the program table: wg_<stage>_home keys ({u, l, gift?, ends?}). Callers that
  // run before the table loads (the tab bar, the checkout page) use this; a bought program never has gift:true.
  function held() {
    var out = [];
    try {
      for (var i = 0; i < w.localStorage.length; i++) {
        var k = w.localStorage.key(i); if (!/^wg_[a-z]+_home$/.test(k)) continue;
        var v = jr(k), slug = slugOf(v && v.u); if (!slug) continue;
        var t = Date.parse(v.ends);
        out.push({ key: k, u: v.u.replace(/\.html$/, ''), l: v.l || '', slug: slug, base: baseOf(slug), dia: /-diaspora$/.test(slug), bundle: baseOf(slug) === 'complete-motherhood-journey',
          gift: !!v.gift, ends: v.ends || '', lapsed: !!v.gift && !isNaN(t) && t <= Date.now() });
      }
    } catch (e) {}
    return out.sort(function (a, b) { return a.key < b.key ? -1 : 1; });
  }
  // The programs she holds right now (a bought program, a bundle, or a campaign program inside its months).
  function active() { return held().filter(function (h) { return !h.lapsed; }); }
  function paidHeld() { return active().filter(function (h) { return !h.gift; }); }
  function bundleHeld() { return paidHeld().some(function (h) { return h.bundle; }); }

  // The programs she holds, one entry per stage key: from the flags on her phone and her cached account.
  // entry = { stage, slug (as sold, may end -diaspora), base, dia, bundle, gift, ends, lapsed }
  function entries() {
    var out = [], seenStage = {};
    if (!DATA) return out;
    function add(stage, slug, gift, ends) {
      var base = baseOf(slug), meta = DATA.programs[base]; if (!meta) return;
      var e = { stage: stage, slug: slug, base: base, dia: /-diaspora$/.test(slug), bundle: !!meta.bundle, gift: !!gift, ends: ends || '', lapsed: false };
      var t = Date.parse(ends); if (gift && !isNaN(t) && t <= Date.now()) e.lapsed = true;
      var cur = seenStage[stage];
      // Per stage: a bought program beats a gifted one, the bundle beats a single program, an active program beats an ended one.
      var rank = function (x) { return (x.lapsed ? 0 : 4) + (x.gift ? 0 : 2) + (x.bundle ? 1 : 0); };
      if (cur && rank(cur) >= rank(e)) return;
      if (cur) out.splice(out.indexOf(cur), 1);
      seenStage[stage] = e; out.push(e);
    }
    var a = account(), gifts = {};
    ((a && a.programs) || []).forEach(function (p) { if (p.ends) gifts[slugOf(p.home) || p.slug] = p.ends; });
    held().forEach(function (h) {
      var st = null; STAGES.forEach(function (x) { if (DATA.stages[x].flag === h.key) st = x; });
      var meta = DATA.programs[h.base]; if (!st || !meta || meta.covers.indexOf(st) < 0) return;
      add(st, h.slug, h.gift || !!gifts[h.slug], h.ends || gifts[h.slug] || '');
    });
    ((a && a.programs) || []).forEach(function (p) {
      var slug = slugOf(p.home) || p.slug, meta = slug && DATA.programs[baseOf(slug)]; if (!meta) return;
      meta.covers.forEach(function (st) { add(st, slug, !!p.ends, p.ends || ''); });
    });
    // A member whose program has not reached this phone yet (a new phone, before the first sync) still counts, through her account.
    var me = memberEnds(a);
    if (a && a.member && a.member.stage && DATA.stages[a.member.stage] && !seenStage[a.member.stage]) {
      add(a.member.stage, DATA.stages[a.member.stage].program, true, a.member.ends || '');
    }
    return out;
  }
  function played() { var p = jr('wg_played_v1'); return p ? Object.keys(p).length : 0; }
  // Saved tools only: the keys a tool writes (WGApp.toolKey), not her name, streak, account or program flags.
  function savedCount() {
    try {
      var tk = w.WGApp && w.WGApp.toolKey; if (!tk) return 0;
      return w.WGApp.savedKeys().filter(function (k) { return tk.test(k) && !/^wg_read_/.test(k) && !/_home$/.test(k); }).length;
    } catch (e) { return 0; }
  }
  function stageDates() { return !!(jr('wg_stage_fertility_v1') || jr('wg_stage_pregnancy_v1') || jr('wg_stage_postpartum_v1') || ls('wg_vax_dob')); }
  function known() { var c = jr('wg_capture_v1'); return token() || !!(c && c.lists && c.lists.length); }

  // ── dates and stage ─────────────────────────────────────────────────────
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return null;
    var dt = new Date(+m[1], +m[2] - 1, +m[3]);
    return dt.getFullYear() === +m[1] && dt.getMonth() === +m[2] - 1 && dt.getDate() === +m[3] ? dt : null;
  }
  function today() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function between(a, b) { return Math.round((a - b) / DAY); }
  // The stage she is in right now, from the dates only she has. A delivery in the last 12 weeks beats a due date still ahead (a baby
  // that came early), a due date beats a baby's birth date (a new pregnancy), and a due date up to 21 days past comes last.
  function dateStage(stages) {
    var t = today(), has = function (s) { return !stages || stages.indexOf(s) > -1; };
    var pr = jr('wg_stage_pregnancy_v1'), due = pr && pr.v === 1 ? parse(pr.due) : null, ahead = due ? between(due, t) : null;
    var pp = jr('wg_stage_postpartum_v1'), del = pp && pp.v === 1 ? parse(pp.delivery) : null, since = del ? between(t, del) : -1;
    var dob = parse(ls('wg_vax_dob')), age = dob ? between(t, dob) : -1;
    if (has('postpartum') && del && since >= 0 && since <= 83) return 'postpartum';
    if (has('pregnancy') && due && ahead >= 0 && ahead <= 300) return 'pregnancy';
    if (has('parenting') && dob && age >= 0 && age <= 2200) return 'parenting';
    if (has('pregnancy') && due && ahead < 0 && ahead >= -21) return 'pregnancy';
    return '';
  }
  // The stage the offer follows. A date can move her on (a due date within 21 days, or a birth 4 to 12 weeks ago): her stage moves
  // and the offer follows it, but only once she has said her saved due date is still right (note 07, "stage changes").
  function moved(stage) {
    var t = today(), pr = jr('wg_stage_pregnancy_v1'), pp = jr('wg_stage_postpartum_v1');
    var due = pr && pr.v === 1 ? parse(pr.due) : null, del = pp && pp.v === 1 ? parse(pp.delivery) : null;
    var dob = parse(ls('wg_vax_dob'));
    var chk = jr('wg_stage_check_v1');
    if (due) {
      var ahead = between(due, t);
      if (ahead <= 21 && ahead >= -21 && chk && chk.v === 1 && chk.due === pr.due) return 'postpartum';
    }
    var since = del ? between(t, del) : (dob ? between(t, dob) : -1);
    if (since >= 28 && since <= 84) return 'parenting';
    return stage;
  }
  function pickedStage() { var u = jr('wg_streak_ui_v1') || {}; return STAGES.indexOf(u.stage) > -1 ? u.stage : ''; }
  function curStage() { var u = jr('wg_streak_ui_v1') || {}; return STAGES.indexOf(u.cur) > -1 ? u.cur : ''; }
  function activityStage() {
    try {
      if (typeof w.appActivity === 'function' && w.APP_TOOLS && w.APP_DATA && w.WGApp) {
        var keys = w.WGApp.savedKeys(), saved = w.APP_TOOLS.filter(function (t) { return w.appHas(keys, t[0]) && w.APP_DATA.tools[t[1]]; }).map(function (t) { return t[1]; });
        var o = w.appActivity(saved).order; return o.length ? o[0] : '';
      }
    } catch (e) {}
    return '';
  }
  // A page about one stage tells us the stage; otherwise her dates, her activity, the last answer, or the stage she picked.
  var PAGE_STAGE = (/^\/(relationships|fertility|pregnancy|postpartum|parenting)(\/|$)/.exec(path) || [])[1] || '';
  function stage() {
    var s = dateStage(null) || activityStage() || curStage() || pickedStage();
    return s ? moved(s) : '';
  }

  // ── her state ───────────────────────────────────────────────────────────
  var STATE = null;
  function state() {
    if (!DATA) return null;
    var list = entries(), own = {}, lapsed = {}, a = account();
    list.forEach(function (e) { if (e.lapsed) lapsed[e.stage] = e; else own[e.stage] = e; });
    // An ended campaign without a program left on her phone (the sync dropped it) is still a lapsed member.
    var me = memberEnds(a);
    if (a && a.member && a.member.stage && !isNaN(me) && me <= Date.now() && !own[a.member.stage] && !lapsed[a.member.stage] && DATA.stages[a.member.stage]) {
      lapsed[a.member.stage] = { stage: a.member.stage, slug: DATA.stages[a.member.stage].program, base: DATA.stages[a.member.stage].program, dia: false, bundle: false, gift: true, ends: a.member.ends, lapsed: true };
    }
    var act = Object.keys(own).map(function (k) { return own[k]; });
    var paid = act.filter(function (e) { return !e.gift; }), gift = act.filter(function (e) { return e.gift; });
    var bundle = paid.some(function (e) { return e.bundle; });
    var name = paid.length && gift.length ? 'both' : bundle ? 'bundle' : paid.length ? 'buyer' : gift.length ? 'member' : Object.keys(lapsed).length ? 'lapsed' : known() ? 'known' : (savedCount() || played() || stageDates()) ? 'engaged' : 'visitor';
    // Signed in, but her account has not reached this phone yet: her state is not known, so nothing is offered until it is.
    var pending = token() && !a;
    var st = {
      name: name, stage: stage(), own: own, lapsed: lapsed, paid: paid.length > 0, bundle: bundle, gift: gift.length > 0, pending: !!pending,
      signedIn: token(), account: a, dia: list.some(function (e) { return e.dia; }),
      col: { visitor: 'V', engaged: 'V', known: 'V', member: 'M', buyer: 'B', both: 'B', bundle: 'O', lapsed: 'L' }[name]
    };
    STATE = st; return st;
  }

  // ── the offer slot ──────────────────────────────────────────────────────
  // For one stage: what fills the slot for this woman. kinds:
  //   none (quiet page, or tools only), own (she holds it), lapsed (her free months ended), f1k (the campaign), paid (the program).
  function sales(slug, dia) { return '/programs/' + slug + (dia ? '-diaspora' : ''); }
  function offer(st, o) {
    o = o || {};
    var S = state(); if (!S || !st || !DATA.stages[st]) return { kind: 'none', stage: st || '' };
    if (S.pending) return { kind: 'none', stage: st, wait: true };
    if (!o.loud && quiet()) return { kind: 'none', stage: st, quiet: true };
    var stg = DATA.stages[st], prog = DATA.programs[stg.program];
    var e = S.own[st];
    if (e) return { kind: 'own', stage: st, entry: e, slug: e.slug, name: DATA.programs[e.base].name, home: '/programs/' + e.slug + '/thank-you', gift: e.gift };
    var l = S.lapsed[st];
    if (l) return { kind: 'lapsed', stage: st, slug: stg.program, name: prog.name, cover: prog.cover, topic: stg.topic, href: sales(stg.program, l.dia) };
    // A stage she does not hold. A member in her free months gets tools only, and so does the bundle owner for a stage it covers.
    if (S.gift && !S.paid) return { kind: 'none', stage: st, tools: true };
    if (S.bundle && prog.covers.length === 1 && MOTHER.indexOf(st) > -1) return { kind: 'none', stage: st, tools: true };
    var dia = S.dia || o.dia;
    var base = { stage: st, slug: stg.program, name: prog.name, cover: prog.cover, topic: stg.topic, href: sales(stg.program, dia) };
    // Buyers never see the campaign offer. A lapsed member has had her place. Everyone else sees it while it is open.
    var buyer = S.paid || S.name === 'lapsed' || Object.keys(S.lapsed).length > 0;
    if (!buyer && campaignOpen()) { base.kind = 'f1k'; base.href = '/first?stage=' + st; base.cap = STATUS.cap; base.left = STATUS.left; return base; }
    base.kind = 'paid'; return base;
  }

  // ── the site-wide table (note 07): the single main action for each surface, by her column ──
  // Columns: V visitor, engaged or known; M campaign member; B buyer (or buyer and member); O bundle owner; L lapsed member.
  var SURFACES = {
    'home-hero':        { V: 'offer', M: 'continue', B: 'continue', O: 'continue', L: 'keep' },
    'header-programs':  { V: 'offer', M: 'menu', B: 'menu', O: 'menu', L: 'programs' },
    'stage-hub':        { V: 'offer', M: 'by-stage', B: 'by-stage', O: 'by-stage', L: 'by-stage' },
    'end-card':         { V: 'offer', M: 'by-stage', B: 'by-stage', O: 'by-stage', L: 'by-stage' },
    'streak-sheet':     { V: 'offer', M: 'months', B: 'lessons', O: 'lessons', L: 'keep' },
    'app-home':         { V: 'offer', M: 'step', B: 'lesson', O: 'lesson', L: 'keep' },
    'programs-page':    { V: 'offer', M: 'yours', B: 'yours', O: 'yours', L: 'programs' },
    'sales-page':       { V: 'offer', M: 'by-program', B: 'by-program', O: 'by-program', L: 'sales' },
    'program-home':     { V: 'gated', M: 'program', B: 'program', O: 'program', L: 'gated' },
    'signin-locked':    { V: 'offer', M: 'signin', B: 'signin', O: 'signin', L: 'keep' },
    'campaign-page':    { V: 'claim', M: 'have-place', B: 'have-program', O: 'have-program', L: 'ended' },
    'emails':           { V: 'weekly', M: 'member-journey', B: 'buyer-journey', O: 'buyer-journey', L: 'end-of-access' }
  };
  // Where this page sits in the table, from its address and what is on it. null means the page is not in the table.
  function surfaceOf(p, hasCard) {
    p = String(p || '').replace(/\.html$/, '').replace(/\/index$/, '/');
    if (p === '/') return 'home-hero';
    if (/^\/app\/?$/.test(p)) return 'app-home';
    if (/^\/(relationships|fertility|pregnancy|postpartum|parenting)\/?$/.test(p)) return 'stage-hub';
    if (/^\/programs\/?$/.test(p)) return 'programs-page';
    if (/^\/programs\/[a-z0-9-]+\/(thank-you|read)$/.test(p)) return 'program-home';
    if (/^\/programs\/[a-z0-9-]+$/.test(p)) return 'sales-page';
    if (/^\/signin\/?$/.test(p)) return 'signin-locked';
    if (/^\/first\/?$/.test(p)) return 'campaign-page';
    if (hasCard) return 'end-card';
    return null;
  }
  // `o` may carry: stage (the page's stage), program (a sales page's slug), days (a streak milestone), entry (one lesson owner).
  function next(surface, o) {
    o = o || {};
    var S = state(); if (!S || !SURFACES[surface]) return null;
    var cell = SURFACES[surface][S.col], st = o.stage || S.stage || '';
    var r = { surface: surface, state: S.name, col: S.col, action: cell, stage: st };
    if (S.pending) { r.action = 'wait'; return r; }
    if (surface === 'streak-sheet' && (o.days !== 7 && o.days !== 30)) { r.action = 'none'; return r; }
    if (cell === 'offer' || cell === 'by-stage' || cell === 'keep') {
      if (!st) { r.action = surface === 'app-home' || surface === 'home-hero' ? 'pick-stage' : 'none'; return r; }
      var f = offer(st, o); r.offer = f;
      r.action = { none: 'none', own: 'open', lapsed: 'keep', f1k: 'offer', paid: S.col === 'V' ? 'offer' : 'paid' }[f.kind];
      if (f.tools) r.action = 'tools-only';
      if (f.quiet) r.action = 'none';
      return r;
    }
    if (surface === 'sales-page') {
      var prog = DATA.programs[baseOf(o.program)], hers = prog && (prog.bundle ? Object.keys(S.own).some(function (k) { return S.own[k].bundle; }) : !!(S.own[prog.stage] || (S.bundle && MOTHER.indexOf(prog.stage) > -1)));
      r.action = hers ? 'open' : 'sales';
      r.owns = !!hers; return r;
    }
    return r;
  }

  // ── the offer card ──────────────────────────────────────────────────────
  function style() {
    if (d.getElementById('wgn-css')) return;
    var s = mk('style'); s.id = 'wgn-css';
    s.textContent =
      '.card.wgn-offer{text-align:left!important}.wgn-offer .eyebrow{margin:0 0 10px!important;text-align:left!important}' +
      '.wgn-row{display:flex;gap:14px;align-items:center}.wgn-row+.wgn-meta{margin-top:10px!important}.wgn-cover{width:64px;height:80px;border-radius:6px;border:2px solid var(--ink,#33322A);object-fit:cover;flex:none}' +
      '.wgn-offer h3{margin:0 0 4px!important;font-size:1.2rem;line-height:1.2;text-align:left!important}.wgn-offer .wgn-row p{margin:0!important;max-width:none!important;font-size:.92rem;line-height:1.45;color:var(--muted,#6b6b60);text-align:left!important}' +
      '.wgn-offer p.wgn-meta{margin:0!important;max-width:none!important;font-size:.92rem;line-height:1.45;color:var(--plum,#33322A);text-align:left!important}.wgn-meta b{display:block;margin-top:2px;font-size:.88rem}' +
      '.wgn-offer .btn{display:flex!important;width:100%;justify-content:center;box-sizing:border-box}' +
      '.wgn-in{text-align:left;border:2px solid var(--ink,#33322A);border-radius:16px;padding:12px;background:#fff}' +
      '.wgn-in h3{font-size:1.05rem!important}' +
      '.wgn-gap{margin-top:18px}' +
      '.wgn-step h2{margin:0 0 10px;font-size:1.3rem;line-height:1.25}.wgn-step .meta{margin:0 0 10px}.wgn-step .btn{display:flex;width:100%;justify-content:center;box-sizing:border-box}' +
      '.wgn-hub{margin-top:18px;margin-bottom:6px;max-width:34rem;position:relative;z-index:1}.wgn-hero{margin-left:auto;margin-right:auto}.wgn-hub-solo{display:block}';
    d.head.appendChild(s);
  }
  var CTAS = { f1k: 'Claim my place', paid: 'See the program', lapsed: 'Keep my program', own: 'Open my program' };
  // The one card. desc = offer(); o.surface names where it shows (for the analytics hook); o.inner is the smaller version inside a sheet.
  function card(desc, o) {
    o = o || {}; style();
    if (!desc || desc.kind === 'none') return null;
    var c = mk(o.inner ? 'div' : 'section', o.inner ? 'wgn-offer wgn-in' : 'card wgn-offer');
    c.setAttribute('data-wgn', desc.kind); c.setAttribute('data-wgn-stage', desc.stage || '');
    if (o.surface) c.setAttribute('data-wgn-surface', o.surface);
    var eb, h, sub, meta, btn, href = desc.href;
    if (desc.kind === 'f1k') {
      eb = 'For the first ' + fmtN(desc.cap) + ' women'; h = 'Get ' + desc.name + ' free'; sub = desc.topic;
      meta = ['Free for a month, and you can earn up to 12 months.', fmtN(desc.left) + ' of ' + fmtN(desc.cap) + (desc.left === 1 ? ' place is' : ' places are') + ' left.'];
      btn = 'Claim my place';
    } else if (desc.kind === 'lapsed') {
      eb = 'Your free months have ended'; h = 'Keep ' + desc.name; sub = 'Your lessons and your place are saved. Carry on where you stopped.';
      meta = null; btn = 'Keep my program';
    } else if (desc.kind === 'own') {
      eb = 'Your program'; h = desc.name; sub = ''; meta = null; btn = 'Open my program'; href = desc.home;
    } else {
      eb = 'A program for your stage'; h = desc.name; sub = desc.topic; meta = null; btn = 'See the program';
    }
    c.appendChild(mk('p', 'eyebrow', eb));
    var row = mk('div', 'wgn-row');
    if (desc.cover || desc.kind === 'own') {
      var cover = desc.cover || (DATA && DATA.programs[desc.entry.base] ? DATA.programs[desc.entry.base].cover : '');
      if (cover) { var im = mk('img', 'wgn-cover'); im.src = cover + '?v=20261009c'; im.width = 64; im.height = 80; im.alt = ''; row.appendChild(im); }
    }
    var tx = mk('div'); tx.appendChild(mk('h3', '', h)); if (sub) tx.appendChild(mk('p', 'muted', sub)); row.appendChild(tx); c.appendChild(row);
    if (meta) { var mp = mk('p', 'wgn-meta', meta[0]); mp.appendChild(mk('b', '', meta[1])); c.appendChild(mp); }
    var a = mk('a', 'btn btn-primary'); a.href = href; a.appendChild(d.createTextNode(btn + ' →'));
    if (desc.kind === 'f1k') a.setAttribute('data-first1000', (o.surface || 'card') + '_card');
    c.appendChild(a);
    return c;
  }
  // The rail beside a guide mirrors the end card's action (wg-article.js builds it from these two attributes).
  function railOf(desc) {
    if (!desc || desc.kind === 'none') return null;
    if (desc.kind === 'f1k') return ['Get ' + desc.name + ' free', 'Claim my place'];
    if (desc.kind === 'lapsed') return [null, 'Keep my program'];
    if (desc.kind === 'own') return ['Your space', 'Open my program'];
    return null;
  }
  function stamp(el, desc) {
    var r = railOf(desc);
    if (!r) { el.removeAttribute('data-rail-hook'); el.removeAttribute('data-rail-label'); }
    if (!r) return;
    if (r[0]) el.setAttribute('data-rail-hook', r[0]); el.setAttribute('data-rail-label', r[1]);
  }

  // ── the pages that carry an offer slot ─────────────────────────────────
  var CARD_SEL = '.program-cta, .wgn-offer[data-wgn-surface="end-card"]';
  // A tool, guide, game or comparison page: its end card holds the slot for the page's stage; the guide's side rail follows it.
  function endCard() {
    var host = d.querySelector(CARD_SEL); if (!host || !PAGE_STAGE || !DATA) return;
    var desc = offer(PAGE_STAGE);
    if (desc.wait) return;
    var rail = d.querySelector('.toc-cta');
    if (desc.kind === 'none') {
      if (host.classList.contains('program-cta') || host.hasAttribute('data-wgn-surface')) host.remove();
      if (rail) rail.remove();
      return;
    }
    var c = card(desc, { surface: 'end-card' }); if (!c) return;
    c.classList.add('program-cta', 'wgn-gap'); stamp(c, desc);
    host.parentNode.replaceChild(c, host); W.mark(c, 'tool_end', actionOf(desc));
    if (rail) { var b = rail.querySelector('a.btn'); var r = railOf(desc); var hook = rail.querySelector('p'); if (b && r) { b.href = c.querySelector('a.btn').getAttribute('href'); b.textContent = r[1]; if (hook) hook.textContent = r[0] || ''; } }
  }
  // The stage hubs: one offer card under the hero line instead of the hero button, the program band and the closing band.
  function stageHub() {
    var hero = d.querySelector('.tool-hero .hub-ctas'); if (!hero || !PAGE_STAGE) return;
    var desc = offer(PAGE_STAGE);
    if (desc.wait) return;
    d.documentElement.classList.add('wg-one-offer');
    [].forEach.call(d.querySelectorAll('[data-hub-sell]'), function (el) { el.hidden = true; el.style.display = 'none'; });
    var c = card(desc, { surface: 'stage-hub' });
    var ghost = hero.querySelector('.btn-ghost'), primary = hero.querySelector('.btn-primary');
    if (!c) { if (primary) primary.remove(); return; }
    c.classList.add('wgn-hub');
    hero.parentNode.insertBefore(c, hero); W.mark(c, 'stage_hub', actionOf(desc));
    if (primary) primary.remove();
    if (ghost && !hero.querySelector('.btn-primary')) hero.classList.add('wgn-hub-solo');
  }

  // ── measurement ─────────────────────────────────────────────────────────
  // Events go to the dataLayer like every other event on the site; the tag container applies consent. Nothing here carries a date, a stage
  // word, a name, an email or an entry. The experiment: wg_variant says which design this page view is. A holdout can be added later by
  // changing VARIANT (or reading it from a cookie) in this one place.
  //   journey_step        step (engaged | known | owner | activated | active), source (tool | guide | game | claim | capture | account | purchase | campaign)
  //   next_action_shown   surface, state, action: once per surface per page view, when the main action is on the page
  //   next_action_click   surface, state, action: a tap on that main action
  //   wg_variant          ux (user property), pushed on every page view
  var VARIANT = 'next';
  var JK = 'wg_journey_v1', ACTIVE_AFTER = 30 * DAY;
  function push(o) { try { (w.dataLayer = w.dataLayer || []).push(o); } catch (e) {} }
  function persist() { try { return !w.WGApp || !w.WGApp.remembering || w.WGApp.remembering() !== false; } catch (e) { return true; } }
  function jget() { var o = null; try { o = JSON.parse((persist() ? w.localStorage : w.sessionStorage).getItem(JK) || 'null'); } catch (e) {} return o && o.v === 1 && o.steps ? o : { v: 1, first: 0, steps: {} }; }
  function jset(o) { try { (persist() ? w.localStorage : w.sessionStorage).setItem(JK, JSON.stringify(o)); } catch (e) {} }
  // Each step fires once per phone: the flag is a timestamp, kept under wg_journey_v1 (not a saved entry; wg-app.js TOOL_KEY skips it).
  function step(name, source) {
    var j = jget(); if (j.steps[name]) return false;
    j.steps[name] = Date.now(); if (!j.first && name !== 'known' && name !== 'owner') j.first = Date.now();
    jset(j); push({ event: 'journey_step', step: name, source: source }); return true;
  }
  // A useful action (a finished tool, game or guide, a saved entry, a lesson, a streak day). The first one is the start of the 30 days.
  function useful(source) {
    var j = jget(), now = Date.now();
    if (!j.first) { j.first = now; jset(j); return; }
    if (!j.steps.active && now - j.first >= ACTIVE_AFTER) step('active', source);
  }
  function engaged(source) { if (step('engaged', source)) return; useful(source); }
  var shownSeen = {};
  function actionOf(desc) { return { f1k: 'offer_f1k', paid: 'offer_paid', lapsed: 'keep_program', own: 'open_program' }[desc && desc.kind] || ''; }
  function shown(surface, action) {
    var S = STATE || state(); if (!S || !action || shownSeen[surface]) return;
    shownSeen[surface] = 1; push({ event: 'next_action_shown', surface: surface, state: S.name, action: action });
  }
  // Marks the element that holds her main action: it reports "shown" now and "click" when she taps its button or link.
  function mark(el, surface, action) {
    if (!el || !action) return;
    el.setAttribute('data-wgn-track', surface + '|' + action); shown(surface, action);
  }
  d.addEventListener('click', function (e) {
    var host = e.target.closest && e.target.closest('[data-wgn-track]'); if (!host || !e.target.closest('a,button')) return;
    var t = host.getAttribute('data-wgn-track').split('|'), S = STATE || state();
    push({ event: 'next_action_click', surface: t[0], state: S ? S.name : '', action: t[1] });
  }, true);
  // What counts as engaged and useful: a tool result or game finished, an entry saved, a guide read to the end.
  function playedHere() { var p = jr('wg_played_v1'); return !!(p && p[path.replace(/\/$/, '')]); }
  d.addEventListener('wg:finish', function () { engaged(playedHere() ? 'game' : 'tool'); });
  d.addEventListener('wg:saved', function () { engaged('tool'); });
  if (/\/guides\//.test(path)) {
    var depth = function () { if ((w.scrollY + w.innerHeight) / Math.max(1, d.documentElement.scrollHeight) > 0.9) { w.removeEventListener('scroll', depth); setTimeout(function () { engaged('guide'); }, 0); } };
    w.addEventListener('scroll', depth, { passive: true });
  }
  // Known and owner come from her state on the first page view that shows them.
  function stateSteps() {
    var S = state(); if (!S || S.pending) return;
    var src = S.gift && !S.paid ? 'campaign' : 'purchase';
    if (S.name !== 'visitor' && S.name !== 'engaged') step('known', S.paid ? 'purchase' : S.gift ? 'claim' : S.signedIn ? 'account' : 'capture');
    if (S.paid || S.gift || Object.keys(S.lapsed).length) step('owner', src);
  }
  push({ ux: VARIANT }); push({ event: 'wg_variant', ux: VARIANT, user_properties: { ux: VARIANT } });

  // The home page: the hero's main button becomes her one next action (note 07, "home hero"). No stage yet: the stage picker comes first.
  function homeHero() {
    var act = d.querySelector('.hero-actions'); if (!act) return;
    var S = state(); if (!S || S.pending) return;
    var primary = act.querySelector('.btn-primary'), st = stage();
    if (S.col === 'V') {
      if (!st) { if (primary) { primary.href = '/#stages'; primary.textContent = 'Find your stage'; } var g = act.querySelector('.btn-ghost'); if (g) g.remove(); return; }
      var desc = offer(st); if (desc.kind === 'none') return;
      var c = card(desc, { surface: 'home-hero' }); if (!c) return;
      c.classList.add('wgn-hub', 'wgn-hero'); act.parentNode.insertBefore(c, act); if (primary) primary.remove();
      W.mark(c, 'home_hero', actionOf(desc)); return;
    }
    if (S.col === 'L') {
      var ls = Object.keys(S.lapsed)[0], ld = ls ? offer(ls) : null, lc = ld && ld.kind !== 'none' ? card(ld, { surface: 'home-hero' }) : null;
      if (lc) { lc.classList.add('wgn-hub', 'wgn-hero'); act.parentNode.insertBefore(lc, act); if (primary) primary.remove(); W.mark(lc, 'home_hero', 'keep_program'); }
      return;
    }
    var e = S.own[st] || S.own[Object.keys(S.own)[0]]; if (!e || !primary) return;
    primary.href = readerOf(e); primary.textContent = 'Continue reading →'; W.mark(primary, 'home_hero', 'next_lesson');
  }
  function readerOf(e) { return e.bundle ? '/programs/' + e.slug + '/thank-you' : '/programs/' + e.slug + '/read'; }
  // The programs list: the one offer on top for a woman with no program (owners already see "Yours" tags, set by wg-app.js).
  function programsPage() {
    var host = d.querySelector('.tool-hero .wrap'); if (!host) return;
    var S = state(); if (!S || S.pending) return;
    var st = S.col === 'L' ? Object.keys(S.lapsed)[0] : stage();
    if (S.col !== 'V' && S.col !== 'L') return;
    if (!st) return;
    var desc = offer(st); if (desc.kind === 'none') return;
    var c = card(desc, { surface: 'programs-page' }); if (!c) return;
    c.classList.add('wgn-hub'); host.appendChild(c);
  }
  // A sales page: an owner sees "Open my program" where the buy buttons are, and no price block. Everyone else keeps the sales page.
  function salesPage() {
    var slug = (/^\/programs\/([a-z0-9-]+)$/.exec(path.replace(/\.html$/, '')) || [])[1]; if (!slug) return;
    var S = state(); if (!S || S.pending) return;
    var n = next('sales-page', { program: slug }); if (!n || n.action !== 'open') return;
    var meta = DATA.programs[baseOf(slug)], e = null;
    if (meta.bundle) { Object.keys(S.own).forEach(function (k) { if (S.own[k].bundle) e = S.own[k]; }); }
    else e = S.own[meta.stage];
    if (!e) return;
    var href = meta.bundle ? '/programs/' + e.slug + '/thank-you' : '/programs/' + DATA.stages[meta.stage].program + (e.dia ? '-diaspora' : '') + '/read', first = null;
    [].forEach.call(d.querySelectorAll('a[href*="selar.com"], a.js-buy, a[href^="/checkout"]'), function (a) {
      a.href = href; a.removeAttribute('data-checkout'); a.classList.remove('js-buy'); a.textContent = 'Open my program →'; first = first || a;
    });
    [].forEach.call(d.querySelectorAll('.sc-price, .sc-row .muted'), function (x) { x.hidden = true; });
    if (first) W.mark(first, 'program_page', 'open_program');
  }

  // The campaign page: only a woman with no program claims a place. Someone with her place or a bought program gets her program; a lapsed
  // member gets the keep link (the campaign has ended for her).
  function campaignPage() {
    var S = state(); if (!S || S.pending || S.col === 'V') return;
    var st = S.col === 'L' ? Object.keys(S.lapsed)[0] : (S.own[stage()] ? stage() : Object.keys(S.own)[0]);
    var href, text, action;
    if (S.col === 'L') { var f = offer(st); if (f.kind === 'none') return; href = f.href; text = 'Keep my program →'; action = 'keep_program'; }
    else { var e = S.own[st]; if (!e) return; href = readerOf(e); text = 'Open my program →'; action = S.col === 'M' ? 'have_place' : 'open_program'; }
    var first = null;
    [].forEach.call(d.querySelectorAll('[data-claim]'), function (b) {
      var a = mk('a', b.className.replace(/\bfx-cta\b/, '').trim()); a.href = href; a.textContent = text; b.parentNode.replaceChild(a, b); first = first || a;
    });
    if (first) W.mark(first, 'campaign_page', action);
  }

  // ── start ───────────────────────────────────────────────────────────────
  function ready(o) {
    var need = o && o.status;
    return Promise.all([load(), domP]).then(function () {
      if (!DATA) return null;
      if (need) { var s = state(); return (s && !s.paid && !s.gift && !s.pending) ? status().then(function () { return W; }) : W; }
      return W;
    });
  }
  var W = {
    ready: ready, state: state, offer: offer, next: next, card: card, status: status, SURFACES: SURFACES, surfaceOf: surfaceOf,
    entries: entries, held: held, active: active, paidHeld: paidHeld, bundleHeld: bundleHeld, stage: stage, moved: moved, dateStage: dateStage, quiet: quiet, account: account, slugOf: slugOf, baseOf: baseOf,
    data: function () { return DATA; }, sales: sales, style: style, campaignOpen: campaignOpen, railOf: railOf, stamp: stamp,
    pageStage: PAGE_STAGE, PAY: PAY, preview: previewStatus,
    endCard: endCard, variant: VARIANT, step: step, useful: useful, engaged: engaged, shown: shown, mark: mark, actionOf: actionOf
  };
  w.WGNext = W;

  // A signed-in phone records the campaign steps (the first result, the telegram tap) from any page.
  if (token() && !d.querySelector('script[src*="wg-member-step"]')) { var ms = d.createElement('script'); ms.src = '/assets/js/wg-member-step.js?v=20261106a'; ms.defer = true; d.head.appendChild(ms); }

  // The pages that carry an offer slot render it themselves; every other surface calls WGNext.next() from its own script.
  ready({ status: true }).then(function () {
    stateSteps();
    var surface = surfaceOf(path, !!d.querySelector(CARD_SEL));
    if (surface === 'end-card') endCard();
    else if (surface === 'stage-hub') stageHub();
    else if (surface === 'home-hero') homeHero();
    else if (surface === 'programs-page') programsPage();
    else if (surface === 'sales-page') salesPage();
    else if (surface === 'campaign-page') campaignPage();
  });
})(window, document);
