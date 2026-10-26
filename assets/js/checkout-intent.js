/* Wholesome Girlies — checkout-intent capture.
 * On a buy click (any Selar add-to-cart button) we capture name/email/phone BEFORE
 * the redirect: buyers arriving from their own recovery/WhatsApp link (details in the
 * link) go straight through; everyone else gets a small prefill modal, filled in with a
 * "Not you?" link when details were saved on this device in the last 30 days. The intent is logged to an Apps Script endpoint (→ Google Sheet + Brevo)
 * so Brevo can run the abandoned-cart / recovery automation, and dataLayer events
 * fire so GTM routes GA4 + (later) the ad pixels. Selar checkout is prefilled.
 * Mirrors the proven MIA pattern. Zero effect on pages without a Selar buy button.
 */
(function () {
  'use strict';

  /* ── CONFIG ─────────────────────────────────────────────────────────────── */
  var INTENT_SHEET = 'https://script.google.com/macros/s/AKfycbwrnzqMHR42YRf--yNocE4y2LIv19oMDFxRivhi6KN0WdKS1MpkpmlSYbvpMHzDgSb6/exec';
  var SOURCE = 'wg-checkout-intent';
  var LEAD_KEY = 'wg_lead';

  /* Selar slug → display name, so the logged `product` matches the Brevo automations
   * (and reads cleanly in GA4 / the ad pixels). One name per offer, market-agnostic
   * (NG and diaspora share the same Selar slug). */
  var PRODUCTS = {
    tryingtoconceiveblueprint: 'The Trying-to-Conceive Blueprint',
    firstpregnancyplan:        'The First Pregnancy Plan',
    postpartumreset:           'The 6-Week Postpartum Reset',
    firstbabyplaybook:         'The First Baby Playbook',
    wifematerialblueprint:     'The Wife Material Blueprint',
    completemotherhoodjourney: 'The Complete Motherhood Journey'
  };

  /* ── identity: URL param (survives WhatsApp/email in-app browsers) or localStorage ──
   * The inline head script strips identity params from the address bar before GTM loads
   * and keeps the original query in window.__idq, so read that first. */
  var SAVED_TTL = 30 * 24 * 60 * 60 * 1000; // saved details are forgotten after 30 days
  function known() {
    var qp; try { qp = new URLSearchParams(window.__idq || location.search); } catch (e) { qp = null; }
    var lead = {}; try { lead = JSON.parse(localStorage.getItem(LEAD_KEY) || '{}') || {}; } catch (e) {}
    if (lead.email && !(lead.ts && Date.now() - lead.ts < SAVED_TTL)) { lead = {}; try { localStorage.removeItem(LEAD_KEY); } catch (e) {} }
    function pick(k) { return (qp && (qp.get(k) || '')) || ''; }
    var ue = (pick('email') || pick('lead')).trim(), same = !!(lead.email && lead.email === ue);
    if (ue) return { src: 'url', email: ue, name: (pick('fullname') || pick('name') || (same ? lead.name : '') || '').trim(), phone: (same ? (lead.phone || '') : '').trim() };
    return { src: lead.email ? 'saved' : '', email: (lead.email || '').trim(), name: (lead.name || '').trim(), phone: (lead.phone || '').trim() };
  }

  /* ── helpers ────────────────────────────────────────────────────────────── */
  function productFromHref(href) {
    var m = href.match(/selar\.com\/([^/?#]+)/i);
    var slug = m ? m[1].toLowerCase() : 'unknown';
    return PRODUCTS[slug] || slug; // display name for Brevo/analytics; raw slug if ever unmapped
  }
  function normPhone(p) { // → 234XXXXXXXXXX
    p = (p || '').replace(/\D/g, '');
    if (p.indexOf('234') === 0) p = p.substring(3);
    if (p.indexOf('0') === 0) p = p.substring(1);
    return p ? '234' + p : '';
  }
  /* Ad that brought her: the /go/ bridge page carries the UTMs and the program page does not, so read them from
   * this page's own query or the bridge page's address in document.referrer (same site, so the query survives),
   * and keep them for the tab's session. They ride on the logged Page URL, so every sheet row names its ad. */
  var UTM_KEY = 'wg_utm', UTM_FIELDS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content'];
  function captureUtm() {
    var found = '';
    [window.__idq || location.search, (function () { try { var r = new URL(document.referrer); return r.host === location.host ? r.search : ''; } catch (e) { return ''; } })()].some(function (q) {
      var qp; try { qp = new URLSearchParams(q || ''); } catch (e) { return false; }
      var out = new URLSearchParams();
      UTM_FIELDS.forEach(function (k) { if (qp.get(k)) out.set(k, qp.get(k)); });
      found = out.toString(); return !!found;
    });
    try { if (found) sessionStorage.setItem(UTM_KEY, found); else found = sessionStorage.getItem(UTM_KEY) || ''; } catch (e) {}
    return found;
  }
  var utm = captureUtm();
  function loggedPageUrl() { return location.origin + location.pathname + (utm ? '?' + utm : ''); }

  /* Validation. The form used to accept anything typed, and on 21 Oct half the checkouts carried no real email
   * ("e.g.b", a bare username), which Selar cannot take payment against. */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
  function emailError(v) {
    if (!v) return 'Enter your email address.';
    if (/^e\.g\b/i.test(v)) return 'Type your own email address, for example adaeze@gmail.com.';
    if (!EMAIL_RE.test(v)) return 'Enter your full email address, for example adaeze@gmail.com.';
    return '';
  }
  function phoneError(raw) { // optional; when given, a Nigerian number must have 10 digits after the 0 or 234
    var p = (raw || '').replace(/\D/g, '');
    if (!p) return '';
    var ng = /^(\+?234|0)/.test((raw || '').trim()) ? p.replace(/^234/, '').replace(/^0/, '') : null;
    if (ng !== null && ng.length !== 10) return 'Check your phone number. It should look like 08012345678.';
    if (p.length < 7 || p.length > 15) return 'Check your phone number. It should look like 08012345678.';
    return '';
  }
  function selarUrl(base, name, email, phone) { // fill Selar prefill params, keep add_to_cart/coupon
    var url; try { url = new URL(base); } catch (e) { return base; }
    if (email) url.searchParams.set('email', email);
    if (name)  url.searchParams.set('fullname', name);
    if (phone) url.searchParams.set('mobile', '0' + phone.substring(3)); // local 0XXXX format
    return url.toString();
  }
  function openCheckout(u) {
    window.location.href = u; // SAME TAB — reliable inside IG/FB/TikTok in-app browsers (new tab breaks there)
  }
  function fireEvent(product, event) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: event, item_id: product, currency: 'NGN' });
  }
  // A test on localhost never writes a row to the Checkout Intents sheet or sends a Lead to the ad pixels.
  var LOCAL = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  function logIntent(d) {
    if (LOCAL || !INTENT_SHEET || INTENT_SHEET.indexOf('PASTE_') === 0) return; // not configured yet → skip logging, still redirect
    try {
      fetch(INTENT_SHEET, {
        method: 'POST', mode: 'no-cors', keepalive: true, // 3 gotchas: no-cors + keepalive + text/plain
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          name: d.name || '', email: d.email || '', phone: d.phone || '',
          product: d.product || '', pageUrl: loggedPageUrl(), source: SOURCE, event: 'clicked_buy'
        })
      });
    } catch (e) {}
  }

  /* ── Bachs: programs that have moved off Selar ─────────────────────────────
   * A program listed in ON_BACHS pays on Bachs in a window over this page (the overlay), so she
   * never leaves Wholesome Girlies. The payment server (wg-pay) makes the order and the Bachs
   * checkout, and the thank-you page waits for the server to confirm the payment before it shows
   * her code: a message from the Bachs window never unlocks anything. If the Bachs script cannot
   * load, she goes to the Bachs payment page in this tab instead. If the server cannot make a
   * checkout, she goes to Selar as before, so no buyer is ever stuck.
   * This is the live route for every buyer except a Meta ad click (Selar to Bachs Migration Plan, phase 6). */
  var PAY_API = 'https://wg-pay.realjaymes.workers.dev';
  var BACHS_JS = 'https://checkout.bachs.io/bachs.js';
  /* All six programs pay on Bachs, in both markets (James, 22 October 2026). Selar slug -> server catalog key. */
  var ON_BACHS = {
    tryingtoconceiveblueprint: 'trying-to-conceive-blueprint',
    firstpregnancyplan:        'first-pregnancy-plan',
    postpartumreset:           'postpartum-reset',
    firstbabyplaybook:         'first-baby-playbook',
    wifematerialblueprint:     'wife-material-blueprint',
    completemotherhoodjourney: 'complete-motherhood-journey'
  };
  /* Buyers from Meta ads pay on Selar (decision 7 in the Selar to Bachs Migration Plan). Meta blocks every event
   * from this site as a health site, so a Bachs sale here never reaches Meta, and Meta campaigns optimise on
   * Selar's Purchase instead. A Meta ad click counts for 7 days (Meta's click window) and the newest ad click
   * wins, so a later TikTok click sends her to Bachs. The click is read from the landing address, or from the
   * /go/ bridge she came through: a Meta source with a paid medium (every Meta ad link carries
   * utm_source=meta&utm_medium=paid_social). fbclid and Meta's _fbc cookie never count on their own, because
   * Instagram and Facebook add fbclid to every link they open, organic bio and post links included.
   * wg_ad_click_v2 = {"s": "meta" | "tiktok", "t": ms}, on this phone only, never sent anywhere. */
  var AD_KEY = 'wg_ad_click_v2', AD_DAYS = 7, META_SOURCES = /^(meta|facebook|fb|instagram|ig)$/i, PAID = /^(paid|paid_social|paidsocial|cpc|ppc)$/i;
  function adSourceNow() {
    var now = Date.now(), rec = null, seen = '';
    try { rec = JSON.parse(localStorage.getItem(AD_KEY) || 'null'); } catch (e) {}
    [window.__idq || location.search, (function () { try { var r = new URL(document.referrer); return r.host === location.host ? r.search : ''; } catch (e) { return ''; } })()].some(function (q) {
      var qp; try { qp = new URLSearchParams(q || ''); } catch (e) { return false; }
      var src = qp.get('utm_source') || '', paid = PAID.test(qp.get('utm_medium') || '');
      if (META_SOURCES.test(src) && paid) seen = 'meta';
      else if ((/^tiktok$/i.test(src) && paid) || qp.get('ttclid')) seen = 'tiktok';
      return !!seen;
    });
    if (seen) { rec = { s: seen, t: now }; try { localStorage.setItem(AD_KEY, JSON.stringify(rec)); } catch (e) {} }
    return rec && now - rec.t < AD_DAYS * 864e5 ? rec.s : '';
  }
  var adSource = adSourceNow();
  function bachsSlug(href) {
    var m = href.match(/selar\.com\/([^/?#]+)/i), slug = m ? m[1].toLowerCase() : '';
    if (!ON_BACHS[slug] || adSource === 'meta') return '';
    return slug;
  }
  function cookie(name) {
    var m = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
    return m ? decodeURIComponent(m[1]) : '';
  }
  function utmObject() {
    var out = {}; try { new URLSearchParams(utm).forEach(function (v, k) { out[k] = v; }); } catch (e) {}
    return out;
  }
  var bachsLoading, bachsFrameListener, bachsPoll;
  function loadBachs() {
    if (window.Bachs && window.Bachs.Checkout) return Promise.resolve();
    if (!bachsLoading) {
      bachsLoading = new Promise(function (resolve, reject) {
        var s = document.createElement('script');
        s.src = BACHS_JS; s.async = true;
        s.onload = function () { window.Bachs && window.Bachs.Checkout ? resolve() : reject(); };
        s.onerror = reject;
        setTimeout(reject, 8000); // a slow network gets the payment page instead of a long wait
        document.head.appendChild(s);
      });
      bachsLoading.catch(function () { bachsLoading = null; });
    }
    return bachsLoading;
  }
  function payOnBachs(slug, href, d) {
    var u; try { u = new URL(href); } catch (e) { u = null; }
    var qp; try { qp = new URLSearchParams((window.__idq || '') || location.search); } catch (e) { qp = null; }
    var body = {
      product: ON_BACHS[slug],
      market: u && u.searchParams.get('currency') === 'USD' ? 'diaspora' : 'ng',
      name: d.name, email: d.email, phone: d.phone ? '+' + d.phone : '',
      coupon: (u && u.searchParams.get('coupon')) || '',
      utm: utmObject(), fbp: cookie('_fbp'), fbc: cookie('_fbc'), ttclid: (qp && qp.get('ttclid')) || ''
    };
    setBusy(true);
    fetch(PAY_API + '/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.checkout_url || !j.thank_you_url) throw j; return j; }); })
      .then(function (j) {
        return loadBachs().then(function () {
          // A sandbox checkout lives on sandbox-checkout.bachs.io, so the overlay takes its origin from the link.
          window.Bachs.Initialize({ baseUrl: new URL(j.checkout_url).origin, onEvent: function (ev) {
            var t = ev && ev.type;
            if (t === 'checkout.completed') location.href = j.thank_you_url; // the page waits for the server to confirm
            if (t === 'checkout.error') openCheckout(j.checkout_url); // the overlay could not open, so use the Bachs page
          } });
          // Bachs sends its window on to the thank-you address after a payment, and that page then loads inside the window.
          // It tells this page (wg-frame-guard.js), and this page leaves for the thank-you address with her private token.
          // The message only moves the page: the thank-you page still waits for the server to confirm the payment.
          if (bachsFrameListener) window.removeEventListener('message', bachsFrameListener);
          bachsFrameListener = function (e) {
            var m = e.data;
            if (e.origin === location.origin && m && m.wg === 'order-in-frame' && (!m.order || m.order === j.order_id)) location.href = j.thank_you_url;
          };
          window.addEventListener('message', bachsFrameListener);
          // Bachs does not always send "completed" to this page before it redirects its own window, so this page also asks
          // the payment server about the order while the window is open, and leaves once the server says it is paid.
          clearInterval(bachsPoll);
          var polls = 0, tq = (/[?&]t=([^&]+)/.exec(j.thank_you_url) || [])[1] || '';
          bachsPoll = setInterval(function () {
            if (++polls > 400 || !(window.Bachs.Checkout.isOpen && window.Bachs.Checkout.isOpen())) { clearInterval(bachsPoll); return; }
            fetch(PAY_API + '/order/' + j.order_id + '?t=' + tq).then(function (r) { return r.ok ? r.json() : null; }).then(function (o) {
              if (o && o.status === 'paid') { clearInterval(bachsPoll); location.href = j.thank_you_url; }
            }).catch(function () {});
          }, 3000);
          close();
          window.Bachs.Checkout.open({ checkoutUrl: j.checkout_url });
          setBusy(false);
          // GTM sends this to TikTok as its checkout-started event. The order id lets the paid event match it later.
          window.dataLayer = window.dataLayer || [];
          window.dataLayer.push({ event: 'bachs_checkout_open', item_id: body.product, value: Number(j.amount), currency: j.currency, transaction_id: j.order_id });
        }, function () { openCheckout(j.checkout_url); });
      })
      .catch(function () { setBusy(false); openCheckout(selarUrl(href, d.name, d.email, d.phone)); close(); });
  }
  function setBusy(on) {
    var b = modal && modal.querySelector('.wgbm-go');
    if (!b) return;
    b.disabled = on; b.textContent = on ? 'Opening payment…' : 'Proceed to payment →';
  }

  /* ── modal (built once, in JS — no per-page HTML needed) ────────────────── */
  var modal, pendingHref = '', pendingProduct = '';
  function injectStyles() {
    if (document.getElementById('wgbm-styles')) return;
    var s = document.createElement('style'); s.id = 'wgbm-styles';
    s.textContent = [
      '#wgBuyModal{position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;padding:20px;}',
      '#wgBuyModal.open{display:flex;}',
      '#wgBuyModal .wgbm-backdrop{position:absolute;inset:0;background:rgba(51,50,42,.55);}',
      '#wgBuyModal .wgbm-card{position:relative;background:var(--cream,#FBF8EF);color:var(--plum,#33322A);max-width:400px;width:100%;border-radius:16px;padding:26px 24px;box-shadow:0 20px 60px rgba(0,0,0,.25);font-family:var(--sans,inherit);}',
      '#wgBuyModal .wgbm-title{margin:0 0 6px;font-family:var(--serif,inherit);font-size:1.4rem;}',
      '#wgBuyModal .wgbm-sub{margin:0 0 16px;font-size:.92rem;color:var(--plum-soft,#66645A);}',
      '#wgBuyModal label{display:block;font-weight:700;font-size:.85rem;margin:0 0 11px;}',
      '#wgBuyModal .wgbm-req{color:#C0763F;font-weight:700;}',
      '#wgBuyModal .wgbm-opt{font-weight:400;font-size:.82rem;color:var(--plum-soft,#66645A);}',
      '#wgBuyModal input{display:block;width:100%;margin-top:5px;padding:11px 13px;border:1px solid var(--line,#E4E1CE);border-radius:10px;font-size:1rem;font-family:inherit;background:#fff;color:var(--plum,#33322A);}',
      '#wgBuyModal .wgbm-go{width:100%;margin-top:6px;padding:13px;border:0;border-radius:10px;background:var(--terracotta,#6E7A3F);color:#fff;font-weight:800;font-size:1rem;cursor:pointer;font-family:inherit;}',
      '#wgBuyModal .wgbm-note{margin:12px 0 0;font-size:.78rem;color:var(--plum-soft,#66645A);text-align:center;}',
      '#wgBuyModal .wgbm-notyou{margin:0 0 12px;font-size:.85rem;color:var(--plum-soft,#66645A);}',
      '#wgBuyModal .wgbm-notyou a{color:inherit;text-decoration:underline;}',
      '#wgBuyModal .wgbm-err{display:block;margin-top:5px;font-weight:700;font-size:.8rem;color:#B3261E;}',
      '#wgBuyModal input[aria-invalid="true"]{border-color:#B3261E;}',
      '#wgBuyModal .wgbm-close{position:absolute;top:8px;right:14px;background:none;border:0;font-size:1.6rem;line-height:1;color:var(--plum-soft,#66645A);cursor:pointer;}'
    ].join('');
    document.head.appendChild(s);
  }
  function buildModal() {
    if (modal) return;
    injectStyles();
    modal = document.createElement('div');
    modal.id = 'wgBuyModal'; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');
    modal.innerHTML =
      '<div class="wgbm-backdrop"></div>' +
      '<div class="wgbm-card" role="document">' +
        '<button type="button" class="wgbm-close" aria-label="Close">×</button>' +
        '<h3 class="wgbm-title">Almost there — Step 1 of 2</h3>' +
        '<p class="wgbm-sub">Enter your details and you\'ll be taken straight to checkout with everything prefilled.</p>' +
        '<form id="wgBuyForm" novalidate>' +
          '<p class="wgbm-notyou" id="wgbmNotYou" style="display:none">Not you? <a href="#">Use different details</a></p>' +
          '<label>Full name <span class="wgbm-req">*</span><input type="text" id="wgbmName" autocomplete="name" placeholder="Your first and last name" required><span class="wgbm-err" id="wgbmNameErr" role="alert" hidden></span></label>' +
          '<label>Email address <span class="wgbm-req">*</span><input type="email" id="wgbmEmail" autocomplete="email" placeholder="you@gmail.com" inputmode="email" autocapitalize="off" spellcheck="false" required><span class="wgbm-err" id="wgbmEmailErr" role="alert" hidden></span></label>' +
          '<label>Phone (WhatsApp) <span class="wgbm-opt">· optional</span><input type="tel" id="wgbmPhone" autocomplete="tel" placeholder="08012345678"><span class="wgbm-err" id="wgbmPhoneErr" role="alert" hidden></span></label>' +
          '<button type="submit" class="wgbm-go">Proceed to payment →</button>' +
          '<p class="wgbm-note">Secure payment via Selar · Paystack · Bank Transfer</p>' +
        '</form>' +
      '</div>';
    document.body.appendChild(modal);
    modal.querySelector('.wgbm-backdrop').addEventListener('click', close);
    modal.querySelector('.wgbm-close').addEventListener('click', close);
    modal.querySelector('#wgBuyForm').addEventListener('submit', submit);
    modal.querySelector('#wgbmNotYou a').addEventListener('click', notYou);
  }
  function open(k) {
    buildModal(); modal.classList.add('open'); document.body.style.overflow = 'hidden';
    k = k || {};
    try {
      document.getElementById('wgBuyForm').reset(); clearErrors();
      var nEl = document.getElementById('wgbmName'), eEl = document.getElementById('wgbmEmail'), pEl = document.getElementById('wgbmPhone');
      if (k.name)  nEl.value = k.name;   // details saved on this device (30-day expiry)
      if (k.email) eEl.value = k.email;
      if (k.phone) pEl.value = k.phone.indexOf('234') === 0 ? '0' + k.phone.substring(3) : k.phone;
      document.getElementById('wgbmNotYou').style.display = k.src === 'saved' ? '' : 'none';
      modal.querySelector('.wgbm-note').textContent = bachsSlug(pendingHref) ? 'Secure payment by card or bank transfer' : 'Secure payment via Selar · Paystack · Bank Transfer';
      var first = !nEl.value ? nEl : (!eEl.value ? eEl : null); // focus the first empty required field; a filled form keeps the keyboard closed
      if (first) setTimeout(function () { try { first.focus(); } catch (e) {} }, 60);
    } catch (e) {}
  }
  function notYou(ev) { // shared device: clear the saved details and start fresh
    ev.preventDefault();
    try { localStorage.removeItem(LEAD_KEY); } catch (e) {}
    document.getElementById('wgBuyForm').reset(); clearErrors();
    document.getElementById('wgbmNotYou').style.display = 'none';
    try { document.getElementById('wgbmName').focus(); } catch (e) {}
  }
  function showError(id, msg) {
    var el = document.getElementById(id), err = document.getElementById(id + 'Err');
    if (!el || !err) return !!msg;
    err.textContent = msg; err.hidden = !msg;
    if (msg) el.setAttribute('aria-invalid', 'true'); else el.removeAttribute('aria-invalid');
    return !!msg;
  }
  function clearErrors() { ['wgbmName', 'wgbmEmail', 'wgbmPhone'].forEach(function (id) { showError(id, ''); }); }
  function close() { if (modal) { modal.classList.remove('open'); document.body.style.overflow = ''; } pendingHref = ''; }
  function submit(ev) {
    ev.preventDefault();
    var name = document.getElementById('wgbmName').value.trim();
    var email = document.getElementById('wgbmEmail').value.trim();
    var rawPhone = document.getElementById('wgbmPhone').value;
    clearErrors();
    var bad = [
      ['wgbmName', name.length < 2 ? 'Enter your name.' : ''],
      ['wgbmEmail', emailError(email)],
      ['wgbmPhone', phoneError(rawPhone)]
    ].filter(function (f) { return showError(f[0], f[1]); });
    if (bad.length) { try { document.getElementById(bad[0][0]).focus(); } catch (e) {} return; }
    email = email.toLowerCase();
    var phone = normPhone(rawPhone);
    try { localStorage.setItem(LEAD_KEY, JSON.stringify({ name: name, email: email, phone: phone, product: pendingProduct, ts: Date.now() })); } catch (e) {}
    // Lead — the owned conversion, fired on form submit BEFORE the Selar redirect (mirrors MIA).
    // event_id dedupes the browser Pixel Lead against the sGTM server CAPI Lead; lead_email/name/phone
    // feed Advanced Matching. GTM (GTM-KW443M88) fires both Lead tags off this single push.
    var leadId = 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 11);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'generate_lead', event_id: leadId, item_id: pendingProduct,
      lead_email: email, lead_name: name, lead_phone: phone
    });
    // Fire the ad-pixel Lead directly here (base pixels are already loaded via GTM, so fbq/ttq
    // exist on the page). We do NOT rely on a GTM tag for this one: the modal is JS-injected and
    // the submit redirects to Selar immediately, which the visual Event Setup Tool / Event Builder
    // can't catch reliably. event_id/eventID lets a future server-side Lead dedupe against this
    // browser event; email/phone feed advanced matching. sendBeacon under the hood survives the
    // redirect. RULE: keep Lead in ONE layer only — do not also add a GTM Lead tag on generate_lead.
    if (!LOCAL) try {
      if (window.ttq) {
        ttq.identify({ email: email, phone_number: phone ? '+' + phone : undefined });
        ttq.track('SubmitForm', { content_id: pendingProduct, content_type: 'product', currency: 'NGN' }, { event_id: leadId });
      }
      if (window.fbq) {
        fbq('track', 'Lead', { content_name: pendingProduct, currency: 'NGN' }, { eventID: leadId });
      }
    } catch (e) {}
    fireEvent(pendingProduct, 'begin_checkout');
    logIntent({ name: name, email: email, phone: phone, product: pendingProduct });
    var slug = bachsSlug(pendingHref);
    if (slug) { payOnBachs(slug, pendingHref, { name: name, email: email, phone: phone }); return; }
    openCheckout(selarUrl(pendingHref, name, email, phone));
    close();
  }

  /* ── click handler ──────────────────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a[href*="selar.com"][href*="add_to_cart"]');
    if (!a) return; // any Selar checkout button anywhere on the page (hero, sticky, pricing, final)
    var href = a.getAttribute('href') || '';
    e.preventDefault();
    var product = productFromHref(href), k = known();
    if (k.email && k.src === 'url') { // details from their own recovery/WhatsApp link → skip the form, straight to Selar prefilled (same tab)
      fireEvent(product, 'begin_checkout');
      logIntent({ name: k.name, email: k.email, phone: k.phone, product: product });
      // Bachs takes several seconds to open, so she sees her filled-in form with "Opening payment…" meanwhile.
      if (bachsSlug(href)) { pendingHref = href; pendingProduct = product; open(k); payOnBachs(bachsSlug(href), href, k); return; }
      openCheckout(selarUrl(href, k.name, k.email, k.phone));
      return;
    }
    pendingHref = href; pendingProduct = product; // unknown → collect first
    fireEvent(product, 'add_to_cart');
    open(k); // show the form, prefilled with "Not you?" when details were saved on this device
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });

  /* ── member coupon on the bundle ────────────────────────────────────────────
   * A buyer of any motherhood program (Trying-to-Conceive, First Pregnancy Plan, 6-Week Postpartum Reset or
   * First Baby Playbook, either market) gets the MOTHER coupon (35% off) on the Complete Motherhood Journey.
   * A Wife Material buyer never does. She counts as a member when her program home saved its flag on this device, or when she
   * came from that home's bundle card (?coupon=MOTHER). Every bundle buy button then carries &coupon=MOTHER, which
   * Selar applies at checkout, and the price card tells her the code and her price. A bundle owner and every other
   * visitor see the plain price, and a bundle owner sees no bundle offer on a sales page at all. */
  var COUPON = 'MOTHER', COUPON_OFF = 0.35;
  function bundleOwner() {
    var own = false;
    ['wg_fertility_home', 'wg_pregnancy_home', 'wg_pp_home', 'wg_parenting_home'].forEach(function (k) {
      try { var v = JSON.parse(localStorage.getItem(k) || 'null'); if (v && /^\/programs\/complete-motherhood-journey/.test(v.u || '')) own = true; } catch (e) {}
    });
    return own;
  }
  function hideBundleOffers() {
    if (!bundleOwner()) return;
    [].forEach.call(document.querySelectorAll('[data-bundle-offer]'), function (el) { el.hidden = true; el.style.display = 'none'; });
  }
  function couponMember() {
    var single = false, bundle = false;
    ['wg_fertility_home', 'wg_pregnancy_home', 'wg_pp_home', 'wg_parenting_home'].forEach(function (k) {
      try {
        var v = JSON.parse(localStorage.getItem(k) || 'null'), u = (v && v.u) || '';
        if (/^\/programs\/complete-motherhood-journey/.test(u)) bundle = true;
        else if (/^\/programs\/(trying-to-conceive-blueprint|first-pregnancy-plan|postpartum-reset|first-baby-playbook)(-diaspora)?\/thank-you/.test(u)) single = true;
      } catch (e) {}
    });
    var fromHome = new URLSearchParams(location.search).get('coupon') === COUPON;
    return !bundle && (single || fromHome);
  }
  function memberPrice(text) {
    var m = (text || '').match(/([₦$])\s*([\d,]+(?:\.\d+)?)/);
    if (!m) return '';
    var n = parseFloat(m[2].replace(/,/g, '')) * (1 - COUPON_OFF);
    return m[1] + (Math.abs(n - Math.round(n)) < 0.005 ? Math.round(n).toLocaleString('en-US') : n.toFixed(2));
  }
  function applyCoupon() {
    var links = document.querySelectorAll('a[href*="selar.com/completemotherhoodjourney"]');
    if (!links.length || !couponMember()) return;
    [].forEach.call(links, function (a) {
      try { var url = new URL(a.getAttribute('href')); url.searchParams.set('coupon', COUPON); a.setAttribute('href', url.toString()); } catch (e) {}
    });
    // The buy buttons and the sticky bar show her price; the "bought one by one" sum stays as it is.
    var plain = ((document.querySelector('.price') || {}).textContent || '').trim(), mine = memberPrice(plain);
    if (plain && mine) {
      [].forEach.call(document.querySelectorAll('a[href*="selar.com/completemotherhoodjourney"], .sc-price'), function (el) {
        var walk = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), n;
        while ((n = walk.nextNode())) if (n.nodeValue.indexOf(plain) >= 0) n.nodeValue = n.nodeValue.replace(plain, mine);
      });
    }
    [].forEach.call(document.querySelectorAll('.price'), function (p) {
      var price = memberPrice(p.textContent);
      if (!price || p.parentNode.querySelector('.wg-member-price')) return;
      var note = document.createElement('p');
      note.className = 'wg-member-price';
      note.style.cssText = 'margin:8px 0 0;padding:10px 12px;border:2px solid var(--ink,#33322A);border-radius:12px;background:var(--mustard-t,#F6E4BC);color:var(--ink,#33322A);font-weight:700;font-size:.92rem;';
      note.innerHTML = 'Your member code <strong>' + COUPON + '</strong> gives you ' + Math.round(COUPON_OFF * 100) + '% off. We add it at checkout, so you pay ' + price + '.';
      p.parentNode.insertBefore(note, p.nextSibling);
    });
  }
  function bundleRules() { hideBundleOffers(); applyCoupon(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', bundleRules); else bundleRules();
})();
