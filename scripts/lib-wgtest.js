// Shared helpers for test-streak.js and test-capture.js: an iPhone-size page, a payment server that never leaves the machine,
// and relative dates. Every request to the payment server is recorded in window.__reqs and answered locally.
const puppeteer = require('puppeteer-core');
const B = process.env.WG_BASE || 'http://localhost:' + (process.env.WG_PORT || 8008);
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const out = [], errs = [];
const ok = (n, p, x = '') => out.push((p ? 'PASS' : 'FAIL') + '  ' + n + (!p && x ? '  (' + x + ')' : ''));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => (n < 10 ? '0' : '') + n;
const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const plus = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return iso(d); };
const isoWeek = (s) => { const [y, m, d] = s.split('-').map(Number); const t = new Date(Date.UTC(y, m - 1, d)); const dn = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - dn); const yy = t.getUTCFullYear(); return yy + '-W' + pad(Math.ceil(((t - Date.UTC(yy, 0, 1)) / 864e5 + 1) / 7)); };
let browser;
async function launch() { browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-first-run'] }); return browser; }
async function open(seed, url, o = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent(o.ua || IPHONE);
  page.on('pageerror', (e) => errs.push(url + ' ' + e.message));
  await page.evaluateOnNewDocument((seed, route) => {
    window.__reqs = [];
    const real = window.fetch.bind(window);
    window.fetch = (u, init) => {
      u = String(u);
      // route['/assets/data/push.json'] stands in for the site's push key file (the real file holds the live public key).
      if (/\/assets\/data\/push\.json/.test(u) && route && route['/assets/data/push.json'] !== undefined)
        return Promise.resolve(new Response(JSON.stringify(route['/assets/data/push.json']), { status: 200, headers: { 'content-type': 'application/json' } }));
      if (/wg-pay\.realjaymes\.workers\.dev/.test(u)) {
        const path = u.replace(/^https:\/\/[^/]+/, '');
        window.__reqs.push({ url: u, path, method: (init && init.method) || 'GET', body: (init && init.body) || '', auth: ((init && init.headers) || {}).Authorization || '' });
        const r = route && route[path] !== undefined ? route[path] : { ok: true };
        // { __delay: ms, __body: {...} } answers late, to test what a page shows while it still does not know.
        if (r && r.__delay) return new Promise((res) => setTimeout(() => res(new Response(JSON.stringify(r.__body), { status: 200, headers: { 'content-type': 'application/json' } })), r.__delay));
        return Promise.resolve(new Response(JSON.stringify(r), { status: 200, headers: { 'content-type': 'application/json' } }));
      }
      return real(u, init);
    };
    if (!sessionStorage.getItem('seeded')) {
      sessionStorage.setItem('seeded', '1'); sessionStorage.setItem('wgapp_test', 'zz');
      Object.keys(seed).forEach((k) => localStorage.setItem(k, typeof seed[k] === 'string' ? seed[k] : JSON.stringify(seed[k])));
    }
  }, Object.assign({ wg_install_test_v1: { v: 1, g: 'later', s: 'x' }, wg_name_v1: { v: 1, name: '', asked: true } }, seed), o.route || null);
  await page.goto(B + url, { waitUntil: 'load' });
  await wait(o.wait || 900);
  return { page, close: () => ctx.close() };
}
const ls = (page, k) => page.evaluate((k) => { try { return JSON.parse(localStorage.getItem(k)); } catch (e) { return localStorage.getItem(k); } }, k);
const reqs = (page) => page.evaluate(() => window.__reqs);
const text = (page, sel) => page.$eval(sel, (e) => e.innerText).catch(() => '');
const has = (page, sel) => page.$(sel).then((e) => !!e);
module.exports = { puppeteer, B, out, errs, ok, wait, plus, iso, isoWeek, launch, open, ls, reqs, text, has, getBrowser: () => browser };
