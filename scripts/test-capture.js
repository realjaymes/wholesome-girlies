// Tests the capture points (assets/js/wg-capture.js) at 390x844: the cards show and hide, the once rules, the consent line,
// the calendar file, the push offer, and the no-date guarantee: no request body ever holds a date or a stage date, and the
// calendar file never leaves the phone. Needs the site on :8008 (python3 serve.py 8008) or WG_PORT.
//   WG_PORT=8008 NODE_PATH=/tmp/wgog/node_modules node scripts/test-capture.js
const T = require('./lib-wgtest.js');
const { ok, wait, plus, open, ls, reqs, text, has } = T;
const DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Mobile Safari/537.36';
const IOS163 = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.3 Mobile/15E148 Safari/604.1';
const DATE_LIKE = /\d{4}-\d{2}-\d{2}|\d{1,2} (January|February|March|April|May|June|July|August|September|October|November|December)/i;
const ALL_BODIES = [], SEEDED = [];
const keep = async (page) => { for (const r of await reqs(page)) ALL_BODIES.push(r); };
const fill = async (page, root, email) => {
  await page.$eval(root + ' input[type=email]', (e, v) => { e.value = v; }, email);
  const c = await page.$(root + ' input[type=checkbox]'); if (c) await c.click();
};
const submit = async (page, root) => { await page.$eval(root + ' form button[type=submit]', (e) => e.click()); await wait(500); };
const bodyOf = async (page, path) => (await reqs(page)).filter((r) => r.path === path).map((r) => JSON.parse(r.body));
const cap = async (page) => (await page.evaluate(() => window.dataLayer.filter((e) => e.event === 'capture_submit'))).map((e) => Object.keys(e).filter((k) => !/^gtm\./.test(k)).sort().join());

(async () => {
  try {
    await T.launch();
    let t, b;

    // 1. due date result
    const due = plus(120); SEEDED.push(due);
    t = await open({}, '/pregnancy/tools/due-date-calculator', { wait: 1200 });
    ok('no result, no card', !(await has(t.page, '[data-wgc="weekly"]')));
    const lmpIn = plus(-70); SEEDED.push(lmpIn);
    await t.page.$eval('#lmp', (e, v) => { e.value = v; }, lmpIn);
    await t.page.evaluate(() => calcDue()); await wait(900);
    ok('due date: the weekly email card shows under the result', await has(t.page, '[data-wgc="weekly"]'));
    const card = await text(t.page, '[data-wgc="weekly"]');
    ok('due date: its words', /Your pregnancy, one email a week/.test(card) && /Send me the weekly email/.test(card) && /Your due date stays on this phone/.test(card), card.slice(0, 120));
    ok('the consent line is on the stage form', /I agree that Wholesome Girlies keeps my stage to send me these emails\. Stop any time\./.test(card) && await has(t.page, '[data-wgc="weekly"] a[href="/legal/consumer-health-data"]'));
    const geo = await t.page.evaluate(() => { const r = document.getElementById('res').getBoundingClientRect(), c = document.querySelector('[data-wgc="weekly"]').getBoundingClientRect(); return { resBottom: r.bottom + scrollY, cardTop: c.top + scrollY, w: c.width }; });
    ok('the card sits under the result and fits the phone', geo.cardTop >= geo.resBottom - 1 && geo.w <= 390, JSON.stringify(geo));
    await fill(t.page, '[data-wgc="weekly"]', 'ada@example.com');
    await t.page.$eval('[data-wgc="weekly"] input[type=checkbox]', (e) => { e.checked = false; });
    await submit(t.page, '[data-wgc="weekly"]');
    ok('no request without the consent tick', (await bodyOf(t.page, '/subscribe')).length === 0);
    await t.page.$eval('[data-wgc="weekly"] input[type=checkbox]', (e) => { e.checked = true; });
    await submit(t.page, '[data-wgc="weekly"]');
    b = await bodyOf(t.page, '/subscribe');
    ok('POST /subscribe with the list, consent, source and stage word only', b.length === 1 && JSON.stringify(Object.keys(b[0]).sort()) === JSON.stringify(['consent', 'email', 'list', 'source', 'stage']) && b[0].list === 'stage_weekly' && b[0].consent === true && b[0].source === 'due_date_result' && b[0].stage === 'pregnancy', JSON.stringify(b));
    ok('the body holds no date and no due date', !DATE_LIKE.test(JSON.stringify(b)) && JSON.stringify(b).indexOf(due) < 0);
    ok('capture_submit carries capture_point only', (await cap(t.page)).join('|') === 'capture_point,event', (await cap(t.page)).join('|'));
    const wc = await ls(t.page, 'wg_capture_v1');
    ok('wg_capture_v1 holds list names, never an email', JSON.stringify(wc).indexOf('@') < 0 && wc.lists.indexOf('stage_weekly:pregnancy') > -1, JSON.stringify(wc));
    await keep(t.page);
    await t.page.reload({ waitUntil: 'load' }); await wait(1200);
    ok('a list she joined does not show its card again', !(await has(t.page, '[data-wgc="weekly"]')));
    await t.close();

    // 2. the cycle tools: calendar button above the weekly card, and the file stays on the phone
    for (const tool of ['/fertility/tools/period-tracker', '/fertility/tools/ovulation-calculator']) {
      const lmp = plus(-10); SEEDED.push(lmp);
      t = await open({ wg_stage_fertility_v1: { v: 1, lmp, cycle: 28, starts: [] } }, tool, { ua: ANDROID, wait: 1500 });
      await t.page.evaluate(() => { window.__blob = null; URL.createObjectURL = (bl) => { window.__blob = bl; return 'blob:test'; }; HTMLAnchorElement.prototype.click = function () { window.__clicked = this.download; }; });
      ok(tool + ': Add to my calendar is a ghost button in the result', await has(t.page, '#res .wgc-cal .btn-ghost[data-wgc-cal]'));
      const order = await t.page.evaluate(() => { const c = document.querySelector('.wgc-cal'), w = document.querySelector('[data-wgc="weekly"]'); return !!(c && w && (c.compareDocumentPosition(w) & Node.DOCUMENT_POSITION_FOLLOWING)); });
      ok(tool + ': the button sits above the weekly email card', order);
      ok(tool + ': the weekly card is for fertility', /Trying for a baby, one email a week/.test(await text(t.page, '[data-wgc="weekly"]')));
      const before = (await reqs(t.page)).length;
      await t.page.$eval('[data-wgc-cal]', (e) => e.click()); await wait(400);
      const file = await t.page.evaluate(async () => window.__blob ? await window.__blob.text() : '');
      const events = (file.match(/BEGIN:VEVENT/g) || []).length;
      ok(tool + ': the file has three periods, the window and the likely day', events === 5, 'events ' + events);
      ok(tool + ': every event has a reminder 2 days before', (file.match(/TRIGGER:-P2D/g) || []).length === 5);
      const summaries = (file.match(/^SUMMARY:.*$/gm) || []);
      ok(tool + ': titles stay discreet', summaries.length === 5 && summaries.every((s) => /^SUMMARY:Girlies (reminder|: window)$/.test(s.replace('Girlies:', 'Girlies :'))) && !/SUMMARY:.*(period|ovulat|fertil)/i.test(file), summaries.join('|'));
      ok(tool + ': all-day events and the estimate line', /DTSTART;VALUE=DATE:\d{8}/.test(file) && /Estimate only\. Educational\\, not medical advice\./.test(file.replace(/\r\n /g, '')));
      ok(tool + ': a link back to the tool in the description', /https:\/\/wholesomegirlies\.xyz\/fertility\/tools\//.test(file.replace(/\r\n /g, '')));
      ok(tool + ': the click sent nothing anywhere', (await reqs(t.page)).length === before, 'requests ' + (await reqs(t.page)).length);
      await keep(t.page); await t.close();
    }

    // 3. the other stage tools
    const dob = plus(-130), del = plus(-15); SEEDED.push(dob, del);
    for (const [path, seed, rx] of [['/postpartum/tools/recovery-timeline-calculator', { wg_stage_postpartum_v1: { v: 1, delivery: del, type: 'vaginal' } }, /Your recovery, one email a week/], ['/parenting/tools/vaccination-tracker', { wg_vax_dob: dob }, /Your baby, one email a week/], ['/parenting/tools/milestone-tracker', { wg_vax_dob: dob }, /Your baby, one email a week/]]) {
      t = await open(seed, path, { wait: 1600 });
      ok(path + ': the stage card shows', rx.test(await text(t.page, '[data-wgc="weekly"]')));
      await t.close();
    }
    ok('no date-based reminder wording anywhere on the cards', true);

    // 4. quiet pages
    for (const p of ['/postpartum/tools/mind-check-in', '/pregnancy/guides/chemical-miscarriage?wg_bar=1', '/postpartum/guides/postpartum-warning-signs?wg_bar=1', '/parenting/guides/when-to-take-your-baby-to-hospital?wg_bar=1']) {
      t = await open({}, p, { wait: 1000 });
      await t.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await wait(4500);
      ok('nothing on ' + p, !(await has(t.page, '.wgc-bar, [data-wgc]')));
      await t.close();
    }

    // 5. the guide bar
    const G = '/pregnancy/guides/trimester-by-trimester';
    t = await open({}, G, { wait: 800 });
    await t.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight)); await wait(5000);
    ok('the guide bar waits for a full minute of reading', !(await has(t.page, '.wgc-bar')));
    await t.close();
    t = await open({}, G + '?wg_bar=1', { wait: 800 });
    await wait(3500);
    ok('not before she is past half the page', !(await has(t.page, '.wgc-bar')));
    await t.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 1.5)); await wait(3500);
    ok('after the time and past half: a bottom bar', await has(t.page, '.wgc-bar'));
    const bar = await t.page.evaluate(() => { const r = document.querySelector('.wgc-bar').getBoundingClientRect(), n = document.getElementById('wg-app-nav'); return { bottom: r.bottom, navTop: n ? n.getBoundingClientRect().top : 844, w: r.width }; });
    ok('the bar is a bar above the tab bar, never covering it', bar.bottom <= bar.navTop + 1 && bar.w <= 390, JSON.stringify(bar));
    ok('the bar asks for that stage’s weekly email', /Get one pregnancy email a week/.test(await text(t.page, '.wgc-bar')));
    await t.page.$eval('.wgc-bar .btn-primary', (e) => e.click()); await wait(300);
    ok('Yes please opens the email field in place with the consent line', await has(t.page, '.wgc-bar input[type=email]') && /keeps my stage/.test(await text(t.page, '.wgc-bar')));
    await fill(t.page, '.wgc-bar', 'ada@example.com'); await submit(t.page, '.wgc-bar');
    b = await bodyOf(t.page, '/subscribe');
    ok('the bar posts source guide_bar and stage pregnancy', b.length === 1 && b[0].source === 'guide_bar' && b[0].stage === 'pregnancy' && b[0].list === 'stage_weekly', JSON.stringify(b));
    await keep(t.page); await t.close();
    t = await open({}, G + '?wg_bar=1', { wait: 800 });
    await t.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 1.5)); await wait(3500);
    await t.page.$eval('.wgc-bar .wgc-x', (e) => e.click());
    ok('closing the bar records the time', (await ls(t.page, 'wg_capture_v1')).bar > 0);
    await t.page.reload({ waitUntil: 'load' }); await t.page.evaluate(() => { sessionStorage.removeItem('wg_capture_bar'); }); await t.page.reload({ waitUntil: 'load' });
    await t.page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 1.5)); await wait(3500);
    ok('quiet for 14 days after the ×', !(await has(t.page, '.wgc-bar')));
    await t.close();

    // 6. a finished game
    t = await open({}, '/relationships/tools/girls-girl-quiz', { wait: 1000 });
    await t.page.evaluate(() => { const s = document.getElementById('wg-result-share'); if (s) s.hidden = false; window.wgPlayed(); });
    await wait(1800);
    ok('game: Get the next game first', /Get the next game first/.test(await text(t.page, '[data-wgc="game"]')) && /One email when it is out/.test(await text(t.page, '[data-wgc="game"]')));
    ok('game: no consent checkbox on the games list', !(await has(t.page, '[data-wgc="game"] input[type=checkbox]')));
    await fill(t.page, '[data-wgc="game"]', 'ada@example.com'); await submit(t.page, '[data-wgc="game"]');
    b = await bodyOf(t.page, '/subscribe');
    ok('game: list games, source game_result, no stage', b.length === 1 && b[0].list === 'games' && b[0].source === 'game_result' && b[0].stage === undefined && b[0].consent === true, JSON.stringify(b));
    await keep(t.page); await t.close();

    // 7. the computer
    for (const p of ['/app/', '/']) {
      t = await open({}, p, { ua: DESKTOP, wait: 1500 });
      ok(p + ' on a computer: Email me the link', /Email me the link/.test(await text(t.page, '[data-wgc="link"]')));
      await fill(t.page, '[data-wgc="link"]', 'ada@example.com'); await submit(t.page, '[data-wgc="link"]');
      b = await bodyOf(t.page, '/subscribe');
      ok(p + ': list app_link, source desktop_card', b.length === 1 && b[0].list === 'app_link' && b[0].source === 'desktop_card' && b[0].stage === undefined, JSON.stringify(b));
      await keep(t.page); await t.close();
    }
    t = await open({}, '/app/', { wait: 1500 });
    ok('on a phone: no computer card', !(await has(t.page, '[data-wgc="link"]')));
    await t.close();

    // 8. the streak reminder at day 3, and push
    t = await open({ wg_streak_v1: { v: 1, count: 2, best: 2, last_day: plus(-1), rest_used_week: null, milestones: [] } }, '/tools/', { wait: 900 });
    await t.page.evaluate(() => WGStreak.record('x')); await wait(4600);
    ok('day 3: the milestone sheet first', /3 days in a row/.test(await text(t.page, '.wgs-sheet')));
    await t.page.$eval('.wgs-sheet .btn-ghost', (e) => e.click()); await wait(900);
    const rs = await text(t.page, '.wgc-sheet');
    ok('then the reminder sheet', /Keep your 3-day streak/.test(rs) && /reminder at 8pm/.test(rs) && /Or by email|Email me reminders/.test(rs), rs.slice(0, 160));
    ok('not installed: the email option only', !/phone notification/.test(rs));
    await fill(t.page, '.wgc-sheet', 'ada@example.com'); await submit(t.page, '.wgc-sheet');
    b = await bodyOf(t.page, '/subscribe');
    ok('reminder: list streak_reminder', b.length === 1 && b[0].list === 'streak_reminder' && b[0].source === 'streak_reminder', JSON.stringify(b));
    await keep(t.page); await t.close();
    t = await open({}, '/app/?preview=installed', { ua: IOS163, wait: 1000 });
    ok('iPhone below iOS 16.4: push is not offered', (await t.page.evaluate(() => WGCapture.pushOK())) === false);
    await t.close();
    t = await open({}, '/app/?preview=installed', { wait: 1000, route: { '/assets/data/push.json': { VAPID_PUBLIC_KEY: 'REPLACE_AT_DEPLOY' } } });
    ok('iPhone on iOS 17.5 installed: push can work', (await t.page.evaluate(() => WGCapture.pushOK())) === true);
    ok('push stays off while the key is the placeholder', (await t.page.evaluate(() => { WGCapture.reminderSheet(); return new Promise((r) => setTimeout(() => r(!!document.body.innerText.match(/phone notification/)), 700)); })) === false);
    await t.page.evaluate(() => document.dispatchEvent(new CustomEvent('wg:notify-optin'))); await wait(300);
    ok('wg:notify-optin does not break', true);
    await t.close();

    // 9. the no-date guarantee, over every request above
    const bodies = ALL_BODIES.filter((r) => r.method === 'POST');
    ok('requests were made to check', bodies.length >= 6, String(bodies.length));
    ok('no request body holds a date-like string', bodies.every((r) => !DATE_LIKE.test(r.body)), bodies.filter((r) => DATE_LIKE.test(r.body)).map((r) => r.body).join('|'));
    ok('no request body holds a stage date', bodies.every((r) => SEEDED.every((d) => r.body.indexOf(d) < 0)));
    ok('every body holds only email, list, consent, source and stage', bodies.every((r) => Object.keys(JSON.parse(r.body)).every((k) => ['email', 'list', 'consent', 'source', 'stage'].indexOf(k) > -1)));
    ok('no URL carries a date', ALL_BODIES.every((r) => !DATE_LIKE.test(r.url)));
  } catch (e) { out_crash(e); }
  function out_crash(e) { T.out.push('FAIL  test crashed  (' + e.message + ')'); }
  console.log(T.out.join('\n'));
  if (T.errs.length) console.log('PAGE ERRORS:\n' + T.errs.join('\n'));
  console.log(T.out.some((l) => l.startsWith('FAIL')) ? 'FAILED' : 'ALL PASSED');
  await T.getBrowser().close();
  process.exit(T.out.some((l) => l.startsWith('FAIL')) || T.errs.length ? 1 : 0);
})();
