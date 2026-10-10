// Tests the program recommendations (CLAUDE.md section 10, "/app/ changes with who is looking") through the private
// lab page, /lab/, at an iPhone size: every scenario is loaded the way James loads it (press the lab button, land on
// the page) and its "what you should see" is checked. Also checks finished games are counted privately, the install
// bar ignores them, MOTHER reaches all four motherhood homes but never Wife Material, a Complete Motherhood Journey
// owner is never offered the bundle, and the lab restores her real data.
// Needs the site on :8001 (python3 serve.py 8001), or set WG_PORT; WG_BASE=https://wholesomegirlies.xyz tests live.
//   WG_PORT=8017 NODE_PATH=/tmp/wgog/node_modules node scripts/test-recommendations.js
// Set WG_SHOTS=/some/folder to also save phone-size screenshots.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const B = process.env.WG_BASE || 'http://localhost:' + (process.env.WG_PORT || 8001);
const SHOTS = process.env.WG_SHOTS || '';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const out = [];
const ok = (name, pass, extra = '') => { out.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${!pass && extra ? '  (' + extra + ')' : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let browser;
const errs = [];

async function newPage(opts = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent(IPHONE);
  // a test never reaches a real endpoint (the Checkout Intents sheet)
  await page.evaluateOnNewDocument(() => { window.fetch = () => Promise.resolve(new Response('{}', { status: 200 })); });
  if (opts.blocked) await page.evaluateOnNewDocument(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }); });
  page.on('pageerror', (e) => errs.push((opts.tag || '') + ' ' + e.message));
  page._ctx = ctx;
  return page;
}
const go = async (page, p) => { await page.goto(B + p, { waitUntil: 'load' }); await wait(700); };
// press a lab button and land on the page it opens
async function lab(page, id, t = 0) {
  await go(page, '/lab/');
  await Promise.all([
    page.waitForNavigation({ waitUntil: 'load' }),
    page.$eval(`button[data-run="${id}"][data-t="${t}"]`, (e) => e.click()),
  ]);
  await wait(900);
}
const vis = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].some((e) => !e.hidden && (e.offsetWidth || e.offsetHeight) && getComputedStyle(e).display !== 'none'), sel);
const picks = (page) => page.evaluate(() => [...document.querySelectorAll('#appPickCard .app-pick')].map((c) => ({
  h: c.querySelector('h3').textContent, href: c.querySelector('a.btn').getAttribute('href'),
  line: (c.querySelector('.app-bundle-line') || {}).textContent || '', lineHref: (c.querySelector('.app-bundle-line a') || {}).getAttribute ? c.querySelector('.app-bundle-line a').getAttribute('href') : '' })));
const pickBox = (page) => vis(page, '#appPick');
const mainText = (page) => page.evaluate(() => {
  const m = document.querySelector('main'); if (!m) return '';
  const keep = [];
  const w = document.createTreeWalker(m, NodeFilter.SHOW_TEXT);
  let n; while ((n = w.nextNode())) { const e = n.parentElement; if (e && e.closest('script,style')) continue; let hidden = false; for (let x = e; x && x !== m; x = x.parentElement) { if (x.hidden || getComputedStyle(x).display === 'none') { hidden = true; break; } } if (!hidden) keep.push(n.nodeValue); }
  return keep.join(' ').replace(/\s+/g, ' ');
});
const store = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);
const hrefs = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].filter((e) => { for (let x = e; x; x = x.parentElement) if (x.hidden || getComputedStyle(x).display === 'none') return false; return true; }).map((a) => a.getAttribute('href')), sel);
const shot = async (page, name) => { if (!SHOTS) return;
  await page.evaluate(() => { const t = [...document.querySelectorAll('#appPick,#appStages')].find((e) => !e.hidden && e.offsetHeight); if (t && /^\/app/.test(location.pathname)) { t.scrollIntoView({ block: 'start' }); window.scrollBy(0, -80); } }); await wait(700); fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false }); };
const BUNDLE = '/programs/complete-motherhood-journey';
const SINGLES = [['fertility', 'trying-to-conceive-blueprint'], ['pregnancy', 'first-pregnancy-plan'], ['pp', 'postpartum-reset'], ['parenting', 'first-baby-playbook']];

(async () => {
  browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-first-run'] });
  try {
    // ---- the lab page itself ----
    let page = await newPage({ tag: 'lab' });
    await go(page, '/lab/');
    ok('lab: noindex, nofollow', await page.$eval('meta[name=robots]', (e) => /noindex/.test(e.content) && /nofollow/.test(e.content)));
    ok('lab: has no analytics, consent or app scripts', await page.evaluate(() => !document.querySelector('script[src*="googletagmanager"],script[src*="consent"],script[src*="wg-app"]') && !/googletagmanager/.test(document.documentElement.innerHTML)));
    const sm = await (await fetch(B + '/sitemap.xml')).text();
    ok('lab: not in the sitemap', !/\/lab/.test(sm));
    const home = await (await fetch(B + '/')).text(), tools = await (await fetch(B + '/tools/')).text();
    ok('lab: not linked from the home page or /tools/', !/href="\/lab/.test(home) && !/href="\/lab/.test(tools));
    const sw = await (await fetch(B + '/sw.js')).text();
    ok('lab: the service worker never caches it', /\^\\\/lab\\\//.test(sw));
    ok('lab: every scenario has a "You should see" line and a button', await page.evaluate(() => [...document.querySelectorAll('.card:not(#names)')].length >= 13 && [...document.querySelectorAll('.card:not(#names)')].every((c) => /You should see/.test(c.textContent) && c.querySelector('button[data-run]'))));
    ok('lab: the mum scenario links all nine tools', await page.evaluate(() => document.querySelectorAll('#mum button[data-run]').length === 9));
    ok('lab: one card links to the name options page', await page.evaluate(() => { const a = document.querySelector('#names a'); return !!a && a.getAttribute('href') === '/lab/names/' && /Your name options \(ideas, not live yet\)/.test(document.querySelector('#names h2').textContent); }));
    ok('lab: Restore and Clear buttons are on top', await page.evaluate(() => !!document.getElementById('restore') && !!document.getElementById('clear')));
    await shot(page, 'lab');
    await page._ctx.close();

    // ---- restore and clear ----
    page = await newPage({ tag: 'restore' });
    await go(page, '/lab/');
    await page.evaluate(() => { localStorage.setItem('wg_name_shortlist_v1', '{"v":1,"items":[{"n":"Real"}]}'); localStorage.setItem('wg_fertility_home', '{"u":"/programs/trying-to-conceive-blueprint/thank-you","l":"Conception home"}'); });
    await lab(page, 'bundleowner');
    ok('lab: a scenario replaces her real data', (await store(page, 'wg_name_shortlist_v1')) === null && /complete-motherhood/.test(await store(page, 'wg_fertility_home')));
    ok('lab: her real data is kept under a lab-only key', !!(await store(page, 'wglab_snapshot')));
    await go(page, '/lab/');
    ok('lab: the bar says a scenario is active', /scenario is active/.test(await page.$eval('#status', (e) => e.textContent)));
    await page.$eval('#clear', (e) => e.click()); await wait(200);
    ok('lab: Clear everything removes every wg_ key', await page.evaluate(() => !Object.keys(localStorage).some((k) => /^wg_/.test(k))));
    await page.$eval('#restore', (e) => e.click()); await wait(200);
    ok('lab: Restore puts her real data back', /Real/.test(await store(page, 'wg_name_shortlist_v1')) && /trying-to-conceive/.test(await store(page, 'wg_fertility_home')));
    ok('lab: Restore deletes the lab key', (await store(page, 'wglab_snapshot')) === null);
    ok('lab: the bar says her real data is back', /real data is in place/i.test(await page.$eval('#status', (e) => e.textContent)));
    await page._ctx.close();

    // ---- the app home, non-buyers ----
    page = await newPage({ tag: 'app' });
    await lab(page, 'new');
    ok('new visitor: five stage cards, no pick', (await page.$$eval('#appStages .stage-card', (a) => a.length)) === 5 && await vis(page, '#appStages') && !(await pickBox(page)));
    await shot(page, 'app-new-visitor');

    await lab(page, 'fert');
    let p = await picks(page);
    ok('one stage: one card, the Trying-to-Conceive Blueprint', p.length === 1 && p[0].h === 'The Trying-to-Conceive Blueprint' && p[0].href === '/programs/trying-to-conceive-blueprint', JSON.stringify(p));
    ok('one stage: no bundle line, stage cards gone', !p[0].line && !(await vis(page, '#appStages')));
    ok('one stage: nothing she did went into the dataLayer', await page.evaluate(() => !JSON.stringify(window.dataLayer || []).includes('trying-to-conceive')));
    await shot(page, 'app-one-stage');

    await lab(page, 'relfert');
    p = await picks(page);
    ok('relationships plus fertility: two cards, fertility first', p.length === 2 && p[0].h === 'The Trying-to-Conceive Blueprint' && p[1].h === 'The Wife Material Blueprint', JSON.stringify(p.map((x) => x.h)));
    ok('two picks: neither shows a bundle line', !p[0].line && !p[1].line);
    await shot(page, 'app-two-picks');

    await lab(page, 'two');
    p = await picks(page);
    ok('two motherhood stages: the top stage single, not a third card', p.length === 1 && p[0].h === 'The Trying-to-Conceive Blueprint', JSON.stringify(p.map((x) => x.h)));
    ok('two motherhood stages: bundle line with a link to the bundle', /Covers every stage, from trying to the baby years/.test(p[0].line) && p[0].lineHref === BUNDLE, JSON.stringify(p[0]));
    await shot(page, 'app-two-stages-bundle-line');

    await lab(page, 'three');
    p = await picks(page);
    ok('three motherhood stages: the pick is the bundle', p.length === 1 && p[0].h === 'The Complete Motherhood Journey' && p[0].href === BUNDLE, JSON.stringify(p));
    ok('three motherhood stages: the bundle line names every stage', /trying, pregnancy, the first six weeks and the baby years/.test(await page.$eval('#appPickCard', (e) => e.textContent)));
    await shot(page, 'app-three-stages-bundle');

    await lab(page, 'games');
    p = await picks(page);
    ok('games only: finished games count, relationships (2 games) before pregnancy (1 game)', p.length === 2 && p[0].h === 'The Wife Material Blueprint' && p[1].h === 'The First Pregnancy Plan', JSON.stringify(p.map((x) => x.h)));
    ok('games only: "More for your stage" shows for the top stage', await vis(page, '#appMore'));
    ok('games only: stage cards hidden', !(await vis(page, '#appStages')));

    // a tie: one finished game in each of two stages, the more recent one wins (list order would pick pregnancy)
    await page.evaluate(() => { localStorage.clear(); const n = Date.now(); localStorage.setItem('wg_played_v1', JSON.stringify({ '/pregnancy/tools/what-kind-of-mum': n - 600000, '/postpartum/tools/omugwo-your-mum-or-his-mum': n - 1000 })); });
    await go(page, '/app/');
    p = await picks(page);
    ok('tie: the stage played most recently wins', p.length === 1 && p[0].h === 'The 6-Week Postpartum Reset' && /Covers every stage/.test(p[0].line), JSON.stringify(p));
    await page.evaluate(() => { const n = Date.now(); localStorage.setItem('wg_played_v1', JSON.stringify({ '/pregnancy/tools/what-kind-of-mum': n - 1000, '/postpartum/tools/omugwo-your-mum-or-his-mum': n - 600000 })); });
    await go(page, '/app/');
    p = await picks(page);
    ok('tie: swap the dates and the winner swaps', p.length === 1 && p[0].h === 'The First Pregnancy Plan', JSON.stringify(p.map((x) => x.h)));
    // a saved tool counts 2, a game 1; a game she also saved counts once
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('wg_ttc_checklist_v1', '{"0":true}'); localStorage.setItem('wg_played_v1', JSON.stringify({ '/pregnancy/tools/what-kind-of-mum': Date.now() })); });
    await go(page, '/app/');
    p = await picks(page);
    ok('weights: one saved tool (2) beats one finished game (1)', p.length === 1 && p[0].h === 'The Trying-to-Conceive Blueprint' && /Covers every stage/.test(p[0].line), JSON.stringify(p));
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('wg_played_v1', 'not json'); localStorage.setItem('wg_ttc_checklist_v1', '{"0":true}'); });
    await go(page, '/app/');
    ok('a bad played marker is ignored', (await picks(page)).length === 1);
    await page._ctx.close();

    // ---- buyers on the app home ----
    page = await newPage({ tag: 'wm' });
    await lab(page, 'wmbuyer', 0);
    p = await picks(page);
    ok('Wife Material buyer: one card for her fertility activity', p.length === 1 && p[0].h === 'The Trying-to-Conceive Blueprint', JSON.stringify(p));
    ok('Wife Material buyer: full price, so no coupon in any link', !/coupon/.test(JSON.stringify(p)) && !/MOTHER/.test(await page.$eval('#appPick', (e) => e.textContent)));
    ok('Wife Material buyer: Wife Material is not recommended back to her', !p.some((x) => /Wife Material/.test(x.h)));
    await shot(page, 'app-wife-material-buyer');
    await lab(page, 'wmbuyer', 1);
    let txt = await mainText(page);
    ok('Wife Material home: the What comes after card names the Trying-to-Conceive Blueprint', /What comes after/.test(txt) && /Trying-to-Conceive Blueprint/.test(txt));
    ok('Wife Material home: a line says the Complete Motherhood Journey covers every stage', /Complete Motherhood Journey covers every stage, from trying to the baby years/.test(txt));
    let hs = await hrefs(page, '.ph-card a');
    ok('Wife Material home: links to the Nigerian pages, with no coupon', hs.includes('/programs/trying-to-conceive-blueprint') && hs.includes(BUNDLE) && !hs.some((h) => /coupon/.test(h)), JSON.stringify(hs));
    ok('Wife Material home: no MOTHER code anywhere', !/MOTHER/.test(txt));
    ok('Wife Material home: the card carries no coupon and sits before the share block', await page.evaluate(() => { const c = document.querySelector('[data-bundle-offer]'); return !!c && !!c.nextElementSibling && c.nextElementSibling.classList.contains('ph-pass'); }));
    await page.evaluate(() => window.scrollTo(0, document.querySelector('[data-bundle-offer]').getBoundingClientRect().top + window.scrollY - 80)); await wait(300);
    await shot(page, 'wife-material-home-card');
    await lab(page, 'wmbuyer', 2);
    ok('bundle page, Wife Material buyer: the plain price, no member note', (await page.$$eval('.wg-member-price', (a) => a.length)) === 0 && !(await hrefs(page, 'a[href*="selar.com/completemotherhoodjourney"]')).some((h) => /coupon=MOTHER/.test(h)));

    await lab(page, 'wmbuyerd', 0);
    p = await picks(page);
    ok('diaspora Wife Material buyer: the pick links to the diaspora page', p.length === 1 && p[0].href === '/programs/trying-to-conceive-blueprint-diaspora', JSON.stringify(p));
    await lab(page, 'wmbuyerd', 1);
    hs = await hrefs(page, '.ph-card a');
    ok('diaspora Wife Material home: diaspora links, no coupon, no MOTHER', hs.includes('/programs/trying-to-conceive-blueprint-diaspora') && hs.includes(BUNDLE + '-diaspora') && !hs.some((h) => /coupon/.test(h)) && !/MOTHER/.test(await mainText(page)), JSON.stringify(hs));
    await page._ctx.close();

    // Wife Material buyer with two motherhood stages: single plus bundle line; with three: bundle, still full price
    page = await newPage({ tag: 'wm2' });
    await go(page, '/lab/');
    await page.evaluate(() => { localStorage.setItem('wg_relationships_home', '{"u":"/programs/wife-material-blueprint/thank-you","l":"Wife Material home"}'); localStorage.setItem('wg_ttc_checklist_v1', '{"0":true}'); localStorage.setItem('wg_hospitalbag_v1', '{"0":true}'); });
    await go(page, '/app/');
    p = await picks(page);
    ok('Wife Material buyer, two stages: single plus the bundle line, no coupon', p.length === 1 && /Covers every stage/.test(p[0].line) && !/coupon/.test(JSON.stringify(p)), JSON.stringify(p));
    await page.evaluate(() => { localStorage.setItem('wg_postpartum_checklist_v1', '{"0":true}'); });
    await go(page, '/app/');
    p = await picks(page);
    ok('Wife Material buyer, three stages: the bundle at full price', p.length === 1 && p[0].h === 'The Complete Motherhood Journey' && !/coupon/.test(JSON.stringify(p)), JSON.stringify(p));
    // no motherhood activity: no card at all
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('wg_relationships_home', '{"u":"/programs/wife-material-blueprint/thank-you","l":"Wife Material home"}'); localStorage.setItem('wg_meet_men_v1', '{"0":true}'); });
    await go(page, '/app/');
    ok('Wife Material buyer with only relationship activity: no card', !(await pickBox(page)));
    await page._ctx.close();

    // ---- motherhood buyers: no app pick, MOTHER on every motherhood home ----
    page = await newPage({ tag: 'ttc' });
    await lab(page, 'ttcbuyer', 0);
    txt = await mainText(page);
    ok('Trying-to-Conceive home: the bundle card with the code MOTHER', /The whole journey, for less/.test(txt) && /MOTHER/.test(txt));
    hs = await hrefs(page, '.ph-card a');
    ok('Trying-to-Conceive home: the bundle card links with ?coupon=MOTHER', hs.includes(BUNDLE + '?coupon=MOTHER'), JSON.stringify(hs));
    await lab(page, 'ttcbuyer', 1);
    ok('Trying-to-Conceive buyer: no program pick on the app home', !(await pickBox(page)));
    await lab(page, 'ttcbuyer', 2);
    ok('bundle page, Trying-to-Conceive buyer: member price note and coupon on the buy buttons', (await page.$$eval('.wg-member-price', (a) => a.length)) > 0 && (await hrefs(page, 'a[href*="selar.com/completemotherhoodjourney"]')).some((h) => /coupon=MOTHER/.test(h)));
    await page._ctx.close();

    page = await newPage({ tag: 'pp' });
    await lab(page, 'ppbuyer', 0);
    let cards = await page.$$eval('main > .wrap section.ph-sec .ph-card, main .ph-sec .ph-card', (a) => a.map((c) => c.textContent.replace(/\s+/g, ' ')));
    const iFB = cards.findIndex((c) => /First Baby Playbook picks up/.test(c)), iB = cards.findIndex((c) => /MOTHER/.test(c));
    ok('Postpartum home: the First Baby Playbook card, then the bundle card with MOTHER', iFB > -1 && iB > -1 && iFB < iB, JSON.stringify([iFB, iB]));
    hs = await hrefs(page, '.ph-card a');
    ok('Postpartum home: both links present, the bundle one with the coupon', hs.includes('/programs/first-baby-playbook') && hs.includes(BUNDLE + '?coupon=MOTHER'), JSON.stringify(hs));
    await page.evaluate(() => window.scrollTo(0, [...document.querySelectorAll('[data-bundle-offer]')][0].getBoundingClientRect().top + window.scrollY - 200)); await wait(300);
    await shot(page, 'postpartum-home-cards');
    await lab(page, 'ppbuyer', 1);
    ok('bundle page, Postpartum buyer: member price', (await page.$$eval('.wg-member-price', (a) => a.length)) > 0);
    await page._ctx.close();

    page = await newPage({ tag: 'baby' });
    await lab(page, 'babybuyer', 0);
    txt = await mainText(page);
    hs = await hrefs(page, '.ph-card a');
    ok('First Baby home: the bundle card with MOTHER and the coupon link', /MOTHER/.test(txt) && hs.includes(BUNDLE + '?coupon=MOTHER'), JSON.stringify(hs));
    await lab(page, 'babybuyer', 1);
    ok('bundle page, First Baby buyer: member price', (await page.$$eval('.wg-member-price', (a) => a.length)) > 0);
    await page._ctx.close();

    // MOTHER on all four homes in both markets: set the flag, open the bundle page in her market
    for (const dia of ['', '-diaspora']) {
      for (const [stage, slug] of SINGLES) {
        const key = { fertility: 'wg_fertility_home', pregnancy: 'wg_pregnancy_home', pp: 'wg_pp_home', parenting: 'wg_parenting_home' }[stage];
        page = await newPage({ tag: 'mother' });
        await go(page, '/lab/');
        await page.evaluate((key, u) => { localStorage.setItem(key, JSON.stringify({ u, l: 'home' })); }, key, `/programs/${slug}${dia}/thank-you`);
        await go(page, `/programs/${slug}${dia}/thank-you`);
        const h2 = await hrefs(page, '.ph-card a');
        ok(`MOTHER card on ${slug}${dia} home`, h2.includes(BUNDLE + dia + '?coupon=MOTHER') && /MOTHER/.test(await mainText(page)), JSON.stringify(h2));
        await go(page, BUNDLE + dia);
        ok(`MOTHER price on the bundle page for a ${slug}${dia} buyer`, (await page.$$eval('.wg-member-price', (a) => a.length)) > 0);
        await page._ctx.close();
      }
    }

    // ---- a Complete Motherhood Journey owner is never offered the bundle ----
    page = await newPage({ tag: 'owner' });
    await lab(page, 'bundleowner', 0);
    ok('bundle owner: no recommendation on the app home, even with saved tools and games', !(await pickBox(page)) && !/Complete Motherhood Journey/.test(await page.$eval('#appPick', (e) => e.textContent)));
    ok('bundle owner: nothing on the app home links to the bundle sales page except her own program home', !(await hrefs(page, `main a[href^="${BUNDLE}"]`)).some((h) => h === BUNDLE || /coupon/.test(h)));
    await shot(page, 'app-bundle-owner');
    for (const [i, slug] of [[1, 'trying-to-conceive-blueprint'], [2, 'postpartum-reset']]) {
      await lab(page, 'bundleowner', i);
      txt = await mainText(page);
      hs = await hrefs(page, 'main a');
      ok(`bundle owner: ${slug} home has no bundle card, no MOTHER, no bundle link`, !/MOTHER/.test(txt) && !/The whole journey, for less/.test(txt) && !hs.some((h) => h.startsWith(BUNDLE) && !/thank-you|read/.test(h)), JSON.stringify(hs.filter((h) => /complete/.test(h))));
    }
    await lab(page, 'bundleowner', 3);
    ok('bundle owner: the Postpartum reader drops the Want it all line', !/Want it all, for less/.test(await page.evaluate(() => document.body.innerText)) && !/MOTHER/.test(await page.evaluate(() => document.querySelector('.rd').innerText)));
    await lab(page, 'bundleowner', 4);
    ok('bundle owner: the bundle page shows the plain price, no member note, no coupon', (await page.$$eval('.wg-member-price', (a) => a.length)) === 0 && !(await hrefs(page, 'a[href*="selar.com/completemotherhoodjourney"]')).some((h) => /coupon/.test(h)));
    await go(page, '/programs/postpartum-reset');
    ok('bundle owner: a single sales page hides its bundle offer', !(await vis(page, '[data-bundle-offer]')));
    await go(page, '/programs/trying-to-conceive-blueprint');
    ok('bundle owner: the Trying-to-Conceive sales page hides its bundle offer', !(await vis(page, '[data-bundle-offer]')));
    // a tool page never sells her the bundle
    await go(page, '/fertility/tools/ttc-checklist');
    ok('bundle owner: a tool page offers no bundle', !(await hrefs(page, `a[href^="${BUNDLE}"]`)).some((h) => !/thank-you/.test(h)));
    // a bundle owner who also owns Wife Material: the Wife Material home card (and the bundle line in it) stays hidden
    await page.evaluate(() => localStorage.setItem('wg_relationships_home', '{"u":"/programs/wife-material-blueprint/thank-you","l":"Wife Material home"}'));
    await go(page, '/programs/wife-material-blueprint/thank-you');
    ok('bundle owner who also owns Wife Material: the home shows no motherhood next-step card', !(await vis(page, '[data-bundle-offer]')) && !/What comes after/.test(await mainText(page)));
    await go(page, '/app/');
    ok('bundle owner who also owns Wife Material: no recommendation', !(await pickBox(page)));
    await page._ctx.close();

    // a bundle bought in the diaspora market
    page = await newPage({ tag: 'owner-d' });
    await go(page, '/lab/');
    await page.evaluate(() => { ['wg_fertility_home', 'wg_pregnancy_home', 'wg_pp_home', 'wg_parenting_home'].forEach((k) => localStorage.setItem(k, JSON.stringify({ u: '/programs/complete-motherhood-journey-diaspora/thank-you', l: 'Motherhood Journey home' }))); localStorage.setItem('wg_ttc_checklist_v1', '{"0":true}'); });
    await go(page, '/programs/postpartum-reset-diaspora/thank-you');
    ok('diaspora bundle owner: no bundle card or MOTHER on a single diaspora home', !/MOTHER/.test(await mainText(page)) && !(await vis(page, '[data-bundle-offer]')));
    await go(page, '/app/');
    ok('diaspora bundle owner: no recommendation on the app home', !(await pickBox(page)));
    await go(page, BUNDLE + '-diaspora');
    ok('diaspora bundle owner: the diaspora bundle page shows no member note', (await page.$$eval('.wg-member-price', (a) => a.length)) === 0);
    await page._ctx.close();

    // ---- games are counted privately, and never fire the install bar ----
    page = await newPage({ tag: 'play' });
    await go(page, '/relationships/tools/girls-girl-quiz');
    ok('game page: nothing is stored before she finishes', (await store(page, 'wg_played_v1')) === null);
    await page.evaluate(() => window.wgShowResult('certified'));
    await wait(1800);
    const pl = JSON.parse(await store(page, 'wg_played_v1') || 'null');
    ok('a finished result writes wg_played_v1 with the game path and a time', pl && typeof pl['/relationships/tools/girls-girl-quiz'] === 'number' && Date.now() - pl['/relationships/tools/girls-girl-quiz'] < 20000, JSON.stringify(pl));
    ok('a finished game does not offer the install bar', (await page.$$eval('.wg-app-bar', (a) => a.length)) === 0);
    ok('the played marker never reaches the dataLayer', await page.evaluate(() => !JSON.stringify(window.dataLayer || []).includes('wg_played') && !JSON.stringify(window.dataLayer || []).includes('girls-girl-quiz"') ));
    await go(page, '/fertility/tools/ttc-checklist');
    await page.evaluate(() => localStorage.setItem('wg_ttc_checklist_v1', '{"0":true}'));
    await wait(1800);
    ok('a saved tool entry still offers the install bar', (await page.$$eval('.wg-app-bar', (a) => a.length)) === 1);
    // a two-player game (no result page) counts when she finishes
    await go(page, '/pregnancy/tools/baby-name-battle');
    ok('two-player game page loads wgPlayed', await page.evaluate(() => typeof window.wgPlayed === 'function'));
    await page.evaluate(() => { try { history.replaceState(null, '', location.pathname); } catch (e) {} window.wgPlayed(); });
    ok('wgPlayed on a pair game records its path', /baby-name-battle/.test(await store(page, 'wg_played_v1')));
    // a non-tool page never records
    await go(page, '/app/');
    await page.evaluate(() => { localStorage.removeItem('wg_played_v1'); window.wgPlayed(); });
    ok('wgPlayed outside a tool page records nothing', (await store(page, 'wg_played_v1')) === null);
    const appjs = await (await fetch(B + '/assets/js/wg-app.js')).text();
    const rx = appjs.match(/var TOOL_KEY = (\/.*\/);/);
    const TOOL_KEY = rx && eval(rx[1]);
    ok('TOOL_KEY excludes wg_played_v1 and still matches a saved tool', TOOL_KEY && !TOOL_KEY.test('wg_played_v1') && TOOL_KEY.test('wg_ttc_checklist_v1') && TOOL_KEY.test('wg_stage_pregnancy_v1'));
    // backup keeps the marker (it is a wg_ key), and it is not a saved tool on the app home
    await page.evaluate(() => { localStorage.clear(); localStorage.setItem('wg_played_v1', '{"/relationships/tools/girls-girl-quiz":1}'); });
    await go(page, '/app/');
    ok('a played marker alone is not a saved tool', !(await vis(page, '#appSaved .ph-tool .ph-saved')));
    await page._ctx.close();

    // ---- storage blocked ----
    page = await newPage({ blocked: true, tag: 'blocked' });
    await go(page, '/app/');
    ok('storage blocked: the app home shows the stage cards and no pick', (await page.$$eval('#appStages .stage-card', (a) => a.length)) === 5 && !(await pickBox(page)));
    await go(page, '/relationships/tools/girls-girl-quiz');
    const thrown = await page.evaluate(() => { try { window.wgPlayed(); window.wgShowResult('certified'); return false; } catch (e) { return String(e); } });
    ok('storage blocked: finishing a game throws nothing', thrown === false, thrown);
    await go(page, '/programs/postpartum-reset/thank-you');
    ok('storage blocked: a program home still shows its cards', /MOTHER/.test(await mainText(page)));
    await page._ctx.close();

    ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  } catch (e) {
    ok('test run completed', false, e.stack || String(e));
  } finally {
    await browser.close();
  }
  console.log(out.join('\n'));
  const fail = out.filter((l) => l.startsWith('FAIL')).length;
  console.log(`\n${out.length - fail} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
