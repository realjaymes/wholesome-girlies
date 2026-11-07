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
 * offer a place instead: "Get [program] free" with "Claim my place" to /first?stage=<stage> and the count ("For the first 100 women.
 * 77 of 100 places are left."; the number is the status answer's cap). When the cap is full and paused it says "All 100 places are
 * taken." with a link to the waiting list on /first and a link to buy the program. When the server does not answer, the card stays
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
  // Localhost only: ?f1kcap=C sets the cap (default 100), ?f1ktaken=T the places taken, ?f1kleft=N the places left. A check only, never on the live site.
  function preview(j) {
    if (!/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) return j;
    var c = /[?&]f1kcap=(\d{2,4})/.exec(location.search), t = /[?&]f1ktaken=(\d{1,4})/.exec(location.search), l = /[?&]f1kleft=(\d{1,4})/.exec(location.search);
    if (!c && !t && !l) return j;
    var cap = c ? +c[1] : 100, taken = t ? +t[1] : l ? cap - +l[1] : 0;
    taken = Math.min(cap, Math.max(0, taken));
    return { ok: true, taken: taken, cap: cap, left: cap - taken, open: cap - taken > 0 };
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
    var pre = preview(null);
    (pre ? Promise.resolve(pre) : fetch(api + '/first1000/status').then(function (r) { return r.json(); })).then(function (j) {
      if (!j || !j.ok || typeof j.cap !== 'number' || holds() !== 'no') return;
      if (!j.open || !(j.left > 0)) {
        // The cap is full and paused: say so, point to the waiting list, and keep the way to buy the program.
        var buy = cta.querySelector('a'), href = buy ? buy.getAttribute('href') : '';
        cta.innerHTML =
          '<p class="eyebrow">Go further</p>' +
          '<h3>The free places are taken for now</h3>' +
          '<p class="muted">All ' + fmtN(+j.cap) + ' places are taken. We can email you if one opens.</p>' +
          '<a href="/first?stage=' + stage + '" class="btn btn-primary" data-first1000="tool_card_wait">Tell me if a place opens &rarr;</a>' +
          (href ? '<p class="muted cta-note">Or <a href="' + esc(href) + '">get the program now</a></p>' : '');
        return;
      }
      var n = +j.left;
      cta.innerHTML =
        '<p class="eyebrow">Go further</p>' +
        '<h3>Get ' + esc(name) + ' free</h3>' +
        '<p class="muted">For the first ' + fmtN(+j.cap) + ' women. ' + fmtN(n) + ' of ' + fmtN(+j.cap) + (n === 1 ? ' places is' : ' places are') + ' left.</p>' +
        '<a href="/first?stage=' + stage + '" class="btn btn-primary" data-first1000="tool_card">Claim my place &rarr;</a>' +
        '<p class="muted cta-note">Already bought? <a href="/signin/">Sign in</a></p>';
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
