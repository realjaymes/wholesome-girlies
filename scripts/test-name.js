// Tests her saved name (CLAUDE.md section 10, "Her name") at an iPhone size: the app home asks once and never again after
// Save or Not now, the greeting and the program home use the name, it can be edited and removed under "Back up or
// restore", it travels in the backup code, it is shown as text only, it never shows on the quiet pages, it never reaches
// the dataLayer, an address or a share line, the share card carries it only when she ticks the box, a name save never
// offers the install bar and never counts as tool activity, and pages work with storage blocked.
// Needs the site on :8001 (python3 serve.py 8001), or set WG_PORT; WG_BASE=https://wholesomegirlies.xyz tests live.
//   WG_PORT=8037 NODE_PATH=/tmp/wgog/node_modules node scripts/test-name.js
// Set WG_SHOTS=/some/folder to also save phone-size screenshots.
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const B = process.env.WG_BASE || 'http://localhost:' + (process.env.WG_PORT || 8001);
const SHOTS = process.env.WG_SHOTS || '';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const KEY = 'wg_name_v1';
const NAME = 'Adaeze';
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
  // a test never reaches a real endpoint (the Checkout Intents sheet); pictures still load for real
  await page.evaluateOnNewDocument(() => {
    const real = window.fetch.bind(window);
    window.fetch = (u, o) => (/\.(jpe?g|png|webp)(\?|$)/.test(String(u)) ? real(u, o) : Promise.resolve(new Response('{}', { status: 200 })));
    // the phone share sheet: keep the file she would share
    navigator.canShare = () => true;
    navigator.share = (d) => { const f = d.files && d.files[0]; window.__shared = f ? { name: f.name } : null; if (f) f.arrayBuffer().then((b) => { window.__shared.size = b.byteLength; }); return Promise.resolve(); };
  });
  if (opts.blocked) await page.evaluateOnNewDocument(() => { Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } }); });
  page.on('pageerror', (e) => errs.push((opts.tag || '') + ' ' + e.message));
  page._ctx = ctx;
  return page;
}
const go = async (page, p) => { await page.goto(B + p, { waitUntil: 'load' }); await wait(600); };
const reload = async (page) => { await page.reload({ waitUntil: 'load' }); await wait(600); };
const text = (page, sel) => page.$eval(sel, (e) => e.textContent.trim()).catch(() => null);
const shown = (page, sel) => page.$eval(sel, (e) => !!(e.offsetWidth || e.offsetHeight) && getComputedStyle(e).visibility !== 'hidden').catch(() => false);
const store = (page, k) => page.evaluate((k) => localStorage.getItem(k), k);
const jstore = async (page, k) => { try { return JSON.parse(await store(page, k)); } catch (e) { return null; } };
const bodyText = (page) => page.evaluate(() => document.body.innerText);
const shot = async (page, name) => {
  if (!SHOTS) return;
  fs.mkdirSync(SHOTS, { recursive: true });
  try { await page.screenshot({ path: path.join(SHOTS, name + '.png') }); } catch (e) { errs.push('shot ' + name + ' ' + e.message); }
};
const typeAndSave = async (page, inputSel, formSel, v) => {
  await page.$eval(inputSel, (e, v) => { e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); }, v);
  await page.$eval(formSel + ' button[type=submit]', (b) => b.click()); await wait(300);
};
const setName = (page, name) => page.evaluate((k, n) => localStorage.setItem(k, JSON.stringify({ v: 1, name: n, asked: true })), KEY, name);
const answerGirlsGirl = async (page) => {
  await page.evaluate(() => { for (let i = 0; i < 10; i++) { const r = document.querySelector('input[name="s' + i + '"][value="0"]'); if (r) r.checked = true; } readFriend(); });
  await wait(500);
};
const QUIET = ['/postpartum/tools/mind-check-in', '/fertility/tools/the-wait-check-in', '/postpartum/guides/postpartum-warning-signs', '/pregnancy/guides/chemical-miscarriage'];
const GG = '/relationships/tools/girls-girl-quiz';

(async () => {
  browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-first-run'] });

  // ── 1. first open: the ask; save; greeting after a reload ─────────────
  {
    const page = await newPage({ tag: 'ask' });
    await go(page, '/app/?preview=installed');
    ok('first open: the app home asks "What should we call you?"', await shown(page, '#appAsk') && /What should we call you\?/.test(await text(page, '#appAsk')));
    ok('first open: the greeting has no name yet', (await text(page, '#appTitle')) === 'You are set');
    ok('first open: nothing is stored before she answers', (await store(page, KEY)) === null);
    ok('first open: the field is capped at 30 characters', (await page.$eval('#appAskName', (e) => e.maxLength)) === 30);
    ok('first open: the ask says it stays on this phone', /stays on this phone\. We never see it/.test(await text(page, '#appAsk')));
    await shot(page, 'name-1-first-open');
    await typeAndSave(page, '#appAskName', '#appAskForm', '  ' + NAME + '  ');
    const st = await jstore(page, KEY);
    ok('save: stored as one entry with the name and the asked flag', st && st.v === 1 && st.name === NAME && st.asked === true, JSON.stringify(st));
    ok('save: the ask is gone and the greeting uses the name', !(await shown(page, '#appAsk')) && (await text(page, '#appTitle')) === 'You are set, ' + NAME);
    ok('save: a line says where to change it', /Change it under Back up or restore/.test(await text(page, '#appAskDone')));
    await shot(page, 'name-2-saved-first-open');
    await reload(page);
    ok('reload: the greeting reads "Welcome back, <name>"', (await text(page, '#appTitle')) === 'Welcome back, ' + NAME, await text(page, '#appTitle'));
    ok('reload: the ask does not come back', !(await shown(page, '#appAsk')));
    ok('reload: her guide still sits beside the greeting', await page.evaluate(() => !!document.querySelector('#appHero .ph-hero-img, #appHero .app-girls') && !document.getElementById('appSayGuide').hidden));
    await shot(page, 'name-3-welcome-back');
    ok('browser tab (not installed): the greeting also carries the name', await (async () => { await go(page, '/app/'); return /^Wholesome Girlies on your phone, Adaeze$/.test(await text(page, '#appTitle')); })());
    await page._ctx.close();
  }

  // ── 2. skip hides the ask for good ────────────────────────────────────
  {
    const page = await newPage({ tag: 'skip' });
    await go(page, '/app/?preview=installed');
    await page.$eval('#appAskSkip', (a) => a.click()); await wait(250);
    const st = await jstore(page, KEY);
    ok('skip: the ask hides and the skip is remembered with no name', !(await shown(page, '#appAsk')) && st && st.asked === true && st.name === '', JSON.stringify(st));
    await reload(page); await go(page, '/app/?preview=installed');
    ok('skip: the ask never comes back, and the greeting has no name', !(await shown(page, '#appAsk')) && (await text(page, '#appTitle')) === 'Welcome back');
    ok('skip: she can still add a name under Back up or restore', await page.evaluate(() => { const f = document.getElementById('appNameForm'); return !!f && !!f.closest('details'); }));
    ok('skip: Remove my name is hidden when no name is saved', !(await shown(page, '#appNameRemove')) || await page.$eval('#appNameRemove', (e) => e.hidden));
    await page._ctx.close();
  }

  // ── 3. edit and remove under Back up or restore ───────────────────────
  {
    const page = await newPage({ tag: 'edit' });
    await go(page, '/app/?preview=installed');
    await typeAndSave(page, '#appAskName', '#appAskForm', NAME);
    await page.$eval('.app-backup-next', (d) => { d.open = true; });
    ok('edit: the closing area holds her name field, filled in', (await page.$eval('#appNameInput', (e) => e.value)) === NAME);
    ok('edit: the closing area says it goes into the backup', /It goes into your backup, so it comes back when you restore/.test(await page.$eval('.app-backup-next', (e) => e.textContent)));
    await shot(page, 'name-4-edit-closing-area');
    await typeAndSave(page, '#appNameInput', '#appNameForm', 'Bola');
    ok('edit: a new name replaces the old one at once', (await jstore(page, KEY)).name === 'Bola' && (await text(page, '#appTitle')) === 'You are set, Bola', await text(page, '#appTitle'));
    ok('edit: the message says it is saved on this phone', /saved on this phone/i.test(await text(page, '#appMsg')));
    ok('edit: Remove my name shows', await shown(page, '#appNameRemove'));
    await page.$eval('#appNameRemove', (b) => b.click()); await wait(300);
    const st = await jstore(page, KEY);
    ok('remove: the name is gone, the asked flag stays', st && st.name === '' && st.asked === true, JSON.stringify(st));
    ok('remove: the greeting drops the name and the ask stays away', (await text(page, '#appTitle')) === 'You are set' && !(await shown(page, '#appAsk')));
    ok('remove: the message says it is removed from this phone', /removed from this phone/.test(await text(page, '#appMsg')));
    await reload(page);
    ok('remove: still no ask after a reload', !(await shown(page, '#appAsk')));
    await typeAndSave(page, '#appNameInput', '#appNameForm', '   ');
    ok('edit: a blank field saves nothing', (await jstore(page, KEY)).name === '');
    await page._ctx.close();
  }

  // ── 4. sanitising, and text only ──────────────────────────────────────
  {
    const page = await newPage({ tag: 'xss' });
    await go(page, '/app/?preview=installed');
    const tag = '<img src=x onerror=__x=1>';
    await typeAndSave(page, '#appAskName', '#appAskForm', tag);
    ok('script-tag name: shown as text in the greeting', (await text(page, '#appTitle')).endsWith(tag) && (await page.$$('#appTitle img')).length === 0);
    ok('script-tag name: nothing ran and no element was made', await page.evaluate(() => !window.__x && !document.querySelector('img[src="x"]')));
    await page._ctx.close();
    const p2 = await newPage({ tag: 'cap' });
    await go(p2, '/app/?preview=installed');
    await typeAndSave(p2, '#appAskName', '#appAskForm', 'Oluwatoyosi\n  Ngozi   Chinwe   Adebayo   Obiora');
    const n = (await jstore(p2, KEY)).name;
    ok('sanitise: trimmed, spaces collapsed, capped at 30 characters', n.length <= 30 && !/\s{2}|\n/.test(n) && n === n.trim() && n.startsWith('Oluwatoyosi Ngozi'), JSON.stringify(n));
    // a value planted in storage, not typed: control characters go, length is capped on read
    await p2.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, name: '\u0007' + 'B'.repeat(80), asked: true })), KEY);
    await go(p2, '/app/?preview=installed');
    ok('sanitise: a planted long name is capped when read', (await text(p2, '#appTitle')) === 'You are set, ' + 'B'.repeat(30) || (await text(p2, '#appTitle')).replace('Welcome back, ', '').length === 30, await text(p2, '#appTitle'));
    await p2.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, name: '<script>window.__y=1</script>', asked: true })), KEY);
    await go(p2, '/programs/first-pregnancy-plan/thank-you'); // reads the name on another page
    ok('script-tag name: also inert on the program home', await p2.evaluate(() => !window.__y && document.querySelectorAll('.ph-top script').length === 0 && /<script>/.test(document.querySelector('.ph-top h1').textContent)));
    await p2._ctx.close();
  }

  // ── 5. program home, quiz result, birth plan ──────────────────────────
  {
    const page = await newPage({ tag: 'surfaces' });
    await go(page, '/app/');
    await page.evaluate((k, n) => { localStorage.setItem(k, JSON.stringify({ v: 1, name: n, asked: true })); localStorage.setItem('wg_pregnancy_home', JSON.stringify({ u: '/programs/first-pregnancy-plan/thank-you', l: 'Pregnancy home' })); }, KEY, NAME);
    await go(page, '/programs/first-pregnancy-plan/thank-you');
    ok('program home: her name leads the heading', (await text(page, '.ph-top h1')) === NAME + ', your Plan, your community and your tools are all here.', await text(page, '.ph-top h1'));
    ok('program home: her guide is still beside the heading', await page.evaluate(() => !!document.querySelector('.ph-top .ph-hero-img') && !!document.querySelector('.ph-top .ph-say')));
    await shot(page, 'name-5-program-home');
    await go(page, '/programs/first-pregnancy-plan-diaspora/thank-you');
    ok('program home (diaspora): "Welcome in, <name>." keeps its first words', /^Welcome in, Adaeze\. Your Plan, community and tools are all on this page\.$/.test(await text(page, '.ph-top h1')), await text(page, '.ph-top h1'));
    await page.evaluate((k) => localStorage.removeItem(k), KEY);
    await go(page, '/programs/first-pregnancy-plan/thank-you');
    ok('program home: with no name the heading is exactly as built', (await text(page, '.ph-top h1')) === 'Your Plan, your community and your tools are all here.');
    await page.evaluate((k, n) => localStorage.setItem(k, JSON.stringify({ v: 1, name: n, asked: true })), KEY, NAME);

    await go(page, '/pregnancy/tools/birth-plan-builder');
    ok('birth plan: the name field starts with her saved name and a note', (await page.$eval('#name', (e) => e.value)) === NAME && /Filled in from your saved name/.test(await text(page, '#name + p, .field p.muted')));
    ok('birth plan: prefilling saves nothing in the plan', (await store(page, 'wg_birth_plan_v1')) === null);

    // quiz result
    await go(page, GG);
    await answerGirlsGirl(page);
    const head = await text(page, '#headline');
    ok('quiz result: the headline starts with her name', /^Adaeze, you are a /.test(head), head);
    ok('quiz result: the box "Put my name on my result card" is there and unticked', await page.evaluate(() => { const t = document.querySelector('#wg-result-share [data-tick]'); return !!t && t.checked === false && /Put my name on my result card/.test(t.parentNode.textContent); }));
    ok('quiz result: the preview picture is the plain card while unticked', await page.$eval('#wg-result-share [data-pic]', (i) => /-status\.jpg/.test(i.getAttribute('src'))));
    ok('quiz result: the share links and text never carry her name', await page.evaluate((n) => { const s = document.querySelector('#wg-result-share .wg-share'); return !s.outerHTML.includes(n) && !JSON.stringify([...document.querySelectorAll('#wg-result-share a')].map((a) => a.href)).includes(n); }, NAME));
    await shot(page, 'name-6-quiz-result-unticked');
    // Save for your Status, unticked: the original picture
    await page.$eval('#wg-result-share [data-save]', (a) => a.click()); await wait(900);
    const plain = await page.evaluate(() => window.__shared);
    ok('share card: unticked, the saved picture is the original image', !!plain && plain.size > 50000, JSON.stringify(plain));
    const origSize = await page.evaluate(() => fetch(document.querySelector('#wg-result-share [data-pic]').getAttribute('src')).then((r) => r.blob()).then((b) => b.size));
    ok('share card: unticked, it is the same size as the file on the site', plain && plain.size === origSize, plain && plain.size + ' vs ' + origSize);
    await page.evaluate(() => { window.__shared = null; });
    await page.$eval('#wg-result-share [data-tick]', (t) => t.click()); await wait(900);
    ok('share card: ticked, the preview is drawn on her phone (blob picture)', await page.$eval('#wg-result-share [data-pic]', (i) => /^blob:/.test(i.src)));
    await shot(page, 'name-7-quiz-result-ticked');
    await page.$eval('#wg-result-share [data-save]', (a) => a.click()); await wait(1400);
    const named = await page.evaluate(() => window.__shared);
    ok('share card: ticked, a different picture is saved (made on the phone)', !!named && named.size > 50000 && named.size !== origSize, JSON.stringify(named));
    await page.$eval('#wg-result-share [data-tick]', (t) => t.click()); await wait(400);
    ok('share card: unticking puts the plain picture back', await page.$eval('#wg-result-share [data-pic]', (i) => /-status\.jpg/.test(i.getAttribute('src'))));
    ok('share card: the box starts unticked again on a new result', await (async () => { await answerGirlsGirl(page); return page.$eval('#wg-result-share [data-tick]', (t) => t.checked === false); })());
    // preview image with the name drawn in, to look at
    if (SHOTS) { await page.$eval('#wg-result-share [data-tick]', (t) => t.click()); await wait(900); await page.$eval('#wg-result-share', (e) => e.scrollIntoView({ block: 'center' })); await wait(300); await shot(page, 'name-8-share-ticked-preview'); }
    // no name in the dataLayer, ever
    const dl = await page.evaluate(() => JSON.stringify(window.dataLayer || []));
    ok('dataLayer: no name on the quiz page, even after the ticked save', !dl.includes(NAME) && /result_save/.test(dl), dl.slice(0, 200));
    ok('address: no name in the page address', !page.url().includes(NAME));
    await page._ctx.close();
  }

  // ── 6. a quiz result with no name saved is unchanged ──────────────────
  {
    const page = await newPage({ tag: 'noname' });
    await go(page, GG); await answerGirlsGirl(page);
    ok('no name: the headline and share block are as before', /^I am /.test(await text(page, '#headline')) && !(await page.$('#wg-result-share [data-tick]')) && !!(await page.$('#wg-result-share a[download]')));
    await page._ctx.close();
  }

  // ── 7. quiet pages never show the name ────────────────────────────────
  {
    const page = await newPage({ tag: 'quiet' });
    await go(page, '/app/');
    await setName(page, NAME);
    for (const q of QUIET) {
      await go(page, q);
      const t = await bodyText(page);
      ok(`quiet page ${q}: no name on screen and WGApp.name() is empty`, !t.includes(NAME) && (await page.evaluate(() => WGApp.name())) === '');
    }
    await go(page, '/postpartum/tools/recovery-checklist');
    ok('a normal page still reads the name', (await page.evaluate(() => WGApp.name())) === NAME);
    await page._ctx.close();
  }

  // ── 8. backup code round trip ─────────────────────────────────────────
  {
    const page = await newPage({ tag: 'backup' });
    await go(page, '/app/?preview=installed');
    await typeAndSave(page, '#appAskName', '#appAskForm', NAME);
    const rt = await page.evaluate(async (k) => {
      let blob; const orig = URL.createObjectURL; URL.createObjectURL = (b) => { blob = b; return 'blob:x'; };
      const click = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
      WGApp.downloadBackup(); URL.createObjectURL = orig; HTMLAnchorElement.prototype.click = click;
      const data = JSON.parse(await blob.text());
      const before = localStorage.getItem(k);
      localStorage.removeItem(k);
      const n = await WGApp.restoreBackup(new File([JSON.stringify(data)], 'b.json'));
      return { inBackup: typeof data.entries[k] === 'string', same: before !== null && before === localStorage.getItem(k), n };
    }, KEY);
    ok('backup code: the name is in the backup', rt.inBackup, JSON.stringify(rt));
    ok('backup code: restore puts the name back exactly', rt.same, JSON.stringify(rt));
    await go(page, '/app/?preview=installed');
    ok('backup code: after a restore the greeting has her name and the ask stays away', (await text(page, '#appTitle')) === 'Welcome back, ' + NAME && !(await shown(page, '#appAsk')));
    // restoring a backup onto a fresh phone brings the name and the asked flag
    const fresh = await newPage({ tag: 'fresh' });
    await go(fresh, '/app/?preview=installed');
    const n = await fresh.evaluate(async (k, name) => WGApp.restoreBackup(new File([JSON.stringify({ app: 'wholesome-girlies', v: 1, entries: { [k]: JSON.stringify({ v: 1, name, asked: true }) } })], 'b.json')), KEY, 'Chioma');
    await go(fresh, '/app/?preview=installed');
    ok('backup code: a fresh phone restores the name and is not asked', n === 1 && /Chioma$/.test(await text(fresh, '#appTitle')) && !(await shown(fresh, '#appAsk')));
    await fresh._ctx.close();
    await page._ctx.close();
  }

  // ── 9. no install bar from a name, and no tool activity ───────────────
  {
    const page = await newPage({ tag: 'bar' });
    await go(page, GG);
    await page.evaluate((k) => localStorage.setItem(k, JSON.stringify({ v: 1, name: 'Ada', asked: true })), KEY);
    await wait(1900);
    ok('install bar: not fired by saving a name on a tool page', (await page.$('.wg-app-bar')) === null);
    await page.evaluate(() => { WGApp.setName('Ada'); }); await wait(1900);
    ok('install bar: not fired by WGApp.setName either', (await page.$('.wg-app-bar')) === null);
    await page.evaluate(() => localStorage.setItem('wg_name_shortlist_v1', '{"v":1,"items":[{"n":"Amara"}]}')); await wait(1900);
    ok('install bar: still fires for a real saved entry (wg_name_shortlist_v1 is not the name key)', (await page.$('.wg-app-bar')) !== null);
    await page._ctx.close();
    const app = await newPage({ tag: 'activity' });
    await go(app, '/app/');
    await setName(app, NAME);
    await go(app, '/app/');
    ok('activity: a name alone shows no saved tools and no program pick', !(await shown(app, '#appMine')) && !(await shown(app, '#appPick')) && !(await shown(app, '#appMore')));
    ok('activity: a name alone still shows the five stage cards', await shown(app, '#appStages'));
    ok('activity: the name key is not read as a saved tool', await app.evaluate(() => WGApp.savedKeys().includes('wg_name_v1') && document.querySelectorAll('#appSaved .ph-tool').length === 0));
    await app._ctx.close();
  }

  // ── 10. storage blocked ───────────────────────────────────────────────
  {
    const page = await newPage({ tag: 'blocked', blocked: true });
    await go(page, '/app/?preview=installed');
    ok('blocked: the app home still loads and asks', await shown(page, '#appAsk') && /^(You are set|Welcome back)$/.test(await text(page, '#appTitle')));
    await typeAndSave(page, '#appAskName', '#appAskForm', NAME);
    ok('blocked: Save says it could not save, and does not claim it did', /could not save/.test(await text(page, '#appAskDone')) && !(await text(page, '#appTitle')).includes(NAME) && await shown(page, '#appAsk'));
    await go(page, '/programs/first-pregnancy-plan/thank-you');
    ok('blocked: a program home still loads with its normal heading', (await text(page, '.ph-top h1')) === 'Your Plan, your community and your tools are all here.');
    await go(page, GG); await answerGirlsGirl(page);
    ok('blocked: a quiz still gives its result and the plain share block', /^I am /.test(await text(page, '#headline')) && !(await page.$('#wg-result-share [data-tick]')));
    await go(page, '/pregnancy/tools/birth-plan-builder');
    ok('blocked: the birth plan page loads with an empty name field', (await page.$eval('#name', (e) => e.value)) === '');
    await page._ctx.close();
  }

  ok('no page errors in the whole run', errs.length === 0, errs.slice(0, 6).join(' | '));

  await browser.close();
  console.log(out.join('\n'));
  const failed = out.filter((l) => l.startsWith('FAIL')).length;
  console.log(`\n${out.length - failed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(async (e) => { console.log(out.join('\n')); console.error('test crashed:', e); try { await browser.close(); } catch (x) {} process.exit(1); });
