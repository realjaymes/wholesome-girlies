// Tests the installable app on the local site: service worker, offline tools, the app home, backup codes,
// the add-to-home-screen offers and where they stay quiet. Needs the site on :8001 (python3 serve.py 8001).
//   NODE_PATH=/tmp/wgog/node_modules node scripts/test-app.js
// Offline behaviour with a real dropped connection is in scripts/test-app-offline.js.
const puppeteer = require('puppeteer-core');
const B = 'http://localhost:8001';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const out = [];
const ok = (name, pass, extra='') => out.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${extra ? '  (' + extra + ')' : ''}`);
const wait = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new', args: ['--no-first-run'] });
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(e.message));
  // 1. service worker registers and precaches
  await page.goto(B + '/app/', { waitUntil: 'load' });
  const sw = await page.evaluate(async () => { const r = await navigator.serviceWorker.ready; return !!r.active; });
  ok('service worker active on /app/', sw);
  let n = 0; for (let i = 0; i < 60; i++) { n = await page.evaluate(async () => { const k = await caches.keys(); if (!k.length) return 0; return (await (await caches.open(k[0])).keys()).length; }); if (n > 150) break; await wait(500); }
  ok('precache filled', n > 50, n + ' entries');
  const cachedTool = await page.evaluate(async () => !!(await caches.match('/pregnancy/tools/hospital-bag-checklist')));
  ok('unvisited tool precached', cachedTool);
  // manifest
  const man = await page.evaluate(async () => (await fetch('/manifest.webmanifest')).json());
  ok('manifest loads', man.short_name === 'Girlies' && man.start_url === '/app/');
  // 2. offline
  await page.setOfflineMode(true);
  await page.goto(B + '/pregnancy/tools/hospital-bag-checklist', { waitUntil: 'load' }).catch(e => errs.push('nav ' + e.message));
  ok('unvisited tool opens offline', /Hospital Bag/i.test(await page.$eval('h1', h => h.textContent)));
  await page.goto(B + '/app/', { waitUntil: 'load' }).catch(() => {});
  ok('app home opens offline', /phone/i.test(await page.$eval('h1', h => h.textContent).catch(() => '')));
  await page.setOfflineMode(false);
  // 3. app home lists saved tools and program
  await page.evaluate(() => { localStorage.setItem('wg_hospitalbag_v1', JSON.stringify({ a: 1 })); localStorage.setItem('wg_feedsleep_2026', '[]'); localStorage.setItem('wg_pp_home', JSON.stringify({ u: '/programs/postpartum-reset/thank-you', l: 'Your 6-Week Postpartum Reset home' })); });
  await page.goto(B + '/app/', { waitUntil: 'load' });
  const home = await page.evaluate(() => ({ remember: WGApp.remembering(), saved: [...document.querySelectorAll('#appSaved b')].map(h => h.textContent), prog: [...document.querySelectorAll('#appProgramList h3')].map(h => h.textContent), progHidden: document.getElementById('appProgram').hidden, mineTitle: document.getElementById('appMineTitle').textContent, howHidden: document.getElementById('appHow').hidden, stagesHidden: document.getElementById('appStages').hidden }));
  ok('app home shows saved tools', home.saved.includes('Hospital Bag Checklist') && home.saved.includes('Feeding & Sleep Tracker'), home.saved.join(', ') + ' remember=' + home.remember);
  ok('app home shows program', !home.progHidden && home.prog.length === 1, home.prog.join(', '));
  ok('buyer app home: her tools, no tool videos, no stage cards', home.mineTitle === 'Your tools' && home.howHidden && home.stagesHidden, JSON.stringify(home));
  // 4. backup round trip
  const rt = await page.evaluate(async () => { const file = new File([JSON.stringify({ app: "wholesome-girlies", v: 1, entries: { wg_hospitalbag_v1: localStorage.getItem('wg_hospitalbag_v1') } })], 'backup.json'); localStorage.removeItem('wg_hospitalbag_v1'); const n = await WGApp.restoreBackup(file); return { n, back: localStorage.getItem('wg_hospitalbag_v1') }; });
  ok('backup file restores entries', rt.back === JSON.stringify({ a: 1 }), JSON.stringify(rt));
  // 5. result line and thank-you line (desktop)
  await page.goto(B + '/relationships/tools/red-flag-radar', { waitUntil: 'load' });
  await page.evaluate(() => wgShowResult('sharp'));
  ok('result card under the share row', /home screen/i.test(await page.$eval('#wg-result-share', e => e.textContent)) && !!(await page.$('#wg-result-share .wg-app-card')));
  await page.goto(B + '/programs/wife-material-blueprint/thank-you', { waitUntil: 'load' });
  ok('thank-you card', !!(await page.$('.sales-hero .wg-app-card')));
  await ctx.close();
  // 6. phone: bar after a tool save; none on quiet or sales pages
  const phoneCtx = await browser.createBrowserContext();
  const ph = await phoneCtx.newPage(); ph.on('pageerror', e => errs.push(e.message));
  await ph.setUserAgent(IPHONE); await ph.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await ph.goto(B + '/pregnancy/tools/hospital-bag-checklist', { waitUntil: 'load' });
  const firstBox = await ph.$('input[type=checkbox]'); if (firstBox) await firstBox.click();
  await wait(1700);
  ok('phone: bar after saving in a tool', !!(await ph.$('.wg-app-bar')));
  if (await ph.$('.wg-app-bar [data-add]')) { await ph.click('.wg-app-bar [data-add]'); await wait(300); ok('iPhone: Add opens the steps sheet', !!(await ph.$('#wg-app-sheet')), (await ph.$eval('#wg-app-sheet', e => e.innerText.slice(0, 120)).catch(() => ''))); }
  const ph2 = await (await browser.createBrowserContext()).newPage();
  await ph2.setUserAgent(IPHONE); await ph2.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await ph2.goto(B + '/postpartum/tools/mind-check-in', { waitUntil: 'load' });
  await ph2.evaluate(() => localStorage.setItem('wg_mind_checkin_v1', '{}')); await wait(1700);
  ok('phone: no bar on the mind check-in', !(await ph2.$('.wg-app-bar')));
  await ph2.goto(B + '/programs/wife-material-blueprint', { waitUntil: 'load' }); await wait(800);
  ok('phone: no bar on a sales page', !(await ph2.$('.wg-app-bar')));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(out.join('\n'));
  await browser.close();
})().catch(e => { console.log(out.join('\n')); console.error('ERR', e.message); process.exit(1); });
