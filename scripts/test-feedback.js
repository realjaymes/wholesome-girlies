/* The day 7 feedback page, end to end at 390 wide, against the local site and a local wg-pay (wrangler dev).
 *   WG_BASE (default http://localhost:8007)   WG_API (default http://localhost:8787)   WG_SHOTS (screenshot folder)
 * Needs puppeteer-core (NODE_PATH=/tmp/wgog/node_modules), the system Chrome, sqlite3, and the wg-pay local database.
 * It claims a place, answers all six questions, checks the done screen, the credited step, two more months and the
 * "already sent" state, and checks the steps card before and after day 7 (?f1kday=N, localhost only). */
const puppeteer = require('puppeteer-core');
const { execSync } = require('child_process');
const fs = require('fs');
const SITE = process.env.WG_BASE || 'http://localhost:8007', API = process.env.WG_API || 'http://localhost:8787';
const SHOTS = process.env.WG_SHOTS || '';
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const wait = (ms) => new Promise(r => setTimeout(r, ms));
const res = []; let failed = 0;
const ok = (n, p, x = '') => { if (!p) failed++; res.push((p ? 'PASS ' : 'FAIL ') + n + (x ? '  (' + x + ')' : '')); };
const run = Date.now().toString().slice(-6);
const email = `fb${run}@example.com`;
const dbFile = () => { const dir = process.env.HOME + '/Documents/wg-pay/.wrangler/state/v3/d1/miniflare-D1DatabaseObject/'; return dir + fs.readdirSync(dir).find(f => f.endsWith('.sqlite') && f !== 'metadata.sqlite'); };
const sql = (q) => execSync(`sqlite3 "${dbFile()}" "${q}"`).toString().trim();
const shot = (p, n) => SHOTS ? p.screenshot({ path: `${SHOTS}/${n}.png` }) : null;

(async () => {
  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const p = await b.newPage(); await p.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  const calls = []; p.on('request', r => { if (r.url().startsWith(API)) calls.push(r.method() + ' ' + r.url().replace(API, '')); });
  await p.evaluateOnNewDocument((api) => { try { localStorage.setItem('wg_pay_api', api); } catch (e) {} }, API);

  // signed out goes to sign-in with next
  await p.goto(SITE + '/first/feedback', { waitUntil: 'networkidle0' }); await wait(800);
  ok('signed out: sent to sign-in with next', /^\/signin\/$/.test(new URL(p.url()).pathname) && /next=%2Ffirst%2Ffeedback|next=\/first\/feedback/.test(p.url()), p.url());
  ok('page is noindex', /<meta name="robots" content="noindex/.test(await (await fetch(SITE + '/first/feedback')).text()));

  // claim a place (this signs her in on this device)
  await p.goto(SITE + '/first/', { waitUntil: 'networkidle0' });
  const claim = await p.evaluate(async (em) => { const j = await WGAccess.first1000.claim({ name: 'Ada Test', email: em, whatsapp: '+234 803 ' + String(Math.floor(Math.random() * 9e6 + 1e6)), stage: 'fertility', consent: true }); return JSON.stringify(j); }, email);
  ok('claim made her a member', /"ok":true/.test(claim), claim.slice(0, 120));
  const endsBefore = sql(`SELECT ends_at FROM members WHERE email='${email}'`);

  // steps card before and after day 7
  await p.goto(SITE + '/app/?f1kday=3', { waitUntil: 'networkidle0' }); await wait(1500);
  let row = await p.evaluate(() => { const li = document.querySelector('.f1k-app li[data-f1k-step="feedback_d7"]'); return li ? { text: li.innerText.replace(/\n/g, ' | '), link: !!li.querySelector('a') } : null; });
  ok('steps card: before day 7 shows "Opens on day 7" and no link', !!row && /Opens on day 7/.test(row.text) && !row.link, row && row.text);
  await shot(p, 'steps-before-day7');
  await p.goto(SITE + '/app/?f1kday=7', { waitUntil: 'networkidle0' }); await wait(1500);
  row = await p.evaluate(() => { const li = document.querySelector('.f1k-app li[data-f1k-step="feedback_d7"]'); const a = li && li.querySelector('a'); return li ? { text: li.innerText.replace(/\n/g, ' | '), href: a ? a.getAttribute('href') : '' } : null; });
  ok('steps card: from day 7 links to the feedback page', !!row && row.href === '/first/feedback' && !/Opens on day 7/.test(row.text), row && (row.text + ' ' + row.href));
  await shot(p, 'steps-day7');

  // the form
  await p.goto(SITE + '/first/feedback', { waitUntil: 'networkidle0' }); await wait(1200);
  ok('member sees the first question', /How useful has your program been so far\?/.test(await p.$eval('#fbCard', e => e.innerText)));
  ok('sales-page header and full footer', !!(await p.$('header')) && !!(await p.$('footer.site-footer')));
  await shot(p, 'feedback-q1');
  await p.click('.fb-dot:nth-child(4)'); await wait(500);
  ok('question 2 after a scale tap', /What have you used most\?/.test(await p.$eval('#fbCard', e => e.innerText)));
  const opts = await p.$$eval('.fb-opt', l => l.map(x => x.innerText));
  ok('question 2 has the five choices', opts.join('|') === 'The lessons|The tools|The games|Today’s card|The Telegram group', opts.join('|'));
  await p.click('.fb-opt:nth-child(1)'); await p.click('.fb-opt:nth-child(3)'); await p.click('.ff-next'); await wait(300);
  ok('question 3 note about health details', /Please don.t share health details here\./.test(await p.$eval('#fbCard', e => e.innerText)));
  const max = await p.$eval('#fbBetter', e => e.maxLength); ok('text capped at 500', max === 500, String(max));
  await p.type('#fbBetter', 'More short lessons please'); await p.click('.ff-next'); await wait(300);
  ok('question 4', /Would you keep paying for it after your free months\?/.test(await p.$eval('#fbCard', e => e.innerText)));
  await p.click('.fb-opt:nth-child(2)'); await wait(500);
  const fair = await p.$$eval('.fb-opt', l => l.map(x => x.innerText));
  ok('question 5 options', fair.join('|') === '₦1,000 a month|₦2,500 a month|₦5,000 a month|Pay once|Other', fair.join('|'));
  await p.click('.fb-opt:nth-child(2)'); await wait(500);
  ok('question 6 line', /We would call or video chat on WhatsApp at a time that suits you\./.test(await p.$eval('#fbCard', e => e.innerText)));
  await p.click('.ff-back'); await wait(300);
  ok('Back returns to question 5', /What would feel fair\?/.test(await p.$eval('#fbCard', e => e.innerText)));
  await p.click('.ff-next'); await wait(300);
  await p.click('.fb-opt:nth-child(1)'); await shot(p, 'feedback-q6');
  await p.click('.ff-next'); await wait(2500);
  const done = await p.$eval('#fbCard', e => e.innerText);
  ok('done screen', /Thank you\. 2 months added to your program\./.test(done), done.replace(/\n/g, ' | '));
  ok('done screen has both buttons', /Open the app/.test(done) && /Back to your program/.test(done));
  await shot(p, 'feedback-done');
  const stored = sql(`SELECT answers_json FROM member_feedback WHERE email='${email}'`);
  ok('answers stored as approved keys', /"useful":4/.test(stored) && /"used":\["lessons","games"\]/.test(stored) && /"keep":"maybe"/.test(stored) && /"fair":2500/.test(stored) && /"talk":true/.test(stored) && /"better":"More short lessons please"/.test(stored), stored);
  ok('feedback_d7 step credited', /feedback_d7/.test(sql(`SELECT step FROM member_steps WHERE email='${email}'`)));
  const endsAfter = sql(`SELECT ends_at FROM members WHERE email='${email}'`);
  const gap = Math.round((Date.parse(endsAfter) - Date.parse(endsBefore)) / 864e5);
  ok('end date moved by 2 months', gap >= 58 && gap <= 62, `${endsBefore} -> ${endsAfter}`);

  // second visit
  await p.goto(SITE + '/first/feedback', { waitUntil: 'networkidle0' }); await wait(1200);
  const again = await p.$eval('#fbCard', e => e.innerText);
  ok('second visit: already sent, no stepper', /You have already sent your feedback\. Thank you\./.test(again) && !(await p.$('.fb-form')), again.replace(/\n/g, ' | '));
  await shot(p, 'feedback-already');
  ok('the steps card marks the step done', (await (async () => { await p.goto(SITE + '/app/?f1kday=9', { waitUntil: 'networkidle0' }); await wait(1500); return p.evaluate(() => { const li = document.querySelector('.f1k-app li[data-f1k-step="feedback_d7"]'); return li; }); })()) === null);
  ok('no answers in any page request URL', !calls.some(c => /fair|useful|better/.test(c)), calls.filter(c => /feedback/.test(c)).join(','));
  ok('no page errors', errs.length === 0, errs.slice(0, 3).join(' | '));
  console.log(res.join('\n')); await b.close();
  process.exit(failed ? 1 : 0);
})().catch(e => { console.log(res.join('\n')); console.error('ERR', e); process.exit(1); });
