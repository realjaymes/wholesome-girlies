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
 * Today's card comes from assets/data/daily-cards.json and is chosen here, on her phone, from her saved stage date. No date,
 * week or stage is sent anywhere. The only analytics event is streak_milestone with the number of days.
 * Both keys are skipped by TOOL_KEY in wg-app.js (a streak write is not a saved entry), and the backup keeps them.
 * Text goes in with textContent, never innerHTML.
 */
(function (w, d) {
  'use strict';
  var A = w.WGApp || null;
  var PAY = 'https://wg-pay.realjaymes.workers.dev';
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
      toast: o.toast || '', pending: +o.pending || 0, ended: +o.ended || 0, rule: o.rule || '', stage: o.stage || '', steps: o.steps || {}, ends: o.ends || '' };
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
      '.wgs-rule ul{margin:8px 0 10px;padding-left:20px}.wgs-pick{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.wgs-pick button{margin:0}';
    d.head.appendChild(s);
  }
  function toast(n) {
    style();
    var old = d.querySelector('.wgs-toast'); if (old) old.remove();
    var el = mk('div', 'wgs-toast', 'Day ' + n + ' done. See you tomorrow.'); el.setAttribute('role', 'status');
    d.body.appendChild(el); setTimeout(function () { el.remove(); }, 3000);
  }
  var MCOPY = { 3: ['Three days is when a habit starts to hold.', 1], 7: ['You showed up for yourself every day this week.', 1], 14: ['Two weeks in a row. That is a habit now.', 0], 30: ['A full month. You kept coming back.', 1] };
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
      box.appendChild(mk('p', 'wgs-src', 'First 1,000 member: ' + (MONTHS[n] > 1 ? MONTHS[n] + ' months' : '1 month') + ' added.' + (when ? ' Your access now runs to ' + when + '.' : '')));
    }
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
    api('/account/state', { streak: { count: s.count, best: s.best, last_day: s.last_day, rest_used_week: s.rest_used_week } }).then(function (j) {
      syncing = false;
      var r = j && j.ok && j.state && j.state.streak; if (!r) return;
      var l = readS(), changed = false;
      if (+r.best > l.best) { l.best = +r.best; changed = true; }
      if (r.last_day && r.last_day > l.last_day) { l.last_day = r.last_day; l.count = +r.count || l.count; l.rest_used_week = r.rest_used_week || null; changed = true; }
      if (changed) { writeS(l); if (onApp) renderApp(); }
    });
    // A member earns months at 3, 7 and 30 days. Each step counts once on the server, so a repeat is harmless.
    var u = readU();
    [3, 7, 30].forEach(function (m) {
      if (s.best < m || u.steps[m]) return;
      api('/member/step', { step: 'streak_' + m }).then(function (j) {
        if (!j) return;
        var uu = readU(); uu.steps[m] = 1; if (j.ok && j.ends) uu.ends = j.ends; writeU(uu);
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
  var MOTHER = ['fertility', 'pregnancy', 'postpartum', 'parenting'];
  // Her stage: the stage of her program, else the stage with the most activity (the app home's own appActivity), else the one she picked.
  function stageOf() {
    var progs = A && A.programs ? A.programs() : [], bundle = false, fromProg = '';
    progs.forEach(function (p) {
      var slug = ((p.u || '').match(/^\/programs\/([a-z0-9-]+)\//) || [])[1] || '', base = slug.replace(/-diaspora$/, '');
      if (base === 'complete-motherhood-journey') bundle = true; else if (!fromProg && STAGE_OF[base]) fromProg = STAGE_OF[base];
    });
    if (fromProg && !bundle) return fromProg;
    try {
      if (typeof w.appActivity === 'function' && w.APP_TOOLS && w.APP_DATA && A) {
        var keys = A.savedKeys(), saved = w.APP_TOOLS.filter(function (t) { return w.appHas(keys, t[0]) && w.APP_DATA.tools[t[1]]; }).map(function (t) { return t[1]; });
        var order = w.appActivity(saved).order.filter(function (s) { return !bundle || MOTHER.indexOf(s) > -1; });
        if (order.length) return order[0];
      }
    } catch (e) {}
    return readU().stage || '';
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
  var box = null, picked = false;
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
      var stage = stageOf(), res = data && stage ? cardFor(stage, data) : null;
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
        var ul = mk('ul'); ['Read today’s card for your stage', 'Use a tool', 'Open a lesson', 'Play a game'].forEach(function (x) { ul.appendChild(mk('li', '', x)); }); rc.appendChild(ul);
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
    c.appendChild(mk('h3', '', 'Which stage are you in?')); c.appendChild(mk('p', 'muted', 'Pick one and today’s card follows it.'));
    var row = mk('div', 'wgs-pick');
    [['relationships', 'Relationships'], ['fertility', 'Fertility'], ['pregnancy', 'Pregnancy'], ['postpartum', 'Postpartum'], ['parenting', 'Parenting']].forEach(function (x) {
      var bt = mk('button', 'btn btn-ghost', x[1]); bt.type = 'button';
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
    record: record, settle: settle, read: readS, ui: readU, cardFor: cardFor, stageOf: stageOf, loadCards: loadCards, isoWeek: isoWeek,
    sheet: sheet, today: today, onRecord: function (f) { onRecord.push(f); }, token: token, render: renderApp
  };
})(window, document);
