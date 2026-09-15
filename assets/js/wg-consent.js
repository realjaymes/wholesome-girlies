/* Wholesome Girlies — consent banner.
 *
 * Runs the self-hosted CookieConsent library (/assets/vendor/cookieconsent/, v3.1.0, MIT) with the
 * region worked out by /assets/js/consent-defaults.js, which must load first. Every choice is passed
 * to WGConsent.apply(), which updates Google Consent Mode, tells Clarity, applies the
 * "Remember on this device" setting, and pushes `wg_consent_update` to the data layer for GTM.
 *
 * Any element with data-cc="show-preferencesModal" (the footer "Privacy choices" links) opens the
 * settings view.
 */
(function (w, d) {
  'use strict';
  var WG = w.WGConsent;
  var CC = w.CookieConsent;
  if (!WG || !CC) return;

  var region = WG.region;
  var note = null; // the note under tools, created by updateToolNote()
  var PRIVACY = '/legal/privacy';

  var description = region === 'us'
    ? 'We use <b>Google Analytics</b> and <b>Microsoft Clarity</b> to see how the site is used, and your browser to remember your tool entries. <b>Meta</b> and <b>TikTok</b>, which measure our ads, only run if you accept.'
    : 'We use <b>Google Analytics</b> and <b>Microsoft Clarity</b> to see how the site is used, <b>Meta</b> and <b>TikTok</b> to measure our ads, and your browser to remember your tool entries. None of it runs until you choose.';

  var advertisingDescription = 'Meta and TikTok measure whether our ads led you here.' +
    (WG.gpc ? ' <b>Your browser’s Global Privacy Control setting is on, so advertising stays off.</b>' : '');

  function sync() {
    // Only a real saved choice changes anything; until then the region defaults from
    // consent-defaults.js stay in force (this matters for the opt-out regions).
    if (!CC.validConsent()) { updateToolNote(); return; }
    WG.apply({
      analytics: CC.acceptedCategory('analytics'),
      advertising: CC.acceptedCategory('advertising'),
      remember: CC.acceptedCategory('remember')
    });
    updateToolNote();
  }

  CC.run({
    mode: region === 'consent' ? 'opt-in' : 'opt-out',
    autoShow: region !== 'open',
    revision: WG.REVISION,
    hideFromBots: true,
    disablePageInteraction: false,
    cookie: { name: WG.COOKIE, expiresAfterDays: 182, sameSite: 'Lax' },
    guiOptions: {
      consentModal: { layout: 'box', position: 'bottom left', equalWeightButtons: true, flipButtons: false },
      preferencesModal: { layout: 'box', equalWeightButtons: true, flipButtons: false }
    },
    categories: {
      necessary: { enabled: true, readOnly: true },
      analytics: {
        enabled: WG.defaults.analytics,
        autoClear: { cookies: [{ name: /^_ga/ }, { name: '_gid' }, { name: /^_cl(ck|sk)$/ }], reloadPage: true }
      },
      advertising: {
        enabled: WG.defaults.advertising && !WG.gpc,
        autoClear: { cookies: [{ name: '_fbp' }, { name: '_fbc' }, { name: /^_tt/ }], reloadPage: true }
      },
      remember: { enabled: WG.defaults.remember }
    },
    onConsent: sync,
    onChange: sync,
    language: {
      default: 'en',
      translations: {
        en: {
          consentModal: {
            label: 'Wholesome Girlies',
            title: 'Before you settle in',
            description: description,
            acceptAllBtn: 'Accept',
            acceptNecessaryBtn: 'Reject',
            showPreferencesBtn: 'Choose what runs',
            footer: 'Change your mind anytime in Privacy choices at the bottom of every page. Wholesome Girlies Media Limited. <a href="' + PRIVACY + '">Privacy policy</a>'
          },
          preferencesModal: {
            title: 'Choose what runs',
            acceptAllBtn: 'Accept all',
            acceptNecessaryBtn: 'Reject all',
            savePreferencesBtn: 'Save choices',
            closeIconLabel: 'Close',
            sections: [
              { title: 'Essential', description: 'Keeps the site secure and working. Nothing personal.', linkedCategory: 'necessary' },
              { title: 'Analytics', description: 'Google Analytics counts visits and pages. Microsoft Clarity records clicks and scrolling, with text hidden, so we can fix confusing pages.', linkedCategory: 'analytics' },
              { title: 'Advertising', description: advertisingDescription, linkedCategory: 'advertising' },
              { title: 'Remember on this device', description: 'Saves your tool entries and checkout details in this browser so you don’t retype them. They never leave your device.', linkedCategory: 'remember' },
              { title: 'More information', description: 'Wholesome Girlies Media Limited. <a href="' + PRIVACY + '#cookies">Privacy policy</a> · <a href="/legal/consumer-health-data">Consumer health data</a>' }
            ]
          }
        }
      }
    }
  });

  // A saved choice from an earlier visit is re-applied on load (a no-op when nothing changed).
  sync();

  // ── Note under tools that save entries, while remembering is off ─────────
  function updateToolNote() {
    var needed = WG.toolStorageUsed() && !WG.state.remember;
    if (needed && !note) {
      var anchor = d.querySelector('.program-cta');
      if (!anchor) return;
      note = d.createElement('p');
      note.className = 'wg-remember-note';
      note.innerHTML = 'Your entries stay on this page only. To keep them for next time, turn on <b>Remember on this device</b> in <a href="#">Privacy choices</a>.';
      note.querySelector('a').addEventListener('click', function (e) { e.preventDefault(); CC.showPreferences(); });
      anchor.parentNode.insertBefore(note, anchor);
    } else if (!needed && note) {
      note.parentNode.removeChild(note);
      note = null;
    }
  }
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', updateToolNote);
  else updateToolNote();
})(window, document);
