// Result cards for the quizzes and checkers, one set per result type in scripts/results.json.
// Each result gets two images from its cast scene (assets/img/cast/results/<art>.jpg):
//   assets/img/results/<tool>/<result>.jpg         1200x630 link preview for the result page
//   assets/img/results/<tool>/<result>-status.jpg  1080x1920 card she saves for WhatsApp Status or Stories
// The words come from results.json and are set in the layout, never drawn by the AI.
//
//   npm install --prefix /tmp/wgog puppeteer-core@23
//   NODE_PATH=/tmp/wgog/node_modules node scripts/make-result-cards.js [tool ...]
// After a re-render, bump RESULT_VERSION here and in scripts/make-result-pages.py.
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");
const og = require("./make-og.js");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "assets/img/results");
const RESULTS = JSON.parse(fs.readFileSync(path.join(__dirname, "results.json"), "utf8"));
const ART = { "ready-for-love-quiz": "ready-for-love", "green-red-flags-checker": "flags", "situationship-checker": "situationship" };
const art = (tool, id) => "data:image/jpeg;base64," + fs.readFileSync(path.join(ROOT, "assets/img/cast/results", `${ART[tool]}-${id}.jpg`)).toString("base64");

function ogCard(t, r, img) {
  const size = r.title.length > 32 ? 50 : 58;
  return og.shell(`
<div style="position:absolute;left:64px;top:62px;width:600px">
  <span class="chip">${og.esc(t.name)}</span>
  <p style="margin-top:30px;font-size:22px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#C0763F">My result</p>
  <h1 class="serif" style="font-size:${size}px;line-height:1.06;margin-top:10px">${og.esc(r.title)}</h1>
  <div style="display:inline-block;margin-top:26px;background:#6E7A3F;color:#fff;font-weight:800;font-size:22px;padding:10px 20px;border-radius:999px;transform:rotate(-2deg)">${og.esc(t.cta)} →</div>
</div>
<div style="position:absolute;right:70px;top:36px;width:380px;height:560px;border-radius:26px;overflow:hidden;transform:rotate(3deg);
  box-shadow:0 24px 60px rgba(51,50,42,.22),0 0 0 6px #fff">
  <img src="${img}" style="width:100%;height:100%;object-fit:cover;object-position:center 30%;display:block">
</div>`);
}

function statusCard(t, r, img) {
  const size = r.title.length > 32 ? 76 : 88;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${og.fonts()}
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1920px;overflow:hidden;background:#FBF8EF;font-family:'Nunito Sans',sans-serif;color:#33322A;position:relative}
.serif{font-family:'DM Serif Display',serif;font-weight:400}
.chip{display:inline-block;background:#6E7A3F;color:#FBF8EF;font-weight:800;font-size:28px;letter-spacing:.08em;text-transform:uppercase;padding:12px 26px;border-radius:999px}
</style></head><body>
<div style="position:absolute;width:760px;height:760px;border-radius:50%;right:-300px;top:-300px;background:#EAE9D2"></div>
<div style="position:absolute;width:420px;height:420px;border-radius:50%;left:-180px;bottom:-200px;background:#DFDCC0;opacity:.6"></div>
<div style="position:absolute;left:80px;top:130px;width:920px">
  <span class="chip">${og.esc(t.name)}</span>
  <p style="margin-top:44px;font-size:32px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#C0763F">My result</p>
  <h1 class="serif" style="font-size:${size}px;line-height:1.05;margin-top:14px">${og.esc(r.title)}</h1>
</div>
<div style="position:absolute;left:110px;top:${r.title.length > 32 ? 560 : 520}px;width:860px;height:1060px;border-radius:40px;overflow:hidden;transform:rotate(-2deg);
  box-shadow:0 30px 80px rgba(51,50,42,.22),0 0 0 10px #fff">
  <img src="${img}" style="width:100%;height:100%;object-fit:cover;object-position:center 35%;display:block">
</div>
<div style="position:absolute;left:80px;right:80px;bottom:90px;display:flex;align-items:center;justify-content:space-between">
  <div style="display:flex;align-items:center;gap:18px">${og.LOGO.replace(/width="46" height="46"/, 'width="64" height="64"')}
    <div><b class="serif" style="font-size:40px;font-weight:400">Wholesome Girlies</b>
    <span style="display:block;font-size:26px;color:#66645A;margin-top:2px">wholesomegirlies.xyz</span></div></div>
  <div style="background:#C0763F;color:#fff;font-weight:800;font-size:30px;padding:16px 30px;border-radius:999px;transform:rotate(-2deg)">${og.esc(t.cta)} →</div>
</div>
</body></html>`;
}

if (require.main === module) (async () => {
  const only = process.argv.slice(2);
  await og.loadFonts();
  const browser = await puppeteer.launch({ executablePath: og.CHROME, headless: true });
  const page = await browser.newPage();
  const render = async (html, w, h, file, quality) => {
    await page.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: file, type: "jpeg", quality });
  };
  for (const [tool, t] of Object.entries(RESULTS)) {
    if (only.length && !only.includes(tool)) continue;
    const dir = path.join(OUT, tool);
    fs.mkdirSync(dir, { recursive: true });
    for (const [id, r] of Object.entries(t.results)) {
      const img = art(tool, id);
      await render(ogCard(t, r, img), 1200, 630, path.join(dir, `${id}.jpg`), 86);
      await render(statusCard(t, r, img), 1080, 1920, path.join(dir, `${id}-status.jpg`), 84);
      console.log("result card", tool, id);
    }
  }
  await browser.close();
})();
