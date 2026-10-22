// Run with the gate on :8003:  wrangler pages dev . --binding GATE_SECRET=localtest --port 8003
// Then:  NODE_PATH=/tmp/wgog/node_modules node scripts/test-gate.js
// Proves the gate on the paid program pages (Selar to Bachs Migration Plan, phase 8). Passes are minted here with the
// test secret, in the same format the payment server uses (wg-pay src/pass.ts). It never calls the live payment server.
const crypto = require('crypto');
const puppeteer = require('puppeteer-core');
const BASE = process.env.GATE_BASE || 'http://localhost:8003';
const SECRET = process.env.GATE_SECRET || 'localtest';
const b64 = (b) => Buffer.from(b).toString('base64url');
const now = () => Math.floor(Date.now() / 1000);

function mint(slugs, { secret = SECRET, exp = now() + 86400, tamper = false } = {}) {
  const body = b64(JSON.stringify({ v: 1, p: slugs, e: 'test', iat: now(), exp }));
  const sig = crypto.createHmac('sha256', secret).update(body).digest('base64url');
  return tamper ? `${b64(JSON.stringify({ v: 1, p: ['first-baby-playbook'], e: 'x', iat: now(), exp: now() + 1e6 }))}.${sig}` : `${body}.${sig}`;
}

let failed = 0;
const ok = (cond, label) => { console.log((cond ? 'pass  ' : 'FAIL  ') + label); if (!cond) failed++; };

// One request with the cookie jar as a plain string. No redirects are followed, so a gate redirect shows up as 302.
async function get(path, cookie) {
  const r = await fetch(BASE + path, { redirect: 'manual', headers: cookie ? { cookie } : {} });
  return { status: r.status, location: r.headers.get('location') || '', cache: r.headers.get('cache-control') || '', text: r.status === 200 ? await r.text() : '' };
}
// Posts a pass to /api/pass the way the page does, and returns the wg_pass cookie it sets.
async function givePass(pass, cookie) {
  const r = await fetch(BASE + '/api/pass', { method: 'POST', headers: { 'content-type': 'application/json', ...(cookie ? { cookie } : {}) }, body: JSON.stringify({ pass }) });
  const set = r.headers.get('set-cookie') || '';
  return { status: r.status, set, cookie: (/wg_pass=[^;]+/.exec(set) || [''])[0], body: await r.json().catch(() => ({})) };
}
const locked = (r, slug) => r.status === 302 && r.location === `/signin/?program=${slug}`;

const FBP = 'first-baby-playbook', PPR = 'postpartum-reset';
const TY = (s) => `/programs/${s}/thank-you`;

(async () => {
  // 1. No cookie: every closed page goes to the sign-in screen for that program.
  for (const p of [TY(FBP), TY(FBP) + '.html', `/programs/${FBP}/read`, `/programs/${FBP}/read.html`, `/programs/${FBP}/%74hank-you`, `/programs//${FBP}//thank-you`, TY(FBP) + '/'])
    ok(locked(await get(p), FBP), `no cookie: ${p} goes to sign-in`);
  ok((await get(TY(FBP))).cache === 'private, no-store', 'the lock redirect is private, no-store');

  // 2. A good pass opens that program, nothing else, and the page is private, no-store.
  const a = await givePass(mint([FBP]));
  ok(a.status === 200 && /HttpOnly/.test(a.set) && /Secure/.test(a.set) && /SameSite=Lax/.test(a.set) && /Path=\//.test(a.set) && /Max-Age=\d+/.test(a.set), 'a good pass sets an HttpOnly, Secure, SameSite=Lax wg_pass cookie');
  const open = await get(TY(FBP), a.cookie);
  ok(open.status === 200 && /ph-top|ph-card/.test(open.text), 'a pass for the program serves its thank-you page');
  ok(open.cache === 'private, no-store', 'the served program page is private, no-store');
  ok((await get(`/programs/${FBP}/read`, a.cookie)).status === 200, 'a pass for the program serves its reader');
  ok(locked(await get(TY(PPR), a.cookie), PPR), 'a pass for another program does not open this one');
  ok(locked(await get(TY(FBP + '-diaspora'), a.cookie), FBP + '-diaspora'), 'the naira program pass does not open the diaspora home');

  // 3. Signing in adds and never removes.
  const b = await givePass(mint([PPR]), a.cookie);
  ok((await get(TY(FBP), b.cookie)).status === 200 && (await get(TY(PPR), b.cookie)).status === 200, 'a second pass merges with the cookie: both programs open');
  ok(JSON.stringify(b.body.programs) === JSON.stringify([FBP, PPR].sort()), 'the merged list holds both programs');

  // 4. Bad passes are refused and nothing opens.
  for (const [label, token] of [['tampered', mint([PPR], { tamper: true })], ['wrong secret', mint([FBP], { secret: 'other' })], ['expired', mint([FBP], { exp: now() - 10 })], ['garbage', 'abc.def']])
    ok((await givePass(token)).status === 400, `/api/pass refuses a ${label} pass`);
  ok(locked(await get(TY(FBP), 'wg_pass=' + mint([FBP], { tamper: true })), FBP), 'a tampered cookie opens nothing');
  ok(locked(await get(TY(FBP), 'wg_pass=' + mint([FBP], { exp: now() - 10 })), FBP), 'an expired cookie opens nothing');
  ok(locked(await get(TY(FBP), 'wg_pass=' + mint([FBP], { secret: 'other' })), FBP), 'a cookie signed with another secret opens nothing');
  ok((await fetch(BASE + '/api/pass')).status === 405, 'GET /api/pass is refused');
  ok((await fetch(BASE + '/api/pass', { method: 'POST', headers: { origin: 'https://evil.example', 'content-type': 'application/json' }, body: JSON.stringify({ pass: mint([FBP]) }) })).status === 403, '/api/pass refuses another website as the origin');

  // 5. The bundle rule: a Complete Motherhood Journey pass opens the four motherhood programs in its market, not Wife Material.
  const bundle = await givePass(mint(['complete-motherhood-journey']));
  ok((await get(TY(FBP), bundle.cookie)).status === 200 && (await get(TY(PPR), bundle.cookie)).status === 200, 'a bundle pass opens the single motherhood programs');
  ok(locked(await get(TY('wife-material-blueprint'), bundle.cookie), 'wife-material-blueprint'), 'a bundle pass does not open Wife Material');
  ok(locked(await get(TY(FBP + '-diaspora'), bundle.cookie), FBP + '-diaspora'), 'a naira bundle pass does not open the diaspora programs');

  // 6. Just paid: ?order= and t= serve a thank-you page. Made-up values do not.
  const order = 'ord_' + 'a1'.repeat(12), t = 'x'.repeat(43);
  ok((await get(`${TY(FBP)}?order=${order}&t=${t}`)).status === 200, 'a thank-you page with ?order= and t= is served without a cookie');
  const htmlOrder = await get(`${TY(FBP)}.html?order=${order}&t=${t}`);
  ok(htmlOrder.status !== 302 || !/signin/.test(htmlOrder.location), 'the .html address with ?order= is not sent to sign-in');
  ok(locked(await get(`${TY(FBP)}?order=bad&t=${t}`), FBP), 'a malformed ?order= is locked');
  ok(locked(await get(`${TY(FBP)}?order=${order}`), FBP), '?order= without t is locked');
  ok(locked(await get(`/programs/${FBP}/read?order=${order}&t=${t}`), FBP), 'the reader is not opened by ?order=');

  // 7. Never gated: sales pages, tools, the app, sign-in, go bridges, assets, the home page.
  for (const p of [`/programs/${FBP}`, `/programs/${FBP}-diaspora`, '/programs/', '/tools/', '/pregnancy/tools/due-date-calculator', '/app/', '/signin/', '/signin/?program=' + FBP, '/', '/assets/data/program-flags.json', '/legal/privacy'])
    ok((await get(p)).status === 200, `never gated: ${p}`);
  const go = await get('/go/'); ok(go.status !== 302 || !/signin/.test(go.location), 'never gated: /go/');

  // 8. In a real browser: the lock lands on the sign-in screen with the program banner, and a pass opens the page.
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setRequestInterception(true);
  page.on('request', (r) => (!r.url().startsWith(BASE) ? r.abort() : r.continue()));
  await page.goto(BASE + TY(FBP), { waitUntil: 'networkidle0' });
  ok(new URL(page.url()).pathname === '/signin/' && new URL(page.url()).searchParams.get('program') === FBP, 'browser: a visitor with no pass lands on /signin/?program=' + FBP);
  const banner = await page.evaluate(() => ({ shown: !document.querySelector('.signin-program').hidden, name: document.getElementById('programName').textContent, img: document.querySelector('.signin-program img').src, title: document.getElementById('signinTitle').textContent }));
  ok(banner.shown && banner.name === 'The First Baby Playbook' && /first-baby-playbook-cover/.test(banner.img) && /Sign in to read it/.test(banner.title), 'browser: the screen shows the program banner and "Sign in to read it"');
  await page.goto(BASE + TY(PPR), { waitUntil: 'networkidle0' });
  ok(await page.evaluate(() => document.getElementById('programName').textContent) === 'The 6-Week Postpartum Reset', 'browser: the banner names the program that was locked');
  // The page hands a pass to /api/pass the way wg-access.js does, then the program page opens.
  const res = await page.evaluate(async (pass) => (await fetch('/api/pass', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pass }) })).status, mint([FBP]));
  ok(res === 200, 'browser: the page can post a pass to /api/pass');
  await page.goto(BASE + TY(FBP), { waitUntil: 'networkidle0' });
  ok(new URL(page.url()).pathname === TY(FBP) && (await page.evaluate(() => !!document.querySelector('.ph-top'))), 'browser: with the cookie the program page opens');
  await page.goto(BASE + TY(PPR), { waitUntil: 'networkidle0' });
  ok(new URL(page.url()).pathname === '/signin/', 'browser: the same phone is still locked out of a program it has no pass for');
  const cookies = await ctx.cookies(BASE);
  ok(cookies.some((c) => c.name === 'wg_pass' && c.httpOnly && c.sameSite === 'Lax'), 'browser: the wg_pass cookie is HttpOnly and SameSite=Lax');

  // 9. The page wiring, with the payment server stubbed (nothing reaches the live one): a right email code and a paid
  // order each hand their pass to /api/pass before the page moves on, and the next load of the program page opens.
  const stub = async (pg, routes) => {
    await pg.setRequestInterception(true);
    pg.on('request', (r) => {
      const u = r.url(), cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': 'content-type', 'access-control-allow-methods': 'GET, POST, OPTIONS' };
      if (!u.startsWith(BASE) && !/wg-pay/.test(u)) return r.abort();
      if (/wg-pay/.test(u) && r.method() === 'OPTIONS') return r.respond({ status: 204, headers: cors });
      const hit = routes.find(([re]) => re.test(u));
      if (hit) return r.respond({ status: 200, contentType: 'application/json', headers: cors, body: JSON.stringify(hit[1]) });
      r.continue();
    });
  };
  const home = `${BASE}${TY(FBP)}`;
  const ctxA = await browser.createBrowserContext(), signin = await ctxA.newPage();
  await stub(signin, [[/signin\/check/, { ok: true, pass: mint([FBP]), codes: [{ code: 'FBP-AAAA-BBBB', product: FBP, name: 'The First Baby Playbook', market: 'ng', program_home: 'https://wholesomegirlies.xyz' + TY(FBP) }] }], [/access\/signin$/, { ok: true }]]);
  await signin.goto(BASE + '/signin/?live=1&program=' + FBP, { waitUntil: 'networkidle0' });
  await signin.type('#siEmail', 'ada@example.com'); await signin.click('#stepEmail .signin-btn');
  await signin.waitForSelector('#stepOtp:not([hidden])'); await signin.type('#siOtp', '123456'); await signin.click('#stepOtp .signin-btn');
  await signin.waitForSelector('#stepDone:not([hidden])');
  ok((await ctxA.cookies(BASE)).some((c) => c.name === 'wg_pass'), 'browser: a right email code leaves the wg_pass cookie before "You are in"');
  await signin.goto(home, { waitUntil: 'networkidle0' });
  ok(new URL(signin.url()).pathname === TY(FBP), 'browser: after email sign-in the program page opens');

  const ctxB = await browser.createBrowserContext(), paid = await ctxB.newPage();
  await stub(paid, [[/\/order\/ord_/, { status: 'paid', order_id: order, amount: '5700.00', currency: 'NGN', name: 'The First Baby Playbook', access: { code: 'FBP-AAAA-BBBB', revoked: false }, pass: mint([FBP]) }]]);
  await paid.goto(`${home}?order=${order}&t=${t}`, { waitUntil: 'load' });
  await paid.waitForFunction(() => document.body.innerText.includes('Your payment went through'), { timeout: 8000 }).catch(() => {});
  ok(new URL(paid.url()).pathname === TY(FBP) && (await paid.evaluate(() => document.body.innerText.includes('Your payment went through'))), 'browser: a paid order shows the thank-you page');
  ok((await ctxB.cookies(BASE)).some((c) => c.name === 'wg_pass'), 'browser: the paid order leaves the wg_pass cookie');
  await paid.goto(home, { waitUntil: 'networkidle0' });
  ok(new URL(paid.url()).pathname === TY(FBP), 'browser: reloading the thank-you page without ?order= still opens it');
  await browser.close();

  console.log(failed ? `\n${failed} FAILED` : '\ngate: all checks passed');
  process.exit(failed ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
