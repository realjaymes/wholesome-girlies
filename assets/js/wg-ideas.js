/* Wholesome Girlies: the cards that read what is on her phone (CLAUDE.md section 10; vault "Site & App Logic").
 *
 * Loaded on every page after wg-app.js. Each card has a rule, and shows nothing when the rule says nothing:
 *   1. Stage check        app home and the date tools: a due date within 3 weeks asks "Is this still right?" (it only asks; once she
 *                         confirms, the rule book in wg-next.js moves her stage on and the one offer follows it)
 *   2. This week          weekModel() gives the stretch the app home's today card uses (the app home no longer draws a week card)
 *   8. Storage notice     app home, iPhone browser tab only: her browser may clear what she saved
 *  10. Continue in stage  tool pages: two tools in her stage she has not used, under a result or a saved tool
 * No program is sold from this file: the single offer slot belongs to WGNext (wg-next.js).
 * Everything is read on the device. No date, week, band, stage or entry goes to the dataLayer, a URL or a share line;
 * the few events here name a target program or a surface only. Cards show nothing on the quiet pages (loss, warning
 * signs, the check-ins), which WGApp.quiet() knows. Text goes in with textContent, never innerHTML.
 */
(function (w, d) {
  'use strict';
  var A = w.WGApp;
  if (!A) return;
  var DAY = 864e5;
  var path = w.location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
  var bare = path.replace(/\/$/, '');
  var onApp = /^\/app\/?$/.test(path);
  var DATA_V = '20261012a';
  // The words (approved copy). The member offer is always said as a percentage, never a price.
  var C = {
    forget: 'Forget my due date', checkQ: 'Is this still right?',
    checkBody: 'Your saved due date is {DATE}, so please confirm it before we show planning for after the birth.',
    checkKeep: 'Yes, keep it', checkGone: 'The date has been removed from this phone.',
    notice: 'Your browser on this iPhone may clear what you have saved on Wholesome Girlies. You can add Wholesome Girlies to your home screen and save a backup.',
    noticeInstall: 'Add to home screen', noticeBackup: 'Save a backup',
  };

  // ── small helpers ──────────────────────────────────────────────────────
  function ls(k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } }
  function jr(k) { try { return JSON.parse(ls(k) || 'null'); } catch (e) { return null; } }
  function push(o) { try { (w.dataLayer = w.dataLayer || []).push(o); } catch (e) {} }
  function mk(tag, cls, text) { var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(text, href, cls) { var a = mk('a', cls || 'btn btn-primary'); a.href = href; a.innerHTML = ''; a.appendChild(d.createTextNode(text + ' →')); return a; }
  function fill(s, v) { return String(s).replace(/\{(\w+)\}/g, function (m, k) { return v && v[k] != null ? v[k] : m; }); }
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    if (!m) return null;
    var dt = new Date(+m[1], +m[2] - 1, +m[3]);
    return dt.getFullYear() === +m[1] && dt.getMonth() === +m[2] - 1 && dt.getDate() === +m[3] && +m[1] >= 2000 && +m[1] <= 2100 ? dt : null;
  }
  function daysTo(s) { // whole days from today to the date (negative = past); null for a bad date
    var dt = parseDate(s); if (!dt) return null;
    var n = new Date(); n = new Date(n.getFullYear(), n.getMonth(), n.getDate());
    return Math.round((dt - n) / DAY);
  }
  function nice(s) { var dt = parseDate(s); return dt ? dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : s; }
  function style() {
    if (d.getElementById('wgi-css')) return;
    var s = mk('style'); s.id = 'wgi-css';
    s.textContent = '.wgi-card{margin:0;text-align:left}.wgi-card .eyebrow{margin:0 0 6px}.wgi-card h3{margin:0 0 6px}.wgi-card p{margin:0 0 12px}' +
      '.wgi-card p.wgi-note{font-size:.92rem;margin-top:12px;padding-top:12px;border-top:1px dashed var(--line,#E3E0CF)}' +
      '.wgi-card .wgi-link{display:block;margin:6px 0 0;padding:0;background:none;border:0;font:inherit;font-size:.88rem;font-weight:700;color:var(--terracotta,#6E7A3F);text-decoration:underline;cursor:pointer}' +
      '.wgi-card .wgi-lbl{margin:14px 0 6px;font-size:.78rem;font-weight:800;letter-spacing:.05em;text-transform:uppercase;color:var(--plum-soft,#66645A)}' +
      '.wgi-card .ph-tools{margin:0 0 6px}.wgi-wrap{margin-top:14px;margin-bottom:6px}.wgi-sec{padding-top:8px;padding-bottom:8px}' +
      '.wgi-next{padding:14px 16px}.wgi-next .wgi-lbl{margin-top:0}.wgi-next .wgi-tools{display:grid;gap:6px}.wgi-next .wgi-tools a{display:block;padding:9px 12px;border:2px solid var(--ink,#33322A);border-radius:12px;background:var(--st,#E3E6CC);color:var(--ink,#33322A);font-weight:700;font-size:.92rem;text-decoration:none}';
    d.head.appendChild(s);
  }
  function card(id, cls) { style(); var c = mk('div', 'card wgi-card ' + (cls || '')); c.setAttribute('data-wgi', id); return c; }

  // ── who she is, from her phone ────────────────────────────────────────
  function who() {
    var N = w.WGNext, S = N && N.state ? N.state() : null;
    return {
      count: S ? Object.keys(S.own).length : 0, bundle: !!(S && S.bundle),
      owns: function (stage) { return !!(S && S.own[stage]); }
    };
  }
  function region() { return w.WGConsent && w.WGConsent.region; }
  function dates() {
    var out = { due: null, dueStr: '', delivery: null, dob: null };
    var f = jr('wg_stage_pregnancy_v1');
    if (f && f.v === 1) { var a = daysTo(f.due); if (a !== null && Math.abs(a) <= 300) { out.due = a; out.dueStr = f.due; } }
    var pp = jr('wg_stage_postpartum_v1');
    if (pp && pp.v === 1) { var b = daysTo(pp.delivery); if (b !== null && b <= 0 && b >= -365) out.delivery = -b; }
    var c = daysTo(ls('wg_vax_dob')); if (c !== null && c <= 0 && c >= -2200) out.dob = -c;
    return out;
  }
  function forgetDue() {
    try { if (w.WGStage && w.WGStage.clear) w.WGStage.clear('pregnancy'); else w.localStorage.removeItem('wg_stage_pregnancy_v1'); } catch (e) {}
    try { w.localStorage.removeItem('wg_stage_check_v1'); } catch (e) {}
  }

  // ── idea 1: stage hand-off ────────────────────────────────────────────
  // A saved due date can belong to a pregnancy that ended in loss, and the device cannot know. So the first time a due date
  // would trigger the card, she is asked "Is this still right?" instead, and the planning card waits for Keep. The answer is
  // stored per due date in wg_stage_check_v1 ({v, due}), which the install bar ignores (TOOL_KEY in wg-app.js).
  // Only the question is asked here. Once she has said the date is right, the rule book moves her stage on (WGNext.moved) and the
  // one offer for her new stage appears wherever the offer slot is; nothing is sold from this card.
  function handoff() {
    if (A.quiet && A.quiet()) return null;
    var D = dates(), W = who();
    if (D.due === null || D.due > 21 || D.due < -21) return null;
    if (W.owns('postpartum')) return null;
    var chk = jr('wg_stage_check_v1');
    if (chk && chk.v === 1 && chk.due === D.dueStr) return null;
    return { kind: 'pp', dueStr: D.dueStr, ask: true };
  }
  var DATE_TOOLS = { pp: ['/pregnancy/tools/due-date-calculator', '/pregnancy/tools/week-by-week-tracker'] };
  function handoffCard(h) {
    var c = card('handoff');
    c.appendChild(mk('h3', '', C.checkQ));
    c.appendChild(mk('p', 'muted', fill(C.checkBody, { DATE: nice(h.dueStr) })));
    var keep = mk('button', 'btn btn-primary', C.checkKeep); keep.type = 'button';
    keep.addEventListener('click', function () {
      try { w.localStorage.setItem('wg_stage_check_v1', JSON.stringify({ v: 1, due: h.dueStr })); } catch (e) {}
      if (onApp && w.appRender) w.appRender(); else { c.remove(); }
    });
    var no = mk('button', 'wgi-link', C.forget); no.type = 'button';
    no.addEventListener('click', function () { forgetDue(); c.innerHTML = ''; c.appendChild(mk('p', 'muted', C.checkGone)); c.setAttribute('role', 'status'); if (onApp && w.appRender) setTimeout(w.appRender, 900); });
    c.appendChild(keep); c.appendChild(no);
    return c;
  }

  // ── idea 2: This week ─────────────────────────────────────────────────
  function weekModel() {
    var Wk = w.WGWeeks, D = dates();
    if (!Wk || (A.quiet && A.quiet())) return null;
    var band = '', wk = null;
    if (D.dob !== null) band = Wk.babyBand(D.dob);
    else if (D.delivery !== null) band = D.delivery <= 42 ? 'pp' : Wk.babyBand(D.delivery);
    else if (D.due !== null) {
      if (D.due < -21) return null;
      var h = handoff(); if (h && h.ask) return null; // the question comes first; the week waits for her answer
      wk = Wk.weekFromDue(D.dueStr); if (wk === null || wk < 0) return null;
      band = Wk.pregnancyBand(wk);
    } else return null;
    return band ? { band: band, week: wk } : null;
  }
  // ── idea 8: storage notice (iPhone browser tab only) ──────────────────
  function noticeCard() {
    if (!A.ios || A.standalone || !w.APP_TOOLS) return null;
    var keys = A.savedKeys(), hasDate = ['wg_stage_fertility_v1', 'wg_stage_pregnancy_v1', 'wg_stage_postpartum_v1', 'wg_vax_dob'].some(function (k) { return keys.indexOf(k) > -1; });
    var seen = {}, tools = w.APP_TOOLS.filter(function (t) {
      return w.appHas(keys, t[0]) && !/^wg_stage_|^wg_vax_dob$/.test(t[0]) && !seen[t[0]] && (seen[t[0]] = 1);
    }).length;
    if (!hasDate && tools < 3) return null;
    var c = card('notice');
    c.appendChild(mk('p', '', C.notice));
    var i = mk('button', 'btn btn-primary', C.noticeInstall); i.type = 'button'; i.addEventListener('click', function () { A.install('storage_notice'); });
    var b = mk('button', 'btn btn-ghost', C.noticeBackup); b.type = 'button';
    b.addEventListener('click', function () { A.downloadBackup(); if (w.appSay) w.appSay('Backup saved. Keep the file somewhere you can find it, like Files or Google Drive.'); });
    c.appendChild(i); c.appendChild(b);
    return c;
  }

  // ── the app home ──────────────────────────────────────────────────────
  function put(id, node) {
    var box = d.getElementById(id); if (!box) return;
    box.innerHTML = ''; box.hidden = !node;
    if (node) { box.appendChild(node); if (w.WGIcons) w.WGIcons.draw(box); }
  }
  function appHome() {
    if (!onApp) return;
    var h = handoff();
    put('appNotice', noticeCard());
    put('appHandoff', h ? handoffCard(h) : null);
  }

  // ── pages other than the app home ─────────────────────────────────────
  function placeAfter(host, node) {
    var wrap = mk('div', 'wrap narrow wgi-wrap'); wrap.appendChild(node); host.parentNode.insertBefore(wrap, host.nextSibling); return wrap;
  }
  function toolPages() {
    var hero = d.querySelector('.tool-hero');
    if (!hero) return;
    var h = handoff();
    if (h && DATE_TOOLS[h.kind].indexOf(bare) > -1) placeAfter(hero, handoffCard(h));
    nextInStage(hero);
  }

  // ── idea 10: Continue in your stage ───────────────────────────────────
  var QUIET_TOOL = /mind-check-in|the-wait-check-in|warning-signs|loss|miscarriage|stillbirth/;
  var toolData = null;
  function loadTools() {
    if (toolData) return toolData;
    toolData = w.fetch ? fetch('/assets/data/app-tools.json?v=' + DATA_V).then(function (r) { return r.json(); }).then(function (j) { return j && j.keys && j.stages && j.names ? j : null; }).catch(function () { return null; }) : Promise.resolve(null);
    return toolData;
  }
  function nextInStage(hero) {
    var m = bare.match(/^\/(relationships|fertility|pregnancy|postpartum|parenting)\/tools\/[a-z0-9-]+$/);
    if (!m || (A.quiet && A.quiet()) || QUIET_TOOL.test(bare)) return;
    var stage = m[1], box = null;
    function has(key) {
      if (key.slice(-1) !== '_') return ls(key) !== null;
      try { for (var i = 0; i < w.localStorage.length; i++) if (w.localStorage.key(i).indexOf(key) === 0) return true; } catch (e) {}
      return false;
    }
    function render(host) {
      loadTools().then(function (D) {
        if (!D) return;
        var played = jr('wg_played_v1') || {}, done = {};
        D.keys.forEach(function (r) { if (has(r[0])) done[r[1]] = 1; });
        var next = (D.stages[stage] || []).filter(function (p) { return p !== bare && !done[p] && !played[p] && !QUIET_TOOL.test(p); }).slice(0, 2);
        if (box) { box.remove(); box = null; }
        if (!next.length) return;
        var c = card('next', 'wgi-next'); c.appendChild(mk('p', 'wgi-lbl', C.nextLabel));
        var list = mk('div', 'wgi-tools');
        next.forEach(function (p) { var a = mk('a', '', D.names[p] || p); a.href = p; list.appendChild(a); });
        c.appendChild(list);
        if (host === 'result') { var r = d.getElementById('wg-result-share'); if (r && !r.hidden) { r.parentNode.insertBefore(c, r.nextSibling); box = c; return; } }
        box = placeAfter(hero, c);
      });
    }
    // A saved tool: when she opens it with an entry saved, and again the moment she saves one.
    loadTools().then(function (D) {
      if (!D) return;
      var mine = D.keys.filter(function (r) { return r[1] === bare; });
      if (mine.some(function (r) { return has(r[0]); })) render('hero');
    });
    var t = null;
    d.addEventListener('wg:saved', function () { clearTimeout(t); t = setTimeout(function () { render('hero'); }, 700); });
    // A finished game or quiz: under its result.
    var after = function () { setTimeout(function () { render('result'); }, 300); };
    if (typeof w.wgShowResult === 'function') { var sr = w.wgShowResult; w.wgShowResult = function (type) { var r = sr.apply(this, arguments); if (type) after(); return r; }; }
    if (typeof w.wgPlayed === 'function') { var wp = w.wgPlayed; w.wgPlayed = function () { var r = wp.apply(this, arguments); after(); return r; }; }
  }

  d.addEventListener('DOMContentLoaded', function () {
    if (onApp) return; // the app home draws its cards from appRender(), which calls WGIdeas.appHome()
    if (/^\/(relationships|fertility|pregnancy|postpartum|parenting)\/tools\/[a-z0-9-]+$/.test(bare)) toolPages();
  });

  w.WGIdeas = { appHome: appHome, handoff: handoff, weekModel: weekModel, dates: dates };
})(window, document);
