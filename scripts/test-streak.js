// Tests the streak (assets/js/wg-streak.js) and today's cards at 390x844: counting, the rest day, a streak that ended,
// milestones, the toast once a day, the quiet pages, the app home card, the signed-in sync and what leaves the phone.
// Needs the site on :8008 (python3 serve.py 8008) or WG_PORT.
//   WG_PORT=8008 NODE_PATH=/tmp/wgog/node_modules node scripts/test-streak.js
const T = require('./lib-wgtest.js');
const { ok, wait, plus, isoWeek, open, ls, reqs, text, has } = T;
const S = (o) => ({ wg_streak_v1: Object.assign({ v: 1, count: 0, best: 0, last_day: '', rest_used_week: null, milestones: [] }, o) });
const DATE_LIKE = /\d{4}-\d{2}-\d{2}/;

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
  const body = await text(t.page, '#appToday');
  ok('the app home says the rest day was used', /rest day/.test(body) && /10-day streak is safe/.test(body), body.slice(0, 200));
  ok('the strip shows a rest circle', await has(t.page, '.wgs-dot.rest'));
  await t.page.evaluate(() => WGStreak.record('x'));
  s = await ls(t.page, 'wg_streak_v1');
  ok('the next action makes day 11', s.count === 11);
  await t.close();

  // rest day already used that week: the streak ends and the best stays
  t = await open(S({ count: 12, best: 12, last_day: plus(-2), rest_used_week: isoWeek(missed) }), '/app/?preview=installed', { wait: 1500 });
  s = await ls(t.page, 'wg_streak_v1');
  ok('a second miss in a week ends the streak and keeps the best', s.count === 0 && s.best === 12, JSON.stringify(s));
  const tx = await text(t.page, '#appToday');
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
  ok('the milestone sheet shows 7 days, the ladder and the member line', /7 days in a row/.test(sheet) && /3 days/.test(sheet) && /30 days/.test(sheet) && /First 1,000 member/.test(sheet), sheet.slice(0, 200));
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
  ok('not signed in: no request to the server', (await reqs(t.page)).length === 0);
  await t.close();
  // a milestone on a quiet page waits
  t = await open(S({ count: 2, best: 2, last_day: plus(-1) }), '/postpartum/tools/mind-check-in');
  await t.page.evaluate(() => WGStreak.record('x')); await wait(1600);
  ok('a milestone does not open on a quiet page', !(await has(t.page, '.wgs-sheet')));
  ok('it waits for the next page', (await ls(t.page, 'wg_streak_ui_v1')).pending === 3);
  await t.close();

  // app home: option B
  t = await open({}, '/app/?preview=installed', { wait: 1500 });
  const first = await text(t.page, '#appToday');
  ok('day 1: the rule card on the first open', /Start your streak/.test(first) && /Miss one day a week and your streak is safe\./.test(first), first.slice(0, 200));
  await t.close();
  t = await open(Object.assign(S({ count: 6, best: 6, last_day: plus(-1) }), { wg_stage_pregnancy_v1: { v: 1, due: plus(120) }, wg_stage_check_v1: { v: 1, due: plus(120) }, wg_streak_ui_v1: { v: 1, rule: plus(-6), first: plus(-6), days: [1, 2, 3, 4, 5, 6].map((n) => plus(-n)) } }), '/app/?preview=installed', { wait: 1500 });
  const b = await text(t.page, '#appToday');
  ok('day 6: today first with the week', /Today · week 22/i.test(b), b.slice(0, 120));
  ok('day 6: the line under the strip', /6 days in a row\. Read today’s card to make it 7\. Best: 6\./.test(b), b);
  ok('the card carries the source line', /Educational, not medical advice\./.test(b));
  ok('the strip has seven circles', (await t.page.$$('.wgs-dot')).length === 7);
  await t.page.screenshot({ path: (process.env.WG_SHOTS || '/tmp') + '/streak-day6.png' }).catch(() => {});
  await t.page.$eval('#appToday button.btn-primary', (e) => e.click()); await wait(500);
  s = await ls(t.page, 'wg_streak_v1');
  ok('reading today’s card makes day 7', s.count === 7);
  ok('after reading, the card links to the guide', /Open|Read/.test(await text(t.page, '#appToday a.btn')));
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
    const lab = await text(t.page, '#appToday .eyebrow');
    ok('card for ' + name + ' (' + lab + ')', new RegExp(rx.source, 'i').test(lab));
    await t.close();
  }
  t = await open({ wg_streak_ui_v1: { v: 1, rule: plus(-3), first: plus(-4), days: [], stage: 'relationships' } }, '/app/?preview=installed', { wait: 1500 });
  ok('relationships: day number since her first streak day', /day 5/i.test(await text(t.page, '#appToday .eyebrow')));
  await t.close();
  t = await open({ wg_streak_ui_v1: { v: 1, rule: plus(-3), days: [] } }, '/app/?preview=installed', { wait: 1500 });
  ok('no stage yet: she picks one', /Which stage are you in\?/.test(await text(t.page, '#appToday')));
  await t.close();

  // the consent guard: remembering off
  t = await open({}, '/app/?preview=installed', { wait: 1200 });
  await t.page.evaluate(() => { WGConsent.apply({ analytics: false, advertising: false, remember: false }); appRender(); });
  await wait(600);
  const off = await text(t.page, '#appToday');
  ok('remembering off: the Turn it on card', /Turn it on/.test(off) && /cannot be kept on this phone/.test(off), off.slice(0, 160));
  await t.page.evaluate(() => [...document.querySelectorAll('#appToday button')].find((b) => /Turn it on/.test(b.textContent)).click()); await wait(600);
  ok('Turn it on switches remembering back on', await t.page.evaluate(() => WGApp.remembering()));
  await t.close();


  // the lab scenarios (James loads them with a button)
  for (const [id, rx, what] of [['streak6', /week 22[\s\S]*6 days in a row/i, 'day 6'], ['streakrest', /rest day[\s\S]*10-day streak is safe/, 'the rest day used'], ['streakended', /Your last streak was 12 days\. That is your best, and it stays\./, 'a streak ended'], ['streak1', /Start your streak/, 'day 1']]) {
    t = await open({}, '/lab/', { wait: 500 });
    await Promise.all([t.page.waitForNavigation({ waitUntil: 'load' }), t.page.$eval('button[data-run="' + id + '"][data-t="0"]', (e) => e.click())]);
    await wait(1500);
    const lt = await text(t.page, '#appToday');
    ok('lab scenario ' + id + ': ' + what, rx.test(lt), lt.slice(0, 160));
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
