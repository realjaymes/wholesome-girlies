// Media kit images for writers, editors and podcast hosts: the pictures a best-of list or a news story shows
// beside an app. Wholesome Girlies has no app store listing to take them from, so we make our own, in the
// shape app stores use: a plain headline above a phone showing the real tool with sample data.
// No "Try it" button, no price and no call to action on any image, because an editor will not run an advert.
//
// Each tool renders in three sizes: tall 1080x1920 (app store screenshot), wide 1600x900 (article body)
// and square 1080x1080 (list thumbnail). Three looks are kept for review:
//   look a  Sticker: stage-tint page, the phone as an ink-outlined sticker, the stage guide beside it.
//   look b  App store: stage-tint page, centred headline, the phone, no drawn person.
//   look c  App store with the stage guide standing beside the phone.
//
// Run with the site up on :8001 (python3 serve.py 8001):
//   NODE_PATH=/tmp/wgog/node_modules node scripts/make-media-kit.js --look a|b|c|all [tool ...]   review set into _lab/media-kit/
//   NODE_PATH=/tmp/wgog/node_modules node scripts/make-media-kit.js --final b [tool ...]         finished set into
//     ~/Downloads/Wholesome Girlies/Media Kit/ (WG_MEDIA_KIT_DIR to change it), for the Media Kit folder in Drive
// The vault note is SEO/Off-Page/09 - Media Kit.md. Words on images follow the site copy rules: no dashes, never
// "free", "Wholesome Girlies" in full.
const fs = require("fs");
const path = require("path");
const os = require("os");
const puppeteer = require("puppeteer-core");
const og = require("./make-og.js");
const { STG } = require("./og-looks.js");

const ROOT = path.join(__dirname, "..");
const LAB = path.join(ROOT, "_lab/media-kit");
const FINAL = process.env.WG_MEDIA_KIT_DIR || path.join(os.homedir(), "Downloads/Wholesome Girlies/Media Kit");
const INK = "#33322A";
const GH = { tolu: [392, 620], amaka: [255, 569], zainab: [289, 563], funmi: [293, 569] };

// Each tool: its page, its stage, the words on the image (what she gets, in plain words) and how to fill it
// with sample data so the screen shows a real result. Days are counted back from today.
const TOOLS = {
  "period-tracker": {
    url: "/fertility/tools/period-tracker", stage: "fertility",
    head: "Know when your next period is due",
    sub: "Your next three periods and your fertile days, worked out on your phone.",
    fill: { dates: { lmp: 18 }, click: "Predict my next periods", scrollTo: "#res" },
  },
};

const SIZES = { tall: [1080, 1920], wide: [1600, 900], square: [1080, 1080] };
const b64 = (f, type) => `data:${type};base64,${fs.readFileSync(f).toString("base64")}`;
const guideImg = (name) => b64(path.join(ROOT, "assets/img/cast/guides", name + ".webp"), "image/webp");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const sprig = (s, w = 56) => `<svg viewBox="0 0 56 56" width="${w}" height="${w}"><circle cx="28" cy="28" r="25.5" fill="${s}" stroke="${INK}" stroke-width="3"/><path d="M17 38c0-11 8-18 21-18 0 11-8 18-21 18z" fill="#FBF8EF" stroke="${INK}" stroke-width="2"/><path d="M20 37c5-6 11-10 17-12" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;

// The tool as it looks in the installed app on an iPhone, sample data in, scrolled to the result.
async function phoneScreen(page, t) {
  await page.goto(og.BASE + t.url + "?preview=installed", { waitUntil: "networkidle0" });
  await page.addStyleTag({ content: "html{scroll-behavior:auto!important}#cc-main,.wg-app-bar,#appNotice,.wg-install-bar,.wg-resume,.wgs-toast,[class^=wgs-sheet]{display:none!important}" });
  await page.evaluate(async (f) => {
    for (const [id, daysAgo] of Object.entries(f.dates || {})) {
      const i = document.getElementById(id);
      i.value = new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10);
      i.dispatchEvent(new Event("input", { bubbles: true }));
      i.dispatchEvent(new Event("change", { bubbles: true }));
    }
    const b = [...document.querySelectorAll(".tool-app button")].find((x) => x.textContent.trim().startsWith(f.click));
    if (b) b.click();
  }, t.fill);
  await new Promise((r) => setTimeout(r, 900));
  // the result, scrolled up under the sticky header, the way she sees it after pressing the button
  await page.evaluate((sel) => {
    const el = document.querySelector(sel);
    el.scrollIntoView({ block: "start" });
    const head = document.querySelector("header");
    window.scrollBy(0, -((head ? head.getBoundingClientRect().height : 0) + 14));
  }, t.fill.scrollTo);
  await new Promise((r) => setTimeout(r, 600));
  return page.screenshot({ encoding: "base64" });
}

const statusIcons = (h) => `<svg height="${h * 0.8}" viewBox="0 0 18 12"><rect x="0" y="8" width="3" height="4" rx="1" fill="#111"/><rect x="5" y="5.5" width="3" height="6.5" rx="1" fill="#111"/><rect x="10" y="3" width="3" height="9" rx="1" fill="#111"/><rect x="15" y="0" width="3" height="12" rx="1" fill="#111"/></svg>
<svg height="${h * 0.8}" viewBox="0 0 27 12"><rect x=".5" y=".5" width="23" height="11" rx="3" fill="none" stroke="#111" opacity=".45"/><rect x="2" y="2" width="18" height="8" rx="1.8" fill="#111"/><rect x="25" y="4" width="1.6" height="4" rx=".8" fill="#111" opacity=".45"/></svg>`;

// A plain iPhone: dark frame, the screen, the camera island. Look a gives it an ink outline and offset shadow.
function phone(shot, w, sticker) {
  const h = Math.round(w * (844 / 390)) + Math.round(w * 0.06);
  const bez = Math.round(w * 0.032), r = Math.round(w * 0.16);
  return `<div style="width:${w}px;height:${h}px;border-radius:${r}px;background:#1d1d1f;padding:${bez}px;position:relative;
    ${sticker ? `border:5px solid ${INK};box-shadow:18px 18px 0 ${INK}` : "box-shadow:0 40px 90px rgba(51,50,42,.28),0 0 0 2px #2c2c2e"}">
    <div style="width:100%;height:100%;border-radius:${r - bez}px;overflow:hidden;background:#FBF8EF;position:relative">
      <div style="height:${Math.round(w * 47 / 390)}px;background:#FBF8EF;display:flex;align-items:flex-end;justify-content:space-between;padding:0 ${Math.round(w * 0.085)}px ${Math.round(w * 0.012)}px;font-weight:800;font-size:${Math.round(w * 0.042)}px;color:#111">
        <span>9:41</span><span style="display:flex;gap:${Math.round(w * 0.012)}px;align-items:center">${statusIcons(Math.round(w * 0.042))}</span></div>
      <img src="data:image/png;base64,${shot}" style="width:100%;display:block">
      <div style="position:absolute;top:${Math.round(w * 0.028)}px;left:50%;transform:translateX(-50%);width:${Math.round(w * 0.3)}px;height:${Math.round(w * 0.085)}px;border-radius:999px;background:#000"></div>
    </div></div>`;
}

function page(W, H, s, body) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${og.fonts()}
*{box-sizing:border-box;margin:0}
body{width:${W}px;height:${H}px;overflow:hidden;font-family:'Nunito Sans',sans-serif;color:${INK};position:relative;background:${s.t}}
.serif{font-family:'DM Serif Display',serif;font-weight:400;letter-spacing:-.01em}
.abs{position:absolute}
.chip{display:inline-block;background:${s.s};color:${s.on};border:3px solid ${INK};font-weight:800;letter-spacing:.06em;text-transform:uppercase;border-radius:999px}
.mark{display:flex;align-items:center;gap:14px}
.mark b{font-family:'DM Serif Display',serif;font-weight:400;line-height:1}
</style></head><body>${body}</body></html>`;
}

function render(look, size, t, shot) {
  const [W, H] = SIZES[size], s = STG[t.stage], sticker = look === "a", guide = look !== "b";
  const g = s.guide, mark = (px) => `<div class="mark">${sprig(s.s, px * 1.5)}<b style="font-size:${px}px">Wholesome Girlies</b></div>`;
  const wash = sticker ? "" : `<div class="abs" style="inset:0;background:linear-gradient(180deg,#FBF8EF 0%,${s.t} 62%)"></div>`;
  const guideAt = (h, right, bottom) => `<img class="abs" src="${guideImg(g)}" style="height:${h}px;right:${right}px;bottom:${bottom}px">`;

  if (size === "tall") {
    const pw = guide ? 620 : 720, left = guide ? 100 : (W - pw) / 2;
    const top = sticker
      ? `<div class="abs" style="left:90px;top:90px;right:90px">
           ${mark(40)}<div style="margin-top:44px"><span class="chip" style="font-size:30px;padding:12px 28px">${esc(s.label)}</span></div>
           <h1 class="serif" style="font-size:104px;line-height:1.02;margin-top:34px">${esc(t.head)}</h1>
           <p style="font-size:40px;line-height:1.3;margin-top:26px;font-weight:700">${esc(t.sub)}</p></div>`
      : `<div class="abs" style="left:80px;right:80px;top:96px;text-align:center;display:flex;flex-direction:column;align-items:center">
           ${mark(40)}
           <h1 class="serif" style="font-size:100px;line-height:1.04;margin-top:44px">${esc(t.head)}</h1>
           <p style="font-size:40px;line-height:1.32;margin-top:26px;color:#55534A;max-width:860px">${esc(t.sub)}</p></div>`;
    const ph = `<div class="abs" style="left:${left}px;top:${sticker ? 820 : 640}px;${sticker ? "transform:rotate(-3deg)" : ""}">${phone(shot, pw, sticker)}</div>`;
    const gd = guide ? guideAt(sticker ? 900 : 860, sticker ? 10 : 20, 0) : "";
    const foot = "";
    return page(W, H, s, wash + top + ph + gd + foot);
  }

  if (size === "wide") {
    const pw = 380, px = guide ? 900 : 1060;
    const text = `<div class="abs" style="left:96px;top:${sticker ? 110 : 120}px;width:${guide ? 760 : 880}px">
        ${sticker ? `<span class="chip" style="font-size:24px;padding:10px 24px">${esc(s.label)}</span>` : mark(34)}
        <h1 class="serif" style="font-size:84px;line-height:1.04;margin-top:34px">${esc(t.head)}</h1>
        <p style="font-size:34px;line-height:1.34;margin-top:24px;${sticker ? "font-weight:700" : "color:#55534A"}">${esc(t.sub)}</p></div>`;
    const ph = `<div class="abs" style="left:${px}px;top:${sticker ? 110 : 90}px;${sticker ? "transform:rotate(3deg)" : ""}">${phone(shot, pw, sticker)}</div>`;
    const gd = guide ? guideAt(sticker ? 640 : 620, 30, 0) : "";
    const foot = sticker ? `<div class="abs" style="left:96px;bottom:70px">${mark(36)}</div>` : "";
    return page(W, H, s, wash + text + ph + gd + foot);
  }

  // square
  const pw = 420, px = guide ? 150 : (W - pw) / 2;
  const top = `<div class="abs" style="left:${sticker ? 70 : 150}px;right:${sticker ? 70 : 150}px;top:${sticker ? 70 : 64}px;${sticker ? "" : "text-align:center"}">
      <h1 class="serif" style="font-size:72px;line-height:1.04">${esc(t.head)}</h1></div>`;
  const ph = `<div class="abs" style="left:${px}px;top:${sticker ? 300 : 280}px;${sticker ? "transform:rotate(-3deg)" : ""}">${phone(shot, pw, sticker)}</div>`;
  const gd = guide ? guideAt(sticker ? 620 : 600, 40, 0) : "";
  const foot = `<div class="abs" style="${sticker ? "left:70px" : "left:0;right:0;display:flex;justify-content:center"};bottom:44px;${sticker ? "" : "display:flex;justify-content:center"}">${sticker ? mark(32) : ""}</div>`;
  return page(W, H, s, wash + top + ph + gd + foot);
}

function labIndex(looks, tools) {
  const names = { a: "A. Sticker look", b: "B. App store style (recommended)", c: "C. App store style with the stage guide" };
  const cards = looks.map((l) => `<section><h2>${names[l]}</h2>${tools.map((t) => Object.keys(SIZES).map((z) =>
    `<figure><img src="${l}-${t}-${z}.png" loading="lazy"><figcaption>${t}, ${z} ${SIZES[z].join("×")}</figcaption></figure>`).join("")).join("")}</section>`).join("");
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="robots" content="noindex, nofollow"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Media kit looks</title><style>body{font-family:system-ui;background:#f4f2ea;color:#33322A;margin:0;padding:24px 16px}h1{font-size:24px}h2{margin:36px 0 12px}
section{display:flex;flex-wrap:wrap;gap:18px;align-items:flex-start}section h2{flex-basis:100%}figure{margin:0;background:#fff;padding:10px;border-radius:12px}
figure img{display:block;height:440px;max-width:calc(100vw - 52px);object-fit:contain}figcaption{font-size:13px;margin-top:6px;color:#666}</style></head>
<body><h1>Wholesome Girlies media kit: three looks</h1><p>Each look in the three sizes writers use: tall (app store screenshot), wide (article image) and square (list thumbnail). Open any image in a new tab for full size.</p>${cards}</body></html>`;
}

(async () => {
  const args = process.argv.slice(2);
  const final = args.includes("--final");
  const lookArg = args[args.indexOf(final ? "--final" : "--look") + 1] || "all";
  const looks = lookArg === "all" ? ["a", "b", "c"] : [lookArg];
  const flagged = new Set([args.indexOf("--look") + 1, args.indexOf("--final") + 1]);
  const only = args.filter((a, i) => !a.startsWith("--") && !flagged.has(i));
  const tools = Object.keys(TOOLS).filter((k) => !only.length || only.includes(k));
  const out = final ? FINAL : LAB;
  fs.mkdirSync(out, { recursive: true });
  await og.loadFonts();
  const browser = await puppeteer.launch({ executablePath: og.CHROME, headless: true });
  const tab = await browser.newPage();
  await tab.setRequestInterception(true);
  tab.on("request", (r) => (/googletagmanager|google-analytics|doubleclick|facebook/.test(r.url()) ? r.abort() : r.continue()));
  tab.on("dialog", (d) => d.dismiss());
  await tab.setUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1");
  await tab.setViewport({ width: 390, height: 797, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  const card = await browser.newPage();
  for (const k of tools) {
    const shot = await phoneScreen(tab, TOOLS[k]);
    for (const l of looks) for (const [z, [W, H]] of Object.entries(SIZES)) {
      await card.setViewport({ width: W, height: H, deviceScaleFactor: 1 });
      await card.setContent(render(l, z, TOOLS[k], shot), { waitUntil: "load" });
      await card.evaluate(() => document.fonts.ready);
      const file = final ? path.join(out, `Wholesome Girlies ${k} ${z}.png`) : path.join(out, `${l}-${k}-${z}.png`);
      await card.screenshot({ path: file, type: "png" });
      console.log("media kit", path.basename(file));
    }
  }
  if (!final) fs.writeFileSync(path.join(out, "index.html"), labIndex(looks, tools));
  await browser.close();
})();
