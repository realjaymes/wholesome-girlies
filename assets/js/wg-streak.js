/* Wholesome Girlies: streaks for every woman, and today's card (CLAUDE.md section 10, "Streaks and today's card").
 *
 * Loaded on every page after wg-app.js and wg-ideas.js (scripts/add-app-tags.py).
 *
 * A streak day is recorded on the first useful action of the day: reading today's card on the app home, a tool result or a
 * saved entry (wg:saved, wgShowResult), a lesson ticked in the reader, or a game finished (wgPlayed).
 *   wg_streak_v1      {"v":1,"count":0,"best":0,"last_day":"YYYY-MM-DD","rest_used_week":"YYYY-Www"|null,"milestones":[3,7]}
 *                     The contract shape (Growth Build Contract). Only these fields ever leave the phone, and only for a signed-in woman.
 *   wg_streak_ui_v1   This phone's own notes: her first streak day, the last 14 days, the rest day used, the day the toast showed,
 *                     a milestone waiting to be shown, the stage she picked. Never sent anywhere.
 * One missed day per ISO week is covered by the rest day. Milestones are 3, 7, 14 and 30 days.
 * Who she is decides what the streak offers: a free woman (no program) keeps it with the card, a tool or a game; a First 1,000
 * member and a buyer also count a lesson; only a member earns months. A buyer's milestone shows her lesson progress, and a woman
 * with two programs (the bundle, or Wife Material plus motherhood) is followed to the right one. All of it is worked out on her
 * phone from her program flags, her cached account and her stage dates; nothing about it is sent anywhere.
 * Today's card comes from assets/data/daily-cards.json and is chosen here, on her phone, from her saved stage date. No date,
 * week or stage is sent anywhere. The only analytics event is streak_milestone with the number of days.
 * Both keys are skipped by TOOL_KEY in wg-app.js (a streak write is not a saved entry), and the backup keeps them.
 * Text goes in with textContent, never innerHTML.
 */
(function (w, d) {
  'use strict';
  var A = w.WGApp || null;
  var PAY = 'https://wg-pay.realjaymes.workers.dev';
  // On localhost only, a wrangler dev server can stand in for the payment server (localStorage.wg_pay_api = 'http://localhost:8787'), as in wg-access.js.
  try {
    if (/^(localhost|127\.0\.0\.1)$/.test(w.location.hostname)) { var po = w.localStorage.getItem('wg_pay_api'); if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(po || '')) PAY = po; }
  } catch (e) {}
  var KEY = 'wg_streak_v1', UIK = 'wg_streak_ui_v1', MILES = [3, 7, 14, 30], DAY = 864e5;
  var DATA_V = '20261106a';
  var path = w.location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
  var onApp = /^\/app\/?$/.test(path);
  var QUIET_RX = /mind-check-in|the-wait-check-in|warning-signs|loss|miscarriage|stillbirth|when-to-take-your-baby-to-hospital/;

  // ── storage and dates ───────────────────────────────────────────────────
  function ls(k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v) { try { w.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function jr(k) { try { var o = JSON.parse(ls(k) || 'null'); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function iso(dt) { return dt.getFullYear() + '-' + pad(dt.getMonth() + 1) + '-' + pad(dt.getDate()); }
  function parse(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || ''); if (!m) return null;
    var dt = new Date(+m[1], +m[2] - 1, +m[3]);
    return dt.getFullYear() === +m[1] && dt.getMonth() === +m[2] - 1 && dt.getDate() === +m[3] ? dt : null;
  }
  function now() { var n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
  function shift(dt, n) { return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n); }
  function between(a, b) { return Math.round((a - b) / DAY); } // whole days a minus b
  function today() { return iso(now()); }
  function isoWeek(dt) { // ISO 8601 week, "YYYY-Www"
    var t = new Date(Date.UTC(dt.getFullYear(), dt.getMonth(), dt.getDate())), dn = t.getUTCDay() || 7;
    t.setUTCDate(t.getUTCDate() + 4 - dn);
    var y = t.getUTCFullYear(), wk = Math.ceil(((t - Date.UTC(y, 0, 1)) / DAY + 1) / 7);
    return y + '-W' + pad(wk);
  }
  function quiet() { return (A && A.quiet ? A.quiet() : false) || QUIET_RX.test(path); }
  function push(o) { try { (w.dataLayer = w.dataLayer || []).push(o); } catch (e) {} }
  function mk(tag, cls, text) { var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  // ── the streak ──────────────────────────────────────────────────────────
  function readS() {
    var o = jr(KEY), s = { v: 1, count: 0, best: 0, last_day: '', rest_used_week: null, milestones: [] };
    if (!o || o.v !== 1) return s;
    s.count = Math.max(0, Math.floor(+o.count) || 0); s.best = Math.max(s.count, Math.floor(+o.best) || 0);
    s.last_day = parse(o.last_day) ? o.last_day : '';
    s.rest_used_week = /^\d{4}-W\d{2}$/.test(o.rest_used_week || '') ? o.rest_used_week : null;
    s.milestones = (Array.isArray(o.milestones) ? o.milestones : []).filter(function (m) { return MILES.indexOf(m) > -1; });
    return s;
  }
  function writeS(s) { return lset(KEY, JSON.stringify({ v: 1, count: s.count, best: s.best, last_day: s.last_day, rest_used_week: s.rest_used_week, milestones: s.milestones })); }
  function readU() {
    var o = jr(UIK) || {};
    return { v: 1, first: parse(o.first) ? o.first : '', days: Array.isArray(o.days) ? o.days.filter(parse).slice(-14) : [], rest: parse(o.rest) ? o.rest : '',
      toast: o.toast || '', pending: +o.pending || 0, ended: +o.ended || 0, rule: o.rule || '', stage: o.stage || '', steps: o.steps || {}, ends: o.ends || '', cur: o.cur || '', pref: o.pref === 'relationships' || o.pref === 'motherhood' ? o.pref : '' };
  }
  function writeU(u) { return lset(UIK, JSON.stringify(u)); }

  // Applies the rest day, or ends the streak, when she has been away. Called on every page and before every record.
  function settle() {
    var s = readS(), u = readU();
    if (!s.last_day || !s.count) return { s: s, u: u };
    var gap = between(now(), parse(s.last_day));
    if (gap <= 1) return { s: s, u: u };
    var missed = shift(now(), -1), wk = isoWeek(missed);
    if (gap === 2 && s.rest_used_week !== wk) { // one missed day, and this week's rest day is free: the streak is safe
      s.rest_used_week = wk; s.last_day = iso(missed); u.rest = iso(missed);
      if (u.days.indexOf(iso(missed)) < 0) u.days.push(iso(missed));
    } else { u.ended = s.count; s.count = 0; } // the best stays
    writeS(s); writeU(u);
    return { s: s, u: u };
  }

  var onRecord = [];
  function record(source) {
    var st = settle(), s = st.s, u = st.u, t = today();
    if (s.last_day === t) return { s: s, isNew: false };
    var yest = iso(shift(now(), -1));
    s.count = s.last_day === yest && s.count > 0 ? s.count + 1 : 1;
    s.last_day = t; if (s.count > s.best) s.best = s.count;
    if (!u.first) u.first = t;
    if (u.days.indexOf(t) < 0) u.days.push(t);
    u.days = u.days.slice(-14); u.ended = 0;
    var milestone = MILES.indexOf(s.count) > -1 && s.milestones.indexOf(s.count) < 0 ? s.count : 0;
    if (milestone) { s.milestones.push(milestone); u.pending = milestone; }
    writeS(s); writeU(u);
    if (milestone) push({ event: 'streak_milestone', days: milestone });
    var showToast = !quiet() && u.toast !== t;
    if (showToast) { u.toast = t; writeU(u); toast(s.count); }
    if (u.pending) setTimeout(maybeSheet, showToast ? 3500 : 800);
    sync();
    var r = { s: s, isNew: true, milestone: milestone, source: source || '' };
    onRecord.forEach(function (f) { try { f(r); } catch (e) {} });
    if (onApp) renderApp();
    return r;
  }

  // ── the toast and the milestone sheet ───────────────────────────────────
  function style() {
    if (d.getElementById('wgs-css')) return;
    var s = mk('style'); s.id = 'wgs-css';
    s.textContent =
      '.wgs-toast{position:fixed;left:50%;bottom:calc(var(--wg-nav-h,66px) + 16px);transform:translateX(-50%);z-index:960;max-width:calc(100% - 32px);background:var(--ink,#33322A);color:#fff;border-radius:999px;padding:11px 20px;font-weight:800;font-size:.95rem;box-shadow:0 8px 24px rgba(51,50,42,.25);animation:wgsIn .25s ease}' +
      '@keyframes wgsIn{from{opacity:0;transform:translate(-50%,10px)}to{opacity:1;transform:translate(-50%,0)}}@media (prefers-reduced-motion:reduce){.wgs-toast{animation:none}}' +
      '.wgs-sheet{position:fixed;inset:0;z-index:970;background:rgba(51,50,42,.45);display:flex;align-items:flex-end;justify-content:center}' +
      '.wgs-in{background:#FBF8EF;border-radius:22px 22px 0 0;padding:24px 20px 28px;width:100%;max-width:560px;max-height:90vh;overflow:auto;text-align:center}' +
      '.wgs-in h3{margin:12px 0 6px}.wgs-in p{margin:0 0 12px}.wgs-in .muted{color:var(--plum-soft,#66645A)}' +
      '.wgs-badge{width:112px;height:112px;margin:0 auto;border-radius:50%;background:var(--mustard,#D49A2A);border:2px solid var(--ink,#33322A);box-shadow:var(--sticker-sm,3px 3px 0 #33322A);display:grid;place-content:center;color:var(--ink,#33322A);line-height:1}' +
      '.wgs-badge b{font-size:2.6rem;font-family:var(--serif,Georgia,serif)}.wgs-badge span{font-size:.72rem;font-weight:800;letter-spacing:.12em}' +
      '.wgs-ladder{display:flex;justify-content:center;gap:8px;margin:14px 0}.wgs-ladder span{min-width:62px;padding:8px 6px;border:2px solid var(--ink,#33322A);border-radius:12px;background:#fff;font-weight:800;font-size:.85rem;color:var(--plum-soft,#66645A)}' +
      '.wgs-ladder span.on{background:var(--st,#E3E6CC);color:var(--ink,#33322A)}' +
      '.wgs-in .btn{margin:4px}.wgs-card{display:block;width:100%;max-width:270px;height:auto;margin:0 auto 12px;border:2px solid var(--ink,#33322A);border-radius:8px}' +
      '.wgs-today{text-align:left}.wgs-today .eyebrow{margin:0 0 6px}.wgs-today p{margin:0 0 10px}.wgs-src{font-size:.82rem;color:var(--plum-soft,#66645A)}' +
      '.wgs-strip{display:flex;justify-content:space-between;gap:6px;margin:14px 0 8px}.wgs-strip div{flex:1;text-align:center;font-size:.72rem;font-weight:800;color:var(--plum-soft,#66645A)}' +
      '.wgs-dot{display:grid;place-items:center;width:34px;height:34px;margin:0 auto 4px;border-radius:50%;border:2px solid var(--ink,#33322A);background:#fff;font-size:.9rem;color:var(--ink,#33322A)}' +
      '.wgs-dot.done{background:var(--olive,#6E7A3F);color:#fff}.wgs-dot.rest{background:repeating-linear-gradient(45deg,#fff 0 4px,var(--peach,#F0C9A8) 4px 8px)}' +
      '.wgs-dot.today{box-shadow:0 0 0 3px var(--mustard,#D49A2A)}.wgs-count{font-weight:800}' +
      '.wgs-src a,.wgs-rule li a{font-weight:800;text-decoration:underline}.wgs-more:empty{display:none}' +
      '.wgs-rule ul{margin:8px 0 10px;padding-left:20px}.wgs-pick{position:relative;display:grid;grid-template-columns:repeat(5,1fr);gap:4px;margin:14px 0 4px}.wgs-pick::before{content:"";position:absolute;left:10%;right:10%;top:21px;border-top:3px dashed var(--ink);opacity:.35}.wgs-stop{position:relative;background:none;border:0;padding:0;font:inherit;color:var(--ink);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;text-align:center;min-width:0;-webkit-tap-highlight-color:transparent}.wgs-dot{width:44px;height:44px;border-radius:50%;display:grid;place-items:center;font-size:1.2rem;background:var(--t);border:2px solid var(--ink);transition:transform .15s}.wgs-stop:hover .wgs-dot,.wgs-stop:focus-visible .wgs-dot{background:var(--c);box-shadow:var(--sticker-sm);transform:scale(1.08)}.wgs-stop b{font-size:clamp(.6rem,2.65vw,.78rem);line-height:1.2;letter-spacing:-.01em}.wgs-stop small{font-size:clamp(.6rem,2.45vw,.7rem);line-height:1.2;opacity:.75}';
    d.head.appendChild(s);
  }
  function toast(n) {
    style();
    var old = d.querySelector('.wgs-toast'); if (old) old.remove();
    var el = mk('div', 'wgs-toast', 'Day ' + n + ' done. See you tomorrow.'); el.setAttribute('role', 'status');
    d.body.appendChild(el); setTimeout(function () { el.remove(); }, 3000);
  }
  var MCOPY = { 3: ['You came back three days in a row.', 1], 7: ['You showed up for yourself every day this week.', 1], 14: ['You came back for two weeks.', 0], 30: ['A full month. You kept coming back.', 1] };
  var MONTHS = { 3: 1, 7: 1, 30: 2 };
  function maybeSheet() {
    var u = readU();
    if (!u.pending || quiet() || d.querySelector('.wgs-sheet')) return;
    var n = u.pending; u.pending = 0; writeU(u);
    sheet(n);
  }
  function sheet(n, memberLine) {
    style();
    var u = readU(), name = A && A.name ? A.name() : '';
    var ov = mk('div', 'wgs-sheet'), box = mk('div', 'wgs-in'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    var badge = mk('div', 'wgs-badge'); badge.appendChild(mk('b', '', String(n))); badge.appendChild(mk('span', '', 'DAYS')); box.appendChild(badge);
    box.appendChild(mk('h3', '', n + ' days in a row' + (name ? ', ' + name : '')));
    box.appendChild(mk('p', 'muted', (MCOPY[n] || MCOPY[7])[0]));
    var lad = mk('div', 'wgs-ladder'); MILES.forEach(function (m) { lad.appendChild(mk('span', m <= n ? 'on' : '', m + ' days')); }); box.appendChild(lad);
    if (MONTHS[n] && u.steps && u.steps[n] && u.ends) {
      var dt = parse(u.ends.slice(0, 10)), when = dt ? dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }) : '';
      box.appendChild(mk('p', 'wgs-src', 'Member: we added ' + (MONTHS[n] > 1 ? MONTHS[n] + ' months' : '1 month') + '.' + (when ? ' Your access now runs to ' + when + '.' : '')));
    }
    var pl = plan(), slot = mk('div', 'wgs-more'); box.appendChild(slot);
    if (pl.wh.paid.length) progressFor(pl).then(function (txt) { if (txt && ov.isConnected) slot.appendChild(mk('p', 'wgs-src', txt)); });
    else if (pl.wh.kind === 'free' && (n === 7 || n === 30)) freeNudge(pl, slot, ov);
    var close = function () { ov.remove(); d.removeEventListener('keydown', esc); try { d.dispatchEvent(new CustomEvent('wg:streak-sheet-closed', { detail: { days: n } })); } catch (e) {} };
    var esc = function (e) { if (e.key === 'Escape') close(); };
    d.addEventListener('keydown', esc);
    if ((MCOPY[n] || MCOPY[7])[1]) {
      var sh = mk('button', 'btn btn-primary', 'Share my ' + n + ' days'); sh.type = 'button';
      sh.addEventListener('click', function () { shareView(box, n, function () { close(); }); });
      box.appendChild(sh);
    }
    var go = mk('button', 'btn btn-ghost', 'Keep going'); go.type = 'button'; go.addEventListener('click', close); box.appendChild(go);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.appendChild(box); d.body.appendChild(ov); go.focus();
  }

  // The share card is drawn here on her phone, like the result cards. It says the days and Wholesome Girlies, never her stage.
  var SHARE_LINE = function (n) { return n + ' days in a row with Wholesome Girlies'; };
  function drawCard(cv, n) {
    var k = cv.width / 1080, x = cv.getContext('2d'), ink = '#33322A';
    x.fillStyle = '#E3E6CC'; x.fillRect(0, 0, cv.width, cv.height);
    x.lineWidth = 10 * k; x.strokeStyle = ink; x.strokeRect(5 * k, 5 * k, cv.width - 10 * k, cv.height - 10 * k);
    x.fillStyle = '#D49A2A'; x.lineWidth = 8 * k; x.beginPath(); x.arc(540 * k, 520 * k, 270 * k, 0, 7); x.fill(); x.stroke();
    var serif = "'DM Serif Display', Georgia, serif", sans = "'Nunito Sans', system-ui, sans-serif";
    x.fillStyle = ink; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.font = '400 ' + 300 * k + 'px ' + serif; x.fillText(String(n), 540 * k, 585 * k);
    x.font = '800 ' + 48 * k + 'px ' + sans; x.fillText('DAYS IN A ROW', 540 * k, 680 * k);
    x.font = '400 ' + 84 * k + 'px ' + serif; x.fillText('with Wholesome Girlies', 540 * k, 960 * k);
    x.font = '800 ' + 34 * k + 'px ' + sans; x.fillText('WHOLESOMEGIRLIES.XYZ', 540 * k, cv.height - 80 * k);
  }
  function shareView(box, n, done) {
    while (box.firstChild) box.removeChild(box.firstChild);
    var prev = mk('canvas', 'wgs-card'); prev.width = 540; prev.height = 675; drawCard(prev, n); box.appendChild(prev);
    var file = function () {
      return new Promise(function (res) {
        var cv = mk('canvas'); cv.width = 1080; cv.height = 1350; drawCard(cv, n);
        cv.toBlob(function (b) { res(b ? new File([b], 'wholesome-girlies-streak.png', { type: 'image/png' }) : null); }, 'image/png');
      });
    };
    var dl = function (f) { var u = URL.createObjectURL(f), a = mk('a'); a.href = u; a.download = f.name; d.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); };
    var sh = mk('button', 'btn btn-primary', 'Share my card'); sh.type = 'button';
    sh.addEventListener('click', function () {
      push({ event: 'share_click', share_channel: 'card', share_item: 'streak', share_surface: 'streak' });
      file().then(function (f) {
        if (f && w.navigator.canShare && w.navigator.canShare({ files: [f] })) return w.navigator.share({ files: [f], text: SHARE_LINE(n), url: 'https://wholesomegirlies.xyz/' });
        if (f) dl(f);
      }).catch(function () {});
    });
    var sv = mk('button', 'btn btn-ghost', 'Save my card'); sv.type = 'button'; sv.addEventListener('click', function () { file().then(function (f) { if (f) dl(f); }); });
    var bk = mk('button', 'btn btn-ghost', 'Done'); bk.type = 'button'; bk.addEventListener('click', done);
    box.appendChild(sh); box.appendChild(sv); box.appendChild(bk);
    box.appendChild(mk('p', 'wgs-src', SHARE_LINE(n)));
  }

  // ── signed in: the count follows her account ────────────────────────────
  function token() {
    var raw = ls('wg_session_v1'); if (!raw) return '';
    try { var o = JSON.parse(raw); if (o && typeof o === 'object') return String(o.token || ''); if (typeof o === 'string') return o; } catch (e) {}
    return String(raw);
  }
  function api(p, body) {
    var t = token(); if (!t || !w.fetch) return Promise.resolve(null);
    return w.fetch(PAY + p, { method: 'POST', headers: { 'content-type': 'application/json', Authorization: 'Bearer ' + t }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); }).catch(function () { return null; });
  }
  var syncing = false;
  function sync() {
    if (!token() || syncing) return; syncing = true;
    var s = readS();
    var u = readU();
    api('/account/state', { streak: { count: s.count, best: s.best, last_day: s.last_day, rest_used_week: s.rest_used_week } }).then(function (j) {
      syncing = false;
      var r = j && j.ok && j.state && j.state.streak; if (!r) return;
      var l = readS(), changed = false;
      if (+r.best > l.best) { l.best = +r.best; changed = true; }
      if (r.last_day && r.last_day > l.last_day) { l.last_day = r.last_day; l.count = +r.count || l.count; l.rest_used_week = r.rest_used_week || null; changed = true; }
      if (changed) { writeS(l); if (onApp) renderApp(); }
      // A member earns months at 3, 7 and 30 days. The server refuses a streak step until her saved streak reached it, so the
      // steps go only after the state above is saved, one after another. Each step counts once on the server, so a repeat is harmless.
      var chain = Promise.resolve(), known = acct();
      [3, 7, 30].forEach(function (m) {
        if (s.best < m || u.steps[m] || (known && !known.member)) return; // an account that is not a member never asks
        chain = chain.then(function () {
          return api('/member/step', { step: 'streak_' + m }).then(function (res) {
            if (!res) return;
            if (!res.ok && res.error !== 'not_member' && res.error !== 'ended') return; // not_earned or a failure: ask again next time
            var uu = readU(); uu.steps[m] = 1; if (res.ok && res.ends) uu.ends = res.ends; writeU(uu);
          });
        });
      });
    });
  }

  // ── today's card ────────────────────────────────────────────────────────
  var cards = null;
  function loadCards() {
    if (cards) return cards;
    cards = w.fetch ? w.fetch('/assets/data/daily-cards.json?v=' + DATA_V).then(function (r) { return r.json(); }).then(function (j) { return j && j.stages ? j : null; }).catch(function () { return null; }) : Promise.resolve(null);
    return cards;
  }
  function byN(list, n) { for (var i = 0; i < list.length; i++) if (list[i].n === n) return list[i]; return list[list.length - 1]; }
  // Which card, from her stage date. Pure: no storage write, nothing sent. Returns {label, card} or {need:{...}} or null.
  function cardFor(stage, data, at) {
    var S = data && data.stages[stage]; if (!S) return null;
    var t = at || now(), c;
    if (stage === 'relationships') {
      var f = parse(readU().first) || t, day = Math.max(1, between(t, f) + 1);
      return { label: 'Today · day ' + day, card: byN(S.cards, ((day - 1) % S.cards.length) + 1) };
    }
    if (stage === 'fertility') {
      var o = jr('wg_stage_fertility_v1'), lmp = o && o.v === 1 ? parse(o.lmp) || (o.starts && parse(o.starts[o.starts.length - 1])) : null;
      if (!lmp) return { need: { text: 'Add the first day of your last period in the Period Tracker to get a card for your cycle day.', p: '/fertility/tools/period-tracker', l: 'Open the Period Tracker' } };
      var cyc = cycleLen(o), cd = (((between(t, lmp)) % cyc) + cyc) % cyc + 1;
      return { label: 'Today · cycle day ' + cd, card: byN(S.cards, Math.min(cd, 28)) };
    }
    if (stage === 'pregnancy') {
      var p = jr('wg_stage_pregnancy_v1'), due = p && p.v === 1 ? parse(p.due) : null;
      if (!due) return { need: { text: 'Add your due date in the Due Date Calculator to get a card for your week.', p: '/pregnancy/tools/due-date-calculator', l: 'Open the Due Date Calculator' } };
      var ahead = between(due, t); if (ahead < -21 || ahead > 300) return null;
      if (!at && w.WGIdeas && w.WGIdeas.weekModel && !w.WGIdeas.weekModel()) return null; // the "Is this still right?" question comes first
      var wk = Math.floor((280 - ahead) / 7), shown = Math.min(40, Math.max(4, wk));
      return { label: 'Today · week ' + shown, card: byN(S.cards, shown) };
    }
    if (stage === 'postpartum') {
      var pp = jr('wg_stage_postpartum_v1'), del = pp && pp.v === 1 ? parse(pp.delivery) : null;
      if (!del) return { need: { text: 'Add your delivery date in the Recovery Timeline Calculator to get a card for your week.', p: '/postpartum/tools/recovery-timeline-calculator', l: 'Open the Recovery Timeline Calculator' } };
      var since = between(t, del); if (since < 0 || since > 83) return null;
      var pw = Math.floor(since / 7) + 1; return { label: 'Today · week ' + pw, card: byN(S.cards, pw) };
    }
    if (stage === 'parenting') {
      var dob = parse(ls('wg_vax_dob')); if (!dob) return { need: { text: 'Add your baby’s date of birth in the Milestone Tracker to get a card for your baby’s age.', p: '/parenting/tools/milestone-tracker', l: 'Open the Milestone Tracker' } };
      var age = between(t, dob); if (age < 0 || age > 2200) return null;
      var mo = Math.floor(age / 30.4375) + 1;
      if (mo <= 12) return { label: 'Today · month ' + mo, card: byN(S.cards, mo) };
      var yr = Math.floor(age / 365.25) + 1; return { label: 'Today · year ' + yr, card: byN(S.years, Math.min(yr, 5)) };
    }
    return null;
  }
  function cycleLen(o) {
    var st = (o.starts || []).filter(parse).sort(), gaps = [];
    for (var i = Math.max(1, st.length - 6); i < st.length; i++) { var g = between(parse(st[i]), parse(st[i - 1])); if (g >= 18 && g <= 60) gaps.push(g); }
    if (gaps.length >= 2) return Math.round(gaps.reduce(function (a, b) { return a + b; }, 0) / gaps.length);
    var c = +o.cycle; return c >= 21 && c <= 40 ? c : 28;
  }
  var STAGE_OF = { 'wife-material-blueprint': 'relationships', 'trying-to-conceive-blueprint': 'fertility', 'first-pregnancy-plan': 'pregnancy', 'postpartum-reset': 'postpartum', 'first-baby-playbook': 'parenting' };
  var PROG_OF = {}; Object.keys(STAGE_OF).forEach(function (k) { PROG_OF[STAGE_OF[k]] = k; });
  var HOME_STAGE = { wg_relationships_home: 'relationships', wg_fertility_home: 'fertility', wg_pregnancy_home: 'pregnancy', wg_pp_home: 'postpartum', wg_parenting_home: 'parenting' };
  var STAGE_WORD = { relationships: 'Relationships', fertility: 'Fertility', pregnancy: 'Pregnancy', postpartum: 'Postpartum', parenting: 'Parenting' };
  var MOTHER = ['fertility', 'pregnancy', 'postpartum', 'parenting'];

  // ── who she is: free, a First 1,000 member, a buyer, or both ──
  // Read from this phone only: her program flags (wg_<stage>_home, which the bundle writes for all four motherhood stages), her
  // cached account (programs with an end date are the member's free program; the rest were paid for) and the member's end date.
  function acct() { var c = jr('wg_account_v1'); return token() && c && c.v === 1 && c.account ? c.account : null; }
  function memberActive(a) { var m = a && a.member; if (!m) return false; var e = Date.parse(m.ends); return isNaN(e) || e > Date.now(); }
  function slugIn(url) { var m = /\/programs\/([a-z0-9-]+)\/(?:thank-you|read)/.exec(url || ''); return m ? m[1] : ''; }
  function who() {
    var a = acct(), u = readU(), entries = [], gift = {};
    ((a && a.programs) || []).forEach(function (p) { if (p.ends) gift[slugIn(p.home) || p.slug] = 1; });
    Object.keys(HOME_STAGE).forEach(function (k) {
      var v = jr(k), slug = slugIn(v && v.u), stage = HOME_STAGE[k]; if (!slug) return;
      var dia = /-diaspora$/.test(slug) ? '-diaspora' : '', base = slug.replace(/-diaspora$/, ''), bundle = base === 'complete-motherhood-journey';
      if (!bundle && STAGE_OF[base] !== stage) return;
      entries.push({ stage: stage, prog: bundle ? PROG_OF[stage] + dia : slug, bundle: bundle, member: !bundle && !!gift[slug] });
    });
    var member = memberActive(a) || (!!u.ends && Date.parse(u.ends) > Date.now());
    if (member && a && a.member && a.member.stage && PROG_OF[a.member.stage] && !entries.some(function (e) { return e.member || e.stage === a.member.stage; })) {
      entries.push({ stage: a.member.stage, prog: PROG_OF[a.member.stage], bundle: false, member: true });
    }
    var paid = entries.filter(function (e) { return !e.member; }), mem = entries.filter(function (e) { return e.member; });
    var kind = paid.length ? (member || mem.length ? 'both' : 'buyer') : (member || mem.length ? 'member' : 'free');
    return { kind: kind, entries: entries, paid: paid, mem: mem };
  }
  // The stage she is in right now, from the dates only she has. A delivery in the last 12 weeks beats a due date still ahead
  // (a baby that came early), a due date beats a baby's birth date (a new pregnancy), and a due date up to 21 days past comes last.
  function dateStage(stages) {
    var t = now(), has = function (s) { return stages.indexOf(s) > -1; };
    var pr = jr('wg_stage_pregnancy_v1'), due = pr && pr.v === 1 ? parse(pr.due) : null, ahead = due ? between(due, t) : null;
    var pp = jr('wg_stage_postpartum_v1'), del = pp && pp.v === 1 ? parse(pp.delivery) : null, since = del ? between(t, del) : -1;
    var dob = parse(ls('wg_vax_dob')), age = dob ? between(t, dob) : -1;
    if (has('postpartum') && del && since >= 0 && since <= 83) return 'postpartum';
    if (has('pregnancy') && due && ahead >= 0 && ahead <= 300) return 'pregnancy';
    if (has('parenting') && dob && age >= 0 && age <= 2200) return 'parenting';
    if (has('pregnancy') && due && ahead < 0 && ahead >= -21) return 'pregnancy';
    return '';
  }
  // The stage with the most activity (the app home's own appActivity). Off the app home the last answer it gave is used.
  function activityOrder() {
    try {
      if (typeof w.appActivity === 'function' && w.APP_TOOLS && w.APP_DATA && A) {
        var keys = A.savedKeys(), saved = w.APP_TOOLS.filter(function (t) { return w.appHas(keys, t[0]) && w.APP_DATA.tools[t[1]]; }).map(function (t) { return t[1]; });
        return { order: w.appActivity(saved).order, live: true };
      }
    } catch (e) {}
    var c = readU().cur; return { order: c ? [c] : [], live: false };
  }
  function motherStage(stages) {
    var ds = dateStage(stages); if (ds) return ds;
    var order = activityOrder().order.filter(function (s) { return stages.indexOf(s) > -1; });
    if (order.length) return order[0];
    return stages.indexOf('fertility') > -1 ? 'fertility' : stages[0];
  }
  // The plan for her card: who she is, which stage the card follows, and whether she can switch between the two kinds of program.
  function plan() {
    var wh = who(), u = readU(), stages = [];
    wh.entries.forEach(function (e) { if (stages.indexOf(e.stage) < 0) stages.push(e.stage); });
    if (!stages.length) { // free: the stage with the most activity, else the one she picked
      var o = activityOrder().order;
      return { wh: wh, stage: o.length ? o[0] : u.stage || '', canSwitch: false, mode: '' };
    }
    var mom = stages.filter(function (s) { return MOTHER.indexOf(s) > -1; }), rel = stages.indexOf('relationships') > -1;
    if (!mom.length) return { wh: wh, stage: 'relationships', canSwitch: false, mode: 'relationships' };
    if (!rel) return { wh: wh, stage: motherStage(mom), canSwitch: false, mode: 'motherhood' };
    var mode = u.pref || (dateStage(mom) ? 'motherhood' : 'relationships');
    return { wh: wh, stage: mode === 'relationships' ? 'relationships' : motherStage(mom), canSwitch: true, mode: mode };
  }
  function stageOf() { return plan().stage; }
  function entryFor(pl, stage) {
    var list = pl.wh.entries, i;
    for (i = 0; i < list.length; i++) if (list[i].stage === stage && !list[i].member) return list[i];
    for (i = 0; i < list.length; i++) if (list[i].stage === stage) return list[i];
    return list[0] || null;
  }
  function readState(prog) { var o = jr('wg_read_' + prog); return o && o.done ? o : { done: {} }; }
  function doneCount(st) { return Math.max(+st.n || 0, Object.keys(st.done || {}).filter(function (id) { return st.done[id]; }).length); }
  // Where "Open a lesson" goes: her program for the stage the card follows, straight to the lesson up next when she has a place.
  function lessonHref(pl) {
    var e = entryFor(pl, pl.stage); if (!e) return '';
    var st = readState(e.prog);
    return '/programs/' + e.prog + '/read' + (st.nextId && /^[a-z0-9-]+$/.test(st.nextId) ? '#' + st.nextId : '');
  }
  // How many lessons a program has comes from its reader page (data-total), never from a number kept here.
  var totals = {};
  function totalOf(prog, st) {
    if (totals[prog]) return totals[prog];
    var fallback = +st.total || 0;
    totals[prog] = w.fetch ? w.fetch('/programs/' + prog + '/read').then(function (r) { return r.text(); }).then(function (h) {
      var m = /data-total="(\d+)"/.exec(h); return m ? +m[1] : fallback;
    }).catch(function () { return fallback; }) : Promise.resolve(fallback);
    return totals[prog];
  }
  // A buyer's milestone line: how far she is through the program. With one program it reads "12 of 30 lessons". With several
  // (the bundle, or Wife Material plus motherhood) it names the stage: "Pregnancy: 12 of 30 lessons". The bundle follows the stage
  // her card follows; Wife Material plus motherhood follows the program she read most recently.
  function progressFor(pl) {
    var paid = pl.wh.paid; if (!paid.length) return Promise.resolve('');
    var rel = paid.some(function (e) { return e.stage === 'relationships'; }), mom = paid.some(function (e) { return e.stage !== 'relationships'; }), pick = null, i;
    var recent = function () {
      var best = null, at = 0;
      paid.forEach(function (e) { var x = +readState(e.prog).at || 0; if (x > at) { at = x; best = e; } });
      return best;
    };
    if (rel && mom) pick = recent() || entryFor({ wh: { entries: paid } }, pl.stage);
    else { for (i = 0; i < paid.length; i++) if (paid[i].stage === pl.stage) pick = paid[i]; pick = pick || recent() || paid[0]; }
    var st = readState(pick.prog), n = doneCount(st), prefix = paid.length > 1 ? STAGE_WORD[pick.stage] + ': ' : '';
    return totalOf(pick.prog, st).then(function (total) { return total ? prefix + n + ' of ' + total + ' lessons' : ''; });
  }
  function fmt(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  // Localhost only: ?f1kcap=C sets the cap (default 100), ?f1ktaken=T the places taken, ?f1kleft=N the places left. A check only, never on the live site.
  function preview(j) {
    if (!/^(localhost|127\.0\.0\.1)$/.test(w.location.hostname)) return j;
    var c = /[?&]f1kcap=(\d{2,4})/.exec(w.location.search), t = /[?&]f1ktaken=(\d{1,4})/.exec(w.location.search), l = /[?&]f1kleft=(\d{1,4})/.exec(w.location.search);
    if (!c && !t && !l) return j;
    var cap = c ? +c[1] : 100, taken = t ? +t[1] : l ? cap - +l[1] : 0;
    taken = Math.min(cap, Math.max(0, taken));
    return { ok: true, taken: taken, cap: cap, left: cap - taken, open: cap - taken > 0 };
  }
  // A free woman at 7 and 30 days: a First 1,000 place while places are left, her stage's program once they are gone.
  function freeNudge(pl, slot, ov) {
    if (!w.fetch) return;
    w.fetch(PAY + '/first1000/status').then(function (r) { return r.json(); }).then(function (j) {
      j = preview(j);
      if (!j || !j.ok || !ov.isConnected) return;
      var a = mk('a', 'btn btn-primary'), left = +j.left || 0, stage = pl.stage, hasCap = typeof j.cap === 'number';
      if (hasCap && !(j.open && left > 0)) {
        slot.appendChild(mk('p', 'wgs-src', 'All ' + fmt(j.cap) + ' places are taken.'));
        a.href = '/first' + (stage ? '?stage=' + stage : ''); a.appendChild(d.createTextNode('Tell me if a place opens →'));
      } else if (hasCap) {
        slot.appendChild(mk('p', 'wgs-src', 'You could get a program free as one of the first ' + fmt(j.cap) + ' women. ' + fmt(left) + ' of ' + fmt(j.cap) + (left === 1 ? ' places is' : ' places are') + ' left.'));
        a.href = '/first' + (stage ? '?stage=' + stage : ''); a.appendChild(d.createTextNode('Claim my place →'));
      } else {
        slot.appendChild(mk('p', 'wgs-src', stage ? 'The program for your stage goes further.' : 'Every stage has a program that goes further.'));
        a.href = stage && PROG_OF[stage] ? '/programs/' + PROG_OF[stage] : '/programs/'; a.appendChild(d.createTextNode((stage ? 'See the program' : 'See the programs') + ' →'));
      }
      slot.appendChild(a);
    }).catch(function () {});
  }

  // ── the app home card (option B: today's card first, the week strip under it) ──
  function strip(s, u) {
    var row = mk('div', 'wgs-strip'), t = now(), names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (var i = 6; i >= 0; i--) {
      var dt = shift(t, -i), k = iso(dt), cell = mk('div'), dot = mk('span', 'wgs-dot');
      var done = u.days.indexOf(k) > -1 || (k === today() && s.last_day === k);
      if (u.rest === k) { dot.className += ' rest'; dot.setAttribute('aria-label', 'Rest day'); }
      else if (done) { dot.className += ' done'; dot.textContent = '✓'; dot.setAttribute('aria-label', 'Done'); }
      if (i === 0) dot.className += ' today';
      cell.appendChild(dot); cell.appendChild(mk('span', '', i === 0 ? 'Today' : names[dt.getDay()])); row.appendChild(cell);
    }
    return row;
  }
  function sayLine(s, u, doneToday) {
    var t = today();
    if (doneToday) return s.count + (s.count === 1 ? ' day' : ' days') + ' in a row. See you tomorrow. Best: ' + s.best + '.';
    if (s.count > 0) return s.count + (s.count === 1 ? ' day' : ' days') + ' in a row. Read today’s card to make it ' + (s.count + 1) + '. Best: ' + s.best + '.';
    if (u.ended) return 'Your last streak was ' + u.ended + ' days. ' + (u.ended >= s.best ? 'That is your best, and it stays.' : 'Your best is ' + s.best + ', and it stays.') + ' Read today’s card to start a new one.';
    return 'Read today’s card to start your streak.';
  }
  var box = null, picked = false, curPlan = null;
  function host() {
    if (box && box.isConnected) return box;
    var anchor = d.getElementById('appNotice') || d.getElementById('appHandoff'); if (!anchor) return null;
    box = mk('div', 'app-block'); box.id = 'appToday'; anchor.parentNode.insertBefore(box, anchor); return box;
  }
  function renderApp() {
    if (!onApp || quiet()) return;
    var b = host(); if (!b) return;
    style();
    var st = settle(), s = st.s, u = st.u, t = today(), doneToday = s.last_day === t;
    var signed = !!token(), blocked = A && A.remembering && !A.remembering() && !signed;
    var firstOpen = !s.best && !s.last_day && (!u.rule || (u.rule === t && !u.first));
    if (!u.rule) { u.rule = t; writeU(u); }
    b.innerHTML = ''; b.hidden = false;
    loadCards().then(function (data) {
      b.innerHTML = '';
      var pl = plan(), stage = pl.stage, res = data && stage ? cardFor(stage, data) : null;
      curPlan = pl;
      if (pl.wh.entries.length && stage && u.cur !== stage) { var uc = readU(); uc.cur = stage; writeU(uc); }
      var card = mk('div', 'card wgs-today'); card.setAttribute('data-wgs', 'today');
      if (blocked) {
        var oc = mk('div', 'card wgs-today'); oc.setAttribute('data-wgs', 'turn-on');
        oc.appendChild(mk('h3', '', 'Your streak'));
        oc.appendChild(mk('p', 'muted', 'Your streak cannot be kept on this phone, because “Remember on this device” is off in your privacy choices.'));
        var on = mk('button', 'btn btn-primary', 'Turn it on'); on.type = 'button';
        on.addEventListener('click', function () {
          var c = w.WGConsent; if (c && c.apply) c.apply({ analytics: c.state.analytics, advertising: c.state.advertising, remember: true });
          try { if (w.appRender) w.appRender(); } catch (e) {}
        });
        oc.appendChild(on);
        if (res && res.card) card.appendChild(todayBody(res, s, u, doneToday, false));
        if (res && res.card) b.appendChild(card);
        b.appendChild(oc); return;
      }
      if (firstOpen) { // the day 1 rule, shown once
        var rc = mk('div', 'card wgs-today wgs-rule'); rc.setAttribute('data-wgs', 'rule');
        rc.appendChild(mk('h3', '', 'Start your streak'));
        rc.appendChild(mk('p', 'muted', 'Open the app and do one thing a day. Any of these counts:'));
        var ul = mk('ul'), lessons = pl.wh.entries.length ? lessonHref(pl) : '';
        ['Read today’s card for your stage', 'Use a tool', lessons ? 'Open a lesson' : '', 'Play a game'].forEach(function (x) {
          if (!x) return;
          var li = mk('li');
          if (x === 'Open a lesson') { var la = mk('a', '', x); la.href = lessons; la.setAttribute('data-wgs', 'lesson'); li.appendChild(la); } else li.textContent = x;
          ul.appendChild(li);
        }); rc.appendChild(ul);
        rc.appendChild(mk('p', 'muted', 'Miss one day a week and your streak is safe.'));
        b.appendChild(rc);
        if (res && res.card) { card.appendChild(todayBody(res, s, u, doneToday, false)); b.appendChild(card); }
        else if (!res || res.need) pickOrNeed(b, res);
        return;
      }
      if (res && (res.card || res.need)) { card.appendChild(todayBody(res, s, u, doneToday, true)); b.appendChild(card); }
      else {
        if (!stage) pickOrNeed(b, null);
        if (s.best || s.count || u.rest) { card.appendChild(streakOnly(s, u, doneToday)); b.appendChild(card); }
      }
    });
  }
  function pickOrNeed(b, res) {
    var c = mk('div', 'card wgs-today'); c.setAttribute('data-wgs', res && res.need ? 'need' : 'pick');
    if (res && res.need) { c.appendChild(mk('p', '', res.need.text)); var a = mk('a', 'btn btn-primary'); a.href = res.need.p; a.appendChild(d.createTextNode(res.need.l + ' →')); c.appendChild(a); b.appendChild(c); return; }
    c.appendChild(mk('h3', '', 'Which stage are you in?')); c.appendChild(mk('p', 'muted', 'Pick one to see today’s card.'));
    var row = mk('div', 'wgs-pick');
    // The same stops, emoji and plain words as the stage picker on /tools/.
    [['relationships', 'Relationships', '💛', 'Dating or in love', 'rust'], ['fertility', 'Fertility', '🌱', 'Trying for a baby', 'olive'], ['pregnancy', 'Pregnancy', '🤰🏾', 'I am pregnant', 'mustard'], ['postpartum', 'Postpartum', '🤱🏾', 'I just gave birth', 'peach'], ['parenting', 'Parenting', '👶🏾', 'I am raising children', 'denim']].forEach(function (x) {
      var bt = mk('button', 'wgs-stop'); bt.type = 'button';
      bt.style.setProperty('--c', 'var(--' + x[4] + ')'); bt.style.setProperty('--t', 'var(--' + x[4] + '-t)');
      var dot = mk('span', 'wgs-dot', x[2]); dot.setAttribute('aria-hidden', 'true'); bt.appendChild(dot); bt.appendChild(mk('b', '', x[1])); bt.appendChild(mk('small', '', x[3]));
      bt.addEventListener('click', function () { var u = readU(); u.stage = x[0]; writeU(u); renderApp(); }); row.appendChild(bt);
    });
    c.appendChild(row); b.appendChild(c);
  }
  function restLine(f, s, u) {
    var y = iso(shift(now(), -1));
    if (u.rest && u.rest === y) f.appendChild(mk('p', 'wgs-src', 'You missed ' + parse(y).toLocaleDateString('en-GB', { weekday: 'long' }) + ', so we used this week’s rest day. Your ' + s.count + '-day streak is safe.'));
  }
  function streakOnly(s, u, doneToday) {
    var f = d.createDocumentFragment();
    f.appendChild(strip(s, u)); restLine(f, s, u); f.appendChild(mk('p', 'wgs-count', sayLine(s, u, doneToday))); return f;
  }
  function todayBody(res, s, u, doneToday, full) {
    var f = d.createDocumentFragment();
    if (res.need) {
      f.appendChild(mk('p', '', res.need.text)); var na = mk('a', 'btn btn-primary'); na.href = res.need.p; na.appendChild(d.createTextNode(res.need.l + ' →')); f.appendChild(na);
    } else {
      f.appendChild(mk('p', 'eyebrow', res.label));
      f.appendChild(mk('p', '', res.card.t));
      var slot = mk('p'), go = function () { var a = mk('a', 'btn btn-primary'); a.href = res.card.p; a.appendChild(d.createTextNode(res.card.l + ' →')); slot.innerHTML = ''; slot.appendChild(a); };
      if (doneToday) go();
      else {
        var rb = mk('button', 'btn btn-primary'); rb.type = 'button'; rb.appendChild(d.createTextNode('Read today’s card →'));
        rb.addEventListener('click', function () { record('card'); }); slot.appendChild(rb);
      }
      f.appendChild(slot);
      f.appendChild(mk('p', 'wgs-src', 'Educational, not medical advice.'));
    }
    if (curPlan && curPlan.canSwitch) {
      var sw = mk('p', 'wgs-src'), sa = mk('a', '', curPlan.mode === 'relationships' ? 'Switch to motherhood' : 'Switch to relationships');
      sa.href = '#'; sa.setAttribute('data-wgs', 'switch');
      sa.addEventListener('click', function (e) { e.preventDefault(); var uu = readU(); uu.pref = curPlan.mode === 'relationships' ? 'motherhood' : 'relationships'; writeU(uu); renderApp(); });
      sw.appendChild(sa); f.appendChild(sw);
    }
    if (full) {
      f.appendChild(strip(s, u));
      restLine(f, s, u);
      f.appendChild(mk('p', 'wgs-count', sayLine(s, u, doneToday)));
    }
    return f;
  }

  // ── what counts as a useful action ──────────────────────────────────────
  function hooks() {
    ['wgShowResult', 'wgPlayed'].forEach(function (name) {
      var f = w[name]; if (typeof f !== 'function' || f.wgsHooked) return;
      var h = function (type) { var r = f.apply(this, arguments); if (name === 'wgPlayed' || type) record(name); return r; };
      h.wgsHooked = true; w[name] = h;
    });
  }
  hooks(); d.addEventListener('DOMContentLoaded', hooks); w.addEventListener('load', hooks);
  d.addEventListener('wg:saved', function () { record('saved'); });
  d.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.rd-done'); if (!b) return;
    var main = d.querySelector('.rd'), id = b.getAttribute('data-lesson');
    setTimeout(function () { var st = jr('wg_read_' + (main && main.getAttribute('data-program'))); if (st && st.done && st.done[id]) record('lesson'); }, 0);
  });

  function boot() {
    var st = settle();
    if (st.s.last_day) sync();
    if (!quiet()) setTimeout(maybeSheet, 1200);
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();

  if (onApp && typeof w.appRender === 'function') {
    var orig = w.appRender;
    w.appRender = function () { var r = orig.apply(this, arguments); try { renderApp(); } catch (e) {} return r; };
    if (d.readyState !== 'loading') renderApp();
  }

  w.WGStreak = {
    record: record, settle: settle, read: readS, ui: readU, cardFor: cardFor, stageOf: stageOf, plan: plan, who: who, progressFor: progressFor, loadCards: loadCards, isoWeek: isoWeek,
    sheet: sheet, today: today, onRecord: function (f) { onRecord.push(f); }, token: token, render: renderApp
  };
})(window, document);
