/* Wholesome Girlies: a program home loaded inside a frame never shows its page.
 * The Bachs payment window is an iframe. After a payment Bachs can send that frame to the thank-you address,
 * and a program home loaded there would show the shared program code instead of the buyer's personal one.
 * So a framed home shows nothing but a "Payment received" card, tells the top page to move to the real
 * thank-you page (checkout-intent.js listens), and offers a button that opens it in the top window.
 * The framed copy never asks the payment server for anything: wg-order.js stops when it is framed.
 * Loaded first in the <head> of the 12 program homes, so the page never paints in a frame. */
(function () {
  'use strict';
  var framed = false;
  try { framed = window.top !== window.self; } catch (e) { framed = true; }
  if (!framed) return;
  var s = document.createElement('style');
  s.textContent = 'html.wg-framed body>*:not(.wg-frame-card){display:none!important}' +
    '.wg-frame-card{font:600 1.05rem/1.5 system-ui,sans-serif;text-align:center;max-width:380px;margin:18vh auto 0;padding:0 20px;color:#33322A}' +
    '.wg-frame-card a{display:inline-block;margin-top:14px;padding:12px 22px;border-radius:999px;background:#6E7A3F;color:#fff;text-decoration:none;font-weight:800}';
  document.head.appendChild(s);
  document.documentElement.classList.add('wg-framed');
  var m = /[?&]order=(ord_[0-9a-f]{24})/.exec(location.search);
  try { window.top.postMessage({ wg: 'order-in-frame', order: m ? m[1] : '' }, location.origin); } catch (e) {}
  document.addEventListener('DOMContentLoaded', function () {
    var c = document.createElement('div');
    c.className = 'wg-frame-card';
    c.innerHTML = '<p>Payment received. Opening your program page.</p>';
    var a = document.createElement('a');
    a.href = location.href; a.target = '_top'; a.textContent = 'Continue';
    c.appendChild(a);
    document.body.appendChild(c);
  });
})();
