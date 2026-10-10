// Tests the app offline for real: starts a second copy of the site on :8019, lets the service worker save the
// tools, stops the server, then opens tools, the app home, an unsaved guide and a sales page.
//   NODE_PATH=/tmp/wgog/node_modules node scripts/test-app-offline.js
const puppeteer = require('puppeteer-core'); const { spawn } = require('child_process');
const B = 'http://localhost:' + (process.env.WG_PORT || 8019); const wait = (ms) => new Promise(r => setTimeout(r, ms));
(async () => {
  const srv = spawn('python3', ['serve.py', '8019'], { cwd: require('path').join(__dirname, '..'), stdio: 'ignore' });
  await wait(1200);
  const browser = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const page = await browser.newPage();
  await page.goto(B + '/app/', { waitUntil: 'load' });
  await page.evaluate(async () => { await navigator.serviceWorker.ready; });
  for (let i = 0; i < 60; i++) { const n = await page.evaluate(async () => { const k = await caches.keys(); return k.length ? (await (await caches.open(k[0])).keys()).length : 0; }); if (n >= 58) break; await wait(500); }
  await page.goto(B + '/relationships/guides/' , { waitUntil: 'load' }).catch(() => {});
  srv.kill(); await wait(800);
  const h1 = async (u) => { await page.goto(B + u, { waitUntil: 'load' }).catch(e => {}); return page.$eval('h1', h => h.textContent).catch(e => 'ERR ' + e.message.slice(0, 60)); };
  for (const u of ['/pregnancy/tools/hospital-bag-checklist', '/parenting/tools/vaccination-tracker', '/app/', '/tools/', '/fertility/guides/ovulation-calculator-guide', '/programs/wife-material-blueprint']) console.log(u.padEnd(48), '→', await h1(u));
  const styled = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
  console.log('font on offline page:', styled);
  await browser.close();
})();
