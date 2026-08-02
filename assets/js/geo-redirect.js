/* Wholesome Girlies — geo-route by continent on the NG program pages.
 * AFRICA sees the Nigeria (naira) page; ANYONE OUTSIDE AFRICA is redirected
 * /programs/<slug> -> /programs/<slug>-diaspora (USD), keeping query/hash. Lets the
 * emails use ONE set of NG links and still land overseas buyers on the dollar pages.
 * (An African buyer relates to naira; a US/UK/EU buyer sees dollars.)
 *
 * Geolocation: a client-side geo-IP API (geojs, with api.country.is as fallback).
 * NOTE: the apex is served directly by GitHub Pages — Cloudflare is DNS-only (grey
 * cloud), so the Cloudflare-proxy endpoint /cdn-cgi/trace is NOT available here; that
 * is why we use a geo-IP API instead. If the site is ever put behind Cloudflare's
 * proxy (orange cloud), we can switch to the free same-origin /cdn-cgi/trace.
 *
 * SEO-safe: declared crawlers are skipped, so the indexable NG page still gets indexed.
 * Fail-open: unknown country or both APIs down -> NO redirect (stay on NG), so an
 * African is never wrongly sent to the diaspora page. One shot per session. The
 * -diaspora pages never run it (guarded below).
 */
(function () {
  'use strict';
  // ISO 3166-1 alpha-2 for the 54 African states + Western Sahara (EH). These stay on NG.
  var AFRICA = ['DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CG','CD','CI','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW','EH'];
  var ua = navigator.userAgent || '';
  // skip search engines, link unfurlers, and headless/preview agents
  if (/bot|crawl|spider|slurp|bing|google|yandex|baidu|duckduck|facebookexternalhit|embedly|quora|whatsapp|telegram|twitter|linkedin|preview|lighthouse|headless|pingdom|uptime/i.test(ua)) return;
  var path = location.pathname.replace(/\/+$/, '');
  // only the NG program sales pages; never the diaspora ones
  if (!/^\/programs\/[a-z0-9-]+$/.test(path) || /-diaspora$/.test(path)) return;
  try { if (sessionStorage.getItem('wg_geo')) return; } catch (e) {}

  function decide(cc) {
    try { sessionStorage.setItem('wg_geo', '1'); } catch (e) {}
    // redirect only when we KNOW the country and it is outside Africa
    if (cc && AFRICA.indexOf(cc) === -1) {
      location.replace(path + '-diaspora' + location.search + location.hash);
    }
  }

  // geo-IP sources tried in order; each yields a 2-letter country code.
  var sources = [
    'https://get.geojs.io/v1/ip/country.json', // -> {"country":"US",...}
    'https://api.country.is/'                   // -> {"country":"US","ip":"..."}
  ];
  (function tryNext(i) {
    if (i >= sources.length) return; // all failed -> fail-open, stay on NG
    fetch(sources[i], { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) {
        var cc = String(j && j.country || '').toUpperCase();
        if (/^[A-Z]{2}$/.test(cc)) decide(cc); else throw 0;
      })
      .catch(function () { tryNext(i + 1); });
  })(0);
})();
