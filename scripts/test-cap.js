// Tests the First 1,000 public cap on the site: every number women see comes from the status answer's cap ("the first 100 women",
// later 200, 500, 1,000), the bar and lines on /first, the centred closing column, the no-count fallback, the paused full state with its
// waiting list, the full refusal in the claim sheet, the app and tool cards, the streak sheet line, and that a buyer or a member never sees
// the offer. No round wording appears anywhere. The payment server is answered locally (lib-wgtest.js).
// Needs the site on :8008 (python3 serve.py 8008) or WG_PORT.
//   WG_PORT=8008 NODE_PATH=/tmp/wgog/node_modules node scripts/test-cap.js
const T = require('./lib-wgtest.js');
const { ok, wait, open, reqs, text, has, out, errs } = T;

// What the payment server answers: the first `cap` women, `taken` of them taken.
const st = (cap, taken) => ({ ok: true, taken, cap, left: cap - taken, open: cap - taken > 0 });
const S = (cap, taken) => ({ '/first1000/status': st(cap, taken), '/subscribe': { ok: true } });
const FLAG = { u: '/programs/first-pregnancy-plan/thank-you', l: 'Home' };
const rect = (page, sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, b: r.y + r.height }; });
const vis = (page, sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }).catch(() => false);
const fillPct = async (page, sel) => page.$eval(sel, (f) => { const t = f.parentElement.getBoundingClientRect().width; return Math.round(f.getBoundingClientRect().width / (t - 4) * 100); });
const body = (page) => page.evaluate(() => document.body.innerText);
const NOROUND = (t) => !/\bround\b|rounds\b|next round|100 at a time/i.test(t);

(async () => {
  try {
    await T.launch();
    let t, x, tx;

    // 1. the first 100: the bar at 0, partway and one place left
    for (const [taken, pct] of [[0, 0], [23, 23], [99, 99]]) {
      const line = `${taken} of 100 places taken`;
      t = await open({}, '/first/', { route: S(100, taken), wait: 1800 });
      const hero = await text(t.page, '.fx-hero [data-taken-line]'), fin = await text(t.page, '.fx-final [data-taken-line]');
      ok(`${taken} taken: the hero reads "${line}"`, hero === line, hero);
      ok(`${taken} taken: the closing section reads the same`, fin === line, fin);
      const hp = await fillPct(t.page, '.fx-hero [data-taken-fill]'), fp = await fillPct(t.page, '.fx-final [data-taken-fill]');
      ok(`${taken} taken: both bars fill ${pct}%`, Math.abs(hp - pct) <= 2 && Math.abs(fp - pct) <= 2, hp + ' ' + fp);
      ok(`${taken} taken: no full state shows`, !(await vis(t.page, '[data-taken]')));
      const b = await body(t.page);
      ok(`${taken} taken: the eyebrow, the lead and the title say 100`, (await text(t.page, '.fx-hero .eyebrow')).toLowerCase() === 'the first 100 women' && /As one of the first 100 women, you get/.test(await text(t.page, '.fx-hero .lead')) && /The First 100/.test(await t.page.title()));
      ok(`${taken} taken: the page names no 1,000 and no round`, !/first 1,000|1,000 places|1,000 women|The First 1,000/.test(b) && NOROUND(b), b.match(/.{20}1,000.{20}/) && b.match(/.{20}1,000.{20}/)[0]);
      await t.close();
    }

    // 2. the jump: the 100th place opens 200 at once, with no full state in between
    t = await open({}, '/first/', { route: S(200, 100), wait: 1800 });
    ok('cap 200 at 100 taken: "100 of 200 places taken", no full state', (await text(t.page, '.fx-hero [data-taken-line]')) === '100 of 200 places taken' && !(await vis(t.page, '[data-taken]')) && (await vis(t.page, '.fx-hero [data-claim]')));
    ok('cap 200: the eyebrow and lead say 200', (await text(t.page, '.fx-hero .eyebrow')).toLowerCase() === 'the first 200 women' && /one of the first 200 women/.test(await text(t.page, '.fx-hero .lead')));
    ok('cap 200: the bar fills 50%', Math.abs((await fillPct(t.page, '.fx-hero [data-taken-fill]')) - 50) <= 2);
    await t.close();
    t = await open({}, '/first/', { route: S(1000, 700), wait: 1800 });
    ok('cap 1,000 at 700 taken: "700 of 1,000 places taken" with a separator', (await text(t.page, '.fx-hero [data-taken-line]')) === '700 of 1,000 places taken' && (await text(t.page, '.fx-hero .eyebrow')).toLowerCase() === 'the first 1,000 women');
    await t.close();

    // 3. no count: no number at all
    t = await open({}, '/first/', { route: { '/first1000/status': { ok: false }, '/subscribe': { ok: true } }, wait: 1800 });
    const fb = await body(t.page);
    ok('no count: the hero keeps "No payment and no card. One place per woman." and shows no bar', /No payment and no card\. One place per woman\./.test(await text(t.page, '.fx-hero .fx-cta-fine')) && !(await vis(t.page, '.fx-hero [data-taken-meter]')) && !(await vis(t.page, '.fx-final [data-taken-meter]')));
    ok('no count: no number is named anywhere on the page', !/first 1,000|1,000 places|1,000 women|first \d+ women|\d+ of \d+ places/.test(fb) && /As one of the first women/.test(await text(t.page, '.fx-hero .lead')), (fb.match(/.{30}first \d.{20}/) || [''])[0]);
    ok('no count: the page title names no number', !/\d/.test(await t.page.title()), await t.page.title());
    await t.close();

    // 4. the closing section is one centred column: button, thin bar, count line; the bar as wide as the button, at 390 and 1728
    for (const W of [390, 1728]) {
      t = await open({}, '/first/', { route: S(100, 23), wait: 1800 });
      await t.page.setViewport({ width: W, height: 900, deviceScaleFactor: 1, isMobile: W < 600, hasTouch: W < 600 });
      await wait(900);
      const b = await rect(t.page, '.fx-final-cta > [data-claim]'), tr = await rect(t.page, '.fx-final .fx-taken-track'), ln = await rect(t.page, '.fx-final [data-taken-line]');
      const h2 = await rect(t.page, '.fx-final h2'), p = await rect(t.page, '.fx-final [data-final-line]');
      ok(`${W}px: heading, line, button, bar and count line stack in that order`, h2.b <= p.y + 1 && p.b <= b.y + 1 && b.b <= tr.y + 1 && tr.b <= ln.y + 1, JSON.stringify({ h2, p, b, tr, ln }));
      ok(`${W}px: the bar is as wide as the button`, Math.abs(tr.w - b.w) <= 1.5, `bar ${tr.w} button ${b.w}`);
      ok(`${W}px: the column is centred (button, bar and line share a centre line)`, Math.abs(b.cx - tr.cx) <= 1.5 && Math.abs(ln.cx - tr.cx) <= 2, `${b.cx} ${tr.cx} ${ln.cx}`);
      ok(`${W}px: the column is centred on the page`, Math.abs(b.cx - W / 2) <= 8, `${b.cx} vs ${W / 2}`);
      ok(`${W}px: no sideways scroll`, await t.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      await t.close();
    }

    // 5. paused and full: "All 100 places are taken." and the waiting list, never a later tier
    t = await open({}, '/first/', { route: S(100, 100), wait: 1800 });
    const fullTx = await text(t.page, '.fx-hero');
    ok('paused full: the hero reads "All 100 places for the first 100 women are taken" with an email field and "Tell me if a place opens"', /All 100 places for the first 100 women are taken/.test(fullTx) && (await vis(t.page, '[data-taken] input[type=email]')) && /Tell me if a place opens/.test(await text(t.page, '[data-taken] button')), fullTx);
    ok('paused full: no Claim button, no floating bar, no bar, no closing section', !(await vis(t.page, '.fx-hero [data-claim]')) && !(await vis(t.page, '[data-floatbar]')) && !(await vis(t.page, '.fx-hero [data-taken-meter]')) && !(await vis(t.page, '.fx-final')));
    const fb2 = await body(t.page);
    ok('paused full: no later tier and no round wording', NOROUND(fb2) && !/200|500|1,000/.test(fullTx));
    await t.page.$eval('[data-taken] input[type=email]', (e) => { e.value = 'Wait@Example.com'; });
    await t.page.$eval('[data-taken] form button[type=submit]', (e) => e.click());
    await wait(600);
    const sub = (await reqs(t.page)).filter((r) => r.path === '/subscribe').map((r) => JSON.parse(r.body));
    ok('waiting list: one POST /subscribe with list f1k_waitlist, consent, source f1k_full and nothing else', sub.length === 1 && sub[0].list === 'f1k_waitlist' && sub[0].consent === true && sub[0].source === 'f1k_full' && sub[0].email.toLowerCase() === 'wait@example.com' && Object.keys(sub[0]).sort().join() === 'consent,email,list,source', JSON.stringify(sub));
    const ev = await t.page.evaluate(() => window.dataLayer.filter((e) => e.event === 'capture_submit'));
    ok('waiting list: the only event is capture_submit with capture_point f1k_full', ev.length === 1 && ev[0].capture_point === 'f1k_full' && Object.keys(ev[0]).filter((k) => !/^gtm\./.test(k)).sort().join() === 'capture_point,event', JSON.stringify(ev));
    ok('waiting list: it thanks her', /Thank you\. We will email you if a place opens\./.test(await text(t.page, '[data-taken]')));
    await t.close();
    t = await open({ wg_capture_v1: { v: 1, lists: ['f1k_waitlist'], bar: 0 } }, '/first/', { route: S(100, 100), wait: 1800 });
    ok('already on the list: it says so and shows no form', /You are on the list/.test(await text(t.page, '[data-taken]')) && !(await has(t.page, '[data-taken] form')));
    await t.close();

    // 6. the claim refusal: James pauses and the cap is reached while she fills the form
    t = await open({}, '/first/?stage=pregnancy', { route: Object.assign(S(100, 60), { '/first1000/claim': { ok: false, error: 'full' } }), wait: 1500 });
    await t.page.$eval('.fx-hero [data-claim]', (e) => e.click()); await wait(500);
    await t.page.type('#fxName', 'Ngozi'); await t.page.$eval('.ff-next', (e) => e.click()); await wait(300);
    await t.page.type('#fxEmail', 'ngozi@example.com'); await t.page.$eval('.ff-next', (e) => e.click()); await wait(300);
    await t.page.type('#fxPhone', '08031234567'); await t.page.$eval('#fxConsent', (e) => e.click());
    await t.page.evaluate((full) => { const f = window.fetch; window.fetch = (u, i) => (/first1000\/status/.test(String(u)) ? Promise.resolve(new Response(JSON.stringify(full), { status: 200 })) : f(u, i)); }, st(100, 100));
    await t.page.$eval('.ff-next', (e) => e.click()); await wait(1200);
    const sheet = await text(t.page, '#fxSheet');
    ok('refusal: the sheet says "All 100 places are taken." and offers the waiting list, not a generic error', /All 100 places are taken\./.test(sheet) && /Tell me if a place opens/.test(sheet) && !/could not save/i.test(sheet), sheet.slice(0, 200));
    ok('refusal: her email is filled in', (await t.page.$eval('#fxSheet input[type=email]', (e) => e.value).catch(() => '')) === 'ngozi@example.com');
    ok('refusal: the page behind shows the full state too', /All 100 places for the first 100 women are taken/.test(await text(t.page, '.fx-hero')) && !(await vis(t.page, '.fx-hero [data-claim]')) && NOROUND(sheet));
    await t.close();

    // 7. localhost previews
    t = await open({}, '/first/?f1kcap=200&f1ktaken=100', { wait: 1500 });
    ok('preview ?f1kcap=200&f1ktaken=100 is the jump to 200', (await text(t.page, '.fx-hero [data-taken-line]')) === '100 of 200 places taken');
    await t.close();
    t = await open({}, '/first/?f1kleft=1', { wait: 1500 });
    ok('preview ?f1kleft=1 is one place left of 100', (await text(t.page, '.fx-hero [data-taken-line]')) === '99 of 100 places taken');
    await t.close();
    t = await open({}, '/first/?f1kleft=0', { wait: 1500 });
    ok('preview ?f1kleft=0 is the paused full state', /All 100 places for the first 100 women are taken/.test(await text(t.page, '.fx-hero')));
    await t.close();
    t = await open({}, '/first/?f1ktaken=23', { wait: 1500 });
    ok('preview ?f1ktaken=23 is 23 of 100', (await text(t.page, '.fx-hero [data-taken-line]')) === '23 of 100 places taken');
    await t.close();

    // 8. the app home card
    const offer = async (seed, route, url) => { x = await open(seed, url || '/app/', { route, wait: 1800 }); return text(x.page, '#appFirst'); };
    tx = await offer({}, S(100, 23));
    ok('app card: "This offer is for the first 100 women. 77 of 100 places are left."', /This offer is for the first 100 women\. 77 of 100 places are left\./.test(tx) && /Claim my place/.test(tx) && NOROUND(tx), tx);
    await x.close();
    tx = await offer({}, S(100, 99));
    ok('app card: one place left reads "1 of 100 places is left"', /1 of 100 places is left\./.test(tx), tx);
    await x.close();
    tx = await offer({}, S(200, 100));
    ok('app card: at the jump it reads the first 200 women, 100 of 200 left', /first 200 women\. 100 of 200 places are left\./.test(tx), tx);
    await x.close();
    tx = await offer({}, S(1000, 0));
    ok('app card: a thousands separator at 1,000', /first 1,000 women\. 1,000 of 1,000 places are left\./.test(tx), tx);
    await x.close();
    tx = await offer({}, S(100, 100));
    ok('app card, paused full: "All 100 places are taken." with a link to the waiting list, no claim button', /All 100 places are taken\./.test(tx) && /Tell me if a place opens/.test(tx) && !/Claim my place/.test(tx) && (await has(x.page, '#appFirst a[href="/first"]')), tx);
    ok('app card, paused full: the card stays small', (await rect(x.page, '#appFirst .f1k-offer')).h < 260);
    await x.close();
    tx = await offer({}, { '/first1000/status': { ok: false } });
    ok('app card, no count: no card', tx === '', tx);
    await x.close();
    tx = await offer({}, S(100, 23), '/app/?f1kcap=200&f1ktaken=150');
    ok('app card: the localhost preview wins', /first 200 women\. 50 of 200 places are left\./.test(tx), tx);
    await x.close();

    // 9. who never sees the card: a buyer, a member, a signed-in woman whose account lists a program
    const account = (extra) => Object.assign({ email: 'ada@example.com', name: '', programs: [], member: undefined }, extra);
    const signed = (acc) => ({ seed: { wg_session_v1: JSON.stringify({ token: 'tok123' }), wg_account_v1: { v: 1, at: Date.now(), account: acc, saved: [] } }, route: { '/account': { ok: true, account: acc, state: {} } } });
    for (const route of [S(100, 23), S(100, 100)]) {
      const label = route['/first1000/status'].open ? 'open' : 'paused full';
      tx = await offer({ wg_pregnancy_home: FLAG }, route);
      ok(`buyer (program flag), ${label}: no offer`, !/Get a program free|places/.test(tx), tx);
      await x.close();
      const mem = signed(account({ member: { stage: 'pregnancy', ends: new Date(Date.now() + 200 * 864e5).toISOString(), steps: {}, invite: 'ABC' } }));
      tx = await offer(mem.seed, Object.assign({}, route, mem.route));
      ok(`member, ${label}: only the steps card`, /Earn more free months/.test(tx) && !/places|Get a program free/.test(tx), tx);
      await x.close();
      const buyer = signed(account({ programs: [{ slug: 'first-pregnancy-plan', home: 'https://wholesomegirlies.xyz/programs/first-pregnancy-plan/thank-you' }] }));
      tx = await offer(buyer.seed, Object.assign({}, route, buyer.route));
      ok(`signed-in buyer, ${label}: no offer`, !/Get a program free|places/.test(tx), tx);
      await x.close();
    }
    x = await open({ wg_session_v1: JSON.stringify({ token: 'tok123' }) }, '/app/', { route: Object.assign(S(100, 23), { '/account': { __delay: 6000, __body: { ok: true, account: account(), state: {} } } }), wait: 1200 });
    ok('status not known yet (signed-in phone, account still loading): nothing shows', (await text(x.page, '#appFirst')) === '');
    await x.close();

    // 10. the tool page card
    const toolCard = async (seed, route, url) => { x = await open(seed, url || '/pregnancy/tools/hospital-bag-checklist', { route, wait: 1800 }); return text(x.page, '.program-cta'); };
    tx = await toolCard({}, S(100, 23));
    ok('tool page: "For the first 100 women. 77 of 100 places are left."', /free/.test(tx) && /For the first 100 women\. 77 of 100 places are left\./.test(tx) && /Already bought\? Sign in/.test(tx) && NOROUND(tx), tx);
    await x.close();
    tx = await toolCard({}, S(100, 99));
    ok('tool page: one place reads "1 of 100 places is left"', /1 of 100 places is left\./.test(tx), tx);
    await x.close();
    tx = await toolCard({}, S(100, 100));
    ok('tool page, paused full: "All 100 places are taken." with the waiting list link and a way to buy', /All 100 places are taken\./.test(tx) && /Tell me if a place opens/.test(tx) && (await has(x.page, '.program-cta a[href^="/first"]')) && !/Claim my place/.test(tx), tx);
    await x.close();
    tx = await toolCard({}, { '/first1000/status': { ok: false } });
    ok('tool page, no count: the paid program card stays', !/free|places/.test(tx), tx);
    await x.close();
    tx = await toolCard({ wg_pregnancy_home: FLAG }, S(100, 23));
    ok('tool page: a buyer keeps "Back to your" and sees no count', /Back to your/.test(tx) && !/places/.test(tx), tx);
    await x.close();
    const mem2 = signed(account({ member: { stage: 'pregnancy', ends: new Date(Date.now() + 200 * 864e5).toISOString(), steps: {}, invite: 'ABC' } }));
    tx = await toolCard(mem2.seed, Object.assign(S(100, 23), mem2.route));
    ok('tool page: a member sees no count', !/places|Claim my place/.test(tx), tx);
    await x.close();

    ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  } catch (e) {
    ok('the run finished', false, e.stack || e.message);
  } finally {
    try { await T.getBrowser().close(); } catch (e) {}
    console.log(out.join('\n'));
    const bad = out.filter((l) => l.startsWith('FAIL')).length;
    console.log(`\n${out.length - bad} passed, ${bad} failed`);
    process.exit(bad ? 1 : 0);
  }
})();
