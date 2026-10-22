/* Wholesome Girlies: the thank-you page after a Bachs payment.
 * Bachs sends her to the program home with ?order=<id>&t=<view token>. This asks the payment
 * server (wg-pay) for the order until the server has confirmed the payment through Bachs's signed
 * webhook, then shows her personal access code. The Bachs window saying "done" never unlocks
 * anything on its own. A page opened without ?order does nothing, so Selar buyers see the page as
 * before. The token is taken out of the address once read, so a shared or bookmarked link never
 * carries it. Until the server confirms the payment, the page shows only the order card: her program, its
 * code and the program flag on her phone wait for "paid", and a failed, held or refunded order never gets them.
 * The page's own flag script skips itself when ?order is present, so this file saves the flag on "paid".
 * Selar to Bachs Migration Plan, phase 3.
 *
 * On localhost only, ?order=demo&state=paid|held|failed|refunded shows each state without the server, for the
 * payments lab. A demo saves nothing and sends no event.
 */
(function () {
  'use strict';
  var PAY_API = 'https://wg-pay.realjaymes.workers.dev';
  var qp = new URLSearchParams(location.search);
  var order = qp.get('order') || '', t = qp.get('t') || '';
  var demo = /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && order === 'demo' ? (qp.get('state') || 'paid') : '';
  if (!demo && (!/^ord_[0-9a-f]{24}$/.test(order) || !t)) return;
  try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {}

  var CODES_KEY = 'wg_codes_v1'; // her personal codes on this phone by program home, as wg-access.js keeps them
  var slug = location.pathname.split('/')[2];
  var root = document.documentElement;
  root.classList.add('wg-order-locked');
  var host = document.querySelector('.ph-top') || document.querySelector('main') || document.body;
  var style = document.createElement('style');
  style.textContent = '.wg-order{margin:0 0 18px}.wg-order h2{margin:0 0 6px;font-size:1.25rem}.wg-order p{margin:0 0 8px}' +
    '.wg-order-code{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0 0!important;padding:12px 14px;border:2px solid var(--ink,#33322A);border-radius:12px;background:#fff}' +
    '.wg-order-locked main.ph>*:not(.ph-top-wrap),.wg-order-locked .ph-top>*:not(.wg-order){display:none!important}' +
    // While the program is hidden, the message sits in the middle of the screen, centred.
    '.wg-order-locked .ph-top-wrap{min-height:calc(100svh - 190px);display:flex;align-items:center}.wg-order-locked .ph-top{width:100%}' +
    '.wg-order-locked .wg-order{margin:0 auto;max-width:440px;text-align:center}.wg-order-locked .wg-order .btn{display:inline-block}' +
    '.wg-order .btn{margin-top:6px}.wg-order-code b{font-size:1.25rem;letter-spacing:.05em;white-space:nowrap}.wg-order-code button{flex:none;padding:8px 16px;font:700 .9rem/1 inherit;color:#fff;background:var(--terracotta,#6E7A3F);border:0;border-radius:999px;cursor:pointer}';
  document.head.appendChild(style);
  var card = document.createElement('div');
  card.className = 'wg-order';
  card.setAttribute('aria-live', 'polite');
  host.insertBefore(card, host.firstChild);

  function say(title, lines, code, link) {
    card.innerHTML = '';
    var box = document.createElement('div'); box.className = 'ph-card';
    var h = document.createElement('h2'); h.textContent = title; box.appendChild(h);
    lines.forEach(function (l) { var p = document.createElement('p'); p.className = 'muted'; p.textContent = l; box.appendChild(p); });
    if (code) {
      var row = document.createElement('p'); row.className = 'wg-order-code';
      var b = document.createElement('b'); b.textContent = code; row.appendChild(b);
      var btn = document.createElement('button'); btn.type = 'button'; btn.textContent = 'Copy';
      btn.addEventListener('click', function () {
        try { navigator.clipboard.writeText(code).then(function () { btn.textContent = 'Copied'; }); } catch (e) {}
      });
      row.appendChild(btn); box.appendChild(row);
    }
    if (link) { var a = document.createElement('a'); a.className = 'btn btn-primary'; a.href = link[1]; a.textContent = link[0]; box.appendChild(a); }
    card.appendChild(box);
  }

  function saveCode(code) {
    try {
      var all = JSON.parse(localStorage.getItem(CODES_KEY) || '{}') || {};
      all[slug] = code;
      localStorage.setItem(CODES_KEY, JSON.stringify(all));
    } catch (e) {}
  }

  // Hands the payment server's pass to this site, which keeps it in a cookie so the program pages open for this phone
  // (functions/api/pass.js). A site that cannot take it, like GitHub Pages today, answers 404 and this moves on.
  function sendPass(pass) {
    if (!pass || demo) return Promise.resolve();
    return fetch('/api/pass', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pass: pass }) }).catch(function () {});
  }

  // Her program flags, with the rule every program home and the app use: the Complete Motherhood Journey keeps a stage it holds.
  function saveHome() {
    return fetch('/assets/data/program-flags.json?v=20261022a').then(function (r) { return r.json(); }).then(function (d) {
      var h = d.homes[slug]; if (!h) return;
      var v = JSON.stringify({ u: location.pathname, l: h.label });
      h.flags.forEach(function (k) {
        try {
          var cur = JSON.parse(localStorage.getItem(k) || 'null');
          if (!(cur && /^\/programs\/complete-motherhood-journey/.test(cur.u))) localStorage.setItem(k, v);
        } catch (e) {}
      });
    }).catch(function () {});
  }

  function purchaseOnce(o) { // GA4 purchase, once per order on this phone
    var key = 'wg_purchase_' + o.order_id;
    try { if (localStorage.getItem(key)) return; localStorage.setItem(key, '1'); } catch (e) {}
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: 'purchase', transaction_id: o.order_id, value: Number(o.amount), currency: o.currency, item_id: o.name });
  }

  var tries = 0;
  function demoOrder() { // the server's answer for each lab state; paid arrives on the third check, as a real payment does
    var paid = tries >= 3;
    if (demo === 'paid') return paid ? { status: 'paid', access: { code: 'FBP-7K2M-Q9XP' } } : { status: 'pending' };
    if (demo === 'refunded') return { status: 'paid', access: { code: 'FBP-7K2M-Q9XP', revoked: true } };
    return { status: demo };
  }
  function check() {
    tries++;
    (demo ? Promise.resolve(demoOrder()) : fetch(PAY_API + '/order/' + order + '?t=' + encodeURIComponent(t))
      .then(function (r) { return r.ok ? r.json() : null; }))
      .then(function (o) {
        if (!o) return say('We could not find this payment', ['Check the email we sent you. Reply to that email if you need help.']);
        if (o.status === 'paid' && o.access && !o.access.revoked) {
          // The pass goes to the site first, so the program is never shown before this phone can open it again.
          return sendPass(o.pass).then(function () {
            root.classList.remove('wg-order-locked');
            if (!demo) { saveCode(o.access.code); saveHome(); }
            var shared = document.querySelector('.ph-code b');
            if (shared) shared.textContent = o.access.code;
            if (!demo) purchaseOnce(o);
            return say('Your payment went through', ['This is your personal access code. We also emailed it to you. It works on up to three of your own phones or devices.'], o.access.code);
          });
        }
        if (o.status === 'paid') return say('This program is no longer active', ['The payment was refunded or reversed. Reply to your access code email if you think this is a mistake.']);
        if (o.status === 'held') return say('We are checking your payment', ['Your payment reached us, and we are checking it before we send your code. We will email you within a day.']);
        if (o.status === 'failed') return say('Your payment did not go through', ['If money left your account, we will email your code as soon as the payment reaches us. If it did not, go back to the program page to try again.'], '', ['Back to the program page', '/programs/' + slug]);
        if (tries < 30) { say('Confirming your payment', ['This takes a few seconds. Please keep this page open.']); setTimeout(check, 2000); return; }
        say('Your payment is still being confirmed', ['We will email your access code as soon as it is confirmed. You can close this page.']);
      })
      .catch(function () {
        if (tries < 30) { setTimeout(check, 3000); return; }
        say('We could not check your payment', ['We will email your access code once the payment is confirmed.']);
      });
  }
  say('Confirming your payment', ['This takes a few seconds. Please keep this page open.']);
  check();
})();
