// Fails any game or quiz whose playing area (.tool-app, before a result shows) is taller than one phone screen.
// Games and quizzes are the tool pages tagged Game or Quiz on tools/index.html, plus every page that loads a game engine
// (wg-count, wg-pair, wg-truefalse, wg-tierlist, wg-chatcard, wg-wrapped, wg-daily) or has data-steps.
// Needs the site on :8001 (python3 serve.py 8001), or set WG_PORT. Skips with a message when the server is down.
//   node scripts/test-one-screen.js          (finds playwright-core or puppeteer-core in site-motion-kit, /tmp/wgog or NODE_PATH)
// Screen 390x844 minus the sticky header (74px) leaves 770px for the playing area.
const fs = require('fs'), path = require('path'), http = require('http');
const PORT = process.env.WG_PORT || 8001, B = 'http://localhost:' + PORT, LIMIT = 770;
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const root = path.join(__dirname, '..');
function walk(dir, out) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.name.startsWith('.') || f.name === 'node_modules' || f.name === 'programs' || f.name === '_lab') continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out); else if (f.name.endsWith('.html')) out.push(p);
  }
  return out;
}
function games() {
  const idx = fs.readFileSync(path.join(root, 'tools/index.html'), 'utf8');
  const tagged = new Set();
  for (const m of idx.matchAll(/href="\/([^"]+)"[^>]*><span class="tag">([^<]*)/g)) if (m[2] === 'Game' || m[2] === 'Quiz') tagged.add('/' + m[1]);
  const out = [];
  for (const f of walk(root, [])) {
    const rel = '/' + path.relative(root, f).replace(/\\/g, '/'), url = rel.replace(/\.html$/, '');
    if (/\/index\.html$/.test(rel) || !/\/tools\//.test(rel)) continue;
    const src = fs.readFileSync(f, 'utf8');
    if (!/class="tool-app/.test(src)) continue;
    if (tagged.has(url) || /wg-(count|pair|truefalse|tierlist|chatcard|wrapped|daily)\.js/.test(src) || /data-steps=/.test(src)) out.push(url);
  }
  return out.sort();
}
function up() { return new Promise(r => { const q = http.get(B + '/', res => { res.resume(); r(true); }); q.on('error', () => r(false)); q.setTimeout(2000, () => { q.destroy(); r(false); }); }); }
function launcher() {
  const tries = [['playwright-core', null], ['playwright-core', '/Users/jamespraise/Documents/site-motion-kit/node_modules/playwright-core'], ['puppeteer-core', null], ['puppeteer-core', '/tmp/wgog/node_modules/puppeteer-core']];
  for (const [name, p] of tries) { try { return [name, require(p || name)]; } catch (e) {} }
  return null;
}
(async () => {
  if (!(await up())) { console.log('test-one-screen: skipped, nothing is serving ' + B + ' (start it with python3 serve.py 8001).'); return; }
  const L = launcher();
  if (!L) { console.log('test-one-screen: skipped, no playwright-core or puppeteer-core found (see the header of this file).'); return; }
  const pages = games(), bad = [], errs = [];
  let browser, mk;
  if (L[0] === 'playwright-core') {
    browser = await L[1].chromium.launch({ executablePath: CHROME });
    mk = async () => { const c = await browser.newContext({ viewport: { width: 390, height: 844 } }); return c.newPage(); };
  } else {
    browser = await L[1].launch({ executablePath: CHROME, headless: 'new' });
    mk = async () => { const p = await browser.newPage(); await p.setViewport({ width: 390, height: 844 }); return p; };
  }
  const page = await mk();
  page.on('pageerror', e => errs.push(e.message));
  for (const u of pages) {
    errs.length = 0;
    await page.goto(B + u, { waitUntil: 'load' });
    await new Promise(r => setTimeout(r, 700));
    const h = await page.evaluate(() => {
      const a = document.querySelector('.tool-app'); if (!a) return -1;
      let hgt = a.getBoundingClientRect().height;
      a.querySelectorAll('.result').forEach(r => { if (r.getBoundingClientRect().height > 0 && !r.classList.contains('show')) hgt -= r.getBoundingClientRect().height; });
      return Math.round(hgt);
    });
    const over = h > LIMIT;
    console.log((over ? 'FAIL ' : 'ok   ') + String(h).padStart(5) + 'px  ' + u + (errs.length ? '  (page error: ' + errs[0] + ')' : ''));
    if (over) bad.push(u + ' ' + h + 'px');
    if (errs.length) bad.push(u + ' page error: ' + errs[0]);
  }
  await browser.close();
  console.log('\ntest-one-screen: ' + pages.length + ' games and quizzes, limit ' + LIMIT + 'px at 390x844');
  if (bad.length) { console.log('FAILED:\n  ' + bad.join('\n  ')); process.exit(1); }
  console.log('PASS');
})();
