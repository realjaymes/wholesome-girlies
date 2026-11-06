/* Wholesome Girlies: her account on this phone (window.WGAccess).
 * Used by /signin/, the "Payment received" page, the app home, the First 1,000 pages and the program homes. It talks to the
 * payment server (wg-pay) and keeps three things on her phone, all under keys that start with wg_ so the consent guard covers them:
 *
 *   wg_session_v1  the signed session token the server gave her at sign-in (90 days). Never in a URL, a backup or an event.
 *   wg_account_v1  {"v":1,"at":<ms>,"account":{email,name,programs,member?},"saved":[tool keys]}, a copy of her account so
 *                  the app can show "Signed in as ..." and her steps before the network answers.
 *   wg_<stage>_home  the program home flags, written from her account at sign-in (never from a typed code or a link).
 *
 * Everyone signs in the same way: her email, then a 6-digit code. There are no program codes. A buyer, a First 1,000 member
 * and a woman with a plain account (no program) are the same kind of account. The signed pass the server returns goes to this
 * site (POST /api/pass), which keeps it in the wg_pass cookie the program-page gate reads.
 *
 * What goes to her account: her name, the reading place per program, the KEYS of the tools she saved and the games she
 * finished. Never what she typed into a tool, never a date (period, due date, delivery, the baby's birth).
 * Growth Build Contract (vault: Wholesome Girlies/Growth Experiments/Build) fixes the routes.
 */
(function (w, d) {
  'use strict';
  var PAY_API = 'https://wg-pay.realjaymes.workers.dev';
  // On localhost only, a wrangler dev server can stand in for the payment server: localStorage.wg_pay_api = 'http://localhost:8787'.
  try {
    if (/^(localhost|127\.0\.0\.1)$/.test(w.location.hostname)) { var o = w.localStorage.getItem('wg_pay_api'); if (/^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(o || '')) PAY_API = o; }
  } catch (e) {}
  var SESSION = 'wg_session_v1', ACCOUNT = 'wg_account_v1', NAME = 'wg_name_v1';
  var HOME_KEYS = ['wg_relationships_home', 'wg_fertility_home', 'wg_pregnancy_home', 'wg_pp_home', 'wg_parenting_home'];
  var data = null;

  // ── storage, always wrapped: a blocked localStorage just means nothing is kept ──
  function get(k) { try { return w.localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { w.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function del(k) { try { w.localStorage.removeItem(k); } catch (e) {} }
  function jget(k) { try { return JSON.parse(get(k) || 'null'); } catch (e) { return null; } }
  // Code-era keys from before the sign-in switch: no program code or device id is kept any more.
  del('wg_codes_v1'); del('wg_device_v1');

  function push(ev, extra) {
    w.dataLayer = w.dataLayer || [];
    var o = { event: ev }; for (var k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) o[k] = extra[k];
    w.dataLayer.push(o);
  }

  // ── network ──
  // The localhost-only status previews (see first1000.status).
  function previewStatus(j) {
    if (!/^(localhost|127\.0\.0\.1)$/.test(w.location.hostname)) return j;
    var r = /[?&]f1kround=(\d{1,2})/.exec(w.location.search), l = /[?&]f1kleft=(\d{1,4})/.exec(w.location.search), taken, round, rt;
    if (r) {
      round = Math.min(10, Math.max(1, +r[1])); var m = /[?&]f1kroundtaken=(\d{1,3})/.exec(w.location.search);
      rt = Math.min(100, m ? +m[1] : 0); taken = (round - 1) * 100 + rt;
    } else if (l) {
      taken = Math.max(0, 1000 - +l[1]); round = Math.min(10, Math.floor(taken / 100) + 1); rt = Math.min(100, taken - (round - 1) * 100);
    } else return j;
    var left = 1000 - taken, ro = rt < 100 && left > 0;
    return { ok: true, taken: taken, left: left, open: ro, round: round, round_size: 100, round_taken: rt, round_left: ro ? 100 - rt : 0, round_open: ro };
  }
  function request(method, path, body, tok) {
    var h = {}; if (body !== undefined) h['content-type'] = 'application/json';
    if (tok) h.authorization = 'Bearer ' + tok;
    return fetch(PAY_API + path, { method: method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) {
        j.status = r.status;
        // The account routes answer {ok:false, error}, the older sign-in routes {ok:false, reason}. Callers may read either.
        if (j.ok === false) { if (j.error == null && j.reason != null) j.error = j.reason; if (j.reason == null && j.error != null) j.reason = j.error; }
        return j;
      }); });
  }
  function authed(method, path, body) {
    var tok = token();
    if (!tok) return Promise.resolve({ ok: false, status: 401, error: 'signed_out' });
    return request(method, path, body, tok).then(function (j) {
      if (j.status === 401) forget(); // the session ended or was signed out elsewhere; her entries stay on the phone
      return j;
    });
  }

  // ── session and account copy ──
  function token() { return get(SESSION) || ''; }
  function cached() { var c = jget(ACCOUNT); return c && c.v === 1 && c.account ? c : null; }
  function account() { var c = cached(); return token() && c ? c.account : null; }
  function signedIn() { return !!token(); }
  function remember(acct, extra) {
    var c = cached() || { v: 1, saved: [] };
    c.v = 1; c.at = Date.now(); if (acct) c.account = acct;
    if (extra) for (var k in extra) c[k] = extra[k];
    set(ACCOUNT, JSON.stringify(c));
    d.dispatchEvent(new CustomEvent('wg:account', { detail: { signedIn: signedIn() } }));
  }
  function forget() { del(SESSION); del(ACCOUNT); d.dispatchEvent(new CustomEvent('wg:account', { detail: { signedIn: false } })); }

  // ── program flags, from her account ──
  function homes() {
    if (data) return Promise.resolve(data);
    return fetch('/assets/data/program-flags.json?v=20261106b').then(function (r) { return r.json(); }).then(function (x) { data = x; return x; });
  }
  function slugOf(url) { var m = /\/programs\/([a-z0-9-]+)\/(?:thank-you|read)/.exec(url || ''); return m ? m[1] : ''; }
  function isBundle(u) { return /^\/programs\/complete-motherhood-journey/.test(u || ''); }
  // The Complete Motherhood Journey outranks a single program for a stage (the same rule as every program home).
  function addHome(slug) {
    return homes().then(function (x) {
      var h = x.homes[slug]; if (!h) return null;
      var u = '/programs/' + slug + '/thank-you', v = JSON.stringify({ u: u, l: h.label });
      h.flags.forEach(function (k) { var cur = jget(k); if (!(cur && isBundle(cur.u) && !isBundle(u))) set(k, v); });
      return { slug: slug, url: u, name: h.name, program: h.program };
    }, function () { return null; });
  }
  // A flag only says "show this program in my app". From her account, flags are added for what she owns and dropped for what she
  // no longer owns (a refund, months that ended), so a typed link can never put a program in her app.
  function reconcile(programs) {
    var own = {}; programs.forEach(function (p) { own[p.slug] = 1; });
    HOME_KEYS.forEach(function (k) { var cur = jget(k), s = cur && slugOf(cur.u); if (s && !own[s]) del(k); });
  }
  function accountPrograms(acct) {
    return ((acct && acct.programs) || []).map(function (p) { return { slug: slugOf(p.home) || p.slug, ends: p.ends || '' }; }).filter(function (p) { return p.slug; });
  }
  function applyPrograms(acct) {
    var list = accountPrograms(acct);
    reconcile(list);
    return Promise.all(list.map(function (p) { return addHome(p.slug); })).then(function (added) {
      var got = added.filter(Boolean);
      // A Selar buyer's "Finish getting ..." card stops once sign-in lists what she bought.
      if (got.length) { var lead = jget('wg_lead'); if (lead && lead.product) { lead.product = ''; set('wg_lead', JSON.stringify(lead)); } }
      return got;
    });
  }

  // ── pass cookie ──
  function sendPass(pass) {
    if (!pass) return Promise.resolve();
    return fetch('/api/pass', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pass: pass }) }).catch(function () {});
  }

  // ── her name: the account is the source, the phone keeps a copy so every page can greet her ──
  function cleanName(v) { return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 30).trim(); }
  function writeName(n) { n = cleanName(n); if (n) set(NAME, JSON.stringify({ v: 1, name: n, asked: true })); return n; }

  // ── state that follows her to a new phone ──
  // The server accepts only these shapes (POST /account/state): reading = {program: lessons finished (a whole number)},
  // saved = tool keys, played = "stage.slug" keys. Anything else is refused as a whole, so each list is cleaned here.
  var STATE_KEY = /^[a-z0-9][a-z0-9_.-]{0,59}$/;
  function localState() {
    var reading = {}, saved = [], played = [], i, k, v;
    try {
      for (i = 0; i < w.localStorage.length; i++) {
        k = w.localStorage.key(i);
        var m = /^wg_read_([a-z0-9-]+)$/.exec(k);
        if (m) {
          v = jget(k);
          if (v && v.done && typeof v.done === 'object' && STATE_KEY.test(m[1])) {
            var n = Math.max(+v.n || 0, Object.keys(v.done).filter(function (id) { return v.done[id]; }).length);
            if (n > 0 && Object.keys(reading).length < 30) reading[m[1]] = Math.min(n, 100000);
          }
        } else if (w.WGApp && w.WGApp.toolKey && w.WGApp.toolKey.test(k) && STATE_KEY.test(k) && saved.length < 200) saved.push(k);
      }
    } catch (e) {}
    var pl = jget('wg_played_v1');
    if (pl && typeof pl === 'object') Object.keys(pl).forEach(function (p) {
      var x = /^\/(relationships|fertility|pregnancy|postpartum|parenting)\/tools\/([a-z0-9-]+)$/.exec(p);
      if (x && played.length < 200 && STATE_KEY.test(x[1] + '.' + x[2])) played.push(x[1] + '.' + x[2]);
    });
    return { reading: reading, saved: saved, played: played };
  }
  function applyState(st) {
    if (!st) return;
    var rd = st.reading || {};
    Object.keys(rd).forEach(function (slug) {
      if (!/^[a-z0-9-]+$/.test(slug) || rd[slug] == null) return;
      var theirs = rd[slug], mine = jget('wg_read_' + slug) || { done: {} };
      // The server keeps how many lessons she finished. A larger number than this phone's lifts the count; the lessons she ticked stay as they are.
      var count = typeof theirs === 'object' ? (+theirs.n || 0) : (+theirs || 0);
      if (count > (mine.n || 0)) {
        mine.done = mine.done || {}; mine.n = count;
        mine.at = mine.at || Date.now();
        set('wg_read_' + slug, JSON.stringify(mine));
      }
    });
    var pl = jget('wg_played_v1') || {}, grew = false;
    var theirsPlayed = Array.isArray(st.played) ? st.played : Object.keys(st.played || {});
    theirsPlayed.forEach(function (p) {
      var x = /^(relationships|fertility|pregnancy|postpartum|parenting)\.([a-z0-9-]+)$/.exec(p);
      var path = x ? '/' + x[1] + '/tools/' + x[2] : p;
      if (/^\/(relationships|fertility|pregnancy|postpartum|parenting)\/tools\/[a-z0-9-]+$/.test(path) && !pl[path]) { pl[path] = Date.now(); grew = true; }
    });
    if (grew) set('wg_played_v1', JSON.stringify(pl));
    if (Array.isArray(st.saved)) remember(null, { saved: st.saved.filter(function (k) { return typeof k === 'string' && /^wg_[a-z0-9_]+$/.test(k); }) });
  }
  var syncing = null;
  // Reads her account, sends what the phone has that the account lacks, and brings back what the phone lacks.
  function sync(force) {
    if (!signedIn()) return Promise.resolve(null);
    var last = 0; try { last = +w.sessionStorage.getItem('wg_sync_at') || 0; } catch (e) {}
    if (!force && Date.now() - last < 120000) return Promise.resolve(cached());
    if (syncing) return syncing;
    try { w.sessionStorage.setItem('wg_sync_at', String(Date.now())); } catch (e) {}
    syncing = authed('GET', '/account').then(function (j) {
      if (!j.ok) return null;
      remember(j.account);
      if (j.account && j.account.name) writeName(j.account.name);
      return applyPrograms(j.account).then(function () {
        applyState(j.state);
        return authed('POST', '/account/state', localState());
      }).then(function (r) { if (r && r.ok) applyState(r.state); return cached(); });
    }).catch(function () { return null; }).then(function (x) { syncing = null; return x; });
    return syncing;
  }

  // ── sign in ──
  // A right code or link: the session, the pass, her programs, her name, and her state all land on this phone.
  function adopt(j) {
    if (!j || !j.ok) return Promise.resolve(j);
    var acct = j.account || null;
    if (j.token) { set(SESSION, j.token); remember(acct || { email: '', name: '', programs: [] }); }
    if (acct && acct.name) writeName(acct.name);
    return sendPass(j.pass)
      .then(function () {
        if (acct) return applyPrograms(acct);
        // The earlier server answered with codes and no account; keep that working until the new server is live.
        return Promise.all((j.codes || []).map(function (c) { return addHome(slugOf(c.program_home)); })).then(function (a) { return a.filter(Boolean); });
      })
      .then(function (programs) {
        return (j.token ? sync(true) : Promise.resolve()).then(function () { return { ok: true, account: acct, programs: programs, token: !!j.token }; });
      });
  }

  w.WGAccess = {
    PAY_API: PAY_API,
    signedIn: signedIn,
    adopt: adopt,
    account: account,
    email: function () { var a = account(); return a ? a.email || '' : ''; },
    name: function () { var a = account(); return a ? a.name || '' : ''; },
    member: function () { var a = account(); return a && a.member ? a.member : null; },
    savedKeys: function () { var c = cached(); return c && c.saved ? c.saved : []; },
    program: function (slug) { return homes().then(function (x) { return x.homes[slug] || null; }, function () { return null; }); },
    addHome: addHome,
    push: push,
    // The server answers the same for every email, so no one can learn whether an address bought a program.
    // create:true makes a plain account first when the email has none (the "Make the app yours" screen).
    signin: function (email, opts) {
      var b = { email: email }; if (opts && opts.name) b.name = opts.name; if (opts && opts.create) b.create = true;
      return request('POST', '/access/signin', b);
    },
    check: function (email, code) { return request('POST', '/access/signin/check', { email: email, code: code }).then(adopt); },
    // The one-tap link in the buyer email. It signs her in as a right code does, once.
    link: function (tok) { return request('POST', '/access/signin/link', { token: tok }).then(adopt); },
    signout: function () {
      var tok = token();
      var done = function () {
        forget(); HOME_KEYS.forEach(del);
        return fetch('/api/pass', { method: 'DELETE', credentials: 'same-origin' }).catch(function () {});
      };
      return (tok ? request('POST', '/account/signout', {}, tok).catch(function () {}) : Promise.resolve()).then(done);
    },
    setName: function (n) {
      n = writeName(n); if (!n) return Promise.resolve(false);
      var c = cached(); if (c && c.account) { c.account.name = n; remember(c.account); }
      return signedIn() ? authed('POST', '/account/name', { name: n }).then(function (j) { return !!j.ok; }) : Promise.resolve(true);
    },
    sync: sync,
    refresh: function () { return sync(true); },
    // ── the First 1,000 ──
    first1000: {
      // { ok, taken, left, open, round, round_size, round_taken, round_left, round_open }. taken and left count all 1,000 places;
      // the round fields count the open round (100 places). open is true only when a claim would succeed now.
      // On localhost, ?f1kleft=N pretends N places are left of 1,000, and ?f1kround=R&f1kroundtaken=M pretends round R (1 to 10) has
      // M of its 100 places taken (M=100 is a full round). A check only, never on the live site.
      status: function () { return request('GET', '/first1000/status').then(function (j) { return j.ok ? previewStatus(j) : null; }, function () { return null; }); },
      claim: function (body) {
        return request('POST', '/first1000/claim', body).then(function (j) {
          if (!j.ok) return j;
          push('first1000_claim');
          return adopt(j).then(function (a) { a.ok = true; return a; });
        });
      },
      // The day 7 feedback form. The server keeps her first answers only and adds the feedback step (2 months) once, while her access
      // is active. On success her account is read again, so the new end date and the step show at once. The event carries no answers.
      feedback: function (answers) {
        return authed('POST', '/member/feedback', { answers: answers }).then(function (j) {
          if (!j.ok) return j;
          push('member_feedback');
          return sync(true).then(function () { return j; });
        });
      },
      // Each step counts once on the server; the answer carries the new end date and the steps she has finished.
      step: function (step) {
        return authed('POST', '/member/step', { step: step }).then(function (j) {
          if (j.ok) { var c = cached(); if (c && c.account && c.account.member) { c.account.member.ends = j.ends || c.account.member.ends; c.account.member.steps = j.steps || c.account.member.steps; remember(c.account); } }
          return j;
        });
      }
    }
  };

  // A signed-in phone keeps its account fresh when a page opens, and sends her place when she leaves a lesson.
  if (signedIn()) {
    d.addEventListener('DOMContentLoaded', function () { sync(false); });
    d.addEventListener('visibilitychange', function () { if (d.visibilityState === 'hidden') { try { w.sessionStorage.removeItem('wg_sync_at'); } catch (e) {} } });
  }
})(window, document);
