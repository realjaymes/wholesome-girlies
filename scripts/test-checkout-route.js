// Run with the site on :8001: NODE_PATH=/tmp/wgog/node_modules node scripts/test-checkout-route.js
// Which checkout does a buy button pick? Each case opens a sales page (the ?pay=bachs parameter is now optional), buys, and reports whether the page
// went to Selar (blocked here, never loaded) or asked wg-pay for a Bachs checkout (also blocked, so no order is made),
// along with what it asked for. Analytics and pixels are blocked, the sheet call is stubbed.
//   Part 1: the Playbook under every ad history (Meta clicks stay on Selar for 7 days).
//   Part 2: all six programs in both markets reach Bachs with the right product and market, and a Meta click still goes to Selar.
//   Part 3: the bundle sends the MOTHER coupon only to a member, and no single program ever sends it.
// Exits 1 when any case differs from what it expects.
const puppeteer = require('puppeteer-core');
const BASE = 'http://localhost:8001/programs/';
const PROGRAMS = [
  ['trying-to-conceive-blueprint', 'tryingtoconceiveblueprint'],
  ['first-pregnancy-plan', 'firstpregnancyplan'],
  ['postpartum-reset', 'postpartumreset'],
  ['first-baby-playbook', 'firstbabyplaybook'],
  ['wife-material-blueprint', 'wifematerialblueprint'],
  ['complete-motherhood-journey', 'completemotherhoodjourney'],
];
// [label, landing visits, expected route]
const adCases = [
  ['no ad', [''], 'Bachs'],
  ['Meta ad', ['utm_source=meta&utm_medium=paid_social'], 'Selar'],
  ['TikTok ad', ['utm_source=tiktok&utm_medium=paid_social'], 'Bachs'],
  ['Instagram or Facebook link, fbclid only', ['fbclid=abc123'], 'Bachs'],
  ['Instagram bio link, organic tags', ['utm_source=instagram&utm_medium=social&fbclid=abc123'], 'Bachs'],
  ['Meta, then TikTok later', ['utm_source=meta&utm_medium=paid_social', 'utm_source=tiktok&utm_medium=paid_social'], 'Bachs'],
  ['TikTok, then Meta later', ['utm_source=tiktok&utm_medium=paid_social', 'utm_source=meta&utm_medium=paid_social'], 'Selar'],
  ['Meta 8 days ago', ['old-meta'], 'Bachs'],
];
let failed = 0;
const check = (label, ok, detail) => { if (!ok) failed++; console.log((ok ? 'PASS ' : 'FAIL ') + label.padEnd(58), detail); };

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });

  // Opens `slug`'s sales page after the given landing visits, buys, and returns { went, sent, note }.
  async function buy(slug, selar, visits, query) {
    const ctx = await browser.createBrowserContext();
    const page = await ctx.newPage();
    let went = '', sent = null;
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      const u = r.url();
      if (!/^http:\/\/localhost/.test(u) && /googletagmanager|google-analytics|analytics\.google|facebook|tiktok|clarity/.test(u)) return r.abort();
      if (/selar\.com/.test(u)) { went = went || 'Selar'; return r.abort(); }
      if (/wg-pay.*\/checkout/.test(u) && r.method() === 'POST') {
        went = went || 'Bachs';
        try { sent = JSON.parse(r.postData()); } catch (e) {}
        return r.abort();
      }
      r.continue();
    });
    await page.evaluateOnNewDocument(() => {
      const real = window.fetch;
      window.fetch = (u, o) => (String(u).includes('script.google.com') ? Promise.resolve(new Response('ok')) : real(u, o));
    });
    for (const v of visits) {
      if (v === 'old-meta') {
        await page.goto('http://localhost:8001/', { waitUntil: 'domcontentloaded' });
        await page.evaluate(() => localStorage.setItem('wg_ad_click_v2', JSON.stringify({ s: 'meta', t: Date.now() - 8 * 864e5 })));
        continue;
      }
      await page.goto(BASE + slug + '?pay=bachs' + (v ? '&' + v : ''), { waitUntil: 'domcontentloaded' });
      await new Promise((r) => setTimeout(r, 300));
    }
    await page.goto(BASE + slug + '?pay=bachs' + (query ? '&' + query : ''), { waitUntil: 'networkidle2' });
    await page.click('a[href*="selar.com/' + selar + '"]');
    await page.waitForSelector('#wgBuyModal.open');
    const note = await page.$eval('#wgBuyModal .wgbm-note', (e) => e.textContent);
    await page.evaluate(() => {
      const set = (id, v) => { const el = document.getElementById(id); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); };
      set('wgbmName', 'Route Test'); set('wgbmEmail', 'route-test@example.com');
    });
    await page.click('.wgbm-go');
    await new Promise((r) => setTimeout(r, 5000));
    await ctx.close();
    return { went: went || 'nothing', sent, note };
  }

  console.log('Part 1: the Playbook under every ad history');
  for (const [label, visits, want] of adCases) {
    const r = await buy('first-baby-playbook', 'firstbabyplaybook', visits);
    check(label, r.went === want, '-> ' + r.went + ' | note: ' + r.note);
  }

  console.log('\nPart 2: every program, both markets, no ad (Bachs) and a Meta click (Selar)');
  for (const [slug, selar] of PROGRAMS) {
    for (const diaspora of [false, true]) {
      const page = slug + (diaspora ? '-diaspora' : '');
      const r = await buy(page, selar, ['']);
      const ok = r.went === 'Bachs' && r.sent && r.sent.product === slug && r.sent.market === (diaspora ? 'diaspora' : 'ng') && !r.sent.coupon;
      check(page, ok, '-> ' + r.went + (r.sent ? ' | product ' + r.sent.product + ', market ' + r.sent.market + ', coupon "' + r.sent.coupon + '"' : ''));
      const m = await buy(page, selar, ['utm_source=meta&utm_medium=paid_social']);
      check(page + ' (Meta click)', m.went === 'Selar', '-> ' + m.went);
    }
  }

  console.log('\nPart 3: the bundle coupon');
  for (const diaspora of [false, true]) {
    const page = 'complete-motherhood-journey' + (diaspora ? '-diaspora' : '');
    const market = diaspora ? 'diaspora' : 'ng';
    const member = await buy(page, 'completemotherhoodjourney', [''], 'coupon=MOTHER');
    check(page + ' from a motherhood home card', member.went === 'Bachs' && member.sent && member.sent.coupon === 'MOTHER' && member.sent.market === market,
      '-> ' + member.went + (member.sent ? ' | coupon "' + member.sent.coupon + '", market ' + member.sent.market : ''));
    const plain = await buy(page, 'completemotherhoodjourney', ['']);
    check(page + ' for a visitor with no card', plain.went === 'Bachs' && plain.sent && !plain.sent.coupon,
      '-> ' + plain.went + (plain.sent ? ' | coupon "' + plain.sent.coupon + '"' : ''));
  }
  const single = await buy('first-pregnancy-plan', 'firstpregnancyplan', [''], 'coupon=MOTHER');
  check('a single program never sends MOTHER', single.went === 'Bachs' && single.sent && !single.sent.coupon, '-> coupon "' + (single.sent && single.sent.coupon) + '"');

  await browser.close();
  console.log(failed ? '\n' + failed + ' FAILED' : '\nAll route checks passed');
  if (failed) process.exit(1);
})().catch((e) => { console.error(e); process.exit(1); });
