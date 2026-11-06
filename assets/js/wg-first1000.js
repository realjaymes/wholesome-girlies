/* Wholesome Girlies: The First 1,000. Two jobs, one file, each only on its own page. The landing page and its claim form
 * are wg-first1000-form.js.
 *   /first/welcome  the thank-you page: her end date, her program and the two steps she can finish now.
 *   /app/                WGFirst1000.todayStep(): the member's one next step; WGFirst1000.stepsCard(): the full list of ways to earn
 *                        months, shown behind "See every way to earn months". The visitor offer is no longer here: the rule book
 *                        (wg-next.js) decides who sees the offer and draws the one card.
 * Everything is written with textContent or .value. Her stage and steps go to the payment server and never to the dataLayer:
 * events carry no stage, date or entry.
 */
(function (w, d) {
  'use strict';
  if (!w.WGAccess) return;
  var PROGRAMS = {
    relationships: ['The Wife Material Blueprint', 'wife-material-blueprint'],
    fertility: ['The Trying-to-Conceive Blueprint', 'trying-to-conceive-blueprint'],
    pregnancy: ['The First Pregnancy Plan', 'first-pregnancy-plan'],
    postpartum: ['The 6-Week Postpartum Reset', 'postpartum-reset'],
    parenting: ['The First Baby Playbook', 'first-baby-playbook']
  };
  var STEPS = [ // key, label, months, today's step line, button. The order is the order of her next step.
    ['app_saved', 'Add the app', 1, 'Save the app. It adds one month.', 'Save the app'],
    ['first_finish', 'Finish your first lesson', 1, 'Finish your first lesson. It adds one month.', 'Open lesson 1'],
    ['streak_3', '3 days in a row', 1, 'Come back 3 days in a row. It adds one month.', 'Do today’s lesson'],
    ['streak_7', '7 days in a row', 1, 'Come back 7 days in a row. It adds one month.', 'Do today’s lesson'],
    ['feedback_d7', 'Tell us what you think on day 7', 2, 'Tell us what you think. It adds 2 months.', 'Give feedback'],
    ['telegram', 'Join our Telegram group', 1, 'Join our Telegram group. It adds one month.', 'Join the group'],
    ['streak_30', '30 days in a row', 2, 'Come back 30 days in a row. It adds 2 months.', 'Do today’s lesson']
  ];
  function $(id) { return d.getElementById(id); }
  function fmtN(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function el(tag, cls, text) { var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmtDate(v) {
    var t = new Date(v); if (isNaN(t)) return '';
    return t.getDate() + ' ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][t.getMonth()];
  }
  function isDone(m, k) { var s = m && m.steps; if (!s) return false; return Array.isArray(s) ? s.indexOf(k) >= 0 : !!s[k]; }
  // Months earned: one for the claim, the steps she finished, 2 for each friend step the server added (friend_1 to friend_3) and
  // 3 for the interview step (the server adds both). The server caps the total at 12. A months number from the server wins.
  function months(m) {
    if (m && typeof m.months === 'number') return m.months;
    var n = 1; STEPS.forEach(function (s) { if (isDone(m, s[0])) n += s[2]; });
    ['friend_1', 'friend_2', 'friend_3'].forEach(function (k) { if (isDone(m, k)) n += 2; });
    if (isDone(m, 'interview')) n += 3;
    return Math.min(12, n);
  }
  // Day 7 after her claim opens the feedback step. On localhost ?f1kday=N pretends today is day N (a check only, never on the live site).
  function dayOf(m) {
    var c = m && m.steps && !Array.isArray(m.steps) ? Date.parse(m.steps.claim) : NaN;
    if (isNaN(c)) return 0;
    var q = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) ? /[?&]f1kday=(\d{1,3})/.exec(location.search) : null;
    if (q) return +q[1];
    return Math.floor((Date.now() - c) / 86400000) + 1;
  }
  function inviteLink(m) {
    var v = m && m.invite ? String(m.invite) : ''; if (!v) return '';
    return /^https?:\/\//.test(v) ? v : 'https://wholesomegirlies.xyz/first?invite=' + encodeURIComponent(v);
  }

  // ── welcome ──
  function welcome() {
    var m = WGAccess.member(), nm = WGAccess.name(), a = WGAccess.account();
    if (!WGAccess.signedIn()) { $('wTitle').textContent = 'Sign in to see your place'; $('wLine').textContent = 'Sign in with the email you used to claim it.'; $('wSteps').hidden = true; return; }
    $('wTitle').textContent = 'You are in' + (nm ? ', ' + nm : '');
    var prog = a && a.programs && a.programs[0], pname = '';
    if (m && PROGRAMS[m.stage]) pname = PROGRAMS[m.stage][0];
    var ends = m && m.ends ? fmtDate(m.ends) : '';
    $('wLine').textContent = (pname || 'Your program') + ' is yours free' + (ends ? ' until ' + ends : '') + '. It is open on this phone now.';
    var open = $('wOpen'); open.setAttribute('href', prog && prog.home ? prog.home : (m && PROGRAMS[m.stage] ? '/programs/' + PROGRAMS[m.stage][1] + '/thank-you' : '/app/'));
    if (WGAccess.email()) $('wMail').textContent = 'We emailed ' + WGAccess.email() + ' how to sign in on another phone.';
  }

  // ── app home ──
  // On localhost the status answer can be previewed (?f1kcap=C&f1ktaken=T or ?f1kleft=N): see wg-next.js.
  var seq = 0;
  // The member's one next step: the first step she has not finished, in the order of STEPS. Feedback opens on day 7.
  // Returns {key, line, btn, href, action} or null when every step is done.
  function todayStep(m) {
    m = m || WGAccess.member(); if (!m) return null;
    var reader = m.stage && PROGRAMS[m.stage] ? '/programs/' + PROGRAMS[m.stage][1] + '/read' : '/app/';
    for (var i = 0; i < STEPS.length; i++) {
      var s = STEPS[i];
      if (isDone(m, s[0])) continue;
      if (s[0] === 'feedback_d7' && dayOf(m) < 7) continue;
      var r = { key: s[0], line: s[3], btn: s[4], href: reader, action: '' };
      if (s[0] === 'app_saved') { r.href = '#appInstallBox'; r.action = 'install'; }
      else if (s[0] === 'feedback_d7') r.href = '/first/feedback';
      else if (s[0] === 'telegram') r.href = 'https://t.me/wholesomegirlies';
      return r;
    }
    return null;
  }
  // The full list of ways to earn months, with the invite link. Drawn into `host`.
  function stepsCard(host) {
    var run = ++seq;
    host.textContent = ''; host.hidden = true;
    if (WGAccess.signedIn() && !WGAccess.account()) return;
    var m = WGAccess.member(); if (!m) return;
    var card = el('section', 'card f1k-app'); card.setAttribute('aria-label', 'Every way to earn months');
    card.appendChild(el('h2', '', 'Every way to earn months'));
    card.appendChild(el('p', 'meta', (m.ends ? 'Your program is free until ' + fmtDate(m.ends) + '.' : 'Your program is free for one month.') + ' You have earned ' + months(m) + ' of 12 months.'));
    var ul = el('ul'); var first = el('li', 'done'); first.appendChild(el('span', '', 'Claim your place')); first.appendChild(el('b', '', '1')); ul.appendChild(first);
    STEPS.slice().sort(function (a, b) { return ['app_saved', 'first_finish', 'telegram', 'streak_3', 'streak_7', 'streak_30', 'feedback_d7'].indexOf(a[0]) - ['app_saved', 'first_finish', 'telegram', 'streak_3', 'streak_7', 'streak_30', 'feedback_d7'].indexOf(b[0]); }).forEach(function (s) {
      var done = isDone(m, s[0]), li = el('li', done ? 'done' : '');
      if (s[0] === 'feedback_d7' && !done) {
        li.setAttribute('data-f1k-step', 'feedback_d7');
        if (dayOf(m) >= 7) { var fa = el('a', '', s[1]); fa.href = '/first/feedback'; li.appendChild(fa); }
        else { var sp = el('span', '', s[1]); sp.appendChild(el('small', '', 'Opens on day 7')); li.appendChild(sp); }
      } else li.appendChild(el('span', '', s[1]));
      li.appendChild(el('b', '', '+' + s[2])); ul.appendChild(li);
    });
    card.appendChild(ul);
    var link = inviteLink(m);
    if (link) {
      card.appendChild(el('p', '', 'You earn 2 months for each friend who joins, up to 3 friends.'));
      var row = el('div', 'row');
      var wa = el('a', 'btn btn-primary', 'Send on WhatsApp'); wa.target = '_blank'; wa.rel = 'noopener';
      wa.href = 'https://wa.me/?text=' + encodeURIComponent('I am getting a Wholesome Girlies program free as one of the first women. You can too: ' + link);
      var cp = el('button', 'btn btn-ghost', 'Copy my invite link'); cp.type = 'button';
      cp.addEventListener('click', function () { try { navigator.clipboard.writeText(link).then(function () { cp.textContent = 'Copied'; }); } catch (e) {} });
      row.appendChild(wa); row.appendChild(cp); card.appendChild(row);
    }
    host.appendChild(card); host.hidden = false;
  }
  w.WGFirst1000 = { todayStep: todayStep, stepsCard: stepsCard, months: months, fmtDate: fmtDate, dayOf: dayOf, isDone: isDone };

  d.addEventListener('DOMContentLoaded', function () {
    if ($('f1kWelcome')) welcome();
  });
})(window, document);
