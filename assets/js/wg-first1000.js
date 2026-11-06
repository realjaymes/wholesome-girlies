/* Wholesome Girlies: The First 1,000. Two jobs, one file, each only on its own page. The landing page and its claim form
 * are wg-first1000-form.js.
 *   /first-1000/welcome  the thank-you page: her end date, her program and the two steps she can finish now.
 *   /app/                #appFirst: the "Earn more free months" card for a member, or a short offer for a visitor
 *                        who holds no program, while places are left. The offer waits until her status is known (her account
 *                        has loaded, or her program flags are read) and is never shown to a member or a buyer.
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
  var STEPS = [ // key, label, months
    ['app_saved', 'Add the app', 1], ['first_finish', 'Finish your first lesson', 1], ['telegram', 'Join our Telegram group', 1],
    ['streak_3', '3 days in a row', 1], ['streak_7', '7 days in a row', 1], ['streak_30', '30 days in a row', 2], ['feedback_d7', 'Tell us what you think on day 7', 2]
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
    return /^https?:\/\//.test(v) ? v : 'https://wholesomegirlies.xyz/first-1000?invite=' + encodeURIComponent(v);
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
  // On localhost the status answer can be previewed (?f1kleft=N, or ?f1kround=R&f1kroundtaken=M): see wg-access.js.
  var seq = 0;
  // Any program flag on this phone (the bundle writes all four motherhood keys), or any program in her account.
  function holdsProgram() {
    try { for (var i = 0; i < localStorage.length; i++) { if (/^wg_.*_home$/.test(localStorage.key(i)) && localStorage.getItem(localStorage.key(i))) return true; } } catch (e) {}
    var a = WGAccess.account();
    return !!(a && (a.member || (a.programs && a.programs.length)));
  }
  function appCard() {
    var host = $('appFirst'); if (!host) return;
    var run = ++seq;
    host.textContent = ''; host.hidden = true;
    // Her status is unknown while she is signed in and her account has not loaded: show nothing until it does (wg:account runs this again).
    if (WGAccess.signedIn() && !WGAccess.account()) return;
    var m = WGAccess.member();
    if (m) {
      var card = el('section', 'card f1k-app'); card.setAttribute('aria-label', 'Earn more free months');
      card.appendChild(el('h2', '', 'Earn more free months'));
      card.appendChild(el('p', 'meta', (m.ends ? 'Your program is free until ' + fmtDate(m.ends) + '.' : 'Your program is free for one month.') + ' You have earned ' + months(m) + ' of 12 months.'));
      var ul = el('ul'); var first = el('li', 'done'); first.appendChild(el('span', '', 'Claim your place')); first.appendChild(el('b', '', '1')); ul.appendChild(first);
      STEPS.forEach(function (s) {
        var done = isDone(m, s[0]), li = el('li', done ? 'done' : '');
        if (s[0] === 'feedback_d7' && !done) {
          li.setAttribute('data-f1k-step', 'feedback_d7');
          if (dayOf(m) >= 7) { var fa = el('a', '', s[1]); fa.href = '/first-1000/feedback'; li.appendChild(fa); }
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
        wa.href = 'https://wa.me/?text=' + encodeURIComponent('I am getting a Wholesome Girlies program free as one of the first 1,000 women. You can too: ' + link);
        var cp = el('button', 'btn btn-ghost', 'Copy my invite link'); cp.type = 'button';
        cp.addEventListener('click', function () { try { navigator.clipboard.writeText(link).then(function () { cp.textContent = 'Copied'; }); } catch (e) {} });
        row.appendChild(wa); row.appendChild(cp); card.appendChild(row);
      }
      host.appendChild(card); host.hidden = false; return;
    }
    // A visitor who holds no program sees the offer while places are left. A buyer, a member, and a woman who bought on another
    // phone (her signed-in account lists the program) never do. A signed-out visitor on a new phone cannot be told apart, so the
    // card carries a sign-in link, and the claim route refuses an email that already owns a program and sends her to sign in.
    if (holdsProgram()) return;
    WGAccess.first1000.status().then(function (s) {
      if (run !== seq || holdsProgram() || (WGAccess.signedIn() && !WGAccess.account())) return;
      if (!s || !(s.left > 0)) return; // all 1,000 places are gone: no offer
      var card = el('section', 'card f1k-app f1k-offer'); card.appendChild(el('h2', '', 'Get a program free'));
      var round = typeof s.round === 'number', roundFull = round && !s.round_open;
      if (roundFull) {
        // The open round is full: say so and point to the waiting list on the First 1,000 page.
        card.appendChild(el('p', '', 'Round ' + s.round + ' is full. The next round opens soon.'));
        var wl = el('a', 'btn btn-primary', 'Tell me when it opens →'); wl.href = '/first-1000'; card.appendChild(wl);
        host.appendChild(card); host.hidden = false; return;
      }
      if (!s.open) return;
      var rl = round ? s.round_left : s.left, rs = round ? s.round_size : 1000;
      card.appendChild(el('p', '', 'This offer is for the first 1,000 women. ' + (round ? 'Round ' + s.round + ' is open: ' + fmtN(rl) + ' of ' + fmtN(rs) + (rl === 1 ? ' places is' : ' places are') + ' left.' : fmtN(s.left) + (s.left === 1 ? ' place is' : ' places are') + ' left.')));
      var a = el('a', 'btn btn-primary', 'Claim my place →'); a.href = '/first-1000'; card.appendChild(a);
      var si = el('p', 'muted'); si.appendChild(d.createTextNode('Already bought? ')); var sl = el('a', '', 'Sign in'); sl.href = '/signin/'; si.appendChild(sl); card.appendChild(si);
      host.appendChild(card); host.hidden = false;
    });
  }

  d.addEventListener('DOMContentLoaded', function () {
    if ($('f1kWelcome')) welcome();
    appCard();
    d.addEventListener('wg:account', appCard);
  });
})(window, document);
