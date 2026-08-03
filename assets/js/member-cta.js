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
  var m = location.pathname.match(/^\/(fertility|pregnancy|postpartum|parenting|relationships)\//);
  if (!m) return;
  var raw;
  try { raw = localStorage.getItem(KEY[m[1]]); } catch (e) { return; }
  if (!raw) return;
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
