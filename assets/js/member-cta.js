/* Member-aware CTA on tool pages.
 * If the visitor has opened their stage "home" hub on this device, they are a member of
 * that program. Swap the top-of-funnel "buy the program" CTA (.program-cta) for a
 * "back to your home" CTA, so a paying member is never re-sold what they already own.
 * The hub sets localStorage 'wg_pp_home' to its own path; we validate it before using.
 * Non-members (no flag) see the normal program CTA, unchanged. */
(function () {
  'use strict';
  var home;
  try { home = localStorage.getItem('wg_pp_home'); } catch (e) { return; }
  if (!home || !/^\/programs\/postpartum-reset(-diaspora)?\/thank-you$/.test(home)) return;
  var cta = document.querySelector('.program-cta');
  if (!cta) return;
  cta.innerHTML =
    '<p class="eyebrow">Your space</p>' +
    '<h3>Back to your Postpartum home</h3>' +
    '<p class="muted">Your toolkit, your community, and all your tools, gathered in one place you can come back to any time.</p>' +
    '<a href="' + home + '" class="btn btn-primary">Go to your Postpartum home &rarr;</a>';
})();
