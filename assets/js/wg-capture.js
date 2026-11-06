/* Wholesome Girlies: the email capture points, the calendar file and Web Push (CLAUDE.md section 10, "Capture points").
 *
 * Loaded on every page after wg-streak.js (scripts/add-app-tags.py). Each capture point asks for her email at a moment when
 * it gives her something, and posts to the payment server's POST /subscribe with consent:true and its source:
 *   due_date_result, period_result, ovulation_result, recovery_result, vaccination_result, milestone_result   list stage_weekly (needs her stage)
 *   guide_bar                                                                                                list stage_weekly
 *   game_result                                                                                              list games
 *   desktop_card                                                                                             list app_link
 *   streak_reminder                                                                                          list streak_reminder (or Web Push)
 * No date, week or entry ever goes in a request. A stage form sends the stage word only, and carries the consent line
 * (stage is health data). The analytics event is capture_submit with capture_point and nothing else.
 * wg_capture_v1 = {"v":1,"lists":["stage_weekly:pregnancy","games"],"bar":<ms>} holds list names and the time the guide bar was
 * closed. It never holds an email. A list she already joined on this phone never shows its card again.
 * Date based reminders by email or push are not built (a decision for James and the lawyer). The calendar file is different:
 * it is made on her phone, by this script, and downloaded or opened there. Nothing is sent anywhere.
 * Quiet pages (loss, mental health, warning signs) show none of it. Text goes in with textContent, never innerHTML.
 */
(function (w, d) {
  'use strict';
  var A = w.WGApp || null;
  var PAY = 'https://wg-pay.realjaymes.workers.dev';
  var CAP = 'wg_capture_v1', PUSHK = 'wg_push_v1';
  var path = w.location.pathname.replace(/\.html$/, '').replace(/\/index$/, '/');
  var bare = path.replace(/\/$/, '');
  var QUIET_RX = /mind-check-in|the-wait-check-in|warning-signs|loss|miscarriage|stillbirth|when-to-take-your-baby-to-hospital/;
  function quiet() { return (A && A.quiet ? A.quiet() : false) || QUIET_RX.test(path); }
  function ls(k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } }
  function lset(k, v) { try { w.localStorage.setItem(k, v); } catch (e) {} }
  function jr(k) { try { var o = JSON.parse(ls(k) || 'null'); return o && typeof o === 'object' ? o : null; } catch (e) { return null; } }
  function push(o) { try { (w.dataLayer = w.dataLayer || []).push(o); } catch (e) {} }
  function mk(tag, cls, text) { var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function qa(name) { return new RegExp('[?&]' + name + '=1\\b').test(w.location.search); }

  // ── what she already joined, on this phone ──────────────────────────────
  function cap() { var o = jr(CAP); return o && o.v === 1 ? { v: 1, lists: Array.isArray(o.lists) ? o.lists : [], bar: +o.bar || 0 } : { v: 1, lists: [], bar: 0 }; }
  function joined(token) { return cap().lists.indexOf(token) > -1; }
  function join(token) { var c = cap(); if (c.lists.indexOf(token) < 0) c.lists.push(token); lset(CAP, JSON.stringify(c)); }
  function barClosed() { var c = cap(); c.bar = Date.now(); lset(CAP, JSON.stringify(c)); }

  function style() {
    if (d.getElementById('wgc-css')) return;
    var s = mk('style'); s.id = 'wgc-css';
    s.textContent =
      '.wgc-card{margin:18px 0 0;text-align:left;clear:both}.wgc-card h3{margin:0 0 6px}.wgc-card p{margin:0 0 10px}.wgc-card .muted,.wgc-note{color:var(--plum-soft,#66645A);font-size:.88rem}' +
      '.wgc-form{display:grid;gap:10px;margin:10px 0 0}.wgc-form input[type=email]{width:100%;box-sizing:border-box;padding:12px 14px;font:inherit;border:2px solid var(--ink,#33322A);border-radius:12px;background:#fff}' +
      '.wgc-form .btn{justify-self:start}.app-install.no-btn .wgc-form .btn{display:inline-flex}.wgc-consent{display:flex;gap:8px;align-items:flex-start;font-size:.86rem;line-height:1.4;color:var(--plum-soft,#66645A)}.wgc-consent input{margin-top:3px;flex:none}' +
      '.wgc-msg{font-weight:800;margin:8px 0 0}.wgc-cal{margin:14px 0 0}' +
      '.wgc-bar{position:fixed;left:12px;right:12px;bottom:calc(var(--wg-nav-h,66px) + 12px);z-index:880;max-width:560px;margin:0 auto;background:#fff;border:2px solid var(--ink,#33322A);border-radius:16px;box-shadow:var(--sticker-sm,3px 3px 0 #33322A);padding:12px 14px;max-height:70vh;overflow:auto}' +
      '.wgc-bar-row{display:flex;gap:10px;align-items:center}.wgc-bar-row p{margin:0;flex:1;font-weight:800;font-size:.95rem;line-height:1.3}' +
      '.wgc-x{flex:none;width:36px;height:36px;border:0;background:none;font-size:1.4rem;line-height:1;color:var(--plum-soft,#66645A);cursor:pointer;border-radius:50%}' +
      '.wgc-sheet{position:fixed;inset:0;z-index:975;background:rgba(51,50,42,.45);display:flex;align-items:flex-end;justify-content:center}' +
      '.wgc-in{background:#FBF8EF;border-radius:22px 22px 0 0;padding:24px 20px 28px;width:100%;max-width:560px;max-height:90vh;overflow:auto}.wgc-in h3{margin:0 0 6px}.wgc-in p{margin:0 0 12px}';
    d.head.appendChild(s);
  }

  // ── the form ────────────────────────────────────────────────────────────
  var CONSENT = 'I agree that Wholesome Girlies keeps my stage to send me these emails. Stop any time.';
  // opts: list, source, stage (for stage_weekly), token (the list name remembered), button, onDone
  function form(opts) {
    style();
    var f = mk('form', 'wgc-form'); f.noValidate = true; f.setAttribute('data-capture', opts.source);
    var em = mk('input'); em.type = 'email'; em.name = 'email'; em.autocomplete = 'email'; em.placeholder = 'you@gmail.com'; em.setAttribute('aria-label', 'Your email'); em.required = true;
    f.appendChild(em);
    var tick = null;
    if (opts.stage) {
      var lab = mk('label', 'wgc-consent'); tick = mk('input'); tick.type = 'checkbox'; tick.required = true;
      lab.appendChild(tick); var sp = mk('span', '', CONSENT + ' '); var a = mk('a', '', 'How we handle health data'); a.href = '/legal/consumer-health-data'; sp.appendChild(a); lab.appendChild(sp);
      f.appendChild(lab);
    }
    var bt = mk('button', 'btn btn-primary', opts.button); bt.type = 'submit'; f.appendChild(bt);
    var msg = mk('p', 'wgc-msg'); msg.setAttribute('role', 'status'); msg.hidden = true; f.appendChild(msg);
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = em.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { msg.hidden = false; msg.textContent = 'Please type your email address.'; em.focus(); return; }
      if (tick && !tick.checked) { msg.hidden = false; msg.textContent = 'Please tick the box to agree.'; return; }
      bt.disabled = true; msg.hidden = false; msg.textContent = 'Sending.';
      var body = { email: v, list: opts.list, consent: true, source: opts.source };
      if (opts.stage) body.stage = opts.stage;
      w.fetch(PAY + '/subscribe', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || !j.ok) throw new Error('no');
          join(opts.token); push({ event: 'capture_submit', capture_point: opts.source });
          f.innerHTML = ''; var ok = mk('p', 'wgc-msg', opts.done || 'Thank you. Check your email.'); ok.setAttribute('role', 'status'); f.appendChild(ok);
          if (opts.onDone) opts.onDone();
        })
        .catch(function () { bt.disabled = false; msg.textContent = 'We could not send that. Please try again.'; });
    });
    return f;
  }

  // ── 1. under a tool result: the weekly email for her stage ──────────────
  var WEEKLY = {
    '/pregnancy/tools/due-date-calculator': ['pregnancy', 'due_date_result', 'Your pregnancy, one email a week', 'What changes this week for you and your baby, which tools help, and when to see a doctor.', 'Your due date stays on this phone. Each email links back here, and the app shows your exact week.'],
    '/fertility/tools/period-tracker': ['fertility', 'period_result', 'Trying for a baby, one email a week', 'What to look at each week while you try, which tools help, and when to see a doctor.', 'Your dates stay on this phone. Each email links back here.'],
    '/fertility/tools/ovulation-calculator': ['fertility', 'ovulation_result', 'Trying for a baby, one email a week', 'What to look at each week while you try, which tools help, and when to see a doctor.', 'Your dates stay on this phone. Each email links back here.'],
    '/postpartum/tools/recovery-timeline-calculator': ['postpartum', 'recovery_result', 'Your recovery, one email a week', 'What changes in your recovery this week, which tools help, and when to see a doctor.', 'Your delivery date stays on this phone. Each email links back here.'],
    '/parenting/tools/vaccination-tracker': ['parenting', 'vaccination_result', 'Your baby, one email a week', 'What to look at as your baby grows, which tools help, and when to see a doctor.', 'Your baby’s date of birth stays on this phone. Each email links back here.'],
    '/parenting/tools/milestone-tracker': ['parenting', 'milestone_result', 'Your baby, one email a week', 'What to look at as your baby grows, which tools help, and when to see a doctor.', 'Your baby’s date of birth stays on this phone. Each email links back here.']
  };
  function weeklyCard(cfg) {
    var token = 'stage_weekly:' + cfg[0];
    if (joined(token)) return null;
    var c = mk('div', 'card wgc-card'); c.setAttribute('data-wgc', 'weekly');
    c.appendChild(mk('h3', '', cfg[2])); c.appendChild(mk('p', 'muted', cfg[3]));
    c.appendChild(form({ list: 'stage_weekly', source: cfg[1], stage: cfg[0], token: token, button: 'Send me the weekly email', done: 'Thank you. Check your email to finish.' }));
    c.appendChild(mk('p', 'wgc-note', cfg[4]));
    return c;
  }

  // The calendar file. Built here, on her phone, from the dates already on the page. Nothing is sent anywhere.
  function ics(lmpStr, cyc) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(lmpStr || ''); if (!m) return '';
    var lmp = new Date(+m[1], +m[2] - 1, +m[3]), t = new Date(); t = new Date(t.getFullYear(), t.getMonth(), t.getDate());
    var P = function (n) { return (n < 10 ? '0' : '') + n; };
    var ymd = function (dt) { return dt.getFullYear() + P(dt.getMonth() + 1) + P(dt.getDate()); };
    var add = function (dt, n) { return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n); };
    var esc = function (s) { return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n'); };
    var fold = function (line) { var out = []; while (line.length > 73) { out.push(line.slice(0, 73)); line = ' ' + line.slice(73); } out.push(line); return out.join('\r\n'); };
    var stamp = (function () { var n = new Date(); return n.getUTCFullYear() + P(n.getUTCMonth() + 1) + P(n.getUTCDate()) + 'T' + P(n.getUTCHours()) + P(n.getUTCMinutes()) + P(n.getUTCSeconds()) + 'Z'; })();
    var TAIL = ' Estimate only. Educational, not medical advice.';
    var events = [], n = 0;
    function ev(title, desc, start, end, link) {
      n++;
      var L = ['BEGIN:VEVENT', 'UID:girlies-' + stamp + '-' + n + '@wholesomegirlies.xyz', 'DTSTAMP:' + stamp, 'DTSTART;VALUE=DATE:' + ymd(start), 'DTEND;VALUE=DATE:' + ymd(add(end, 1)),
        'SUMMARY:' + esc(title), 'DESCRIPTION:' + esc(desc + TAIL + ' Details: https://wholesomegirlies.xyz' + link), 'URL:https://wholesomegirlies.xyz' + link,
        'BEGIN:VALARM', 'ACTION:DISPLAY', 'DESCRIPTION:' + esc(title), 'TRIGGER:-P2D', 'END:VALARM', 'END:VEVENT'];
      events.push(L.map(fold).join('\r\n'));
    }
    for (var k = 1; k <= 3; k++) { var p = add(lmp, cyc * k); ev('Girlies reminder', 'Your next period may start around this day.', p, p, '/fertility/tools/period-tracker'); }
    var j = 1, ov = add(lmp, cyc * j - 14);
    while (add(ov, 1) < t && j < 40) { j++; ov = add(lmp, cyc * j - 14); } // the next window that is not over yet
    ev('Girlies: window', 'Your estimated fertile window.', add(ov, -5), add(ov, 1), '/fertility/tools/ovulation-calculator');
    ev('Girlies: window', 'Your most likely day of ovulation.', ov, ov, '/fertility/tools/ovulation-calculator');
    return ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Wholesome Girlies//Reminders//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH'].concat(events, ['END:VCALENDAR']).join('\r\n') + '\r\n';
  }
  function deliver(text) {
    var ios = A ? A.ios : /iPhone|iPad|iPod/.test(w.navigator.userAgent), standalone = A ? A.standalone : false;
    if (ios && standalone) { w.location.href = 'data:text/calendar;charset=utf-8,' + encodeURIComponent(text); return; } // the installed iPhone app: a blob link does not open there
    var u = URL.createObjectURL(new Blob([text], { type: 'text/calendar;charset=utf-8' }));
    if (ios) { w.location.href = u; return; } // iPhone Safari hands a calendar file to Calendar
    var a = mk('a'); a.href = u; a.download = 'girlies-reminders.ics'; d.body.appendChild(a); a.click(); a.remove();
    setTimeout(function () { URL.revokeObjectURL(u); }, 4000);
  }
  function calButton() {
    var wrap = mk('div', 'wgc-cal'), b = mk('button', 'btn btn-ghost', 'Add to my calendar'); b.type = 'button'; b.setAttribute('data-wgc-cal', '1');
    b.addEventListener('click', function () {
      var lmp = (d.getElementById('lmp') || {}).value, cs = w.WGStage && w.WGStage.fertility ? w.WGStage.fertility.effectiveCycle() : null;
      var cyc = cs && cs.source === 'average' ? cs.days : parseInt((d.getElementById('cyc') || {}).value, 10) || 28;
      var text = ics(lmp, cyc); if (!text) return;
      deliver(text); push({ event: 'calendar_add' });
    });
    wrap.appendChild(b); wrap.appendChild(mk('p', 'wgc-note', 'Your phone makes the file. Nothing is sent to us.'));
    return wrap;
  }
  function resultCards() {
    var cfg = WEEKLY[bare]; if (!cfg || quiet()) return;
    var res = d.getElementById('res'), isCycle = /period-tracker|ovulation-calculator/.test(bare);
    function sync() {
      var card = d.querySelector('[data-wgc="weekly"]'), cal = d.querySelector('.wgc-cal');
      var on = res ? res.classList.contains('show') : !!(w.WGStage && w.WGStage.parenting && w.WGStage.parenting.read());
      if (!on) { if (card) card.remove(); if (cal) cal.remove(); return; }
      if (isCycle && res && !cal) res.appendChild(calButton());
      if (!card) {
        var c = weeklyCard(cfg); if (!c) return;
        if (res) res.parentNode.insertBefore(c, res.nextSibling);
        else { var app = d.querySelector('.tool-app'); if (app) app.appendChild(c); }
      }
    }
    if (res && w.MutationObserver) new MutationObserver(sync).observe(res, { attributes: true, attributeFilter: ['class'] });
    d.addEventListener('wg:saved', function () { setTimeout(sync, 300); });
    sync();
  }

  // ── 2. the guide bar: a minute of reading and past half the page ────────
  function guideBar() {
    var m = bare.match(/^\/(relationships|fertility|pregnancy|postpartum|parenting)\/guides\/[a-z0-9-]+$/);
    if (!m || quiet() || w.sessionStorage.getItem('wg_capture_bar')) return;
    var stage = m[1], token = 'stage_weekly:' + stage;
    if (joined(token) || Date.now() - cap().bar < 14 * 864e5) return;
    var need = qa('wg_bar') ? 2 : 60, active = 0, last = Date.now(), past = false, done = false;
    var touch = function () { last = Date.now(); };
    ['scroll', 'touchstart', 'pointerdown', 'keydown', 'mousemove'].forEach(function (ev) { w.addEventListener(ev, touch, { passive: true }); });
    function half() { var h = d.documentElement; return (w.scrollY + w.innerHeight) / Math.max(1, h.scrollHeight) > 0.5; }
    w.addEventListener('scroll', function () { if (half()) past = true; }, { passive: true });
    var timer = setInterval(function () {
      if (done) return clearInterval(timer);
      if (d.visibilityState === 'visible' && Date.now() - last < 15000) active++;
      if (active >= need && past) {
        if (d.documentElement.classList.contains('show--consent') || d.querySelector('.wg-app-bar,.wgs-sheet')) return; // wait while something else is open
        done = true; clearInterval(timer); show();
      }
    }, 1000);
    function show() {
      try { w.sessionStorage.setItem('wg_capture_bar', '1'); } catch (e) {}
      style();
      var bar = mk('div', 'wgc-bar'); bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Weekly email');
      var row = mk('div', 'wgc-bar-row'), t = mk('p', '', 'Get one ' + stage + ' email a week'), yes = mk('button', 'btn btn-primary', 'Yes please'); yes.type = 'button';
      var x = mk('button', 'wgc-x', '×'); x.type = 'button'; x.setAttribute('aria-label', 'Close');
      row.appendChild(t); row.appendChild(yes); row.appendChild(x); bar.appendChild(row);
      yes.addEventListener('click', function () {
        yes.remove(); t.textContent = 'Where should we send it?';
        bar.appendChild(form({ list: 'stage_weekly', source: 'guide_bar', stage: stage, token: token, button: 'Send me the weekly email', done: 'Thank you. Check your email to finish.', onDone: function () { setTimeout(function () { bar.remove(); }, 3500); } }));
      });
      x.addEventListener('click', function () { bar.remove(); barClosed(); });
      d.body.appendChild(bar);
    }
  }

  // ── 3. a finished game ──────────────────────────────────────────────────
  var games = null;
  function isGame() {
    if (!games) games = w.fetch ? w.fetch('/assets/data/games.json?v=20261106a').then(function (r) { return r.json(); }).then(function (j) { return (j.games || []).map(function (g) { return g.path; }); }).catch(function () { return []; }) : Promise.resolve([]);
    return games.then(function (list) { return list.indexOf(bare) > -1; });
  }
  function gameCapture() {
    if (quiet() || !/^\/[a-z]+\/tools\/[a-z0-9-]+$/.test(bare)) return;
    var after = function () {
      setTimeout(function () {
        var share = d.getElementById('wg-result-share');
        if (!share || share.hidden || joined('games') || d.querySelector('[data-wgc="game"]')) return;
        isGame().then(function (yes) {
          if (!yes || d.querySelector('[data-wgc="game"]')) return;
          style();
          var c = mk('div', 'card wgc-card'); c.setAttribute('data-wgc', 'game');
          c.appendChild(mk('h3', '', 'Get the next game first')); c.appendChild(mk('p', 'muted', 'A new game most weeks. One email when it is out.'));
          c.appendChild(form({ list: 'games', source: 'game_result', token: 'games', button: 'Tell me', done: 'Thank you. We will email you when the next game is out.' }));
          share.parentNode.insertBefore(c, share.nextSibling);
        });
      }, 900);
    };
    var hook = function () {
      ['wgShowResult', 'wgPlayed'].forEach(function (name) {
        var f = w[name]; if (typeof f !== 'function' || f.wgcHooked) return;
        var h = function (type) { var r = f.apply(this, arguments); if (name === 'wgPlayed' || type) after(); return r; }; h.wgcHooked = true; w[name] = h;
      });
    };
    hook(); d.addEventListener('DOMContentLoaded', hook); w.addEventListener('load', hook);
  }

  // ── 4. a computer: email me the link ────────────────────────────────────
  function desktopCard() {
    if ((A && (A.phone || A.standalone)) || joined('app_link')) return;
    var host = null, pagePath = path;
    if (/^\/app\/?$/.test(pagePath)) host = d.getElementById('appInstall');
    else if (pagePath === '/') host = d.getElementById('homeApp');
    if (!host) return;
    var put = function () {
      if (host.querySelector('[data-wgc="link"]')) return;
      style();
      var c = mk('div', 'wgc-card'); c.setAttribute('data-wgc', 'link');
      c.appendChild(mk('p', '', 'Or we send the link to your phone'));
      c.appendChild(form({ list: 'app_link', source: 'desktop_card', token: 'app_link', button: 'Email me the link', done: 'Thank you. Check your email for the link.' }));
      c.appendChild(mk('p', 'wgc-note', 'We will email the link once. Stop any time.'));
      host.appendChild(c); if (host.parentNode && host.parentNode.hidden) host.parentNode.hidden = false;
    };
    // the homepage card is added by wg-app.js on DOMContentLoaded
    if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', function () { setTimeout(put, 50); }); else setTimeout(put, 50);
  }

  // ── 5. Web Push, on the installed app ───────────────────────────────────
  var pushCfg = null;
  function loadPush() {
    if (!pushCfg) pushCfg = w.fetch ? w.fetch('/assets/data/push.json?v=20261106a').then(function (r) { return r.json(); }).catch(function () { return null; }) : Promise.resolve(null);
    return pushCfg;
  }
  function iosVersion() { var m = /OS (\d+)_(\d+)/.exec(w.navigator.userAgent); return m ? +m[1] + (+m[2] / 100) : 0; }
  // Only where it works: the installed app on Android, and on iPhone with iOS 16.4 or later.
  function pushOK() {
    if (!A || !A.standalone || !('serviceWorker' in w.navigator) || !('PushManager' in w) || !('Notification' in w)) return false;
    return A.android || (A.ios && iosVersion() >= 16.04);
  }
  function pushReady() { return pushOK() ? loadPush().then(function (c) { return c && c.VAPID_PUBLIC_KEY && c.VAPID_PUBLIC_KEY !== 'REPLACE_AT_DEPLOY' ? c.VAPID_PUBLIC_KEY : ''; }) : Promise.resolve(''); }
  function b64(s) { var p = '='.repeat((4 - s.length % 4) % 4), r = atob((s + p).replace(/-/g, '+').replace(/_/g, '/')), o = new Uint8Array(r.length); for (var i = 0; i < r.length; i++) o[i] = r.charCodeAt(i); return o; }
  function bearer() { return w.WGStreak && w.WGStreak.token ? w.WGStreak.token() : ''; }
  function enablePush() {
    return pushReady().then(function (key) {
      if (!key) return false;
      return w.Notification.requestPermission().then(function (p) {
        if (p !== 'granted') return false;
        return w.navigator.serviceWorker.ready.then(function (reg) {
          return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
        }).then(function (sub) {
          var h = { 'content-type': 'application/json' }, t = bearer(); if (t) h.Authorization = 'Bearer ' + t;
          return w.fetch(PAY + '/push/subscribe', { method: 'POST', headers: h, body: JSON.stringify({ subscription: sub.toJSON(), hour: 20, tz: (Intl.DateTimeFormat().resolvedOptions().timeZone || '') }) });
        }).then(function () { lset(PUSHK, JSON.stringify({ v: 1, on: 1 })); push({ event: 'push_opt_in' }); return true; });
      });
    }).catch(function () { return false; });
  }
  // On each app open: tell the server she is here, so no reminder goes out that day.
  function pushSeen() {
    var o = jr(PUSHK); if (!o || !o.on || !pushOK() || w.sessionStorage.getItem('wg_capture_seen')) return;
    try { w.sessionStorage.setItem('wg_capture_seen', '1'); } catch (e) {}
    w.navigator.serviceWorker.ready.then(function (reg) { return reg.pushManager.getSubscription(); }).then(function (sub) {
      if (sub) w.fetch(PAY + '/push/seen', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ endpoint: sub.endpoint }) }).catch(function () {});
    }).catch(function () {});
  }
  d.addEventListener('wg:notify-optin', function () { enablePush(); }); // the "Make the app yours" sheet fires this

  // ── 6. the streak reminder sheet, at day 3 ──────────────────────────────
  function reminderSheet() {
    if (quiet() || joined('streak_reminder') || (jr(PUSHK) || {}).on || d.querySelector('.wgc-sheet')) return;
    style();
    var ov = mk('div', 'wgc-sheet'), box = mk('div', 'wgc-in'); box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
    box.appendChild(mk('h3', '', 'Keep your 3-day streak'));
    box.appendChild(mk('p', 'muted', 'Want a reminder at 8pm on days you have not opened the app yet?'));
    var close = function () { ov.remove(); };
    pushReady().then(function (key) {
      if (key) {
        var pb = mk('button', 'btn btn-primary', 'Send me a phone notification'); pb.type = 'button';
        pb.addEventListener('click', function () { enablePush().then(function (ok) { if (ok) { box.innerHTML = ''; box.appendChild(mk('h3', '', 'Done')); box.appendChild(mk('p', 'muted', 'We will remind you at 8pm on days you have not opened the app.')); var c = mk('button', 'btn btn-ghost', 'Close'); c.type = 'button'; c.addEventListener('click', close); box.appendChild(c); } }); });
        box.insertBefore(pb, box.children[2] || null);
        box.insertBefore(mk('p', 'wgc-note', 'Or by email'), pb.nextSibling);
      }
    });
    box.appendChild(form({ list: 'streak_reminder', source: 'streak_reminder', token: 'streak_reminder', button: 'Email me reminders', done: 'Thank you. Check your email to finish.', onDone: function () { setTimeout(close, 3000); } }));
    box.appendChild(mk('p', 'wgc-note', 'One reminder a day at most. Stop any time.'));
    var no = mk('button', 'btn btn-ghost', 'Not now'); no.type = 'button'; no.addEventListener('click', close); box.appendChild(no);
    ov.addEventListener('click', function (e) { if (e.target === ov) close(); });
    ov.appendChild(box); d.body.appendChild(ov);
  }
  d.addEventListener('wg:streak-sheet-closed', function (e) { if (e.detail && e.detail.days === 3) setTimeout(reminderSheet, 400); });

  function boot() { resultCards(); guideBar(); gameCapture(); desktopCard(); pushSeen(); }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', boot); else boot();

  w.WGCapture = { ics: ics, enablePush: enablePush, pushOK: pushOK, reminderSheet: reminderSheet, joined: joined };
})(window, document);
