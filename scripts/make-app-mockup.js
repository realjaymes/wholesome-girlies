// Makes the phone screen in the app home's install card (assets/img/app/app-iphone.webp): Are You a Girl's Girl?
// two answers in, showing question 3 (the aso ebi one), as it looks opened from the home screen (James's pick:
// the picture shows a game). Needs the site on :8001.
//   NODE_PATH=/tmp/wgog/node_modules node scripts/make-app-mockup.js <out-dir>
// then resize <out-dir>/app-mock-raw.png to 432px wide as webp (quality 82) into assets/img/app/app-iphone.webp,
// and bump its ?v= in app/index.html.
const puppeteer = require('puppeteer-core'); const D = process.argv[2];
(async () => {
  const b = await puppeteer.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: 'new' });
  const p = await b.newPage();
  await p.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1');
  await p.setViewport({ width: 390, height: 797, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  await p.goto('http://localhost:8001/relationships/tools/girls-girl-quiz', { waitUntil: 'networkidle0' });
  await p.addStyleTag({ content: '#cc-main,.wg-app-bar{display:none!important}' });
  for (const [q, a] of [[0, 0], [1, 1]]) {
    await p.evaluate((q, a) => document.querySelectorAll('#scenarios .rq')[q].querySelectorAll('input[type=radio]')[a].click(), q, a);
    await new Promise(r => setTimeout(r, 700));
  }
  await p.evaluate(() => {
    document.querySelectorAll('.wg-app-bar').forEach(e => e.remove());
    const head = document.querySelector('header').getBoundingClientRect().height, t = document.querySelector('.tool-app');
    scrollTo(0, t.getBoundingClientRect().top + scrollY - head - 12);
  });
  await new Promise(r => setTimeout(r, 700));
  await p.screenshot({ path: D + '/app-mock-raw.png' });
  await b.close();
})();
