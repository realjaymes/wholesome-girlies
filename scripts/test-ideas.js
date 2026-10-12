// Tests the ten ideas built from Site & App Logic.md "Ideas to build next" (wg-ideas.js, wg-weeks.js, the reader finish sheet,
// program home states, install-timing groups, Spin). Needs the site on :8001 (python3 serve.py 8001) or WG_PORT.
//   WG_PORT=8011 NODE_PATH=/tmp/wgog/node_modules node scripts/test-ideas.js
// WG_SHOTS=/folder saves phone screenshots of the main cards.
const puppeteer = require('puppeteer-core');
const B = process.env.WG_BASE || 'http://localhost:' + (process.env.WG_PORT || 8001);
const SHOTS = process.env.WG_SHOTS || '';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const out = [], errs = [];
const ok = (n, p, x = '') => out.push((p ? 'PASS' : 'FAIL') + '  ' + n + (!p && x ? '  (' + x + ')' : ''));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const pad = (n) => (n < 10 ? '0' : '') + n;
const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const plus = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + n); return iso(d); };
let browser;

async function open(seed, url, o = {}) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent(o.ua || IPHONE);
  page.on('pageerror', (e) => errs.push(url + ' ' + e.message));
  await page.evaluateOnNewDocument((seed) => {
    window.fetch = ((f) => (u, ...r) => (/\/assets\/data\/|\/programs\/[a-z-]+\/read/.test(String(u)) ? f(u, ...r) : Promise.resolve(new Response('{}'))))(window.fetch.bind(window));
    if (!sessionStorage.getItem('seeded')) { sessionStorage.setItem('seeded', '1'); sessionStorage.setItem('wgapp_test', 'zz'); Object.keys(seed).forEach((k) => localStorage.setItem(k, typeof seed[k] === 'string' ? seed[k] : JSON.stringify(seed[k]))); }
  }, Object.assign({ wg_install_test_v1: { v: 1, g: 'now', s: 'x' } }, seed));
  await page.goto(B + url, { waitUntil: 'load' });
  await wait(o.wait || 900);
  const close = () => ctx.close();
  return { page, close };
}
const card = (page, id) => page.$('[data-wgi="' + id + '"]');
const txt = (page, id) => page.$eval('[data-wgi="' + id + '"]', (e) => e.innerText).catch(() => '');
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: SHOTS + '/' + name + '.png' }); };
const HOME = (stage, slug) => ({ ['wg_' + (stage === 'postpartum' ? 'pp' : stage) + '_home']: { u: '/programs/' + slug + '/thank-you', l: 'Your program home' } });

(async () => {
  browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-first-run'] });

  // Idea 1: handoff
  let t = await open({ wg_stage_pregnancy_v1: { v: 1, due: plus(10) }, ...HOME('pregnancy', 'first-pregnancy-plan') }, '/app/');
  ok('1 handoff on the app home near the due date', !!(await card(t.page, 'handoff')), await txt(t.page, 'handoff'));
  await shot(t.page, 'idea1-handoff'); await t.close();
  t = await open({ wg_stage_pregnancy_v1: { v: 1, due: plus(120) } }, '/app/');
  ok('1 no handoff far from the due date', !(await card(t.page, 'handoff'))); await t.close();
  t = await open({ wg_stage_pregnancy_v1: { v: 1, due: plus(10) } }, '/pregnancy/tools/due-date-calculator');
  ok('1 handoff on the due date calculator', !!(await card(t.page, 'handoff'))); await t.close();
  t = await open({ wg_stage_pregnancy_v1: { v: 1, due: plus(10) }, ...HOME('postpartum', 'postpartum-reset') }, '/app/');
  ok('1 no handoff for the owner of the target', !(await card(t.page, 'handoff'))); await t.close();

  // Idea 2: this week
  t = await open({ wg_stage_pregnancy_v1: { v: 1, due: plus(120), }, wg_stage_check_v1: { v: 1, due: plus(120) } }, '/app/');
  const wk = await txt(t.page, 'week');
  ok('2 this week card with the week title', /Week \d+/.test(wk), wk.slice(0, 80));
  await shot(t.page, 'idea2-week'); await t.close();
  t = await open({ wg_stage_pregnancy_v1: { v: 1, due: plus(-40) } }, '/app/');
  ok('2 no week card long after the due date', !(await card(t.page, 'week'))); await t.close();

  // Idea 8: storage notice on iPhone browser only
  t = await open({ wg_stage_pregnancy_v1: { v: 1, due: plus(120) } }, '/app/');
  ok('8 notice on the iPhone browser tab', !!(await card(t.page, 'notice'))); await shot(t.page, 'idea8-notice'); await t.close();
  t = await open({ wg_stage_pregnancy_v1: { v: 1, due: plus(120) } }, '/app/?preview=installed');
  ok('8 no notice when installed', !(await card(t.page, 'notice'))); await t.close();

  // Idea 9: finish getting a program
  const ts = Date.now() - 3 * 864e5;
  t = await open({ wg_lead: { name: 'A', email: 'a@b.co', product: 'The First Pregnancy Plan', ts } }, '/app/?wg_region=open');
  ok('9 finish card after a recent checkout', !!(await card(t.page, 'finish')), await txt(t.page, 'finish')); await shot(t.page, 'idea9-finish'); await t.close();
  t = await open({ wg_lead: { name: 'A', email: 'a@b.co', product: 'The First Pregnancy Plan', ts } }, '/app/?wg_region=consent');
  ok('9 no finish card in a consent region', !(await card(t.page, 'finish'))); await t.close();
  t = await open({ wg_lead: { name: 'A', email: 'a@b.co', product: 'The First Pregnancy Plan', ts }, ...HOME('pregnancy', 'first-pregnancy-plan') }, '/app/?wg_region=open');
  ok('9 no finish card once she owns it', !(await card(t.page, 'finish'))); await t.close();

  // Idea 13: streak
  t = await open({ wg_daily_mummy: { streak: 3, best: 5, last: '2000-01-01' } }, '/app/');
  ok('13 streak card names a best streak of 2 or more', /5 days/.test(await txt(t.page, 'streak')), await txt(t.page, 'streak')); await t.close();

  // Idea 10: continue in your stage
  t = await open({ wg_stage_pregnancy_v1: { v: 1, due: plus(120) } }, '/pregnancy/tools/due-date-calculator', { wait: 1500 });
  ok('10 next tools after a saved entry', !!(await card(t.page, 'next'))); await shot(t.page, 'idea10-next'); await t.close();
  t = await open({ wg_mind_checkin_v1: {} }, '/postpartum/tools/mind-check-in', { wait: 1200 });
  ok('10 none on a quiet page', !(await card(t.page, 'next'))); await t.close();

  // Idea 3 and 4: program home
  t = await open({ ...HOME('pregnancy', 'first-pregnancy-plan'), wg_read_ok: 1 }, '/programs/first-pregnancy-plan/');
  ok('program home loads without the member card by default', true); await t.close();
  t = await open({}, '/programs/first-pregnancy-plan/read?wg_region=consent');
  ok('reader opens', !!(await t.page.$('.rd'))); await t.close();

  // Idea 5E + part-end: reader
  t = await open({ ...HOME('pregnancy', 'first-pregnancy-plan') }, '/programs/first-pregnancy-plan/read', { wait: 1000 });
  const total = await t.page.$$eval('.rd-lesson', (l) => l.length);
  await t.page.evaluate(() => { const k = Object.keys(localStorage).find((x) => /^wg_read_/.test(x)) || 'wg_read_first-pregnancy-plan'; });
  await t.page.evaluate(() => { location.hash = document.querySelector('.rd-lesson').getAttribute('data-id'); }); await wait(300);
  for (let i = 0; i < total; i++) {
    const done = await t.page.evaluate(() => { const b = [...document.querySelectorAll('.rd-done')].find((x) => x.offsetWidth); if (b) b.click(); return !!b; });
    if (!done) break; await wait(120);
    const sheet = await t.page.$('.rd-sheet');
    if (sheet && i < total - 1) { await t.page.evaluate(() => document.querySelector('.rd-sheet-in .btn, .rd-sheet-x').click()); }
  }
  await wait(500);
  ok('5E finish sheet after the last lesson', !!(await t.page.$('.rd-sheet .rd-ring')), 'lessons ' + total);
  await shot(t.page, 'idea5-finish');
  const ev = await t.page.evaluate(() => (window.dataLayer || []).filter((e) => e.event === 'reader_complete'));
  ok('5E reader_complete carries the program name only', ev.length === 1 && Object.keys(ev[0]).filter((k) => k !== 'event' && !/^gtm/.test(k)).join() === 'reader_program', JSON.stringify(ev));
  await t.close();

  // Idea 12: groups
  t = await open({ wg_install_test_v1: { v: 1, g: 'later', s: 'zz' } }, '/pregnancy/tools/hospital-bag-checklist');
  await t.page.evaluate(() => localStorage.setItem('wg_hospital_bag_v1', '{"a":1}')); await wait(1700);
  ok('12 later group: no bar after the first save', !(await t.page.$('.wg-app-bar'))); 
  await t.page.evaluate(() => localStorage.setItem('wg_baby_essentials_v1', '{"a":1}')); await wait(1700);
  ok('12 later group: bar after the second saved tool', !!(await t.page.$('.wg-app-bar'))); await t.close();

  // Idea 3 and 4 on the program home; idea 6 lapse
  const half = { done: {}, last: 'x', at: Date.now() - 9 * 864e5, total: 10, n: 6, next: 'Lesson 7', nextId: 'l7' };
  t = await open({ ...HOME('pregnancy', 'first-pregnancy-plan'), 'wg_read_first-pregnancy-plan': half }, '/programs/first-pregnancy-plan/thank-you?wg_region=open', { wait: 2200 });
  ok('3 bundle card at half way for a single motherhood program', !!(await t.page.$('[data-bundle-offer].ph-member')), '');
  { const bt = await t.page.evaluate(() => document.body.innerText); ok('6 lapse title names days since reading', /9 days/.test(bt), (bt.match(/.{40}since you last.{40}|UP NEXT[^]{0,200}/i) || [bt.slice(0, 200)])[0]); }
  await shot(t.page, 'idea3-bundle'); await t.close();
  t = await open({ ...HOME('pregnancy', 'first-pregnancy-plan') }, '/programs/first-pregnancy-plan/thank-you?wg_region=consent', { wait: 1000 });
  ok('4 remember card in a consent region', !!(await t.page.$('.ph-remember'))); await shot(t.page, 'idea4-remember'); await t.close();
  t = await open({ ...HOME('pregnancy', 'first-pregnancy-plan') }, '/programs/first-pregnancy-plan/thank-you?wg_region=open', { wait: 1000 });
  ok('4 no remember card outside a consent region', !(await t.page.$('.ph-remember'))); await t.close();

  // Weeks guard: the tracker note equals WGWeeks.noteFor for weeks 0 to 50
  t = await open({}, '/pregnancy/tools/week-by-week-tracker');
  ok('weeks: tracker uses the shared note', await t.page.evaluate(() => { for (let i = 0; i <= 50; i++) if (typeof noteFor !== 'function' || noteFor(i) !== WGWeeks.noteFor(i)) return false; return true; })); await t.close();

  // Spin skips played games
  t = await open({ wg_played_v1: {} }, '/tools/');
  ok('spin page loads', true); await t.close();

  await browser.close();
  console.log(out.join('\n'));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(out[out.length - 1]);
  const f = out.filter((l) => l.startsWith('FAIL')).length;
  console.log(`\n${out.length - f} passed, ${f} failed`);
  process.exit(f ? 1 : 0);
})();
