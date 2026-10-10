// Tests the saved tools and stage dates (CLAUDE.md section 10, "Saved tools") on the local site, at an iPhone size:
// each of the nine tools saves, restores after a reload, shares its stage date with the other tools in the stage and
// forgets it for the whole stage; the app home shows the "Saved" marks; the backup code round-trips the new keys;
// the install bar still fires after a save; pages work with localStorage blocked and with bad saved values; nothing
// she enters reaches the dataLayer. Needs the site on :8001 (python3 serve.py 8001), or set WG_PORT.
//   WG_PORT=8011 NODE_PATH=/tmp/wgog/node_modules node scripts/test-saved-tools.js
// Set WG_SHOTS=/some/folder to also save a phone-size screenshot of each tool in its saved state.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const B = process.env.WG_BASE || 'http://localhost:' + (process.env.WG_PORT || 8001); // WG_BASE=https://wholesomegirlies.xyz tests the live site
const SHOTS = process.env.WG_SHOTS || '';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const TOOL_KEY = /^wg_(?!lead$|app_|consent|played_|name_v1$)(?!.*_home$)/; // the same pattern as wg-app.js
const out = [];
const ok = (name, pass, extra = '') => { out.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${!pass && extra ? '  (' + extra + ')' : ''}`); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const pad = (n) => (n < 10 ? '0' : '') + n;
const iso = (d) => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
const daysAgo = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - n); return iso(d); };
const monthsAgo = (n) => { const d = new Date(); d.setHours(0, 0, 0, 0); d.setMonth(d.getMonth() - n); return iso(d); };
const addIso = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d); };

const KEYS = { fert: 'wg_stage_fertility_v1', preg: 'wg_stage_pregnancy_v1', pp: 'wg_stage_postpartum_v1', dob: 'wg_vax_dob', plan: 'wg_birth_plan_v1', names: 'wg_name_shortlist_v1' };
const TOOLS = {
  period: '/fertility/tools/period-tracker', ovul: '/fertility/tools/ovulation-calculator',
  due: '/pregnancy/tools/due-date-calculator', week: '/pregnancy/tools/week-by-week-tracker', plan: '/pregnancy/tools/birth-plan-builder',
  recov: '/postpartum/tools/recovery-timeline-calculator',
  mile: '/parenting/tools/milestone-tracker', routine: '/parenting/tools/baby-routine-planner', names: '/parenting/tools/baby-name-explorer', vax: '/parenting/tools/vaccination-tracker'
};
const PRIVACY = 'Saved only on this phone. Nothing is sent to us.';

let browser;
const errs = [];
async function newPage(ctx, opts = {}) {
  const page = await ctx.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await page.setUserAgent(IPHONE);
  // never let a test reach a real endpoint (CLAUDE.md: stub fetch before any checkout path)
  await page.evaluateOnNewDocument(() => { window.fetch = () => Promise.resolve(new Response('{}', { status: 200 })); });
  if (opts.blocked) await page.evaluateOnNewDocument(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }); });
  page.on('pageerror', (e) => errs.push((opts.tag || '') + ' ' + e.message));
  return page;
}
const open = async (page, p) => { await page.goto(B + p, { waitUntil: 'load' }); await wait(450); };
const reload = async (page) => { await page.reload({ waitUntil: 'load' }); await wait(450); };
const val = (page, sel) => page.$eval(sel, (e) => e.value).catch(() => null);
const text = (page, sel) => page.$eval(sel, (e) => e.textContent.trim()).catch(() => null);
const shown = (page, sel) => page.$eval(sel, (e) => !!(e.offsetWidth || e.offsetHeight) && getComputedStyle(e).visibility !== 'hidden').catch(() => false);
const store = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);
const jstore = async (page, k) => { try { return JSON.parse(await store(page, k)); } catch (e) { return null; } };
const setVal = (page, sel, v) => page.$eval(sel, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); }, v);
const clickSel = (page, sel) => page.$eval(sel, (e) => e.click());
const clickText = (page, label) => page.evaluate((label) => {
  const b = [...document.querySelectorAll('button, a.btn')].find((x) => x.textContent.trim() === label && (x.offsetWidth || x.offsetHeight));
  if (!b) return false; b.click(); return true;
}, label);
const pageText = (page) => page.evaluate(() => document.body.innerText);
const shot = async (page, name, sel) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  try {
    const h = await page.$(sel || '.tool-app'); if (h) await h.screenshot({ path: path.join(SHOTS, name + '-tool.png') });
    await page.evaluate(() => { const e = document.querySelector('.wg-saved:not([hidden])') || document.querySelector('.tool-app'); if (e) e.scrollIntoView({ block: 'center' }); });
    await wait(300);
    await page.screenshot({ path: path.join(SHOTS, name + '-phone.png') });
  } catch (e) { errs.push('shot ' + name + ' ' + e.message); }
};
const fmtLong = (page, s, n) => page.evaluate((s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); }, s, n);

(async () => {
  browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-first-run'] });

  // ── 0. keys and privacy line ──────────────────────────────────────────
  ok('every new key matches the install-bar pattern and none ends in _home', Object.values(KEYS).every((k) => TOOL_KEY.test(k) && !/_home$/.test(k)));
  {
    const ctx = await browser.createBrowserContext(); const page = await newPage(ctx, { tag: 'privacy' });
    for (const [n, p] of Object.entries(TOOLS)) {
      await open(page, p);
      const t = await pageText(page);
      ok(`${n}: privacy line is on the page`, t.includes(PRIVACY));
      ok(`${n}: the old "stores nothing" line is gone`, !/stores nothing|do not store your date/i.test(t));
      ok(`${n}: nothing saved, so no forget control shows`, !(await shown(page, '.wg-saved')));
    }
    await ctx.close();
  }

  // ── 1. fertility: Period Tracker and Ovulation Calculator ─────────────
  {
    const ctx = await browser.createBrowserContext(); const page = await newPage(ctx, { tag: 'fertility' });
    await open(page, TOOLS.period);
    ok('period: logging box shows', await shown(page, '#logBox'));
    await setVal(page, '#logDate', daysAgo(93)); await clickSel(page, '#logAdd');
    ok('period: one logged period lists one date', (await page.$$('#logList li')).length === 1);
    ok('period: one cycle logged still uses the number she picked', /Using the cycle length you picked above \(28 days\)/.test(await text(page, '#cycNote')), await text(page, '#cycNote'));
    await setVal(page, '#logDate', daysAgo(62)); await clickSel(page, '#logAdd');
    ok('period: two logged periods still use the picked number', /you picked above/.test(await text(page, '#cycNote')));
    await setVal(page, '#lmp', daysAgo(31));
    await clickText(page, 'Predict my next periods'); await wait(300);
    const noteAvg = await text(page, '#cycNote');
    ok('period: with 3 logged periods it uses her own average and says so', /Using your own average of 31 days, from your last 2 cycles/.test(noteAvg), noteAvg);
    const first = await fmtLong(page, daysAgo(31), 31);
    ok('period: the next periods count from her average, not 28', (await text(page, '#list')).includes(first), first);
    ok('period: still shows three periods', (await page.$$('#list .big')).length === 3);
    const st = await jstore(page, KEYS.fert);
    ok('period: stored as versioned JSON with lmp, cycle and starts', st && st.v === 1 && st.lmp === daysAgo(31) && st.cycle === 28 && st.starts.length === 3, JSON.stringify(st));
    await reload(page);
    ok('period: reload restores the last period date', (await val(page, '#lmp')) === daysAgo(31));
    ok('period: reload restores the history', (await page.$$('#logList li')).length === 3);
    ok('period: reload keeps using her average', /own average of 31 days/.test(await text(page, '#cycNote')));
    ok('period: reload opens on her predictions', await shown(page, '#res'));
    ok('period: forget control shows with its one-line stage note', (await shown(page, '.wg-saved button')) && /every fertility tool/.test(await text(page, '.wg-saved-note')));
    await shot(page, 'period-tracker');
    await clickText(page, 'My period started today'); await wait(200);
    let s2 = await jstore(page, KEYS.fert);
    ok('period: "My period started today" logs today', s2.starts.includes(daysAgo(0)) && s2.lmp === daysAgo(0) && (await val(page, '#lmp')) === daysAgo(0), JSON.stringify(s2));
    await clickSel(page, '#logList li button'); await wait(200);
    s2 = await jstore(page, KEYS.fert);
    ok('period: removing a logged date takes it out and steps the last period back', !s2.starts.includes(daysAgo(0)) && s2.lmp === daysAgo(31), JSON.stringify(s2));
    await setVal(page, '#cyc', '30'); await wait(100);
    ok('period: changing the cycle length updates the saved value', (await jstore(page, KEYS.fert)).cycle === 30);

    await open(page, TOOLS.ovul);
    ok('ovulation: prefilled with the last period date', (await val(page, '#lmp')) === daysAgo(31));
    ok('ovulation: says it is using her own average', /own average of 31 days/.test(await text(page, '#cycNote')), await text(page, '#cycNote'));
    ok('ovulation: opens on the window', await shown(page, '#res'));
    const ov = await page.evaluate((s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return d.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }); }, daysAgo(31), 31 - 14);
    ok('ovulation: ovulation day counts from her average of 31', (await text(page, '#ovday')).includes(ov), ov + ' vs ' + await text(page, '#ovday'));
    await setVal(page, '#lmp', daysAgo(5)); await wait(100);
    ok('ovulation: changing the date updates the saved value', (await jstore(page, KEYS.fert)).lmp === daysAgo(5));
    await shot(page, 'ovulation-calculator');
    ok('ovulation: forget note says it clears every fertility tool', /every fertility tool/.test(await text(page, '.wg-saved-note')));
    await clickText(page, 'Forget my dates'); await wait(200);
    ok('ovulation: forget removes the stage key', (await store(page, KEYS.fert)) === null);
    ok('ovulation: forget empties the date and result', (await val(page, '#lmp')) === '' && !(await shown(page, '#res')));
    ok('ovulation: forget confirms plainly', /removed from this phone/.test(await text(page, '.wg-saved-done')));
    await open(page, TOOLS.period);
    ok('period: the other fertility tool is cleared too', (await val(page, '#lmp')) === '' && (await page.$$('#logList li')).length === 0 && !(await shown(page, '.wg-saved')));
    await ctx.close();
  }

  // ── 2. pregnancy: Due Date Calculator, Week-by-Week, Birth Plan ───────
  {
    const ctx = await browser.createBrowserContext(); const page = await newPage(ctx, { tag: 'pregnancy' });
    await open(page, TOOLS.due);
    const lmp = daysAgo(100);
    await setVal(page, '#lmp', lmp); await clickText(page, 'Show my due date'); await wait(300);
    const sp = await jstore(page, KEYS.preg);
    ok('due: saves the due date as versioned JSON (last period + 280 days)', sp && sp.v === 1 && sp.due === addIso(lmp, 280), JSON.stringify(sp));
    ok('due: shows the saved due date and a forget control', /Saved on this phone: your due date is/.test(await text(page, '.wg-saved-sum')) && (await text(page, '.wg-saved button')) === 'Forget my due date');
    await shot(page, 'due-date-calculator');
    await open(page, TOOLS.week);
    ok('week: opens with the date filled from the saved due date', (await val(page, '#lmp')) === lmp);
    ok('week: opens on her current week', /You are 14 weeks and 2 days pregnant/.test(await text(page, '#weekline')), await text(page, '#weekline'));
    await setVal(page, '#lmp', daysAgo(70)); await clickText(page, 'Show my week'); await wait(200);
    ok('week: changing the date updates the saved due date', (await jstore(page, KEYS.preg)).due === addIso(daysAgo(70), 280));
    await shot(page, 'week-by-week-tracker');
    ok('week: forget note says it clears every pregnancy tool', /every pregnancy tool/.test(await text(page, '.wg-saved-note')));
    await clickText(page, 'Forget my due date'); await wait(200);
    ok('week: one tap removes the due date', (await store(page, KEYS.preg)) === null);
    ok('week: wording is neutral and plain', (await text(page, '.wg-saved-done')) === 'Your due date is removed from this phone.');
    await open(page, TOOLS.due);
    ok('due: cleared for the other pregnancy tool too', !(await shown(page, '.wg-saved')));
    // Birth plan
    await open(page, TOOLS.plan);
    await setVal(page, '#name', 'Ada'); await setVal(page, '#support', 'my sister and my mother'); await setVal(page, '#pain', 'Would like an epidural if available');
    await setVal(page, '#feeding', 'Undecided'); await setVal(page, '#notes', 'I am afraid of needles');
    await wait(700);
    const bp = await jstore(page, KEYS.plan);
    ok('plan: saves every field as she types (versioned)', bp && bp.v === 1 && bp.f.name === 'Ada' && bp.f.notes === 'I am afraid of needles' && bp.f.pain === 'Would like an epidural if available', JSON.stringify(bp));
    await reload(page);
    ok('plan: restores text fields', (await val(page, '#name')) === 'Ada' && (await val(page, '#support')) === 'my sister and my mother' && (await val(page, '#notes')) === 'I am afraid of needles');
    ok('plan: restores dropdowns', (await val(page, '#pain')) === 'Would like an epidural if available' && (await val(page, '#feeding')) === 'Undecided');
    ok('plan: shows the restored plan', /BIRTH PLAN: Ada/.test(await text(page, '#plan')));
    await shot(page, 'birth-plan-builder');
    await page.emulateMediaType('print');
    const pr = await page.evaluate(() => ({ plan: getComputedStyle(document.querySelector('#res')).display, field: getComputedStyle(document.querySelector('#name').closest('.field')).display, saved: getComputedStyle(document.querySelector('.wg-saved')).display }));
    ok('plan: printing still shows the plan and hides the fields and the forget control', pr.plan !== 'none' && pr.field === 'none' && pr.saved === 'none', JSON.stringify(pr));
    await page.emulateMediaType('screen');
    await clickText(page, 'Clear my plan'); await wait(200);
    ok('plan: "Clear my plan" wipes the saved plan and the fields', (await store(page, KEYS.plan)) === null && (await val(page, '#name')) === '' && !(await shown(page, '#res')));
    await reload(page);
    ok('plan: stays cleared after a reload', (await val(page, '#name')) === '');
    await ctx.close();
  }

  // ── 3. postpartum: Recovery Timeline Calculator ───────────────────────
  {
    const ctx = await browser.createBrowserContext(); const page = await newPage(ctx, { tag: 'postpartum' });
    await open(page, TOOLS.recov);
    await setVal(page, '#dd', daysAgo(10)); await setVal(page, '#dt', 'csection'); await clickText(page, 'Show my timeline'); await wait(250);
    const sp = await jstore(page, KEYS.pp);
    ok('recovery: saves the delivery date and type (versioned)', sp && sp.v === 1 && sp.delivery === daysAgo(10) && sp.type === 'csection', JSON.stringify(sp));
    await reload(page);
    ok('recovery: restores the date and type', (await val(page, '#dd')) === daysAgo(10) && (await val(page, '#dt')) === 'csection');
    ok('recovery: opens on her current week', /You are in week 2 after birth/.test(await text(page, '#resWhere')), await text(page, '#resWhere'));
    ok('recovery: the C-section row shows', /C-section/.test(await text(page, '#milestones')));
    await setVal(page, '#dt', 'vaginal'); await wait(100);
    ok('recovery: changing the type updates the saved value', (await jstore(page, KEYS.pp)).type === 'vaginal');
    await shot(page, 'recovery-timeline-calculator');
    ok('recovery: forget note says it clears every postpartum tool', /every postpartum tool/.test(await text(page, '.wg-saved-note')));
    await clickText(page, 'Forget my dates'); await wait(200);
    ok('recovery: forget removes the key and empties the form', (await store(page, KEYS.pp)) === null && (await val(page, '#dd')) === '' && !(await shown(page, '#res')));
    await ctx.close();
  }

  // ── 4. parenting: Milestone Tracker, Baby Routine Planner, Name Explorer, Vaccination Tracker ──
  {
    const ctx = await browser.createBrowserContext(); const page = await newPage(ctx, { tag: 'parenting' });
    // a mum who already used the Vaccination Tracker
    await open(page, TOOLS.vax);
    await setVal(page, '#dob', monthsAgo(5));
    ok('vaccination: its own date of birth key is unchanged (plain text)', (await store(page, KEYS.dob)) === monthsAgo(5));
    await open(page, TOOLS.mile);
    ok('milestone: prefilled from the Vaccination Tracker date of birth', (await val(page, '#dob')) === monthsAgo(5));
    ok('milestone: picks her baby\'s age (around 4 months)', (await val(page, '#age')) === '4', await val(page, '#age'));
    ok('milestone: the age box can still be changed', await page.$eval('#age', (e) => !e.disabled));
    await setVal(page, '#age', '9'); ok('milestone: changing the age works', /Understands/.test(await text(page, '#out')));
    await setVal(page, '#dob', monthsAgo(8)); await wait(100);
    ok('milestone: changing the date of birth updates the saved value', (await store(page, KEYS.dob)) === monthsAgo(8));
    ok('milestone: and re-picks the age (around 6 months)', (await val(page, '#age')) === '6');
    await reload(page);
    ok('milestone: restores after reload', (await val(page, '#dob')) === monthsAgo(8) && (await val(page, '#age')) === '6');
    await shot(page, 'milestone-tracker');
    await open(page, TOOLS.routine);
    ok('routine: prefilled from the same date of birth', (await val(page, '#dob')) === monthsAgo(8));
    ok('routine: picks the 6 to 12 months day', (await val(page, '#age')) === 'b', await val(page, '#age'));
    await shot(page, 'baby-routine-planner');
    ok('routine: forget note names the Vaccination Tracker', /Vaccination Tracker/.test(await text(page, '.wg-saved-note')));
    await clickText(page, 'Forget my baby’s date of birth'); await wait(200);
    ok('routine: forget removes the shared date of birth', (await store(page, KEYS.dob)) === null && (await val(page, '#dob')) === '');
    await open(page, TOOLS.vax);
    ok('vaccination: cleared there too', (await val(page, '#dob')) === '' && !(await shown(page, '.wg-saved')));
    await setVal(page, '#dob', monthsAgo(2)); await wait(100);
    ok('vaccination: forget control appears once a date is saved', await shown(page, '.wg-saved button'));
    await setVal(page, '#dob', ''); await wait(100);
    ok('vaccination: clearing the box removes the key instead of saving an empty value', (await store(page, KEYS.dob)) === null);

    // Name Explorer
    await open(page, TOOLS.names);
    await setVal(page, '#q', 'Amara'); await wait(200);
    ok('names: each name has a heart', (await page.$$('#list .wg-heart')).length >= 1);
    await clickSel(page, '#list .wg-heart'); await wait(200);
    await setVal(page, '#q', 'Tunde'); await wait(200);
    await clickSel(page, '#list .wg-heart'); await wait(200);
    await setVal(page, '#q', '');
    ok('names: the shortlist shows both names', /Amara/.test(await text(page, '#shortlist')) && /Tunde/.test(await text(page, '#shortlist')));
    const sl = await jstore(page, KEYS.names);
    ok('names: saved as versioned JSON', sl && sl.v === 1 && sl.items.length === 2 && sl.items[0].n === 'Amara', JSON.stringify(sl));
    // an added name can be hearted too
    await page.$eval('#addName', (e) => { e.open = true; });
    await setVal(page, '#anName', 'Ebube'); await setVal(page, '#anMeaning', 'glory'); await clickSel(page, '#anAdd'); await wait(200);
    await clickSel(page, '#list .wg-heart'); await wait(200);
    ok('names: a name she added herself can be saved', /Ebube/.test(await text(page, '#shortlist')));
    await reload(page);
    ok('names: shortlist is restored after a reload', /Amara/.test(await text(page, '#shortlist')) && /Tunde/.test(await text(page, '#shortlist')) && /Ebube/.test(await text(page, '#shortlist')));
    await shot(page, 'baby-name-explorer');
    await page.$eval('#shortlist .wg-heart', (e) => e.click()); await wait(200);
    ok('names: she can remove a name from the shortlist', !/Amara/.test(await text(page, '#shortlist')) && (await jstore(page, KEYS.names)).items.length === 2);
    ok('names: clear control reads "Clear shortlist"', (await text(page, '.wg-saved button')) === 'Clear shortlist');
    await clickText(page, 'Clear shortlist'); await wait(200);
    ok('names: clear removes the key and the shortlist', (await store(page, KEYS.names)) === null && (await text(page, '#shortlist')) === '');
    await ctx.close();
  }

  // ── 5. the app home, install bar, backup code ─────────────────────────
  {
    const ctx = await browser.createBrowserContext(); const page = await newPage(ctx, { tag: 'app' });
    // use the real tools to write the real values
    await open(page, TOOLS.period); await setVal(page, '#lmp', daysAgo(12)); await clickText(page, 'Predict my next periods'); await wait(250);
    await open(page, TOOLS.due);
    await setVal(page, '#lmp', daysAgo(60)); await clickText(page, 'Show my due date');
    await wait(1700);
    ok('install bar: still fires after a save in a tool (phone)', await page.$('.wg-app-bar') !== null);
    await page.evaluate(() => { const s = document.querySelector('.wg-saved'); if (s) s.scrollIntoView({ block: 'center', behavior: 'instant' }); }); await wait(900);
    ok('install bar: does not cover the forget control', await page.evaluate(() => { const b = document.querySelector('.wg-app-bar'), s = document.querySelector('.wg-saved'); if (!b || !s) return false; const r = s.getBoundingClientRect(), q = b.getBoundingClientRect(); return r.bottom <= q.top + 1; }));
    await shot(page, 'due-date-with-install-bar');
    await open(page, TOOLS.recov); await setVal(page, '#dd', daysAgo(20)); await clickText(page, 'Show my timeline');
    await open(page, TOOLS.mile); await setVal(page, '#dob', monthsAgo(3));
    await open(page, TOOLS.plan); await setVal(page, '#name', 'Ada'); await wait(700);
    await open(page, TOOLS.names); await setVal(page, '#q', 'Amara'); await wait(150); await clickSel(page, '#list .wg-heart'); await wait(200);
    await open(page, '/app/');
    await wait(500);
    const marks = await page.evaluate(() => [...document.querySelectorAll('#appSaved .ph-tool')].filter((a) => !a.querySelector('.ph-saved').hidden).map((a) => a.querySelector('b').textContent.trim()));
    const want = ['Period Tracker', 'Ovulation & Fertile Window Calculator', 'Due Date Calculator', 'Week-by-Week Tracker', 'Birth Plan Builder', 'Recovery Timeline Calculator', 'Baby Milestone Tracker', 'Baby Routine Planner', 'Baby Name Explorer'];
    ok('app home: "Saved" marks on all nine tools', want.every((w) => marks.includes(w)), JSON.stringify(marks));
    ok('app home: lists them under a saved-tools heading', (await text(page, '#appMineTitle')).length > 0 && await shown(page, '#appMine'));
    await shot(page, 'app-home', '#appMine');
    // backup code round trip
    const rt = await page.evaluate(async () => {
      const keys = ['wg_stage_fertility_v1', 'wg_stage_pregnancy_v1', 'wg_stage_postpartum_v1', 'wg_vax_dob', 'wg_birth_plan_v1', 'wg_name_shortlist_v1'];
      const before = {}; keys.forEach((k) => { before[k] = localStorage.getItem(k); });
      let blob; const orig = URL.createObjectURL; URL.createObjectURL = (b) => { blob = b; return 'blob:x'; };
      const click = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
      WGApp.downloadBackup(); URL.createObjectURL = orig; HTMLAnchorElement.prototype.click = click;
      const data = JSON.parse(await blob.text());
      keys.forEach((k) => localStorage.removeItem(k));
      const n = await WGApp.restoreBackup(new File([JSON.stringify(data)], 'b.json'));
      const after = {}; keys.forEach((k) => { after[k] = localStorage.getItem(k); });
      return { inBackup: keys.every((k) => typeof data.entries[k] === 'string'), same: keys.every((k) => before[k] !== null && before[k] === after[k]), n, saved: WGApp.savedKeys() };
    });
    ok('backup code: includes every new key', rt.inBackup, JSON.stringify(rt));
    ok('backup code: restore puts every new key back exactly', rt.same, JSON.stringify(rt));
    // nothing she entered reached the dataLayer
    for (const [n, p, needle] of [['plan', TOOLS.plan, 'Ada'], ['period', TOOLS.period, daysAgo(12)], ['names', TOOLS.names, 'Amara']]) {
      await open(page, p);
      const dl = await page.evaluate(() => JSON.stringify(window.dataLayer || []));
      const url = page.url();
      ok(`${n}: saved values are not in the dataLayer or the address`, !dl.includes(needle) && !url.includes(needle), needle);
    }
    await ctx.close();
  }

  // ── 6. bad saved values are ignored, never crash ──────────────────────
  {
    const ctx = await browser.createBrowserContext(); const page = await newPage(ctx, { tag: 'bad' });
    await open(page, '/app/');
    const bad = {
      wg_stage_fertility_v1: '{not json', wg_stage_pregnancy_v1: JSON.stringify({ v: 1, due: daysAgo(400) }), wg_stage_postpartum_v1: JSON.stringify({ v: 1, delivery: '2026-13-45', type: 'x' }),
      wg_vax_dob: addIso(daysAgo(0), 30), wg_birth_plan_v1: JSON.stringify({ v: 1, f: { name: 5, pain: 'not an option' } }), wg_name_shortlist_v1: JSON.stringify({ v: 1, items: [null, { n: 5 }, 'x'] })
    };
    await page.evaluate((bad) => { Object.keys(bad).forEach((k) => localStorage.setItem(k, bad[k])); }, bad);
    let clean = true;
    for (const [n, p] of Object.entries(TOOLS)) {
      const before = errs.length;
      await open(page, p);
      if (errs.length !== before) { clean = false; ok(`${n}: loads with bad saved values`, false, errs.slice(before).join(' | ')); }
    }
    ok('bad values: every tool loads without a page error', clean);
    await open(page, TOOLS.week); ok('bad values: an old due date is ignored (week tracker stays empty)', (await val(page, '#lmp')) === '');
    await open(page, TOOLS.mile); ok('bad values: a future date of birth is ignored', (await val(page, '#age')) === '2' && !(await shown(page, '.wg-saved')));
    await open(page, TOOLS.recov); ok('bad values: an invalid delivery date is ignored', (await val(page, '#dd')) === '');
    await open(page, TOOLS.plan); ok('bad values: a bad plan restores nothing', (await val(page, '#name')) === '' && (await val(page, '#pain')) === 'Keep all options open');
    await open(page, TOOLS.names); ok('bad values: a bad shortlist shows nothing', (await text(page, '#shortlist')) === '');
    await open(page, TOOLS.period); ok('bad values: unreadable fertility data is ignored', (await val(page, '#lmp')) === '');
    await ctx.close();
  }

  // ── 7. storage blocked (private mode): pages work, nothing saves ──────
  {
    const ctx = await browser.createBrowserContext(); const page = await newPage(ctx, { tag: 'blocked', blocked: true });
    let clean = true;
    for (const [n, p] of Object.entries(TOOLS)) {
      const before = errs.length;
      await open(page, p);
      const h1 = await text(page, 'h1');
      if (!h1) { clean = false; ok(`${n}: opens with storage blocked`, false); }
      if (errs.length !== before) { clean = false; ok(`${n}: no page error with storage blocked`, false, errs.slice(before).join(' | ')); }
    }
    ok('blocked: every tool opens without a page error', clean);
    await open(page, TOOLS.period); await setVal(page, '#lmp', daysAgo(10)); await clickText(page, 'Predict my next periods'); await wait(200);
    ok('blocked: the period tracker still predicts', (await page.$$('#list .big')).length === 3);
    ok('blocked: no logging box and no forget control', !(await shown(page, '#logBox')) && !(await shown(page, '.wg-saved')));
    await open(page, TOOLS.ovul); await setVal(page, '#lmp', daysAgo(10)); await clickText(page, 'Show my fertile window'); await wait(150);
    ok('blocked: the ovulation calculator still works', /Most likely day/.test(await text(page, '#ovday')));
    await open(page, TOOLS.due); await setVal(page, '#lmp', daysAgo(50)); await clickText(page, 'Show my due date'); await wait(150);
    ok('blocked: the due date calculator still works', (await text(page, '#due')).length > 5);
    await open(page, TOOLS.week); await setVal(page, '#lmp', daysAgo(50)); await clickText(page, 'Show my week'); await wait(150);
    ok('blocked: the week tracker still works', /weeks/.test(await text(page, '#weekline')));
    await open(page, TOOLS.recov); await setVal(page, '#dd', daysAgo(9)); await clickText(page, 'Show my timeline'); await wait(150);
    ok('blocked: the recovery timeline still works', /week/.test(await text(page, '#resWhere')));
    await open(page, TOOLS.plan); await setVal(page, '#name', 'Ada'); await clickText(page, 'Create my birth plan'); await wait(600);
    ok('blocked: the birth plan still builds', /BIRTH PLAN: Ada/.test(await text(page, '#plan')));
    await open(page, TOOLS.mile); await setVal(page, '#dob', monthsAgo(5)); await wait(100);
    ok('blocked: the milestone tracker still follows the date', (await val(page, '#age')) !== null);
    await open(page, TOOLS.names); await setVal(page, '#q', 'Amara'); await wait(150); await clickSel(page, '#list .wg-heart'); await wait(150);
    ok('blocked: hearting a name does not crash', (await page.$$('#list .big')).length >= 1);
    await ctx.close();
  }

  // ── 8. a blocked-storage page also needs no error from the site's other scripts ──
  ok('no page errors in the whole run', errs.length === 0, errs.slice(0, 6).join(' | '));

  await browser.close();
  console.log(out.join('\n'));
  const failed = out.filter((l) => l.startsWith('FAIL')).length;
  console.log(`\n${out.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(async (e) => { console.log(out.join('\n')); console.error('test crashed:', e); try { await browser.close(); } catch (x) {} process.exit(1); });
