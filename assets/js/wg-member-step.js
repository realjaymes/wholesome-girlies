/* Wholesome Girlies: First 1,000 steps recorded from the page she is on (POST /member/step).
 * Loaded on the app home, the First 1,000 welcome page, the program reader, and (by member-cta.js) on tool pages, but only
 * does anything on a phone that is signed in as a First 1,000 member. It sends the step name and nothing else: never which
 * tool, which lesson or what she entered. Each step counts once on the server.
 *
 *   app_saved     the first launch from the home screen (the page opens as the installed app)
 *   first_finish  her first lesson ticked, or her first tool result (a quiz or checker result, or a tool that saves)
 *   telegram      a tap on a join link marked data-f1k-step="telegram"
 */
(function (w, d) {
  'use strict';
  var PAY_API = 'https://wg-pay.realjaymes.workers.dev';
  try {
    if (/^(localhost|127\.0\.0\.1)$/.test(w.location.hostname)) { var o = w.localStorage.getItem('wg_pay_api'); if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(o || '')) PAY_API = o; }
  } catch (e) {}
  if (w.WGMemberStep) return;
  function jget(k) { try { return JSON.parse(w.localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function token() { try { return w.localStorage.getItem('wg_session_v1') || ''; } catch (e) { return ''; } }
  function member() { var c = jget('wg_account_v1'); return token() && c && c.account && c.account.member ? c.account.member : null; }
  var sent = {};
  function post(step) {
    var m = member(); if (!m || sent[step] || (m.steps && m.steps[step])) return;
    sent[step] = 1;
    fetch(PAY_API + '/member/step', { method: 'POST', headers: { 'content-type': 'application/json', authorization: 'Bearer ' + token() }, body: JSON.stringify({ step: step }), keepalive: true })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.ok) { sent[step] = 0; return; }
        var c = jget('wg_account_v1');
        if (c && c.account && c.account.member) {
          c.account.member.ends = j.ends || c.account.member.ends; c.account.member.steps = j.steps || c.account.member.steps;
          try { w.localStorage.setItem('wg_account_v1', JSON.stringify(c)); } catch (e) {}
          d.dispatchEvent(new CustomEvent('wg:account', { detail: { signedIn: true } }));
        }
      }).catch(function () { sent[step] = 0; });
  }
  w.WGMemberStep = { post: post };
  if (!member()) return;

  // The first launch from the home screen.
  var standalone = (w.matchMedia && w.matchMedia('(display-mode: standalone)').matches) || w.navigator.standalone === true;
  if (standalone || /[?&]preview=installed\b/.test(w.location.search)) post('app_saved');

  // Her first lesson or first tool result.
  d.addEventListener('wg:finish', function () { post('first_finish'); });
  d.addEventListener('wg:saved', function () { post('first_finish'); });

  // The join link: tapping it records the step. Joining itself is not checked.
  d.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[data-f1k-step]');
    if (a) post(a.getAttribute('data-f1k-step'));
  });
})(window, document);
