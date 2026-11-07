// Tests the streak (assets/js/wg-streak.js) and today's cards at 390x844: counting, the rest day, a streak that ended,
// milestones, the toast once a day, the quiet pages, the app home card, the signed-in sync and what leaves the phone.
// Needs the site on :8008 (python3 serve.py 8008) or WG_PORT.
//   WG_PORT=8008 NODE_PATH=/tmp/wgog/node_modules node scripts/test-streak.js
const T = require('./lib-wgtest.js');
// textContent, so a card behind the "Read today's card" link (a closed details) is read too
const tc = (page, sel) => page.$eval(sel, (e) => e.textContent).catch(() => '');
const { ok, wait, plus, isoWeek, open, ls, reqs, text, has } = T;
const S = (o) => ({ wg_streak_v1: Object.assign({ v: 1, count: 0, best: 0, last_day: '', rest_used_week: null, milestones: [] }, o) });
const DATE_LIKE = /\d{4}-\d{2}-\d{2}/;
// ── who she is: the flags, the cached account and the server's answers for each group ──
const HOMEKEY = { relationships: 'wg_relationships_home', fertility: 'wg_fertility_home', pregnancy: 'wg_pregnancy_home', postpartum: 'wg_pp_home', parenting: 'wg_parenting_home' };
const STAGE_OF = { 'wife-material-blueprint': 'relationships', 'trying-to-conceive-blueprint': 'fertility', 'first-pregnancy-plan': 'pregnancy', 'postpartum-reset': 'postpartum', 'first-baby-playbook': 'parenting' };
const FL = (slug) => JSON.stringify({ u: '/programs/' + slug + '/thank-you', l: 'Home' });
const flagsFor = (slug) => { // the program flags her phone holds
  const b = slug.replace(/-diaspora$/, ''), o = {};
  if (b === 'complete-motherhood-journey') ['fertility', 'pregnancy', 'postpartum', 'parenting'].forEach((st) => { o[HOMEKEY[st]] = FL(slug); });
  else o[HOMEKEY[STAGE_OF[b]]] = FL(slug);
  return o;
};
const homeUrl = (slug) => 'https://wholesomegirlies.xyz/programs/' + slug + '/thank-you';
// A buyer (flags only, signed out): a phone that bought on the program's thank-you page.
const owns = (...slugs) => Object.assign({}, ...slugs.map(flagsFor));
// A signed-in phone: session, cached account and the server answering with the same account. programs: [{slug, ends?}].
function signed(programs, member) {
  const account = { email: 'ada@example.com', name: '', programs: programs.map((x) => ({ slug: x.slug, home: homeUrl(x.slug), ends: x.ends })), member: member || undefined };
  const seed = { wg_session_v1: JSON.stringify({ token: 'tok123' }), wg_account_v1: { v: 1, at: Date.now(), account, saved: [] } };
  programs.forEach((x) => Object.assign(seed, flagsFor(x.slug)));
  return { seed, route: { '/account': { ok: true, account, state: {} }, '/first1000/status': { ok: true, taken: 8, cap: 100, left: 92, open: true } } };
}
const memberOf = (stage) => ({ stage, ends: plus(200) + 'T00:00:00Z', steps: {}, invite: 'ABC' });
const UI = (o) => ({ wg_streak_ui_v1: Object.assign({ v: 1, rule: plus(-3), first: plus(-3), days: [] }, o) });
const READ = (slug, n, ago) => ({ ['wg_read_' + slug]: { done: {}, n, at: Date.now() - (ago || 0) } });
const totalOf = async (slug) => +(/data-total="(\d+)"/.exec(await (await fetch(T.B + '/programs/' + slug + '/read')).text())[1]);
const OPEN = { '/first1000/status': { ok: true, taken: 8, cap: 100, left: 92, open: true } };

(async () => {
  try {
  await T.launch();
  let t, s;

  // counting
  t = await open({}, '/pregnancy/tools/hospital-bag-checklist');
  await t.page.evaluate(() => document.dispatchEvent(new CustomEvent('wg:saved')));
  await wait(400);
  s = await ls(t.page, 'wg_streak_v1');
  ok('first useful action starts day 1', s && s.count === 1 && s.best === 1 && s.last_day === plus(0), JSON.stringify(s));
  ok('the toast says Day 1 done', /Day 1 done\. See you tomorrow\./.test(await text(t.page, '.wgs-toast')));
  await t.page.evaluate(() => WGStreak.record('again'));
  s = await ls(t.page, 'wg_streak_v1');
  ok('a second action the same day does not count again', s.count === 1);
  await wait(3300);
  ok('the toast leaves after about three seconds', !(await has(t.page, '.wgs-toast')));
  ok('streak keys are not saved entries (no install bar)', !(await has(t.page, '.wg-app-bar')));
  ok('the backup carries the streak key', await t.page.evaluate(() => WGApp.savedKeys().indexOf('wg_streak_v1') > -1));
  await t.close();

  t = await open({}, '/relationships/tools/girls-girl-quiz');
  await t.page.evaluate(() => window.wgPlayed());
  await wait(300);
  s = await ls(t.page, 'wg_streak_v1');
  ok('a finished game counts (wgPlayed)', s && s.count === 1);
  await t.close();

  t = await open(S({ count: 4, best: 4, last_day: plus(-1), milestones: [3] }), '/tools/');
  await t.page.evaluate(() => WGStreak.record('x'));
  s = await ls(t.page, 'wg_streak_v1');
  ok('yesterday plus today makes day 5', s.count === 5 && s.best === 5);
  await t.close();

  // toast once a day
  t = await open(Object.assign(S({ count: 2, best: 2, last_day: plus(-1) }), { wg_streak_ui_v1: { v: 1, toast: plus(0), days: [] } }), '/tools/');
  await t.page.evaluate(() => WGStreak.record('x'));
  ok('no second toast on the same day', !(await has(t.page, '.wgs-toast')));
  await t.close();

  // quiet pages
  for (const p of ['/postpartum/tools/mind-check-in', '/pregnancy/guides/chemical-miscarriage', '/postpartum/guides/postpartum-warning-signs', '/fertility/tools/the-wait-check-in']) {
    t = await open({}, p);
    await t.page.evaluate(() => WGStreak.record('x'));
    ok('no toast on ' + p, !(await has(t.page, '.wgs-toast')));
    await t.close();
  }

  // the rest day
  const missed = plus(-1);
  t = await open(S({ count: 10, best: 10, last_day: plus(-2), rest_used_week: null }), '/app/?preview=installed', { wait: 1500 });
  s = await ls(t.page, 'wg_streak_v1');
  ok('one missed day is covered by the rest day', s.count === 10 && s.last_day === missed && s.rest_used_week === isoWeek(missed), JSON.stringify(s));
  const body = await tc(t.page, '#appToday');
  ok('the app home says the rest day was used', /rest day/.test(body) && /10-day streak is safe/.test(body), body.slice(0, 200));
  ok('the strip shows a rest circle', await has(t.page, '.wgs-dots i.r'));
  await t.page.evaluate(() => WGStreak.record('x'));
  s = await ls(t.page, 'wg_streak_v1');
  ok('the next action makes day 11', s.count === 11);
  await t.close();

  // rest day already used that week: the streak ends and the best stays
  t = await open(S({ count: 12, best: 12, last_day: plus(-2), rest_used_week: isoWeek(missed) }), '/app/?preview=installed', { wait: 1500 });
  s = await ls(t.page, 'wg_streak_v1');
  ok('a second miss in a week ends the streak and keeps the best', s.count === 0 && s.best === 12, JSON.stringify(s));
  const tx = await tc(t.page, '#appToday');
  ok('the ended message is kind', /Your last streak was 12 days\. That is your best, and it stays\./.test(tx), tx.slice(0, 260));
  await t.page.evaluate(() => WGStreak.record('x'));
  s = await ls(t.page, 'wg_streak_v1');
  ok('a new streak starts at 1 and the best stays', s.count === 1 && s.best === 12);
  await t.close();
  t = await open(S({ count: 8, best: 8, last_day: plus(-5) }), '/app/', { wait: 1200 });
  s = await ls(t.page, 'wg_streak_v1');
  ok('a longer gap ends the streak', s.count === 0 && s.best === 8);
  await t.close();

  // milestone at 7, signed in
  const route = { '/account/state': { ok: true, state: { streak: { count: 6, best: 6, last_day: plus(-1), rest_used_week: null } } }, '/member/step': { ok: true, ends: plus(200) + 'T00:00:00Z', steps: {} } };
  t = await open(Object.assign(S({ count: 6, best: 6, last_day: plus(-1), milestones: [3] }), { wg_session_v1: JSON.stringify({ token: 'tok123' }) }), '/pregnancy/tools/hospital-bag-checklist', { route });
  await t.page.evaluate(() => WGStreak.record('x'));
  await wait(4600);
  const sheet = await text(t.page, '.wgs-sheet');
  ok('the milestone sheet shows 7 days, the ladder and the member line', /7 days in a row/.test(sheet) && /3 days/.test(sheet) && /30 days/.test(sheet) && /Member: we added/.test(sheet), sheet.slice(0, 200));
  ok('the sheet offers a share card', /Share my 7 days/.test(sheet));
  await t.page.$eval('.wgs-sheet .btn-primary', (e) => e.click()); await wait(300);
  const sh = await text(t.page, '.wgs-sheet');
  ok('the share text is "7 days in a row with Wholesome Girlies"', /7 days in a row with Wholesome Girlies/.test(sh) && !/pregnan|fertil|postpartum|parent|relationship/i.test(sh), sh);
  const dl = await t.page.evaluate(() => window.dataLayer.filter((e) => e.event === 'streak_milestone'));
  ok('streak_milestone carries days only', dl.length === 1 && Object.keys(dl[0]).filter((k) => !/^gtm\./.test(k)).sort().join() === 'days,event' && dl[0].days === 7, JSON.stringify(dl));
  const rq = await reqs(t.page);
  const st = rq.filter((r) => r.path === '/account/state');
  ok('signed in: the count syncs with POST /account/state and a bearer token', st.length >= 1 && st[0].auth === 'Bearer tok123');
  ok('only the four contract fields leave the phone', st.every((r) => Object.keys(JSON.parse(r.body).streak).sort().join() === 'best,count,last_day,rest_used_week'));
  const steps = rq.filter((r) => r.path === '/member/step').map((r) => JSON.parse(r.body).step);
  ok('a member posts streak_3 and streak_7 to /member/step', steps.indexOf('streak_3') > -1 && steps.indexOf('streak_7') > -1, steps.join());
  await t.close();

  // not signed in: nothing is sent
  t = await open(S({ count: 6, best: 6, last_day: plus(-1) }), '/tools/');
  await t.page.evaluate(() => WGStreak.record('x')); await wait(500);
  ok('not signed in: no request to the server', (await reqs(t.page)).filter((r) => r.path !== '/first1000/status').length === 0);
  await t.close();
  // a milestone on a quiet page waits
  t = await open(S({ count: 2, best: 2, last_day: plus(-1) }), '/postpartum/tools/mind-check-in');
  await t.page.evaluate(() => WGStreak.record('x')); await wait(1600);
  ok('a milestone does not open on a quiet page', !(await has(t.page, '.wgs-sheet')));
  ok('it waits for the next page', (await ls(t.page, 'wg_streak_ui_v1')).pending === 3);
  await t.close();

  // app home: option B
  t = await open({}, '/app/?preview=installed', { wait: 1500 });
  const first = await tc(t.page, '#appToday');
  ok('day 1: no rule card; with no stage she picks one', !/Start your streak/.test(first) && /Which stage are you in\?/.test(first), first.slice(0, 200));
  await t.close();
  t = await open(Object.assign(S({ count: 6, best: 6, last_day: plus(-1) }), { wg_stage_pregnancy_v1: { v: 1, due: plus(120) }, wg_stage_check_v1: { v: 1, due: plus(120) }, wg_streak_ui_v1: { v: 1, rule: plus(-6), first: plus(-6), days: [1, 2, 3, 4, 5, 6].map((n) => plus(-n)) } }), '/app/?preview=installed', { wait: 1500 });
  await t.page.$eval('#appToday summary', (e) => e.click());
  const b = await tc(t.page, '#appToday');
  ok('day 6: today first with the week', /Today · week 22/i.test(b), b.slice(0, 120));
  ok('day 6: the line under the strip', /6 days in a row\. Read today’s card to make it 7\. Best: 6\./.test(b), b);
  ok('the card carries the source line', /Educational, not medical advice\./.test(b));
  ok('the strip has seven circles', (await t.page.$$('.wgs-dots i')).length === 7);
  await t.page.screenshot({ path: (process.env.WG_SHOTS || '/tmp') + '/streak-day6.png' }).catch(() => {});
  await t.page.$eval('#appToday button.btn-primary', (e) => e.click()); await wait(500);
  s = await ls(t.page, 'wg_streak_v1');
  ok('reading today’s card makes day 7', s.count === 7);
  ok('after reading, the card links to the guide', /Open|Read/.test(await t.page.$eval('#appToday a.btn', (e) => e.textContent).catch(() => '')));
  await t.close();

  // the stage cards, picked on the phone
  const cases = [
    ['pregnancy', { wg_stage_pregnancy_v1: { v: 1, due: plus(120) }, wg_stage_check_v1: { v: 1, due: plus(120) } }, /week 22/],
    ['fertility', { wg_stage_fertility_v1: { v: 1, lmp: plus(-10), cycle: 28, starts: [] } }, /cycle day 11/],
    ['postpartum', { wg_stage_postpartum_v1: { v: 1, delivery: plus(-15), type: 'vaginal' } }, /week 3/],
    ['parenting', { wg_vax_dob: plus(-130) }, /month 5/],
  ];
  for (const [name, seed, rx] of cases) {
    t = await open(Object.assign({ wg_streak_ui_v1: { v: 1, rule: plus(-3), first: plus(-3), days: [] } }, seed), '/app/?preview=installed', { wait: 1500 });
    const lab = await tc(t.page, '#appToday .eyebrow');
    ok('card for ' + name + ' (' + lab + ')', new RegExp(rx.source, 'i').test(lab));
    await t.close();
  }
  t = await open({ wg_streak_ui_v1: { v: 1, rule: plus(-3), first: plus(-4), days: [], stage: 'relationships' } }, '/app/?preview=installed', { wait: 1500 });
  ok('relationships: day number since her first streak day', /day 5/i.test(await tc(t.page, '#appToday .eyebrow')));
  await t.close();
  t = await open({ wg_streak_ui_v1: { v: 1, rule: plus(-3), days: [] } }, '/app/?preview=installed', { wait: 1500 });
  ok('no stage yet: she picks one', /Which stage are you in\?/.test(await tc(t.page, '#appToday')));
  await t.close();

  // the consent guard: remembering off
  t = await open({}, '/app/?preview=installed', { wait: 1200 });
  await t.page.evaluate(() => { WGConsent.apply({ analytics: false, advertising: false, remember: false }); appRender(); });
  await wait(600);
  const off = await tc(t.page, '#appToday');
  ok('remembering off: the Turn it on card', /Turn it on/.test(off) && /cannot be kept on this phone/.test(off), off.slice(0, 160));
  await t.page.evaluate(() => [...document.querySelectorAll('#appToday button')].find((b) => /Turn it on/.test(b.textContent)).click()); await wait(600);
  ok('Turn it on switches remembering back on', await t.page.evaluate(() => WGApp.remembering()));
  await t.close();


  // ═══ Streak rules by group ═══════════════════════════════════════════════
  const APP = '/app/?preview=installed';
  const home = async (seed, route, wt) => { const x = await open(seed, APP, { route: route || OPEN, wait: wt || 1800 }); return x; };
  // The milestone sheet at day 7, on a tool page. The toast is marked as shown, so the sheet comes at once.
  const sheetAt7 = async (seed, route) => {
    const x = await open(Object.assign(S({ count: 6, best: 6, last_day: plus(-1), milestones: [3] }), UI({ toast: plus(0) }), seed), '/pregnancy/tools/hospital-bag-checklist', { route: route || OPEN });
    await x.page.evaluate(() => WGStreak.record('x')); await wait(2600);
    const tx = await text(x.page, '.wgs-sheet'); const links = await x.page.$$eval('.wgs-sheet a', (a) => a.map((e) => e.getAttribute('href')));
    await x.close(); return { tx, links };
  };

  // 1. free: the card, a tool or a game; no lesson line
  t = await home({});
  let rule = await text(t.page, '#appToday .wgs-rule');
  ok('free: the app home has no rule card (the rule card is gone); the streak row is the whole of it', rule === '' && !(await has(t.page, '#appToday .wgs-rule')), rule);
  ok('free: no lesson line', !/lesson/i.test(rule) && !(await has(t.page, '#appToday [data-wgs="lesson"]')));
  await t.close();
  let r7 = await sheetAt7({}, OPEN);
  ok('free: day 7 shows the one offer card, the First 100 place while places are left', /For the first 100 women/i.test(r7.tx) && /92 of 100 places are left\./.test(r7.tx) && /Claim my place/.test(r7.tx) && r7.links.some((h) => /^\/first/.test(h)) && !/[₦$]\s?\d/.test(r7.tx), r7.tx);
  ok('free: the badge ladder stays', /3 days/.test(r7.tx) && /14 days/.test(r7.tx) && /30 days/.test(r7.tx));
  ok('free: no lesson progress and no member line', !/lesson \d|\d+ lessons/i.test(r7.tx) && !/Member: we added/.test(r7.tx));
  r7 = await sheetAt7(UI({ toast: plus(0), stage: 'pregnancy' }), { '/first1000/status': { ok: true, taken: 100, cap: 100, left: 0, open: false } });
  ok('free: with the cap full and paused, day 7 falls back to the paid program', /A program for your stage/i.test(r7.tx) && /See the program/.test(r7.tx) && r7.links.some((h) => /^\/programs\//.test(h)) && !/Claim my place/.test(r7.tx) && !/[₦$]\s?\d/.test(r7.tx), r7.tx + r7.links.join());
  r7 = await sheetAt7({ wg_streak_v1: { v: 1, count: 29, best: 29, last_day: plus(-1), rest_used_week: null, milestones: [3, 7, 14] } }, OPEN);
  ok('free: day 30 shows the offer too', /30 days in a row/.test(r7.tx) && /first 100 women/i.test(r7.tx), r7.tx);
  r7 = await sheetAt7({ wg_streak_v1: { v: 1, count: 13, best: 13, last_day: plus(-1), rest_used_week: null, milestones: [3, 7] } }, OPEN);
  ok('free: day 14 shows the badge and no nudge', /14 days in a row/.test(r7.tx) && !/first 100 women/i.test(r7.tx), r7.tx);

  // 2. First 1,000 member: lessons count and link into her program; months at 3, 7 and 30
  const mem = signed([{ slug: 'first-pregnancy-plan', ends: plus(200) + 'T00:00:00Z' }], memberOf('pregnancy'));
  t = await home(mem.seed, mem.route);
  ok('member: the continue row opens her program\'s reader (the rule card is gone)', (await t.page.$eval('#appProgram [data-wgh="continue"]', (e) => e.getAttribute('href')).catch(() => '')).indexOf('/programs/first-pregnancy-plan/read') === 0);
  ok('member: she is a member, not a buyer', await t.page.evaluate(() => WGStreak.who().kind) === 'member');
  await t.close();
  const memSteps = { '/account': mem.route['/account'], '/account/state': { ok: true, state: { streak: { count: 6, best: 6, last_day: plus(-1), rest_used_week: null } } }, '/member/step': { ok: true, ends: plus(230) + 'T00:00:00Z', steps: {} } };
  t = await open(Object.assign(S({ count: 6, best: 6, last_day: plus(-1), milestones: [3] }), UI({ toast: plus(0) }), mem.seed), '/pregnancy/tools/hospital-bag-checklist', { route: memSteps });
  await t.page.evaluate(() => WGStreak.record('x')); await wait(3000);
  const msh = await text(t.page, '.wgs-sheet');
  ok('member: the milestone shows the added month and her new end date', /Member: we added 1 month\. Your access now runs to/.test(msh), msh);
  ok('member: no lesson progress line, no free-place nudge', !/lessons/.test(msh) && !/first 100 women/.test(msh));
  ok('member: months are posted to /member/step', (await reqs(t.page)).filter((r) => r.path === '/member/step').map((r) => JSON.parse(r.body).step).indexOf('streak_3') > -1);
  await t.close();
  // a woman who is signed in and is not a member never posts a streak step
  const plain = signed([], null);
  t = await open(Object.assign(S({ count: 6, best: 6, last_day: plus(-1), milestones: [3] }), plain.seed), '/pregnancy/tools/hospital-bag-checklist', { route: Object.assign({}, plain.route, { '/account/state': { ok: true, state: { streak: { count: 6, best: 6, last_day: plus(-1), rest_used_week: null } } } }) });
  await t.page.evaluate(() => WGStreak.record('x')); await wait(1200);
  ok('signed in without a membership: no /member/step request', (await reqs(t.page)).filter((r) => r.path === '/member/step').length === 0);
  ok('a plain account is free', await t.page.evaluate(() => WGStreak.who().kind) === 'free');
  await t.close();

  // 3. one paid program: lessons count, progress in the milestone, no offer
  const pregTotal = await totalOf('first-pregnancy-plan'), wmTotal = await totalOf('wife-material-blueprint');
  ok('the lesson totals come from the reader pages', pregTotal > 10 && wmTotal > 10, pregTotal + ' ' + wmTotal);
  t = await home(owns('first-pregnancy-plan'));
  ok('buyer: the lesson card opens her program', (await t.page.$eval('#appMain a.btn', (e) => e.getAttribute('href')).catch(() => '')).indexOf('/programs/first-pregnancy-plan/read') === 0);
  ok('buyer: never offered the free program', !(await has(t.page, '#appMain .wgn-offer')) && (await t.page.evaluate(() => WGStreak.who().kind)) === 'buyer');
  await t.close();
  r7 = await sheetAt7(Object.assign(owns('first-pregnancy-plan'), READ('first-pregnancy-plan', 12)), OPEN);
  ok('buyer: the milestone shows lessons, not months', r7.tx.indexOf('12 of ' + pregTotal + ' lessons') > -1 && !/months?\./.test(r7.tx) && !/first 100 women/i.test(r7.tx) && !/^Pregnancy:/m.test(r7.tx), r7.tx);
  t = await open(Object.assign(S({ count: 6, best: 6, last_day: plus(-1), milestones: [3] }), UI({ toast: plus(0) }), owns('wife-material-blueprint'), READ('wife-material-blueprint', 3)), '/relationships/tools/is-he-husband-material', { route: OPEN });
  await t.page.evaluate(() => WGStreak.record('x')); await wait(2600);
  ok('buyer of Wife Material: progress in her own program', (await text(t.page, '.wgs-sheet')).indexOf('3 of ' + wmTotal + ' lessons') > -1);
  await t.close();
  // a lesson ticked in the reader keeps the streak
  t = await open(Object.assign({}, owns('wife-material-blueprint')), '/programs/wife-material-blueprint/read');
  await t.page.$eval('.rd-done', (e) => e.click()); await wait(500);
  s = await ls(t.page, 'wg_streak_v1');
  ok('a lesson ticked in the reader counts for a buyer', s && s.count === 1);
  await t.close();

  // 4. the bundle: the stage follows her own dates
  const BUNDLE = owns('complete-motherhood-journey');
  const stageCases = [
    ['a due date means pregnancy', { wg_stage_pregnancy_v1: { v: 1, due: plus(120) }, wg_stage_check_v1: { v: 1, due: plus(120) } }, /week 22/i, 'first-pregnancy-plan'],
    ['a delivery date in the last 12 weeks means postpartum', { wg_stage_postpartum_v1: { v: 1, delivery: plus(-15), type: 'vaginal' } }, /week 3/i, 'postpartum-reset'],
    ['a baby’s birth date means parenting', { wg_vax_dob: plus(-130) }, /month 5/i, 'first-baby-playbook'],
    ['an old delivery date and a baby’s birth date mean parenting', { wg_stage_postpartum_v1: { v: 1, delivery: plus(-200), type: 'vaginal' }, wg_vax_dob: plus(-200) }, /month 7/i, 'first-baby-playbook'],
    ['a delivery date beats a due date that has not passed (an early baby)', { wg_stage_pregnancy_v1: { v: 1, due: plus(10) }, wg_stage_check_v1: { v: 1, due: plus(10) }, wg_stage_postpartum_v1: { v: 1, delivery: plus(-4), type: 'vaginal' } }, /week 1\b/i, 'postpartum-reset'],
    ['no dates: the stage with the most activity', { wg_hospitalbag_v1: { 0: true }, wg_safe_foods_checklist_v1: { 0: true } }, /./, 'first-pregnancy-plan'],
    ['no dates and no activity: fertility', {}, /./, 'trying-to-conceive-blueprint'],
  ];
  for (const [what, seed, rx, prog] of stageCases) {
    t = await home(Object.assign({}, BUNDLE, UI({}), seed));
    const lab = await tc(t.page, '#appToday .eyebrow'), tb = await tc(t.page, '#appToday');
    const stage = await t.page.evaluate(() => WGStreak.stageOf());
    ok('bundle: ' + what + ' (' + stage + ')', rx.test(lab + ' ' + tb) && STAGE_OF[prog] === stage, lab + ' | ' + stage);
    await t.close();
    t = await home(Object.assign({}, BUNDLE, seed));
    const lh = await t.page.$eval('#appMain a.btn', (e) => e.getAttribute('href')).catch(() => 'none');
    ok('bundle: the lesson card opens ' + prog, lh.indexOf('/programs/' + prog + '/read') === 0, lh);
    await t.close();
  }
  t = await home(Object.assign({}, owns('complete-motherhood-journey-diaspora'), { wg_stage_pregnancy_v1: { v: 1, due: plus(120) }, wg_stage_check_v1: { v: 1, due: plus(120) } }));
  ok('diaspora bundle: the lesson opens the diaspora stage program', (await t.page.$eval('#appMain a.btn', (e) => e.getAttribute('href')).catch(() => '')).indexOf('/programs/first-pregnancy-plan-diaspora/read') === 0);
  await t.close();
  const ppTotal = await totalOf('postpartum-reset'), pbTotal = await totalOf('first-baby-playbook'), ttcTotal = await totalOf('trying-to-conceive-blueprint');
  for (const [what, seed, line] of [
    ['pregnancy', { wg_stage_pregnancy_v1: { v: 1, due: plus(120) }, wg_stage_check_v1: { v: 1, due: plus(120) }, ...READ('first-pregnancy-plan', 12) }, 'Pregnancy: 12 of ' + pregTotal + ' lessons'],
    ['postpartum', { wg_stage_postpartum_v1: { v: 1, delivery: plus(-15), type: 'vaginal' }, ...READ('postpartum-reset', 4) }, 'Postpartum: 4 of ' + ppTotal + ' lessons'],
    ['parenting', { wg_vax_dob: plus(-130), ...READ('first-baby-playbook', 7) }, 'Parenting: 7 of ' + pbTotal + ' lessons'],
    ['fertility (no dates)', { ...READ('trying-to-conceive-blueprint', 2) }, 'Fertility: 2 of ' + ttcTotal + ' lessons'],
  ]) {
    r7 = await sheetAt7(Object.assign({}, BUNDLE, READ('first-pregnancy-plan', 30, 1e6), seed), OPEN);
    ok('bundle milestone, ' + what + ': "' + line + '", one stage and not a total', r7.tx.indexOf(line) > -1 && (r7.tx.match(/lessons/g) || []).length === 1, r7.tx);
  }
  t = await home(BUNDLE);
  ok('bundle: never offered the bundle, another program or the free place', !(await has(t.page, '#appFirst .card')) && !(await has(t.page, '#appMain .wgn-offer')));
  await t.close();

  // 5. Wife Material plus motherhood
  const WM = owns('wife-material-blueprint', 'first-pregnancy-plan');
  t = await home(Object.assign({}, WM, UI({})));
  let eb = await tc(t.page, '#appToday .eyebrow'), sw = await tc(t.page, '#appToday [data-wgs="switch"]');
  ok('Wife Material plus motherhood, no stage date: relationships, with a switch to motherhood', /Today · day/i.test(eb) && sw === 'Switch to motherhood', eb + '|' + sw);
  await t.page.$eval('#appToday [data-wgs="switch"]', (e) => e.click()); await wait(900);
  ok('the switch opens the motherhood card and saves her pick on this phone', (await ls(t.page, 'wg_streak_ui_v1')).pref === 'motherhood' && /Which|Add your due date|week/i.test(await tc(t.page, '#appToday')) && await tc(t.page, '#appToday [data-wgs="switch"]') === 'Switch to relationships');
  await t.page.reload({ waitUntil: 'load' }); await wait(1600);
  ok('her pick is still there after a reload', await tc(t.page, '#appToday [data-wgs="switch"]') === 'Switch to relationships');
  await t.close();
  t = await home(Object.assign({}, WM, UI({}), { wg_stage_pregnancy_v1: { v: 1, due: plus(120) }, wg_stage_check_v1: { v: 1, due: plus(120) } }));
  eb = await tc(t.page, '#appToday .eyebrow'); sw = await tc(t.page, '#appToday [data-wgs="switch"]');
  ok('Wife Material plus motherhood with a stage date: the motherhood card, with a switch to relationships', /week 22/i.test(eb) && sw === 'Switch to relationships', eb + '|' + sw);
  await t.page.$eval('#appToday [data-wgs="switch"]', (e) => e.click()); await wait(900);
  ok('switching to relationships shows the relationships card', /Today · day/i.test(await tc(t.page, '#appToday .eyebrow')) && (await ls(t.page, 'wg_streak_ui_v1')).pref === 'relationships');
  ok('she is offered nothing she already owns', !(await has(t.page, '#appFirst .card')) && !(await has(t.page, '#appMain .wgn-offer')));
  await t.close();
  t = await home(Object.assign({}, owns('wife-material-blueprint'), UI({})));
  ok('Wife Material alone: no switch link', !(await has(t.page, '#appToday [data-wgs="switch"]')));
  await t.close();
  t = await home(Object.assign({}, owns('first-pregnancy-plan'), UI({})));
  ok('one motherhood program: no switch link', !(await has(t.page, '#appToday [data-wgs="switch"]')));
  await t.close();
  t = await home(Object.assign({}, owns('wife-material-blueprint', 'complete-motherhood-journey'), UI({}), { wg_vax_dob: plus(-130) }));
  eb = await tc(t.page, '#appToday .eyebrow');
  ok('Wife Material plus the bundle: the bundle follows the stage date', /month 5/i.test(eb) && await tc(t.page, '#appToday [data-wgs="switch"]') === 'Switch to relationships', eb);
  await t.close();
  // the milestone follows the program she read most recently
  for (const [what, a, b, line] of [
    ['motherhood most recent', 90000, 1000, 'Pregnancy: 12 of ' + pregTotal + ' lessons'],
    ['relationships most recent', 1000, 90000, 'Relationships: 5 of ' + wmTotal + ' lessons'],
  ]) {
    r7 = await sheetAt7(Object.assign({}, WM, READ('wife-material-blueprint', 5, a), READ('first-pregnancy-plan', 12, b)), OPEN);
    ok('Wife Material plus motherhood milestone, ' + what, r7.tx.indexOf(line) > -1 && (r7.tx.match(/lessons/g) || []).length === 1, r7.tx);
  }
  // a lesson in either program keeps the streak
  for (const prog of ['wife-material-blueprint', 'first-pregnancy-plan']) {
    t = await open(Object.assign({}, WM), '/programs/' + prog + '/read');
    await t.page.$eval('.rd-done', (e) => e.click()); await wait(500);
    ok('a lesson in ' + prog + ' keeps the streak', (await ls(t.page, 'wg_streak_v1') || {}).count === 1);
    await t.close();
  }

  // 6. a First 1,000 member who then buys
  const both = signed([{ slug: 'first-pregnancy-plan', ends: plus(200) + 'T00:00:00Z' }, { slug: 'first-baby-playbook' }], memberOf('pregnancy'));
  const bothSteps = Object.assign({}, both.route, { '/account/state': { ok: true, state: { streak: { count: 6, best: 6, last_day: plus(-1), rest_used_week: null } } }, '/member/step': { ok: true, ends: plus(230) + 'T00:00:00Z', steps: {} } });
  t = await open(Object.assign(S({ count: 6, best: 6, last_day: plus(-1), milestones: [3] }), UI({ toast: plus(0) }), both.seed, READ('first-baby-playbook', 9)), '/pregnancy/tools/hospital-bag-checklist', { route: bothSteps });
  ok('member who bought: she is in both groups', await t.page.evaluate(() => WGStreak.who().kind) === 'both');
  await t.page.evaluate(() => WGStreak.record('x')); await wait(3000);
  const bs = await text(t.page, '.wgs-sheet');
  ok('member who bought: the paid program’s progress and the member’s months both show', bs.indexOf('Parenting: 9 of ' + pbTotal + ' lessons') > -1 || bs.indexOf('9 of ' + pbTotal + ' lessons') > -1, bs);
  ok('member who bought: her months still count until the free program ends', /Member: we added 1 month/.test(bs) && (await reqs(t.page)).some((r) => r.path === '/member/step'), bs);
  await t.close();
  t = await home(both.seed, both.route);
  ok('member who bought: the lesson card is main, her second program is a line, and no offer shows', await has(t.page, '#appMain .wgh-step') && await has(t.page, '#appProgram [data-wgh="second"]') && !(await has(t.page, '#appMain .wgn-offer')));
  await t.close();

  // ═══ The offer reaches the right women (the one offer card in #appMain; the rule book decides) ═══
  const offer = async (seed, route, wt) => { const x = await open(seed, '/app/', { route: route || OPEN, wait: wt || 1800 }); const tx = await text(x.page, '#appMain'); return { x, tx }; };
  const STPICK = { wg_streak_ui_v1: { v: 1, stage: 'pregnancy' } };
  let o = await offer(STPICK);
  ok('signed out, no program: the one offer card shows', /For the first 100 women/i.test(o.tx) && /Claim my place/.test(o.tx), o.tx);
  ok('the count line reads "92 of 100 places are left."', /92 of 100 places are left\./.test(o.tx), o.tx);
  await o.x.close();
  o = await offer(STPICK, { '/first1000/status': { ok: true, taken: 0, cap: 100, left: 100, open: true } });
  ok('a fresh cap reads "100 of 100 places are left." with no bare 1000', /100 of 100 places are left\./.test(o.tx) && !/\b1000\b/.test(o.tx), o.tx);
  await o.x.close();
  o = await offer(STPICK, { '/first1000/status': { ok: true, taken: 99, cap: 100, left: 1, open: true } });
  ok('one place left: "1 of 100 place is left."', /1 of 100 place is left\./.test(o.tx), o.tx);
  await o.x.close();
  o = await offer(STPICK, { '/first1000/status': { ok: true, taken: 100, cap: 100, left: 0, open: false } });
  ok('cap full: the slot falls back to the paid program, no claim', /A program for your stage/i.test(o.tx) && /See the program/.test(o.tx) && !/Claim my place/.test(o.tx) && !/[₦$]\s?\d/.test(o.tx), o.tx);
  await o.x.close();
  // nothing renders until her status is known
  t = await open(STPICK, '/app/', { route: { '/first1000/status': { __delay: 4200, __body: { ok: true, taken: 8, cap: 100, left: 92, open: true } } }, wait: 900 });
  ok('the offer waits for the server: nothing renders before it answers', (await text(t.page, '#appMain')) === '' && await t.page.evaluate(() => document.getElementById('appMain').hidden));
  await t.page.waitForSelector('#appMain .wgn-offer', { timeout: 12000 }).catch(() => {});
  ok('the offer shows once the server has answered', /Claim my place/.test(await text(t.page, '#appMain')));
  await t.close();
  const unloaded = signed([], null);
  o = await offer({ wg_session_v1: unloaded.seed.wg_session_v1 }, { '/account': { ok: false }, '/first1000/status': OPEN['/first1000/status'] });
  ok('signed in with her account not loaded: no offer', o.tx === '', o.tx);
  await o.x.close();
  o = await offer(Object.assign({}, unloaded.seed, STPICK), unloaded.route);
  ok('a signed-in woman with no program sees the offer', /Claim my place/.test(o.tx), o.tx);
  await o.x.close();
  o = await offer(owns('first-pregnancy-plan'));
  ok('a buyer on this phone never sees the offer', !/Claim my place|A program for your stage/.test(o.tx), o.tx);
  await o.x.close();
  o = await offer(owns('complete-motherhood-journey'));
  ok('a bundle buyer never sees the offer', !/Claim my place|A program for your stage/.test(o.tx), o.tx);
  await o.x.close();
  const elsewhere = signed([{ slug: 'first-baby-playbook' }], null);
  o = await offer({ wg_session_v1: elsewhere.seed.wg_session_v1, wg_account_v1: elsewhere.seed.wg_account_v1 }, elsewhere.route);
  ok('a buyer who bought on another device (her account lists it) never sees the offer', !/Claim my place|A program for your stage/.test(o.tx), o.tx);
  await o.x.close();
  o = await offer(mem.seed, mem.route);
  ok('a member sees her step card, not the offer', /Today’s step/i.test(o.tx) && !/Claim my place/.test(o.tx), o.tx);
  await o.x.close();

  // the tool pages carry the same slot
  const toolOffer = async (seed, route, wt) => { const x = await open(seed, '/pregnancy/tools/hospital-bag-checklist', { route: route || OPEN, wait: wt || 1800 }); const tx = await text(x.page, '.program-cta'); await x.close(); return tx; };
  let tcx = await toolOffer({});
  ok('tool page, signed out with no program: the offer with the count', /free/.test(tcx) && /92 of 100 places are left/.test(tcx), tcx);
  tcx = await toolOffer({}, { '/first1000/status': { ok: true, taken: 0, cap: 100, left: 100, open: true } });
  ok('tool page: a fresh cap reads 100 of 100 places', /100 of 100 places are left/.test(tcx), tcx);
  tcx = await toolOffer(owns('wife-material-blueprint'));
  ok('tool page: a buyer of another program is never offered the campaign', !/ free|Claim my place/.test(tcx), tcx);
  tcx = await toolOffer(owns('complete-motherhood-journey'));
  ok('tool page: a bundle buyer is not offered a place', !/Claim my place/.test(tcx), tcx);
  tcx = await toolOffer({ wg_session_v1: unloaded.seed.wg_session_v1 });
  ok('tool page: signed in with no account on the phone yet, no offer', !/Claim my place/.test(tcx), tcx);
  tcx = await toolOffer(mem.seed, mem.route);
  ok('tool page: a member is not offered a place', !/Claim my place/.test(tcx), tcx);
  tcx = await toolOffer({ wg_session_v1: elsewhere.seed.wg_session_v1, wg_account_v1: elsewhere.seed.wg_account_v1 }, elsewhere.route);
  ok('tool page: a buyer whose account lists a program is not offered a place', !/Claim my place/.test(tcx), tcx);
  t = await open({}, '/pregnancy/tools/hospital-bag-checklist', { route: { '/first1000/status': { __delay: 4200, __body: { ok: true, taken: 8, cap: 100, left: 92, open: true } } }, wait: 900 });
  ok('tool page: no campaign offer before the server answers', !/Claim my place/.test(await text(t.page, '.program-cta')));
  await t.page.waitForFunction(() => /Claim my place/.test((document.querySelector('.program-cta') || {}).innerText || ''), { timeout: 12000 }).catch(() => {});
  ok('tool page: the offer shows once the server has answered', /Claim my place/.test(await text(t.page, '.program-cta')));
  await t.close();

  // the lab scenarios (James loads them with a button)
  for (const [id, rx, what] of [['streak6', /6 days in a row[\s\S]*week 22/i, 'day 6'], ['streakrest', /rest day[\s\S]*10-day streak is safe/, 'the rest day used'], ['streakended', /Your last streak was 12 days\. That is your best, and it stays\./, 'a streak ended'], ['streak1', /Which stage are you in\?/, 'day 1: no rule card, she picks a stage']]) {
    t = await open({}, '/lab/', { wait: 500 });
    await Promise.all([t.page.waitForNavigation({ waitUntil: 'load' }), t.page.$eval('button[data-run="' + id + '"][data-t="0"]', (e) => e.click())]);
    await wait(1500);
    const lt = await tc(t.page, '#appToday');
    ok('lab scenario ' + id + ': ' + what, rx.test(lt), lt.slice(0, 160));
    await t.close();
  }
  // the group scenarios in the lab
  for (const [id, rx, what] of [['sgnew', /Continue reading/, 'a buyer’s main action is the lesson card'], ['sgbpp', /week 3/i, 'the bundle follows a delivery date'], ['sgbbaby', /month 5/i, 'the bundle follows a baby’s birth date'], ['sgwm', /Switch to motherhood/, 'Wife Material plus motherhood offers the switch'], ['sgwmdate', /week 22[\s\S]*Switch to relationships/i, 'a due date moves the card to motherhood'], ['sgmember', /Add your due date/i, 'a member follows her program’s stage'], ['sgfree', /Start your streak|week 22/i, 'a free woman']]) {
    t = await open({}, '/lab/', { wait: 500 });
    await Promise.all([t.page.waitForNavigation({ waitUntil: 'load' }), t.page.$eval('button[data-run="' + id + '"][data-t="0"]', (e) => e.click())]);
    await wait(1800);
    const lt = await tc(t.page, id === 'sgnew' ? '#appMain' : '#appToday');
    ok('lab scenario ' + id + ': ' + what, rx.test(lt), lt.slice(0, 200));
    await t.close();
  }
  // a 7-day milestone from the lab
  t = await open({}, '/lab/', { wait: 500 });
  await Promise.all([t.page.waitForNavigation({ waitUntil: 'load' }), t.page.$eval('button[data-run="streak7"][data-t="0"]', (e) => e.click())]);
  await wait(900);
  await t.page.evaluate(() => document.dispatchEvent(new CustomEvent('wg:saved'))); await wait(4600);
  ok('lab scenario streak7: the 7 day sheet', /7 days in a row/.test(await text(t.page, '.wgs-sheet')));
  await t.close();
  } catch (e) { T.out.push('FAIL  test crashed  (' + e.message + ')'); }
  console.log(T.out.join('\n'));
  if (T.errs.length) console.log('PAGE ERRORS:\n' + T.errs.join('\n'));
  console.log(T.out.filter((l) => l.startsWith('FAIL')).length ? 'FAILED' : 'ALL PASSED');
  await T.getBrowser().close();
  process.exit(T.out.some((l) => l.startsWith('FAIL')) || T.errs.length ? 1 : 0);
})();
