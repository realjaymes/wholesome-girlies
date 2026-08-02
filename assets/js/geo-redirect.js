/* Wholesome Girlies — geo-route by continent on the NG program pages.
 * Reads the visitor's country from Cloudflare's /cdn-cgi/trace. AFRICA sees the
 * Nigeria (naira) page; ANYONE OUTSIDE AFRICA is redirected /programs/<slug> ->
 * /programs/<slug>-diaspora (USD), keeping any query string / hash. Lets the emails
 * use ONE set of links (the NG pages) and still land non-African buyers on the dollar
 * pages. (An African buyer relates to naira; a US/UK/EU buyer sees dollars.)
 *
 * SEO-safe: declared crawlers are skipped, so the indexable NG page still gets indexed.
 * Fail-open: unknown country -> NO redirect (stay on the NG page), so an African is
 * never wrongly sent to the diaspora page. Local-safe: no /cdn-cgi/trace on the preview
 * server, the fetch fails, nothing happens. One shot per session. The -diaspora pages
 * never run it (guarded below).
 */
(function () {
  'use strict';
  // ISO 3166-1 alpha-2 for the 54 African states + Western Sahara (EH). These stay on the NG page.
  var AFRICA = ['DZ','AO','BJ','BW','BF','BI','CV','CM','CF','TD','KM','CG','CD','CI','DJ','EG','GQ','ER','SZ','ET','GA','GM','GH','GN','GW','KE','LS','LR','LY','MG','MW','ML','MR','MU','MA','MZ','NA','NE','NG','RW','ST','SN','SC','SL','SO','ZA','SS','SD','TZ','TG','TN','UG','ZM','ZW','EH'];
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
      // redirect only when we KNOW the country and it is outside Africa
      if (cc && AFRICA.indexOf(cc) === -1) {
        location.replace(path + '-diaspora' + location.search + location.hash);
      }
    })
    .catch(function () {});
})();
