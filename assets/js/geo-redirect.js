/* Wholesome Girlies — geo-route by continent on the NG program pages.
 * AFRICA sees the Nigeria (naira) page; ANYONE OUTSIDE AFRICA is redirected
 * /programs/<slug> -> /programs/<slug>-diaspora (USD), keeping query/hash. Lets the
 * emails use ONE set of NG links and still land overseas buyers on the dollar pages.
 *
 * Geolocation: two INDEPENDENT client-side geo-IP providers (geojs + ipwho.is). We
 * redirect to the USD page ONLY when BOTH agree the visitor is outside Africa. This is
 * deliberately biased toward the NG (naira) page: a single flaky/cached reading can
 * never wrongly send a Nigerian to the dollar page (the costly error — ₦13,700 vs $27).
 * The reverse error (a diaspora buyer seeing cheap naira) is the safe direction.
 *
 * Why not Cloudflare /cdn-cgi/trace: the apex is served directly by GitHub Pages
 * (Cloudflare is DNS-only / grey cloud), so that same-origin endpoint 404s here. If the
 * site is ever put behind Cloudflare's proxy (orange cloud), switch to the free,
 * per-request-accurate /cdn-cgi/trace and drop the third-party calls.
 *
 * SEO-safe: declared crawlers are skipped, so the indexable NG page still gets indexed.
 * Fail-open: any provider down / unknown country -> NO redirect (stay on NG). One shot
 * per session. The -diaspora pages never run it (guarded below).
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

  function norm(v) { v = String(v || '').toUpperCase(); return /^[A-Z]{2}$/.test(v) ? v : ''; }
  function outsideAfrica(cc) { return cc && AFRICA.indexOf(cc) === -1; }
  function get(url, key) {
    return fetch(url, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (j) { return norm(j[key]); })
      .catch(function () { return ''; });
  }

  Promise.all([
    get('https://get.geojs.io/v1/ip/country.json', 'country'),
    get('https://ipwho.is/?fields=country_code', 'country_code')
  ]).then(function (cc) {
    try { sessionStorage.setItem('wg_geo', '1'); } catch (e) {}
    // redirect only when BOTH providers returned a code AND both are outside Africa
    if (outsideAfrica(cc[0]) && outsideAfrica(cc[1])) {
      location.replace(path + '-diaspora' + location.search + location.hash);
    }
  });
})();
