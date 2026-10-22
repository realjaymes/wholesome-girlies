// Run with the site on :8001: NODE_PATH=/tmp/wgog/node_modules node scripts/test-checkout-route.js
// Which checkout does the Playbook buy button pick? Each case opens the sales page with a landing query,
// buys, and reports whether the page went to Selar (blocked here, never loaded) or asked wg-pay for a Bachs
// checkout (also blocked, so no order is made). Analytics and pixels are blocked, the sheet call is stubbed.
const puppeteer = require('puppeteer-core');
const cases = [
  ['no ad', ['']],
  ['Meta ad', ['utm_source=meta&utm_medium=paid']],
  ['TikTok ad', ['utm_source=tiktok']],
  ['Meta click id only', ['fbclid=abc123']],
  ['Meta, then TikTok later', ['utm_source=meta', 'utm_source=tiktok']],
  ['TikTok, then Meta later', ['utm_source=tiktok', 'utm_source=meta']],
  ['Meta 8 days ago', ['old-meta']],
];
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  for (const [label, visits] of cases) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    let went = '';
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const u = r.url();
      if (!/^http:\/\/localhost/.test(u) && /googletagmanager|google-analytics|analytics\.google|facebook|tiktok|clarity/.test(u)) return r.abort();
      if (/selar\.com/.test(u)) { went = went || 'Selar'; return r.abort(); }
      if (/wg-pay.*\/checkout/.test(u) && r.method() === 'POST') { went = went || 'Bachs'; return r.abort(); }
      r.continue();
    });
    await page.evaluateOnNewDocument(() => {
      const real = window.fetch;
      window.fetch = (u, o) => (String(u).includes('script.google.com') ? Promise.resolve(new Response('ok')) : real(u, o));
    });
    for (const v of visits) {
      if (v === 'old-meta') {
        await page.goto('http://localhost:8001/', { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => localStorage.setItem('wg_ad_click_v1', JSON.stringify({ s: 'meta', t: Date.now() - 8 * 864e5 })));
        continue;
      }
      await page.goto('http://localhost:8001/programs/first-baby-playbook?pay=bachs' + (v ? '&' + v : ''), { waitUntil: 'domcontentloaded' });
      await new Promise((r) => setTimeout(r, 300));
    }
    await page.goto('http://localhost:8001/programs/first-baby-playbook?pay=bachs', { waitUntil: 'networkidle2' });
    await page.click('a[href*="selar.com/firstbabyplaybook"]');
    await page.waitForSelector('#wgBuyModal.open');
    const note = await page.$eval('#wgBuyModal .wgbm-note', (e) => e.textContent);
    await page.evaluate(() => {
      const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
      set('wgbmName', 'Route Test'); set('wgbmEmail', 'route-test@example.com');
    });
    await page.click('.wgbm-go');
    await new Promise((r) => setTimeout(r, 5000));
    console.log(label.padEnd(26), '->', went || 'nothing', '| note:', note);
    await ctx.close();
  }
  await browser.close();
})().catch((e) => { console.error(e); process.exit(1); });
