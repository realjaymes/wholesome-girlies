/* Wholesome Girlies — consent defaults.
 *
 * Loads as a normal (blocking) script in <head>, after the identity-link cleanup script and
 * BEFORE Google Tag Manager, on every page that carries GTM. It decides, before any tag can fire:
 *
 *   1. The visitor's region, from the device time zone (no network call):
 *        consent : EU, UK, Switzerland, Canada, plus any unclear zone. Nothing optional runs until a yes.
 *        us      : United States. Analytics and remembering entries on by default; ad pixels wait for Accept.
 *        open    : Nigeria and everywhere else. Everything on; no banner.
 *   2. The effective choice: the saved choice (cookie `wg_consent`, written by /assets/js/wg-consent.js)
 *      if it matches the current revision, otherwise the region default. The Global Privacy Control
 *      browser signal always turns advertising off.
 *   3. Google Consent Mode defaults, and Microsoft Clarity's consent signal.
 *   4. The "Remember on this device" guard: while remembering is off, browser storage for keys
 *      starting `wg_` lives in memory for this page only, so tools keep working but keep nothing.
 *
 * Exposes window.WGConsent for /assets/js/wg-consent.js (the banner) to call apply() on each choice.
 * QA only: add ?wg_region=consent|us|open to a page address to preview another region (not saved).
 */
(function (w, d) {
  'use strict';

  var COOKIE = 'wg_consent';
  var REVISION = 1;

  // ── 1. Region ──────────────────────────────────────────────────────────────
  var CONSENT_ZONES = [
    // Canada
    'America/Toronto', 'America/Montreal', 'America/Vancouver', 'America/Edmonton', 'America/Winnipeg',
    'America/Halifax', 'America/St_Johns', 'America/Regina', 'America/Moncton', 'America/Glace_Bay',
    'America/Goose_Bay', 'America/Whitehorse', 'America/Dawson', 'America/Dawson_Creek', 'America/Creston',
    'America/Fort_Nelson', 'America/Yellowknife', 'America/Inuvik', 'America/Cambridge_Bay',
    'America/Rankin_Inlet', 'America/Iqaluit', 'America/Resolute', 'America/Swift_Current',
    'America/Atikokan', 'America/Blanc-Sablon', 'America/Nipigon', 'America/Thunder_Bay',
    'America/Rainy_River', 'America/Pangnirtung',
    // EU and EEA zones outside Europe/*
    'Atlantic/Reykjavik', 'Atlantic/Canary', 'Atlantic/Madeira', 'Atlantic/Azores', 'Atlantic/Faroe',
    'Atlantic/Jan_Mayen', 'Arctic/Longyearbyen', 'Asia/Nicosia', 'Asia/Famagusta',
    // Legacy aliases
    'GB', 'GB-Eire', 'Eire', 'Iceland', 'Portugal', 'Poland'
  ];
  var US_ZONES = [
    'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'America/Phoenix',
    'America/Anchorage', 'America/Adak', 'America/Boise', 'America/Detroit', 'America/Juneau',
    'America/Menominee', 'America/Metlakatla', 'America/Nome', 'America/Sitka', 'America/Yakutat',
    'America/Puerto_Rico', 'Pacific/Honolulu', 'Navajo'
  ];

  function timeZone() {
    try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ''; } catch (e) { return ''; }
  }

  function regionFor(tz) {
    if (!tz || tz === 'UTC' || tz === 'GMT' || tz === 'Universal' || tz === 'Zulu' || tz.indexOf('Etc/') === 0) return 'consent';
    if (tz.indexOf('Europe/') === 0 || tz.indexOf('Canada/') === 0 || CONSENT_ZONES.indexOf(tz) > -1) return 'consent';
    if (tz.indexOf('US/') === 0 || US_ZONES.indexOf(tz) > -1 ||
        tz.indexOf('America/Indiana/') === 0 || tz.indexOf('America/Kentucky/') === 0 ||
        tz.indexOf('America/North_Dakota/') === 0) return 'us';
    return 'open';
  }

  var region = regionFor(timeZone());
  try {
    var qa = new URLSearchParams(w.location.search).get('wg_region');
    if (qa === 'consent' || qa === 'us' || qa === 'open') region = qa;
  } catch (e) {}

  var DEFAULTS = {
    consent: { analytics: false, advertising: false, remember: false },
    us:      { analytics: true,  advertising: false, remember: true },
    open:    { analytics: true,  advertising: true,  remember: true }
  };

  // ── 2. Effective choice ───────────────────────────────────────────────────
  var gpc = false;
  try { gpc = w.navigator.globalPrivacyControl === true; } catch (e) {}

  function readSaved() {
    try {
      var m = d.cookie.match(new RegExp('(?:^|;\\s*)' + COOKIE + '=([^;]*)'));
      if (!m) return null;
      var raw = m[1];
      var data;
      try { data = JSON.parse(decodeURIComponent(raw)); } catch (e) { data = JSON.parse(raw); }
      if (!data || data.revision !== REVISION || !data.categories) return null;
      return data.categories;
    } catch (e) { return null; }
  }

  var saved = readSaved();
  var base = DEFAULTS[region];
  var state = saved
    ? { analytics: saved.indexOf('analytics') > -1, advertising: saved.indexOf('advertising') > -1, remember: saved.indexOf('remember') > -1 }
    : { analytics: base.analytics, advertising: base.advertising, remember: base.remember };
  if (gpc) state.advertising = false;

  // ── 3. Google Consent Mode + Clarity ──────────────────────────────────────
  w.dataLayer = w.dataLayer || [];
  function gtag() { w.dataLayer.push(arguments); }
  function g(on) { return on ? 'granted' : 'denied'; }
  function consentFields(s) {
    return {
      analytics_storage: g(s.analytics),
      ad_storage: g(s.advertising),
      ad_user_data: g(s.advertising),
      ad_personalization: g(s.advertising),
      functionality_storage: 'granted',
      security_storage: 'granted'
    };
  }
  gtag('consent', 'default', consentFields(state));
  w.dataLayer.push({ event: 'wg_consent_default', wg_region: region, wg_gpc: gpc });

  // Clarity's own loader uses this same queue, so calls made before Clarity loads are kept.
  w.clarity = w.clarity || function () { (w.clarity.q = w.clarity.q || []).push(arguments); };
  function tellClarity(s) {
    try { w.clarity('consentv2', { ad_Storage: g(s.advertising), analytics_Storage: g(s.analytics) }); } catch (e) {}
  }
  tellClarity(state);

  // ── 4. Remember on this device ────────────────────────────────────────────
  var memory = {};
  var toolStorageUsed = false;
  var proto = w.Storage && w.Storage.prototype;
  var real = proto ? { get: proto.getItem, set: proto.setItem, remove: proto.removeItem } : null;

  function localStore() { try { return w.localStorage; } catch (e) { return null; } }
  function guarded(store, key) {
    if (!/^wg_/.test(String(key))) return false;
    if (store !== localStore()) return false; // sessionStorage (currency redirect, animations) is untouched
    var k = String(key);
    if (k !== 'wg_lead' && !/_home$/.test(k)) toolStorageUsed = true; // a tool on this page saves entries
    return !state.remember;
  }

  if (real) {
    proto.getItem = function (key) {
      if (guarded(this, key)) return Object.prototype.hasOwnProperty.call(memory, key) ? memory[key] : null;
      return real.get.apply(this, arguments);
    };
    proto.setItem = function (key, value) {
      if (guarded(this, key)) { memory[key] = String(value); return; }
      return real.set.apply(this, arguments);
    };
    proto.removeItem = function (key) {
      if (guarded(this, key)) { delete memory[key]; return; }
      return real.remove.apply(this, arguments);
    };
  }

  function saveMemoryToDevice() {
    var ls = localStore(); if (!ls || !real) return;
    for (var k in memory) {
      if (Object.prototype.hasOwnProperty.call(memory, k)) { try { real.set.call(ls, k, memory[k]); } catch (e) {} }
    }
    memory = {};
  }
  function clearSavedEntries() {
    var ls = localStore(); if (!ls || !real) return;
    var keys = [];
    try { for (var i = 0; i < ls.length; i++) { var k = ls.key(i); if (/^wg_/.test(k)) keys.push(k); } } catch (e) {}
    for (var j = 0; j < keys.length; j++) { try { real.remove.call(ls, keys[j]); } catch (e) {} }
  }

  // ── Public API for the banner ─────────────────────────────────────────────
  w.WGConsent = {
    COOKIE: COOKIE,
    REVISION: REVISION,
    region: region,
    gpc: gpc,
    hadSavedChoice: !!saved,
    defaults: base,
    state: state,
    toolStorageUsed: function () { return toolStorageUsed; },
    apply: function (next) {
      var s = {
        analytics: !!next.analytics,
        advertising: !!next.advertising && !gpc,
        remember: !!next.remember
      };
      var changed = s.analytics !== state.analytics || s.advertising !== state.advertising || s.remember !== state.remember;
      if (!changed) return false;
      var rememberWas = state.remember;
      state.analytics = s.analytics; state.advertising = s.advertising; state.remember = s.remember;
      gtag('consent', 'update', consentFields(state));
      tellClarity(state);
      if (!s.analytics) { try { w.clarity('consent', false); } catch (e) {} }
      if (s.remember && !rememberWas) saveMemoryToDevice();
      if (!s.remember && rememberWas) clearSavedEntries();
      w.dataLayer.push({ event: 'wg_consent_update', wg_region: region, wg_analytics: s.analytics, wg_advertising: s.advertising, wg_remember: s.remember });
      try { d.dispatchEvent(new CustomEvent('wg:consent', { detail: { analytics: s.analytics, advertising: s.advertising, remember: s.remember } })); } catch (e) {}
      return true;
    }
  };
})(window, document);
