/* Wholesome Girlies: programs bought on Bachs, on this phone (window.WGAccess).
 * Used by /signin/ and the app's "Add a program you bought". It talks to the payment server (wg-pay)
 * and puts each program on her phone the way its program home does.
 *
 * Keys on her phone (all start with wg_, so the consent guard covers them):
 *   wg_codes_v1   {"<program home slug>": "<personal access code>"}, her personal codes, added to and never replaced
 *   wg_device_v1  a random id for this phone, so a personal code counts it once against its device limit
 *   wg_<stage>_home  the program home flags, set by addHome() with the same rule as appAddHome() in /app/
 *
 * Shared program codes (BABY-K7P3) are checked on the phone against assets/data/program-flags.json and never
 * leave it. Personal codes (FBP-XGM6-Y9YF) go to the server. Selar to Bachs Migration Plan, phase 3.
 *
 * Phase 8: when the program pages close, the server's answer to a right email code or a personal code carries a
 * signed pass. sendPass() hands it to this site (POST /api/pass), which keeps it in the wg_pass cookie the gate reads.
 * A shared code never earns a pass. PHASE8 below is the one switch for the phase 8 screens and rules: it is read
 * here, by wg-signin.js, wg-signin-entry.js and the app's code box. Leave it false until the gate is live.
 */
(function () {
  'use strict';
  var PAY_API = 'https://wg-pay.realjaymes.workers.dev';
  var PHASE8 = false; // true once the program pages are closed: Option B only, shared codes retired
  var CODES_KEY = 'wg_codes_v1', DEVICE_KEY = 'wg_device_v1';
  var data = null;

  function homes() {
    if (data) return Promise.resolve(data);
    return fetch('/assets/data/program-flags.json?v=20261022a').then(function (r) { return r.json(); })
      .then(function (d) { data = d; return d; });
  }

  function post(path, body) {
    return fetch(PAY_API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) { j.status = r.status; return j; });
      });
  }

  // Gives the server's pass to this site so the gate opens for this phone. If the site has no /api/pass (GitHub
  // Pages today) it answers 404 and we carry on, because there is no gate to open.
  function sendPass(pass) {
    if (!pass) return Promise.resolve();
    return fetch('/api/pass', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pass: pass }) })
      .catch(function () {});
  }

  function device() {
    try {
      var id = localStorage.getItem(DEVICE_KEY);
      if (!id) {
        var b = new Uint8Array(16); crypto.getRandomValues(b);
        id = Array.prototype.map.call(b, function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
        localStorage.setItem(DEVICE_KEY, id);
      }
      return id;
    } catch (e) { return 'nostorage' + Date.now(); }
  }

  function hash(text) {
    var code = String(text).toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!code || !(window.crypto && crypto.subtle)) return Promise.resolve('');
    return crypto.subtle.digest('SHA-256', new TextEncoder().encode(code)).then(function (b) {
      return Array.prototype.map.call(new Uint8Array(b), function (x) { return ('0' + x.toString(16)).slice(-2); }).join('');
    });
  }

  // The program home slug from its address: /programs/<slug>/thank-you.
  function slugOf(url) {
    var m = /\/programs\/([a-z0-9-]+)\/thank-you/.exec(url || '');
    return m ? m[1] : '';
  }

  // Same rule as appAddHome(slug, true) in /app/: an empty stage takes this home, The Complete Motherhood
  // Journey outranks a single program, and a program she signed in for replaces another single program.
  function addHome(slug) {
    return homes().then(function (d) {
      var h = d.homes[slug];
      if (!h) return null;
      var bundle = function (u) { return /^\/programs\/complete-motherhood-journey/.test(u || ''); };
      var u = '/programs/' + slug + '/thank-you', v = JSON.stringify({ u: u, l: h.label });
      try {
        h.flags.forEach(function (k) {
          var cur = null; try { cur = JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) {}
          var had = cur && cur.u;
          if (!had || !bundle(had)) localStorage.setItem(k, v);
        });
      } catch (e) {}
      return { slug: slug, url: u, name: h.name, program: h.program };
    });
  }

  // A right sign-in code or link: every program she bought is saved and added to her phone. The pass goes to the
  // site before the programs are shown, so the page she taps next opens.
  function openAll(j) {
    if (!j.ok) return j;
    var list = j.codes || [];
    return sendPass(j.pass)
      .then(function () { return Promise.all(list.map(function (c) { saveCode(slugOf(c.program_home), c.code); return addHome(slugOf(c.program_home)); })); })
      .then(function (added) { return { ok: true, programs: added.filter(Boolean) }; });
  }

  function saveCode(slug, code) {
    if (!slug || !code) return; // a Selar purchase has no personal code
    try {
      var all = JSON.parse(localStorage.getItem(CODES_KEY) || '{}') || {};
      all[slug] = code;
      localStorage.setItem(CODES_KEY, JSON.stringify(all));
    } catch (e) {}
  }

  window.WGAccess = {
    PHASE8: PHASE8,

    // What the sign-in screen needs to name a program: { name, program } or null for a slug we do not sell.
    program: function (slug) { return homes().then(function (d) { return d.homes[slug] || null; }, function () { return null; }); },

    // Ask for a 6-digit code by email. The server answers the same for every email.
    signin: function (email) { return post('/access/signin', { email: email }); },

    // Check the 6-digit code. When it is right, every program she bought is saved and added to her phone.
    check: function (email, code) {
      return post('/access/signin/check', { email: email, code: code }).then(openAll);
    },

    // The one-tap link emailed to a Selar buyer when her sale reaches us. It signs her in as a right code does, once.
    link: function (token) {
      return post('/access/signin/link', { token: token }).then(openAll);
    },

    // A typed code: a shared program code is checked on the phone first, then a personal code on the server.
    addCode: function (text) {
      return Promise.all([homes(), hash(text)]).then(function (r) {
        var slug = r[1] && r[0].codes[r[1]];
        if (slug && !PHASE8) return addHome(slug).then(function (p) { return { ok: true, programs: [p] }; });
        var clean = String(text).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (clean.length !== 11) return { ok: false, reason: 'invalid' };
        return post('/access/verify', { code: text, device: device() }).then(function (j) {
          if (!j.ok) return j;
          saveCode(slugOf(j.program_home), clean.slice(0, 3) + '-' + clean.slice(3, 7) + '-' + clean.slice(7));
          return sendPass(j.pass).then(function () { return addHome(slugOf(j.program_home)); }).then(function (p) { return { ok: true, programs: p ? [p] : [] }; });
        });
      });
    },
  };
})();
