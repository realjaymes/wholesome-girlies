/* Wholesome Girlies — checkout-intent capture.
 * On a buy click (a.js-buy → a Selar URL) we capture name/email/phone BEFORE the
 * redirect: known buyers go straight through; unknown buyers get a small prefill
 * modal. The intent is logged to an Apps Script endpoint (→ Google Sheet + Brevo)
 * so Brevo can run the abandoned-cart / recovery automation, and dataLayer events
 * fire so GTM routes GA4 + (later) the ad pixels. Selar checkout is prefilled.
 * Mirrors the proven MIA pattern. Zero effect on pages without an a.js-buy button.
 */
(function () {
  'use strict';

  /* ── CONFIG ─────────────────────────────────────────────────────────────── */
  var INTENT_SHEET = 'PASTE_APPS_SCRIPT_EXEC_URL_HERE'; // set after deploying the Apps Script
  var SOURCE = 'wg-checkout-intent';
  var LEAD_KEY = 'wg_lead';

  /* ── identity: URL param (survives WhatsApp/email in-app browsers) or localStorage ── */
  function known() {
    var qp; try { qp = new URLSearchParams(location.search); } catch (e) { qp = null; }
    var lead = {}; try { lead = JSON.parse(localStorage.getItem(LEAD_KEY) || '{}') || {}; } catch (e) {}
    function pick(k) { return (qp && (qp.get(k) || '')) || ''; }
    return {
      email: (pick('email') || pick('lead') || lead.email || '').trim(),
      name:  (pick('fullname') || pick('name') || lead.name || '').trim(),
      phone: (lead.phone || '').trim()
    };
  }

  /* ── helpers ────────────────────────────────────────────────────────────── */
  function productFromHref(href) { var m = href.match(/selar\.com\/([^/?#]+)/i); return m ? m[1] : 'unknown'; }
  function normPhone(p) { // → 234XXXXXXXXXX
    p = (p || '').replace(/\D/g, '');
    if (p.indexOf('234') === 0) p = p.substring(3);
    if (p.indexOf('0') === 0) p = p.substring(1);
    return p ? '234' + p : '';
  }
  function selarUrl(base, name, email, phone) { // fill Selar prefill params, keep add_to_cart/coupon
    var url; try { url = new URL(base); } catch (e) { return base; }
    if (email) url.searchParams.set('email', email);
    if (name)  url.searchParams.set('fullname', name);
    if (phone) url.searchParams.set('mobile', '0' + phone.substring(3)); // local 0XXXX format
    return url.toString();
  }
  function openCheckout(u) {
    try { var w = window.open(u, '_blank'); if (w) { try { w.opener = null; } catch (e) {} return; } } catch (e) {}
    window.location.href = u;
  }
  function fireEvent(product, event) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: event, item_id: product, currency: 'NGN' });
  }
  function logIntent(d) {
    if (!INTENT_SHEET || INTENT_SHEET.indexOf('PASTE_') === 0) return; // not configured yet → skip logging, still redirect
    try {
      fetch(INTENT_SHEET, {
        method: 'POST', mode: 'no-cors', keepalive: true, // 3 gotchas: no-cors + keepalive + text/plain
        headers: { 'Content-Type': 'text/plain' },
        body: JSON.stringify({
          name: d.name || '', email: d.email || '', phone: d.phone || '',
          product: d.product || '', pageUrl: location.href, source: SOURCE, event: 'clicked_buy'
        })
      });
    } catch (e) {}
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
      '#wgBuyModal input{display:block;width:100%;margin-top:5px;padding:11px 13px;border:1px solid var(--line,#E4E1CE);border-radius:10px;font-size:1rem;font-family:inherit;background:#fff;color:var(--plum,#33322A);}',
      '#wgBuyModal .wgbm-go{width:100%;margin-top:6px;padding:13px;border:0;border-radius:10px;background:var(--terracotta,#6E7A3F);color:#fff;font-weight:800;font-size:1rem;cursor:pointer;font-family:inherit;}',
      '#wgBuyModal .wgbm-note{margin:12px 0 0;font-size:.78rem;color:var(--plum-soft,#66645A);text-align:center;}',
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
        '<h3 class="wgbm-title">Almost there</h3>' +
        '<p class="wgbm-sub">Pop in your details so we can set up your access and reach you if anything goes wrong at checkout.</p>' +
        '<form id="wgBuyForm" novalidate>' +
          '<label>Your name<input type="text" id="wgbmName" autocomplete="name" required></label>' +
          '<label>Email<input type="email" id="wgbmEmail" autocomplete="email" required></label>' +
          '<label>Phone (WhatsApp)<input type="tel" id="wgbmPhone" autocomplete="tel" required></label>' +
          '<button type="submit" class="wgbm-go">Continue to secure checkout →</button>' +
          '<p class="wgbm-note">Payment is handled securely by Selar.</p>' +
        '</form>' +
      '</div>';
    document.body.appendChild(modal);
    modal.querySelector('.wgbm-backdrop').addEventListener('click', close);
    modal.querySelector('.wgbm-close').addEventListener('click', close);
    modal.querySelector('#wgBuyForm').addEventListener('submit', submit);
  }
  function open() {
    buildModal(); modal.classList.add('open'); document.body.style.overflow = 'hidden';
    setTimeout(function () { try { document.getElementById('wgbmName').focus(); } catch (e) {} }, 60);
  }
  function close() { if (modal) { modal.classList.remove('open'); document.body.style.overflow = ''; } pendingHref = ''; }
  function submit(ev) {
    ev.preventDefault();
    var name = document.getElementById('wgbmName').value.trim();
    var email = document.getElementById('wgbmEmail').value.trim();
    var phone = normPhone(document.getElementById('wgbmPhone').value);
    if (!name || !email) { return; }
    try { localStorage.setItem(LEAD_KEY, JSON.stringify({ name: name, email: email, phone: phone, ts: Date.now() })); } catch (e) {}
    fireEvent(pendingProduct, 'begin_checkout');
    logIntent({ name: name, email: email, phone: phone, product: pendingProduct });
    openCheckout(selarUrl(pendingHref, name, email, phone));
    close();
  }

  /* ── click handler ──────────────────────────────────────────────────────── */
  document.addEventListener('click', function (e) {
    var a = e.target.closest && e.target.closest('a.js-buy');
    if (!a) return;
    var href = a.getAttribute('href') || '';
    if (href.indexOf('selar.com') === -1) return; // only real Selar buttons
    e.preventDefault();
    var product = productFromHref(href), k = known();
    if (k.email) { // known → straight through, no modal
      fireEvent(product, 'begin_checkout');
      logIntent({ name: k.name, email: k.email, phone: k.phone, product: product });
      openCheckout(selarUrl(href, k.name, k.email, k.phone));
      return;
    }
    pendingHref = href; pendingProduct = product; // unknown → collect first
    fireEvent(product, 'add_to_cart');
    open();
    if (k.name) { try { document.getElementById('wgbmName').value = k.name; } catch (e2) {} }
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') close(); });
})();
