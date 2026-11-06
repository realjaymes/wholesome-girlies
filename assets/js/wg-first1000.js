/* Wholesome Girlies: The First 1,000. Two jobs, one file, each only on its own page. The landing page and its claim form
 * are wg-first1000-form.js.
 *   /first-1000/welcome  the thank-you page: her end date, her program and the two steps she can finish now.
 *   /app/                #appFirst: the "Your First 1,000 steps" card for a member, or a one-line offer for a visitor
 *                        who holds no program, while places are left.
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
  function el(tag, cls, text) { var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function fmtDate(v) {
    var t = new Date(v); if (isNaN(t)) return '';
    return t.getDate() + ' ' + ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][t.getMonth()];
  }
  function isDone(m, k) { var s = m && m.steps; if (!s) return false; return Array.isArray(s) ? s.indexOf(k) >= 0 : !!s[k]; }
  function months(m) {
    if (m && typeof m.months === 'number') return m.months;
    var n = 1; STEPS.forEach(function (s) { if (isDone(m, s[0])) n += s[2]; });
    n += 2 * Math.min(3, (m && (m.invited || m.invites)) | 0);
    return Math.min(12, n);
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
  function appCard() {
    var host = $('appFirst'); if (!host) return;
    host.textContent = '';
    var m = WGAccess.member();
    if (m) {
      var card = el('section', 'card f1k-app'); card.setAttribute('aria-label', 'Your First 1,000 steps');
      card.appendChild(el('h2', '', 'Your First 1,000 steps'));
      var meta = el('div', 'meta'); meta.appendChild(el('span', '', m.ends ? 'Your free month runs until ' + fmtDate(m.ends) : 'You have one free month')); meta.appendChild(el('span', '', 'You have earned ' + months(m) + ' of 12 months')); card.appendChild(meta);
      var ul = el('ul'); var first = el('li', 'done'); first.appendChild(el('span', '', 'Claim your place')); first.appendChild(el('b', '', '1')); ul.appendChild(first);
      STEPS.forEach(function (s) { var li = el('li', isDone(m, s[0]) ? 'done' : ''); li.appendChild(el('span', '', s[1])); li.appendChild(el('b', '', '+' + s[2])); ul.appendChild(li); });
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
    // A visitor who holds no program sees the offer while places are left.
    var bought = false;
    try { for (var i = 0; i < localStorage.length; i++) { if (/^wg_.*_home$/.test(localStorage.key(i)) && localStorage.getItem(localStorage.key(i))) bought = true; } } catch (e) {}
    if (bought || WGAccess.signedIn()) return;
    WGAccess.first1000.status().then(function (s) {
      if (!s || !s.open || s.left <= 0) return;
      var card = el('section', 'card f1k-app'); card.appendChild(el('h2', '', 'Get a program free'));
      card.appendChild(el('p', '', 'This offer is for the first 1,000 women. ' + s.left + ' places are left.'));
      var a = el('a', 'btn btn-primary', 'Claim my place →'); a.href = '/first-1000'; card.appendChild(a);
      host.appendChild(card); host.hidden = false;
    });
  }

  d.addEventListener('DOMContentLoaded', function () {
    if ($('f1kWelcome')) welcome();
    appCard();
    d.addEventListener('wg:account', appCard);
  });
})(window, document);
