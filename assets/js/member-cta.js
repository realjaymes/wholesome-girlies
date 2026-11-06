/* Member-aware CTA on tool + guide pages (all stages).
 *
 * A stage "home" hub (the thank-you page) stores { u: <hub path>, l: <label> } under a
 * per-stage localStorage key when a buyer opens it. On a tool/guide page, if the visitor
 * is a member of THIS page's stage, swap the top-of-funnel "buy the program" CTA
 * (.program-cta) for a "back to your <home>" CTA, so a paying member is never re-sold what
 * they already own. Non-members (no flag) see the normal CTA, unchanged.
 *
 * The Complete Motherhood Journey (bundle) hub sets all four motherhood keys (pointing at
 * the bundle home), so a bundle member sees the swap across every motherhood tool.
 * Relationships (Wife Material) has no community but IS a member stage.
 *
 * While First 1,000 places are left (GET /first1000/status), a visitor with no program of this stage sees the same card
 * offer a place instead: "Get [program] free" with "Claim my place" to /first-1000?stage=<stage>, and the open round's count
 * ("Round 1 is open: 77 of 100 places are left."). When the open round is full it says so and links to the waiting list on
 * /first-1000, with a link to buy the program. When all 1,000 places are gone, or the server does not answer, the card stays
 * the paid program card. The offer waits until her status is known
 * (a signed-in phone needs its account loaded) and is never shown to a member, to a buyer of any program, or to a woman whose
 * account lists a program. A signed-out visitor on a new phone cannot be told apart, so the offer carries "Already bought? Sign in".
 * "Free" is allowed on the First 1,000 offer only. A signed-in phone also loads wg-member-step.js, which records the First 1,000 steps.
 */
(function () {
  'use strict';
  var KEY = {
    fertility: 'wg_fertility_home',
    pregnancy: 'wg_pregnancy_home',
    postpartum: 'wg_pp_home',
    parenting: 'wg_parenting_home',
    relationships: 'wg_relationships_home'
  };
  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fmtN(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  // 'yes' when she holds any program or is a member, 'unknown' when she is signed in and her account is not on this phone yet.
  function holds() {
    try {
      for (var s in KEY) if (localStorage.getItem(KEY[s])) return 'yes';
      if (localStorage.getItem('wg_session_v1')) {
        var c = JSON.parse(localStorage.getItem('wg_account_v1') || 'null'), a = c && c.account;
        if (!a) return 'unknown';
        if (a.member || (a.programs && a.programs.length)) return 'yes';
      }
    } catch (e) { return 'unknown'; }
    return 'no';
  }
  // Localhost only: ?f1kleft=N pretends N places are left of 1,000, ?f1kround=R&f1kroundtaken=M pretends round R has M of its 100 places taken.
  function preview(j) {
    if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return j;
    var r = /[?&]f1kround=(\d{1,2})/.exec(location.search), l = /[?&]f1kleft=(\d{1,4})/.exec(location.search), taken, round, rt;
    if (r) {
      round = Math.min(10, Math.max(1, +r[1])); var m = /[?&]f1kroundtaken=(\d{1,3})/.exec(location.search);
      rt = Math.min(100, m ? +m[1] : 0); taken = (round - 1) * 100 + rt;
    } else if (l) {
      taken = Math.max(0, 1000 - +l[1]); round = Math.min(10, Math.floor(taken / 100) + 1); rt = Math.min(100, taken - (round - 1) * 100);
    } else return j;
    var left = 1000 - taken, ro = rt < 100 && left > 0;
    return { ok: true, taken: taken, left: left, open: ro, round: round, round_size: 100, round_taken: rt, round_left: ro ? 100 - rt : 0, round_open: ro };
  }
  // The offer card for a visitor who owns nothing of this stage.
  function offerPlace(stage) {
    if (holds() !== 'no') return;
    var cta = document.querySelector('.program-cta');
    if (!cta) return;
    var api = 'https://wg-pay.realjaymes.workers.dev';
    try { if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) { var o = localStorage.getItem('wg_pay_api'); if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(o || '')) api = o; } } catch (e) {}
    var name = (cta.querySelector('h3') || {}).textContent || '';
    if (!name) return;
    fetch(api + '/first1000/status').then(function (r) { return r.json(); }).then(function (j) {
      j = preview(j);
      if (!j || !j.ok || !(j.left > 0) || holds() !== 'no') return;
      var rl = typeof j.round === 'number';
      if (rl && !j.round_open) {
        // The open round is full: say so, point to the waiting list, and keep the way to buy the program.
        var buy = cta.querySelector('a'), href = buy ? buy.getAttribute('href') : '';
        cta.innerHTML =
          '<p class="eyebrow">Go further</p>' +
          '<h3>Get ' + esc(name) + ' free</h3>' +
          '<p class="muted">Round ' + (+j.round) + ' is full. The next round opens soon.</p>' +
          '<a href="/first-1000?stage=' + stage + '" class="btn btn-primary" data-first1000="tool_card_wait">Tell me when it opens &rarr;</a>' +
          (href ? '<p class="muted">Or <a href="' + esc(href) + '">get the program now</a></p>' : '');
        return;
      }
      if (!j.open) return;
      var n = rl ? +j.round_left : +j.left;
      cta.innerHTML =
        '<p class="eyebrow">Go further</p>' +
        '<h3>Get ' + esc(name) + ' free</h3>' +
        '<p class="muted">For the first 1,000 women. ' + (rl ? 'Round ' + (+j.round) + ' is open: ' + fmtN(n) + ' of ' + fmtN(+j.round_size) + (n === 1 ? ' places is' : ' places are') + ' left.' : fmtN(n) + (n === 1 ? ' place' : ' places') + ' left.') + '</p>' +
        '<a href="/first-1000?stage=' + stage + '" class="btn btn-primary" data-first1000="tool_card">Claim my place &rarr;</a>' +
        '<p class="muted">Already bought? <a href="/signin/">Sign in</a></p>';
    }).catch(function () {});
  }
  var m = location.pathname.match(/^\/(fertility|pregnancy|postpartum|parenting|relationships)\//);
  if (!m) return;
  var raw;
  try { raw = localStorage.getItem(KEY[m[1]]); } catch (e) { return; }
  try {
    if (localStorage.getItem('wg_session_v1')) {
      var st = document.createElement('script'); st.src = '/assets/js/wg-member-step.js?v=20261106a'; st.defer = true; document.head.appendChild(st);
    }
  } catch (e) {}
  if (!raw) { offerPlace(m[1]); return; }
  var home;
  try {
    var o = JSON.parse(raw);
    home = { u: o.u, l: o.l };
  } catch (e) {
    home = { u: raw, l: 'home' }; // legacy plain-string flag (old postpartum format)
  }
  if (!home.u || !/^\/programs\/[a-z0-9-]+(-diaspora)?\/thank-you(\.html)?$/.test(home.u)) return;
  var label = home.l || 'home';
  var cta = document.querySelector('.program-cta');
  if (!cta) return;
  cta.innerHTML =
    '<p class="eyebrow">Your space</p>' +
    '<h3>Back to your ' + esc(label) + '</h3>' +
    '<p class="muted">Everything you own is gathered in one place you can come back to any time.</p>' +
    '<a href="' + esc(home.u) + '" class="btn btn-primary">Go to your ' + esc(label) + ' &rarr;</a>';
})();
