// Tests the First 1,000 rounds on the site: the round bar and lines on /first-1000, the centred closing column, the full-round
// state with its waiting list, the claim refusal (round_full), the app home card, the tool page card and the streak sheet line,
// and that a buyer or a member never sees the offer. The payment server is answered locally (lib-wgtest.js).
// Needs the site on :8008 (python3 serve.py 8008) or WG_PORT.
//   WG_PORT=8008 NODE_PATH=/tmp/wgog/node_modules node scripts/test-rounds.js
const T = require('./lib-wgtest.js');
const { ok, wait, open, reqs, text, has, out, errs } = T;

// What the payment server answers, for round R with M of its 100 places taken (round 1 of 1,000 unless said).
const st = (round, rt) => {
  const taken = (round - 1) * 100 + rt, left = 1000 - taken, ro = rt < 100 && left > 0;
  return { ok: true, taken, left, open: ro, round, round_size: 100, round_taken: rt, round_left: ro ? 100 - rt : 0, round_open: ro };
};
const S = (round, rt) => ({ '/first1000/status': st(round, rt), '/subscribe': { ok: true } });
const FLAG = { u: '/programs/first-pregnancy-plan/thank-you', l: 'Home' };
const rect = (page, sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, w: r.width, h: r.height, cx: r.x + r.width / 2, b: r.y + r.height }; });
const vis = (page, sel) => page.$eval(sel, (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden'; }).catch(() => false);
const fillPct = async (page, sel) => page.$eval(sel, (f) => { const t = f.parentElement.getBoundingClientRect().width; return Math.round(f.getBoundingClientRect().width / (t - 4) * 100); });

(async () => {
  try {
    await T.launch();
    let t, x;

    // 1. the bar and lines on the page, round 1 at 0, partway and one place left
    for (const [rt, line, pct] of [[0, 'Round 1: 0 of 100 places taken', 0], [23, 'Round 1: 23 of 100 places taken', 23], [99, 'Round 1: 99 of 100 places taken', 99]]) {
      t = await open({}, '/first-1000/', { route: S(1, rt), wait: 1800 });
      const hero = await text(t.page, '.fx-hero [data-taken-line]'), fin = await text(t.page, '.fx-final [data-taken-line]');
      ok(`page, ${rt} taken: the hero reads "${line}"`, hero === line, hero);
      ok(`page, ${rt} taken: the closing section reads the same`, fin === line, fin);
      const hp = await fillPct(t.page, '.fx-hero [data-taken-fill]'), fp = await fillPct(t.page, '.fx-final [data-taken-fill]');
      ok(`page, ${rt} taken: both bars fill ${pct}%`, Math.abs(hp - pct) <= 2 && Math.abs(fp - pct) <= 2, hp + ' ' + fp);
      ok(`page, ${rt} taken: no claim waiting list shows`, !(await vis(t.page, '.fx-hero [data-wait]')) && !(await vis(t.page, '.fx-final [data-wait]')));
      ok(`page, ${rt} taken: the old "places left of 1,000" counter is gone`, !/places left of 1,000/.test(await t.page.evaluate(() => document.body.innerText)));
      await t.close();
    }

    // 2. the closing section is one centred column: button, thin bar, count line; the bar as wide as the button, at 390 and 1728
    for (const W of [390, 1728]) {
      t = await open({}, '/first-1000/', { route: S(1, 23), wait: 1800 });
      await t.page.setViewport({ width: W, height: 900, deviceScaleFactor: 1, isMobile: W < 600, hasTouch: W < 600 });
      await wait(900);
      const b = await rect(t.page, '.fx-final-col > [data-claim]'), tr = await rect(t.page, '.fx-final .fx-taken-track'), ln = await rect(t.page, '.fx-final [data-taken-line]');
      const h2 = await rect(t.page, '.fx-final h2'), p = await rect(t.page, '.fx-final [data-final-line]');
      ok(`${W}px: heading, line, button, bar and count line stack in that order`, h2.b <= p.y + 1 && p.b <= b.y + 1 && b.b <= tr.y + 1 && tr.b <= ln.y + 1, JSON.stringify({ h2, p, b, tr, ln }));
      ok(`${W}px: the bar is as wide as the button`, Math.abs(tr.w - b.w) <= 1.5, `bar ${tr.w} button ${b.w}`);
      ok(`${W}px: the column is centred (button, bar and line share a centre line)`, Math.abs(b.cx - tr.cx) <= 1.5 && Math.abs(ln.cx - tr.cx) <= 2, `${b.cx} ${tr.cx} ${ln.cx}`);
      ok(`${W}px: the column is centred on the page`, Math.abs(b.cx - W / 2) <= 8, `${b.cx} vs ${W / 2}`);
      ok(`${W}px: no sideways scroll`, await t.page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
      ok(`${W}px: the old boxed meter is gone`, !(await has(t.page, '.fx-meter')));
      await t.close();
    }

    // 3. round 2 partway reads its own number
    t = await open({}, '/first-1000/', { route: S(2, 40), wait: 1500 });
    ok('round 2 at 40 taken: "Round 2: 40 of 100 places taken"', (await text(t.page, '.fx-hero [data-taken-line]')) === 'Round 2: 40 of 100 places taken');
    await t.close();

    // 4. the full round: claim buttons give way to the waiting list, in the hero and the closing column
    t = await open({}, '/first-1000/', { route: S(1, 100), wait: 1800 });
    const msg = 'Round 1 is full. The next round opens soon.';
    ok('full round: the hero says "Round 1 is full. The next round opens soon."', (await text(t.page, '.fx-hero [data-wait-line]')) === msg, await text(t.page, '.fx-hero [data-wait]'));
    ok('full round: the closing section says it too', (await text(t.page, '.fx-final [data-final-line]')) === msg);
    ok('full round: no Claim button shows', !(await vis(t.page, '.fx-hero [data-claim]')) && !(await vis(t.page, '.fx-final [data-claim]')) && !(await vis(t.page, '[data-floatbar]')));
    ok('full round: no bar shows', !(await vis(t.page, '.fx-hero [data-taken-meter]')) && !(await vis(t.page, '.fx-final [data-taken-meter]')));
    ok('full round: an email field and "Tell me when it opens" in the hero and in the closing column', (await vis(t.page, '.fx-hero [data-wait] input[type=email]')) && (await vis(t.page, '.fx-final [data-wait] input[type=email]')) && /Tell me when it opens/.test(await text(t.page, '.fx-hero [data-wait] button')));
    ok('full round: the offer is not called sold out', !(await vis(t.page, '[data-taken]')));
    const wb = await rect(t.page, '.fx-final .fx-wait input[type=email]'), fh = await rect(t.page, '.fx-final h2');
    ok('full round: the closing form sits in the same centred column (centred on the page)', Math.abs(wb.cx - 195) <= 10, JSON.stringify(wb));
    await t.page.$eval('.fx-hero [data-wait] input[type=email]', (e) => { e.value = 'Wait@Example.com'; });
    await t.page.$eval('.fx-hero [data-wait] form button[type=submit]', (e) => e.click());
    await wait(600);
    const sub = (await reqs(t.page)).filter((r) => r.path === '/subscribe').map((r) => JSON.parse(r.body));
    ok('waiting list: one POST /subscribe with list f1k_next_round, consent, source f1k_round_full and nothing else', sub.length === 1 && sub[0].list === 'f1k_next_round' && sub[0].consent === true && sub[0].source === 'f1k_round_full' && sub[0].email.toLowerCase() === 'wait@example.com' && Object.keys(sub[0]).sort().join() === 'consent,email,list,source', JSON.stringify(sub));
    ok('waiting list: the body has no stage and no date', sub.length === 1 && !('stage' in sub[0]) && !/\d{4}-\d{2}-\d{2}/.test(JSON.stringify(sub[0])));
    const ev = await t.page.evaluate(() => window.dataLayer.filter((e) => e.event === 'capture_submit'));
    ok('waiting list: the only event is capture_submit with capture_point f1k_round_full', ev.length === 1 && ev[0].capture_point === 'f1k_round_full' && Object.keys(ev[0]).filter((k) => !/^gtm\./.test(k)).sort().join() === 'capture_point,event', JSON.stringify(ev));
    ok('waiting list: it thanks her', /Thank you\. We will email you when the next round opens\./.test(await text(t.page, '.fx-hero [data-wait]')));
    await t.close();
    // joined on this phone: no form again
    t = await open({ wg_capture_v1: { v: 1, lists: ['f1k_next_round'], bar: 0 } }, '/first-1000/', { route: S(1, 100), wait: 1800 });
    ok('already on the list: the hero says so and shows no form', /You are on the list/.test(await text(t.page, '.fx-hero [data-wait]')) && !(await has(t.page, '.fx-hero [data-wait] form')));
    await t.close();

    // 5. all 1,000 gone keeps the old closed state, with no waiting list
    t = await open({}, '/first-1000/', { route: S(10, 100), wait: 1500 });
    ok('all 1,000 taken: the sold-out message shows and no waiting list', (await vis(t.page, '[data-taken]')) && !(await vis(t.page, '[data-wait]')) && !(await vis(t.page, '[data-claim]')));
    await t.close();

    // 6. the claim refusal: the round fills while she fills the form
    t = await open({}, '/first-1000/?stage=pregnancy', { route: Object.assign(S(1, 60), { '/first1000/claim': { ok: false, error: 'round_full' } }), wait: 1500 });
    await t.page.$eval('.fx-hero [data-claim]', (e) => e.click()); await wait(500);
    await t.page.type('#fxName', 'Ngozi'); await t.page.$eval('.ff-next', (e) => e.click()); await wait(300);
    await t.page.type('#fxEmail', 'ngozi@example.com'); await t.page.$eval('.ff-next', (e) => e.click()); await wait(300);
    await t.page.type('#fxPhone', '08031234567'); await t.page.$eval('#fxConsent', (e) => e.click());
    await t.page.evaluate((full) => { const f = window.fetch; window.fetch = (u, i) => (/first1000\/status/.test(String(u)) ? Promise.resolve(new Response(JSON.stringify(full), { status: 200 })) : f(u, i)); }, st(1, 100));
    await t.page.$eval('.ff-next', (e) => e.click()); await wait(1200);
    const sheet = await text(t.page, '#fxSheet');
    ok('refusal: the sheet says the round is full, not a generic error', /Round 1 is full\. The next round opens soon\./.test(sheet) && !/could not save/i.test(sheet), sheet.slice(0, 200));
    ok('refusal: the sheet offers the waiting list with her email filled in', (await t.page.$eval('#fxSheet input[type=email]', (e) => e.value).catch(() => '')) === 'ngozi@example.com' && /Tell me when it opens/.test(sheet));
    ok('refusal: the page behind switched to the full-round state', /Round 1 is full/.test(await text(t.page, '.fx-hero [data-wait-line]')) && !(await vis(t.page, '.fx-hero [data-claim]')));
    await t.close();

    // 7. localhost previews
    t = await open({}, '/first-1000/?f1kround=3&f1kroundtaken=40', { wait: 1500 });
    ok('preview ?f1kround=3&f1kroundtaken=40', (await text(t.page, '.fx-hero [data-taken-line]')) === 'Round 3: 40 of 100 places taken');
    await t.close();
    t = await open({}, '/first-1000/?f1kround=1&f1kroundtaken=100', { wait: 1500 });
    ok('preview ?f1kround=1&f1kroundtaken=100 is the full round', /Round 1 is full/.test(await text(t.page, '.fx-hero [data-wait-line]')));
    await t.close();
    t = await open({}, '/first-1000/?f1kleft=1', { wait: 1500 });
    ok('preview ?f1kleft=1 is round 10 with 99 taken', (await text(t.page, '.fx-hero [data-taken-line]')) === 'Round 10: 99 of 100 places taken');
    await t.close();

    // 8. the app home card
    const offer = async (seed, route, url) => { x = await open(seed, url || '/app/', { route, wait: 1800 }); return text(x.page, '#appFirst'); };
    let tx = await offer({}, S(1, 23));
    ok('app card: "This offer is for the first 1,000 women. Round 1 is open: 77 of 100 places are left."', /This offer is for the first 1,000 women\. Round 1 is open: 77 of 100 places are left\./.test(tx) && /Claim my place/.test(tx), tx);
    await x.close();
    tx = await offer({}, S(1, 99));
    ok('app card: one place left reads "1 of 100 places is left"', /Round 1 is open: 1 of 100 places is left\./.test(tx), tx);
    await x.close();
    tx = await offer({}, S(2, 50));
    ok('app card: round 2 reads its number and its count', /Round 2 is open: 50 of 100 places are left\./.test(tx), tx);
    await x.close();
    tx = await offer({}, S(1, 0));
    ok('app card: round 1 at 0 taken reads 100 of 100, never a bare 1000', /Round 1 is open: 100 of 100 places are left\./.test(tx) && !/\b1000\b/.test(tx), tx);
    await x.close();
    tx = await offer({}, S(1, 100));
    ok('app card, round full: "Round 1 is full. The next round opens soon." and a link to the waiting list, no claim button', /Round 1 is full\. The next round opens soon\./.test(tx) && !/Claim my place/.test(tx) && (await has(x.page, '#appFirst a[href="/first-1000"]')), tx);
    ok('app card, round full: the card stays small', (await rect(x.page, '#appFirst .f1k-offer')).h < 260);
    await x.close();
    tx = await offer({}, S(10, 100));
    ok('app card, all 1,000 gone: no card', tx === '', tx);
    await x.close();
    tx = await offer({}, S(1, 23), '/app/?f1kround=2&f1kroundtaken=10');
    ok('app card: the localhost preview wins', /Round 2 is open: 90 of 100 places are left\./.test(tx), tx);
    await x.close();

    // 9. who never sees the card: a buyer, a member, a signed-in woman whose account lists a program
    const account = (extra) => Object.assign({ email: 'ada@example.com', name: '', programs: [], member: undefined }, extra);
    const signed = (acc) => ({ seed: { wg_session_v1: JSON.stringify({ token: 'tok123' }), wg_account_v1: { v: 1, at: Date.now(), account: acc, saved: [] } }, route: Object.assign(S(1, 23), { '/account': { ok: true, account: acc, state: {} } }) });
    for (const route of [S(1, 23), S(1, 100)]) {
      const label = route['/first1000/status'].round_open ? 'open round' : 'full round';
      tx = await offer({ wg_pregnancy_home: FLAG }, route);
      ok(`buyer (program flag), ${label}: no offer, no round line`, !/Get a program free|Round \d/.test(tx), tx);
      await x.close();
      const mem = signed(account({ member: { stage: 'pregnancy', ends: new Date(Date.now() + 200 * 864e5).toISOString(), steps: {}, invite: 'ABC' } }));
      tx = await offer(mem.seed, Object.assign({}, route, { '/account': mem.route['/account'] }));
      ok(`member, ${label}: only the steps card, no round line`, /Earn more free months/.test(tx) && !/Round \d|Get a program free/.test(tx), tx);
      await x.close();
      const buyer = signed(account({ programs: [{ slug: 'first-pregnancy-plan', home: 'https://wholesomegirlies.xyz/programs/first-pregnancy-plan/thank-you' }] }));
      tx = await offer(buyer.seed, Object.assign({}, route, { '/account': buyer.route['/account'] }));
      ok(`signed-in buyer, ${label}: no offer`, !/Get a program free|Round \d/.test(tx), tx);
      await x.close();
    }
    x = await open({ wg_session_v1: JSON.stringify({ token: 'tok123' }) }, '/app/', { route: Object.assign(S(1, 23), { '/account': { __delay: 6000, __body: { ok: true, account: account(), state: {} } } }), wait: 1200 });
    ok('status not known yet (signed-in phone, account still loading): nothing shows', (await text(x.page, '#appFirst')) === '');
    await x.close();

    // 10. the tool page card
    const toolCard = async (seed, route, url) => { x = await open(seed, url || '/pregnancy/tools/hospital-bag-checklist', { route, wait: 1800 }); return text(x.page, '.program-cta'); };
    tx = await toolCard({}, S(1, 23));
    ok('tool page: "For the first 1,000 women. Round 1 is open: 77 of 100 places are left."', /free/.test(tx) && /For the first 1,000 women\. Round 1 is open: 77 of 100 places are left\./.test(tx) && /Already bought\? Sign in/.test(tx), tx);
    await x.close();
    tx = await toolCard({}, S(1, 99));
    ok('tool page: one place reads "1 of 100 places is left"', /Round 1 is open: 1 of 100 places is left\./.test(tx), tx);
    await x.close();
    tx = await toolCard({}, S(1, 100));
    ok('tool page, round full: "Round 1 is full. The next round opens soon." with the waiting list link and a way to buy', /Round 1 is full\. The next round opens soon\./.test(tx) && /Tell me when it opens/.test(tx) && (await has(x.page, '.program-cta a[href^="/first-1000"]')) && !/Claim my place/.test(tx), tx);
    await x.close();
    tx = await toolCard({}, S(10, 100));
    ok('tool page, all 1,000 gone: the paid program card stays', !/free|Round \d/.test(tx), tx);
    await x.close();
    tx = await toolCard({ wg_pregnancy_home: FLAG }, S(1, 23));
    ok('tool page: a buyer keeps "Back to your" and sees no round line', /Back to your/.test(tx) && !/Round \d/.test(tx), tx);
    await x.close();
    const mem2 = signed(account({ member: { stage: 'pregnancy', ends: new Date(Date.now() + 200 * 864e5).toISOString(), steps: {}, invite: 'ABC' } }));
    tx = await toolCard(mem2.seed, mem2.route);
    ok('tool page: a member sees no round line', !/Round \d|Claim my place/.test(tx), tx);
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
