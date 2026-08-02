/* Wholesome Girlies — geo-route diaspora visitors on the NG program pages.
 * Reads the visitor's country from Cloudflare's /cdn-cgi/trace and, for a non-Nigeria
 * human, redirects /programs/<slug> -> /programs/<slug>-diaspora (USD pricing), keeping
 * any query string / hash. Lets the emails use ONE set of links (the NG pages) and still
 * land diaspora buyers on the dollar pages.
 *
 * SEO-safe: declared crawlers are skipped, so the indexable NG page still gets indexed
 * (Googlebot etc. see the NG page, not the noindex diaspora one).
 * Local-safe: on the preview server there is no /cdn-cgi/trace, the fetch fails, nothing
 * happens. One shot per session. The -diaspora pages never run it (guarded below).
 */
(function () {
  'use strict';
  var ua = navigator.userAgent || '';
  // skip search engines, link unfurlers, and headless/preview agents
  if (/bot|crawl|spider|slurp|bing|google|yandex|baidu|duckduck|facebookexternalhit|embedly|quora|whatsapp|telegram|twitter|linkedin|preview|lighthouse|headless|pingdom|uptime/i.test(ua)) return;
  var path = location.pathname.replace(/\/+$/, '');
  // only the NG program sales pages; never the diaspora ones
  if (!/^\/programs\/[a-z0-9-]+$/.test(path) || /-diaspora$/.test(path)) return;
  try { if (sessionStorage.getItem('wg_geo')) return; } catch (e) {}
  fetch('/cdn-cgi/trace', { cache: 'no-store' })
    .then(function (r) { return r.text(); })
    .then(function (t) {
      try { sessionStorage.setItem('wg_geo', '1'); } catch (e) {}
      var m = t.match(/\bloc=([A-Z]{2})/);
      var cc = m ? m[1] : '';
      if (cc && cc !== 'NG') {
        location.replace(path + '-diaspora' + location.search + location.hash);
      }
    })
    .catch(function () {});
})();
