/* Wholesome Girlies: the "Payment received" card, for both routes. Three ticks: Payment received, Setting up your program,
 * Ready on this phone.
 *
 * Bachs route. Bachs sends her to the program home with ?order=<id>&t=<view token>. This asks the payment server (wg-pay)
 * for the order until the server has confirmed the payment through Bachs's signed webhook. The Bachs window saying "done"
 * never unlocks anything on its own. A page opened without ?order does nothing. The token is taken out of the address once
 * read. Until the server confirms, the page shows only this card; the program flag on her phone waits for "paid", and a
 * failed, held or refunded order never gets it. The page's own flag script skips itself when ?order is present.
 *
 * Selar route. Selar sends her to /payment-received/?program=<slug>. Her sale reaches the server a few minutes later, so
 * this page checks every 20 seconds (WGAccess.ready, with the email she typed in our form) and opens her program by itself
 * once it is ready. "Paid with a different email?" lets her change the email. After 10 minutes it offers email sign-in.
 *
 * No program code is shown or saved anywhere. Sign-in is by email (wg-access.js).
 *
 * On localhost only, ?order=demo&state=paid|held|failed|refunded shows each Bachs state without the server, for the
 * payments lab, and /payment-received/?program=<slug>&demo=wait|ready|session shows the Selar states. A demo saves
 * nothing and sends no event.
 */
(function () {
  'use strict';
  var PAY_API = 'https://wg-pay.realjaymes.workers.dev';
  var local = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  // Inside a frame (the Bachs window) this page shows nothing and asks for nothing: wg-frame-guard.js moves the top page here.
  try { if (window.top !== window.self) return; } catch (e) { return; }
  var qp = new URLSearchParams(location.search);
  var selar = /\/payment-received\/?$/.test(location.pathname);
  var order = qp.get('order') || '', t = qp.get('t') || '';
  var demo = local && !selar && order === 'demo' ? (qp.get('state') || 'paid') : '';
  var selarDemo = local && selar ? (qp.get('demo') || '') : '';
  if (!selar && !demo && (!/^ord_[0-9a-f]{24}$/.test(order) || !t)) return;
  if (!selar) { try { history.replaceState(null, '', location.pathname + location.hash); } catch (e) {} }

  var slug = selar ? (qp.get('program') || '').replace(/[^a-z0-9-]/g, '') : location.pathname.split('/')[2];
  var root = document.documentElement;
  var host = document.querySelector('.ph-top') || document.querySelector('main') || document.body;
  if (!selar) root.classList.add('wg-order-locked');
  var style = document.createElement('style');
  style.textContent = '.wg-order{margin:0 0 18px}.wg-order h2{margin:0 0 6px;font-size:1.25rem}.wg-order p{margin:0 0 8px}' +
    '.wg-order-locked main.ph>*:not(.ph-top-wrap),.wg-order-locked .ph-top>*:not(.wg-order){display:none!important}' +
    '.wg-order-locked .ph-top-wrap{min-height:calc(100svh - 190px);display:flex;align-items:center}.wg-order-locked .ph-top{width:100%}' +
    '.wg-order-locked .wg-order,.wg-order.solo{margin:0 auto;max-width:440px;text-align:center}.wg-order .btn{display:inline-block;margin-top:6px}' +
    '.wg-ticks{list-style:none;display:flex;gap:6px;justify-content:center;margin:12px 0 14px;padding:0;font-size:.82rem;font-weight:800}' +
    '.wg-ticks li{flex:1;display:flex;flex-direction:column;align-items:center;gap:6px;opacity:.55}.wg-ticks li.on{opacity:1}' +
    '.wg-ticks .dot{display:grid;place-items:center;width:30px;height:30px;border-radius:50%;border:2px solid var(--ink,#33322A);background:#fff;font-size:.95rem;line-height:1}' +
    '.wg-ticks li.done .dot{background:var(--terracotta,#6E7A3F);color:#fff}' +
    '.wg-order-alt{margin-top:12px}.wg-order-alt input{width:100%;box-sizing:border-box;font:inherit;padding:11px 12px;border:2px solid var(--ink,#33322A);border-radius:12px;margin:8px 0}' +
    '.wg-order .link{background:none;border:0;padding:0;font:inherit;font-weight:800;text-decoration:underline;cursor:pointer;color:inherit}';
  document.head.appendChild(style);
  var card = document.createElement('div');
  card.className = 'wg-order' + (selar ? ' solo' : '');
  card.setAttribute('aria-live', 'polite');
  host.insertBefore(card, host.firstChild);

  function ticks(n) { // n ticks are done: 1 payment received, 2 setting up, 3 ready
    var ul = document.createElement('ul'); ul.className = 'wg-ticks';
    ['Payment received', 'Setting up your program', 'Ready on this phone'].forEach(function (l, i) {
      var li = document.createElement('li'), d = document.createElement('span'), tx = document.createElement('span');
      d.className = 'dot'; tx.textContent = l;
      if (i < n) { li.className = 'done on'; d.textContent = '✓'; } else if (i === n) { li.className = 'on'; d.textContent = '…'; }
      li.appendChild(d); li.appendChild(tx); ul.appendChild(li);
    });
    return ul;
  }
  function say(title, lines, done, link, extra) {
    card.textContent = '';
    var box = document.createElement('div'); box.className = 'ph-card';
    var h = document.createElement('h2'); h.textContent = title; box.appendChild(h);
    if (done != null) box.appendChild(ticks(done));
    lines.forEach(function (l) { var p = document.createElement('p'); p.className = 'muted'; p.textContent = l; box.appendChild(p); });
    if (link) { var a = document.createElement('a'); a.className = 'btn btn-primary'; a.href = link[1]; a.textContent = link[0]; if (link[2]) a.addEventListener('click', link[2]); box.appendChild(a); }
    if (extra) box.appendChild(extra);
    card.appendChild(box);
  }

  function leadEmail() { try { var l = JSON.parse(localStorage.getItem('wg_lead') || '{}') || {}; return String(l.email || '').trim(); } catch (e) { return ''; } }
  function mailLine(email) { return email ? 'We emailed ' + email + ' a link and how to sign in on another phone.' : 'We emailed you a link and how to sign in on another phone.'; }

  // Hands the payment server's pass to Wholesome Girlies, which keeps it in a cookie so the program pages open for this phone
  // (functions/api/pass.js). Where that cannot take it, like GitHub Pages today, it answers 404 and this moves on.
  function sendPass(pass) {
    if (!pass || demo) return Promise.resolve();
    return fetch('/api/pass', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pass: pass }) }).catch(function () {});
  }
  // Her program flags, with the rule every program home and the app use: the Complete Motherhood Journey keeps a stage it holds.
  function saveHome() {
    if (window.WGAccess && WGAccess.addHome) return Promise.resolve(WGAccess.addHome(slug));
    return fetch('/assets/data/program-flags.json?v=20261106b').then(function (r) { return r.json(); }).then(function (d) {
      var h = d.homes[slug]; if (!h) return;
      var v = JSON.stringify({ u: '/programs/' + slug + '/thank-you', l: h.label });
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
  function adopt(o) { return o && o.token && window.WGAccess && WGAccess.adopt ? WGAccess.adopt({ ok: true, token: o.token, pass: o.pass, account: o.account }) : Promise.resolve(); }

  // ── Bachs route ──
  var tries = 0;
  function demoOrder() {
    var paid = tries >= 3;
    if (demo === 'paid') return paid ? { status: 'paid', email: 'ada@example.com', access: {} } : { status: 'pending' };
    if (demo === 'refunded') return { status: 'paid', access: { revoked: true } };
    return { status: demo };
  }
  function openIt(e) { if (e) e.preventDefault(); card.remove(); root.classList.remove('wg-order-locked'); window.scrollTo(0, 0); }
  function check() {
    tries++;
    (demo ? Promise.resolve(demoOrder()) : fetch(PAY_API + '/order/' + order + '?t=' + encodeURIComponent(t)).then(function (r) { return r.ok ? r.json() : null; }))
      .then(function (o) {
        if (!o) return say('We could not find this payment', ['We could not match this payment. Reply to the email we sent you if you need help.']);
        if (o.status === 'paid' && o.access && !o.access.revoked) {
          // The pass goes to Wholesome Girlies first, so the program is never shown before this phone can open it again.
          return sendPass(o.pass).then(function () { return demo ? null : adopt(o); }).then(function () {
            if (!demo) { saveHome(); purchaseOnce(o); }
            say('Your payment went through', ['Your program is open on this phone. ' + mailLine(o.email || leadEmail())], 3, ['Open my program →', '#', openIt]);
          });
        }
        if (o.status === 'paid') return say('This program is no longer active', ['The payment was refunded or reversed. Reply to your last email from us if you think this is a mistake.']);
        if (o.status === 'held') return say('We are checking your payment', ['Your payment reached us, and we are checking it before we open your program. We will email you within a day.']);
        if (o.status === 'failed') return say('Your payment did not go through', ['If money left your account, we will email you as soon as the payment reaches us. If it did not, go back to the program page to try again.'], null, ['Back to the program page', '/programs/' + slug]);
        if (tries < 30) { say('Confirming your payment', ['This takes a few seconds. Please keep this page open.'], 1); setTimeout(check, 2000); return; }
        say('Your payment is still being confirmed', ['We will email you as soon as it is confirmed. You can close this page.']);
      })
      .catch(function () {
        if (tries < 30) { setTimeout(check, 3000); return; }
        say('We could not check your payment', ['We will email you once the payment is confirmed.']);
      });
  }

  // ── Selar route ──
  function selarWait() {
    var email = leadEmail(), started = Date.now(), timer = 0, polls = 0;
    var signin = '/signin/' + (slug ? '?program=' + encodeURIComponent(slug) : '');
    function other() { // Paid with a different email?
      var wrap = document.createElement('div'); wrap.className = 'wg-order-alt';
      var b = document.createElement('button'); b.type = 'button'; b.className = 'link'; b.textContent = 'Paid with a different email?'; wrap.appendChild(b);
      b.addEventListener('click', function () {
        wrap.textContent = '';
        var f = document.createElement('form'), i = document.createElement('input'), go = document.createElement('button');
        i.type = 'email'; i.autocomplete = 'email'; i.placeholder = 'The email you used on Selar'; i.value = email; i.setAttribute('aria-label', 'The email you used on Selar');
        go.type = 'submit'; go.className = 'btn btn-primary'; go.textContent = 'Check with this email';
        f.appendChild(i); f.appendChild(go); wrap.appendChild(f);
        f.addEventListener('submit', function (e) { e.preventDefault(); if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(i.value.trim())) { email = i.value.trim(); render(); poll(); } });
      });
      return wrap;
    }
    function render() {
      say('Payment received', ['We are setting up your program. This usually takes a few minutes. Keep this page open and it opens by itself.',
        email ? 'We will also email ' + email + ' the moment it is ready, so you can close this page if you need to.' : 'We will also email you the moment it is ready, so you can close this page if you need to.'], 1, null, other());
    }
    function ready(j) {
      clearTimeout(timer);
      if (j && j.token) { say('Your program is ready', ['It is open on this phone. ' + mailLine(email)], 3, ['Open my program →', '/programs/' + slug + '/thank-you']); setTimeout(function () { location.href = '/programs/' + slug + '/thank-you'; }, 1500); }
      else say('Your program is ready', ['Sign in with the email you paid with and your program opens. ' + mailLine(email)], 2, ['Sign in →', signin]);
    }
    function poll() {
      clearTimeout(timer); polls++;
      if (selarDemo) { if (selarDemo === 'wait' || polls < 2) { timer = setTimeout(poll, 20000); return; } return ready(selarDemo === 'session' ? { token: 'demo' } : { ready: true }); }
      if (!email || !window.WGAccess) { timer = setTimeout(poll, 20000); return; }
      WGAccess.ready(email, slug, '').then(function (j) {
        if (j && (j.ready || j.token)) return ready(j);
        if (Date.now() - started > 600000) { say('Still setting up', ['This is taking longer than usual. Sign in with the email you paid with and your program opens as soon as it is ready. We will also email you.'], 1, ['Sign in →', signin], other()); return; }
        timer = setTimeout(poll, 20000);
      }).catch(function () { timer = setTimeout(poll, 20000); });
    }
    render(); poll();
  }

  if (selar) { var fb = document.getElementById('payFallback'); if (fb) fb.hidden = true; selarWait(); return; }
  say('Confirming your payment', ['This takes a few seconds. Please keep this page open.'], 1);
  check();
})();
