// Landscape covers (email headers, X and LinkedIn banners) in the link-preview card style:
// cream canvas, soft blobs, the rust and olive dots, the stage stickers and chat bubbles.
// Each design lays out from the banner's own width and height, so one design renders at
// every size: 1500x500 (X header, email), 1285x500 (email), 1584x396 (LinkedIn).
//
// Run with the local server up (python3 serve.py 8001), puppeteer-core installed as for make-og.js:
//   NODE_PATH=/tmp/wgog/node_modules node scripts/make-banners.js            all designs at 1500x500 into Banners/Options
//   NODE_PATH=/tmp/wgog/node_modules node scripts/make-banners.js stickers --sizes   one design at every size into Banners/
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");
const og = require("./make-og.js");

const BANNERS = path.join(require("os").homedir(), "Downloads/Wholesome Girlies/Brand Assets/Banners");
const SIZES = [[1500, 500], [1285, 500], [1584, 396]];
const TOOLS = ["/relationships/tools/situationship-checker", "/pregnancy/tools/due-date-calculator", "/postpartum/tools/recovery-checklist"];
const stages = Object.values(og.STAGES);

function frame(W, H, body) {
  const k = Math.min(H / 500, W / 1500);
  return `<!doctype html><html><head><meta charset="utf-8"><style>${og.fonts()}
*{box-sizing:border-box;margin:0}
body{width:${W}px;height:${H}px;overflow:hidden;background:#FBF8EF;font-family:'Nunito Sans',sans-serif;color:#33322A;position:relative}
.blob{position:absolute;border-radius:50%}
.serif{font-family:'DM Serif Display',serif;font-weight:400}
.chip{display:inline-block;background:#6E7A3F;color:#FBF8EF;font-weight:800;font-size:${14 * k}px;letter-spacing:.08em;text-transform:uppercase;padding:${7 * k}px ${15 * k}px;border-radius:999px;white-space:nowrap}
.lockup{display:flex;align-items:center;gap:${16 * k}px}
.lockup svg{width:${66 * k}px;height:${66 * k}px}
.lockup b{font-family:'DM Serif Display',serif;font-weight:400;font-size:${64 * k}px;line-height:1;white-space:nowrap}
</style></head><body>
<div class="blob" style="width:${620 * k}px;height:${620 * k}px;right:${-150 * k}px;top:${-330 * k}px;background:#EAE9D2"></div>
<div class="blob" style="width:${320 * k}px;height:${320 * k}px;left:${-130 * k}px;bottom:${-220 * k}px;background:#DFDCC0;opacity:.6"></div>
${body}
</body></html>`;
}
const dot = (x, y, d, c) => `<div class="blob" style="width:${d}px;height:${d}px;left:${x}px;top:${y}px;background:${c}"></div>`;
const left = (W, H, inner) => `<div style="position:absolute;left:${W * 0.06}px;top:0;bottom:0;display:flex;flex-direction:column;justify-content:center">${inner}</div>`;

const designs = {
  // the name and promise on the left, the five stages as stickers on the right
  stickers: (W, H) => {
    const k = Math.min(H / 500, W / 1500), x0 = W - 660 * k;
    const at = [[0, 40, -6], [250, 110, 5], [20, 190, 3], [300, 250, -5], [60, 320, 4]];
    return frame(W, H, `${left(W, H, `
  <div class="lockup">${og.LOGO}<b>Wholesome Girlies</b></div>
  <p class="serif" style="font-size:${34 * k}px;line-height:1.15;margin-top:${22 * k}px;max-width:${660 * k}px">${og.esc(og.HEADLINE).replace("trust, ", "trust,<br>")}</p>
  <p style="font-size:${19 * k}px;font-weight:800;color:#66645A;margin-top:${16 * k}px">wholesomegirlies.xyz</p>`)}
${dot(x0 - 90 * k, 340 * k + (H - 500 * k) / 2, 30 * k, "#C0763F")}${dot(x0 - 44 * k, 390 * k + (H - 500 * k) / 2, 14 * k, "#6E7A3F")}
<div style="position:absolute;left:${x0}px;top:${(H - 440 * k) / 2}px;width:${640 * k}px;height:${440 * k}px">${stages.map((s, i) => `<div style="position:absolute;left:${at[i][0] * k}px;top:${at[i][1] * k}px;transform:rotate(${at[i][2]}deg);
  background:${og.STICKERS[i][0]};color:${og.STICKERS[i][1]};font-family:'DM Serif Display',serif;font-size:${30 * k}px;padding:${13 * k}px ${24 * k}px;white-space:nowrap;
  border-radius:${18 * k}px;border:1px solid #E4E1CE;box-shadow:0 ${12 * k}px ${30 * k}px rgba(51,50,42,.16)">${s}</div>`).join("")}</div>`);
  },

  // the promise as a message in a group chat, the site as the link that comes back
  "group-chat": (W, H) => {
    const k = Math.min(H / 500, W / 1500), x0 = W - 760 * k;
    return frame(W, H, `${left(W, H, `
  <div class="lockup">${og.LOGO}<b style="font-size:${54 * k}px">Wholesome Girlies</b></div>
  <div style="margin-top:${22 * k}px"><span class="chip">${og.EYEBROW}</span></div>`)}
${dot(x0 - 40 * k, 60 * k, 30 * k, "#C0763F")}${dot(x0 + 10 * k, 108 * k, 14 * k, "#6E7A3F")}
<div style="position:absolute;left:${x0}px;right:${W * 0.05}px;top:${40 * k}px;bottom:${40 * k}px;display:flex;flex-direction:column;justify-content:center;gap:${44 * k}px">
  <div style="position:relative;align-self:flex-start;max-width:${560 * k}px;background:#fff;border-radius:${6 * k}px ${28 * k}px ${28 * k}px ${28 * k}px;padding:${22 * k}px ${28 * k}px;box-shadow:0 ${12 * k}px ${34 * k}px rgba(51,50,42,.14)">
    <p class="serif" style="font-size:${40 * k}px;line-height:1.1">${og.esc(og.HEADLINE)}</p>
    <span style="position:absolute;right:${22 * k}px;bottom:${-20 * k}px;background:#fff;border-radius:999px;padding:${5 * k}px ${12 * k}px;font-size:${21 * k}px;box-shadow:0 ${5 * k}px ${16 * k}px rgba(51,50,42,.16);border:1px solid #E4E1CE">💛 🙌</span>
  </div>
  <div style="align-self:flex-end;max-width:${560 * k}px;background:#6E7A3F;color:#FBF8EF;border-radius:${28 * k}px ${6 * k}px ${28 * k}px ${28 * k}px;padding:${16 * k}px ${24 * k}px;box-shadow:0 ${12 * k}px ${34 * k}px rgba(51,50,42,.18)">
    <p style="font-size:${13 * k}px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.8">wholesomegirlies.xyz</p>
    <p style="font-size:${19 * k}px;font-weight:800;line-height:1.3;margin-top:${5 * k}px">${stages.join(" · ")}</p>
    <p style="font-size:${13 * k}px;text-align:right;margin-top:${3 * k}px;color:#DFDCC0">✓✓</p>
  </div>
</div>`);
  },

  // the promise and "Try it" beside three of the real tools
  "tool-fan": (W, H, shots) => {
    const k = Math.min(H / 500, W / 1500), x0 = W - 720 * k;
    return frame(W, H, `${left(W, H, `
  <div class="lockup">${og.LOGO}<b style="font-size:${54 * k}px">Wholesome Girlies</b></div>
  <p class="serif" style="font-size:${32 * k}px;line-height:1.15;margin-top:${20 * k}px;max-width:${640 * k}px">${og.esc(og.HEADLINE)}</p>
  <div><div style="display:inline-block;margin-top:${20 * k}px;background:#C0763F;color:#fff;font-weight:800;font-size:${19 * k}px;padding:${9 * k}px ${18 * k}px;border-radius:999px;transform:rotate(-2deg)">Try the tools →</div></div>`)}
${dot(x0 - 70 * k, 380 * k, 30 * k, "#C0763F")}${dot(x0 - 24 * k, 430 * k, 14 * k, "#6E7A3F")}
${shots.map((b64, i) => `<div style="position:absolute;top:${[70, 40, 96][i] * k}px;left:${x0 + [0, 220, 440][i] * k}px;width:${270 * k}px;max-height:${380 * k}px;background:#fff;border-radius:${18 * k}px;overflow:hidden;
  box-shadow:0 ${20 * k}px ${46 * k}px rgba(51,50,42,.22),0 0 0 1px #E4E1CE;transform:rotate(${[-6, 2, 8][i]}deg);z-index:${[1, 3, 2][i]}">
  <img src="data:image/png;base64,${b64}" style="width:100%;display:block"></div>`).join("")}`);
  },
};

(async () => {
  const args = process.argv.slice(2);
  const sizes = args.includes("--sizes");
  const pick = args.filter((a) => !a.startsWith("--"));
  const names = pick.length ? pick : Object.keys(designs);
  await og.loadFonts();
  const browser = await puppeteer.launch({ executablePath: og.CHROME, headless: true });
  let shots = [];
  if (names.includes("tool-fan")) {
    const page = await browser.newPage();
    await page.setViewport({ width: 760, height: 1200, deviceScaleFactor: 2 });
    for (const url of TOOLS) shots.push(await og.screenshot(page, { url }));
  }
  const card = await browser.newPage();
  for (const name of names) {
    for (const [W, H] of sizes ? SIZES : [SIZES[0]]) {
      const dir = sizes ? BANNERS : path.join(BANNERS, "Options");
      fs.mkdirSync(dir, { recursive: true });
      const file = path.join(dir, sizes ? `wg-banner-${W}x${H}.png` : `${Object.keys(designs).indexOf(name) + 1}-${name}-${W}x${H}.png`);
      // finals at their exact size; options at double resolution for a sharp review
      await card.setViewport({ width: W, height: H, deviceScaleFactor: sizes ? 1 : 2 });
      await card.setContent(designs[name](W, H, shots), { waitUntil: "load" });
      await card.evaluate(() => document.fonts.ready);
      await card.screenshot({ path: file, type: "png" });
      console.log("banner", path.relative(BANNERS, file));
    }
  }
  await browser.close();
})();
