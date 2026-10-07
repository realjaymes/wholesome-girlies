// Link preview cards (Open Graph, 1200x630) for every tool and guide.
// Tools: the title and "Try it" beside a live screenshot of the tool. Guides: a chat-style
// card, the hook as a message and the guide as the shared link. Loss and warning-signs
// guides use the same card with a single heart reaction. Output: assets/img/og/<slug>.jpg
// Pages that are not a tool or guide (home, programs, about, legal, stage indexes) share
// assets/img/og/default.jpg: the headline beside the five stages as stickers.
// Every run also makes a 1080x1350 (4:5) feed post of each card for Instagram and other feeds,
// saved outside the repo in ~/Downloads/Wholesome Girlies/Social Posts/<stage>/<slug>.jpg
// (set WG_SQUARE_DIR to change it, pass --no-square to skip, or --square-only to make only these).
//
// Run with the local server up (python3 serve.py 8001):
//   npm install --prefix /tmp/wgog puppeteer-core@23
//   NODE_PATH=/tmp/wgog/node_modules node scripts/make-og.js [slug ... | default]
// Guide hooks come from scripts/og-hooks.json (python3 scripts/share-bank.py --og-json).
// After a re-render, bump OG_VERSION so WhatsApp, X and Facebook fetch the new image.
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const ROOT = path.join(__dirname, "..");
const BASE = "http://localhost:8001";
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const OUT = path.join(ROOT, "assets/img/og");
const SQUARE_OUT = process.env.WG_SQUARE_DIR || path.join(require("os").homedir(), "Downloads/Wholesome Girlies/Social Posts");
const OG_VERSION = "20261007a";
const STAGES = { relationships: "Relationships", fertility: "Trying to conceive", pregnancy: "Pregnancy", postpartum: "Postpartum", parenting: "Parenting" };
// sensitive guides: a single heart reaction, never the playful ones
const GENTLE = new Set(["chemical-miscarriage", "postpartum-warning-signs"]);
// loss pages carry one gentle share line, so their card message is set here
const HOOK_OVERRIDES = { "/pregnancy/guides/chemical-miscarriage": "A positive test, then a period." };
const hooks = JSON.parse(fs.readFileSync(path.join(__dirname, "og-hooks.json"), "utf8"));

const unesc = (s) => s.replace(/&amp;/g, "&").replace(/&#x27;|&#39;/g, "'").replace(/&quot;/g, '"').replace(/<[^>]+>/g, "").trim();
let FONTS = "";
// the brand fonts, fetched once and embedded, so every card renders the same
async function loadFonts() {
  const ua = { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 Chrome/126 Safari/537.36" } };
  let css = await (await fetch("https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Nunito+Sans:wght@400;700;800&display=block", ua)).text();
  for (const url of [...new Set(css.match(/https:[^)]+\.woff2/g))]) {
    const b64 = Buffer.from(await (await fetch(url)).arrayBuffer()).toString("base64");
    css = css.split(url).join("data:font/woff2;base64," + b64);
  }
  FONTS = css;
}
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");

function pages() {
  const list = [];
  for (const stage of Object.keys(STAGES)) {
    for (const kind of ["tools", "guides"]) {
      const dir = path.join(ROOT, stage, kind);
      if (!fs.existsSync(dir)) continue;
      for (const f of fs.readdirSync(dir).filter((x) => x.endsWith(".html"))) {
        const html = fs.readFileSync(path.join(dir, f), "utf8");
        const h1 = (html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) || [, f])[1];
        const slug = f.replace(/\.html$/, "");
        list.push({ stage, kind: kind === "tools" ? "tool" : "guide", slug, url: `/${stage}/${kind}/${slug}`, title: unesc(h1) });
      }
    }
  }
  return list;
}

const LOGO = `<svg viewBox="0 0 56 56" width="46" height="46"><circle cx="28" cy="28" r="27" fill="#6E7A3F"/><path d="M18 38c0-11 8-18 20-18 0 11-8 18-20 18z" fill="#FBF8EF"/><path d="M20 37c5-6 11-10 17-12" stroke="#6E7A3F" stroke-width="1.9" fill="none" stroke-linecap="round"/></svg>`;

// sq = true lays the card out as a 1080x1350 (4:5) feed post
function shell(body, sq = false) {
  const W = sq ? 1080 : 1200, H = sq ? 1350 : 630;
  return `<!doctype html><html><head><meta charset="utf-8">
<style>${FONTS}
*{box-sizing:border-box;margin:0}
body{width:${W}px;height:${H}px;overflow:hidden;background:#FBF8EF;font-family:'Nunito Sans',sans-serif;color:#33322A;position:relative}
.blob{position:absolute;border-radius:50%}
.chip{display:inline-block;background:#6E7A3F;color:#FBF8EF;font-weight:800;font-size:19px;letter-spacing:.08em;text-transform:uppercase;padding:9px 18px;border-radius:999px}
.brand{position:absolute;left:${sq ? 72 : 64}px;bottom:${sq ? 64 : 44}px;display:flex;align-items:center;gap:14px}
.brand b{font-family:'DM Serif Display',serif;font-weight:400;font-size:30px}
.brand span{display:block;font-size:18px;color:#66645A;margin-top:2px}
.serif{font-family:'DM Serif Display',serif;font-weight:400}
</style></head><body>
${sq ? `<div class="blob" style="width:620px;height:620px;right:-230px;top:-280px;background:#EAE9D2"></div>
<div class="blob" style="width:380px;height:380px;left:-150px;bottom:-210px;background:#DFDCC0;opacity:.6"></div>
<div class="blob" style="width:34px;height:34px;left:890px;top:300px;background:#C0763F"></div>
<div class="blob" style="width:16px;height:16px;left:940px;top:352px;background:#6E7A3F"></div>` : `<div class="blob" style="width:520px;height:520px;right:-170px;top:-210px;background:#EAE9D2"></div>
<div class="blob" style="width:300px;height:300px;left:-120px;bottom:-170px;background:#DFDCC0;opacity:.6"></div>
<div class="blob" style="width:34px;height:34px;left:560px;top:60px;background:#C0763F"></div>
<div class="blob" style="width:16px;height:16px;left:610px;top:112px;background:#6E7A3F"></div>`}
${body}
<div class="brand">${LOGO}<div><b>Wholesome Girlies</b><span>wholesomegirlies.xyz</span></div></div>
</body></html>`;
}

function toolCard(p, shot) {
  const size = p.title.length > 34 ? 52 : 62;
  return shell(`
<div style="position:absolute;left:64px;top:62px;width:520px">
  <span class="chip">Tool · ${STAGES[p.stage]}</span>
  <h1 class="serif" style="font-size:${size}px;line-height:1.06;margin-top:26px">${esc(p.title)}</h1>
  <div style="display:inline-block;margin-top:24px;background:#C0763F;color:#fff;font-weight:800;font-size:22px;padding:10px 20px;border-radius:999px;transform:rotate(-2deg)">Try it →</div>
</div>
<div style="position:absolute;right:64px;top:0;bottom:0;width:470px;display:flex;align-items:center">
<div style="width:470px;max-height:540px;background:#fff;border-radius:24px;overflow:hidden;
  box-shadow:0 24px 60px rgba(51,50,42,.22),0 0 0 1px #E4E1CE;transform:rotate(3deg)">
  <img src="data:image/png;base64,${shot}" style="width:100%;display:block">
</div></div>`);
}

function guideCard(p) {
  const hook = HOOK_OVERRIDES[p.url] || hooks[p.url];
  if (!hook) throw new Error("no hook for " + p.url + " (add it to the Share Copy Bank, then run share-bank.py --og-json)");
  const size = hook.length > 80 ? 40 : hook.length > 55 ? 46 : 54;
  return shell(`
<div style="position:absolute;left:64px;top:52px"><span class="chip">Guide · ${STAGES[p.stage]}</span></div>
<div style="position:absolute;left:64px;top:124px;max-width:900px;background:#fff;border-radius:6px 30px 30px 30px;padding:28px 34px;
  box-shadow:0 14px 40px rgba(51,50,42,.14)">
  <p class="serif" style="font-size:${size}px;line-height:1.12">${esc(hook)}</p>
  <span style="position:absolute;right:26px;bottom:-22px;background:#fff;border-radius:999px;padding:6px 14px;font-size:24px;
    box-shadow:0 6px 18px rgba(51,50,42,.16);border:1px solid #E4E1CE">${GENTLE.has(p.slug) ? "💛" : p.stage === "relationships" ? "👀 💯" : "💛 🙌"}</span>
</div>
<div style="position:absolute;right:64px;bottom:150px;max-width:640px;background:#6E7A3F;color:#FBF8EF;border-radius:30px 6px 30px 30px;padding:20px 28px;
  box-shadow:0 14px 40px rgba(51,50,42,.18)">
  <p style="font-size:15px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.8">wholesomegirlies.xyz</p>
  <p style="font-size:25px;font-weight:800;line-height:1.25;margin-top:6px">${esc(p.title)}</p>
  <p style="font-size:16px;text-align:right;margin-top:6px;color:#DFDCC0">✓✓</p>
</div>`);
}

// feed posts: the same cards stacked, title or message on top, tool or link below
function toolSquare(p, shot) {
  const size = p.title.length > 34 ? 58 : 68;
  return shell(`
<div style="position:absolute;left:72px;top:72px;width:860px">
  <span class="chip">Tool · ${STAGES[p.stage]}</span>
  <h1 class="serif" style="font-size:${size}px;line-height:1.06;margin-top:28px">${esc(p.title)}</h1>
  <div style="display:inline-block;margin-top:26px;background:#C0763F;color:#fff;font-weight:800;font-size:24px;padding:11px 22px;border-radius:999px;transform:rotate(-2deg)">Try it →</div>
</div>
<div style="position:absolute;right:60px;top:400px;bottom:170px;width:720px;display:flex;align-items:center">
<div style="width:720px;max-height:780px;background:#fff;border-radius:24px;overflow:hidden;
  box-shadow:0 24px 60px rgba(51,50,42,.22),0 0 0 1px #E4E1CE;transform:rotate(3deg)">
  <img src="data:image/png;base64,${shot}" style="width:100%;display:block">
</div></div>`, true);
}

function guideSquare(p) {
  const hook = HOOK_OVERRIDES[p.url] || hooks[p.url];
  const size = hook.length > 80 ? 56 : hook.length > 55 ? 62 : 72;
  return shell(`
<div style="position:absolute;left:72px;top:72px"><span class="chip">Guide · ${STAGES[p.stage]}</span></div>
<div style="position:absolute;left:72px;right:72px;top:160px;bottom:180px;display:flex;flex-direction:column;justify-content:center;gap:110px">
<div style="position:relative;align-self:flex-start;max-width:900px;background:#fff;border-radius:6px 34px 34px 34px;padding:34px 40px;
  box-shadow:0 14px 40px rgba(51,50,42,.14)">
  <p class="serif" style="font-size:${size}px;line-height:1.12">${esc(hook)}</p>
  <span style="position:absolute;right:28px;bottom:-24px;background:#fff;border-radius:999px;padding:7px 16px;font-size:28px;
    box-shadow:0 6px 18px rgba(51,50,42,.16);border:1px solid #E4E1CE">${GENTLE.has(p.slug) ? "💛" : p.stage === "relationships" ? "👀 💯" : "💛 🙌"}</span>
</div>
<div style="align-self:flex-end;max-width:760px;background:#6E7A3F;color:#FBF8EF;border-radius:34px 6px 34px 34px;padding:24px 32px;
  box-shadow:0 14px 40px rgba(51,50,42,.18)">
  <p style="font-size:17px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;opacity:.8">wholesomegirlies.xyz</p>
  <p style="font-size:30px;font-weight:800;line-height:1.25;margin-top:8px">${esc(p.title)}</p>
  <p style="font-size:18px;text-align:right;margin-top:6px;color:#DFDCC0">✓✓</p>
</div></div>`, true);
}

// the site-wide card, in the home page's own words
const HEADLINE = "Women's health you can trust, at every stage.";
const EYEBROW = "For African women, at home and in the diaspora";
const STICKERS = [["#6E7A3F", "#FBF8EF", -6], ["#fff", "#33322A", 5], ["#C0763F", "#fff", 3], ["#DFDCC0", "#33322A", -5], ["#fff", "#33322A", 4]];
function defaultCard(sq = false) {
  const at = sq ? [[40, 0], [400, 110], [0, 250], [420, 370], [120, 500]] : [[20, 10], [120, 120], [0, 220], [190, 320], [30, 400]];
  const stickers = Object.values(STAGES).map((name, i) => `<div style="position:absolute;left:${at[i][0]}px;top:${at[i][1]}px;transform:rotate(${STICKERS[i][2]}deg);
  background:${STICKERS[i][0]};color:${STICKERS[i][1]};font-family:'DM Serif Display',serif;font-size:${sq ? 40 : 34}px;padding:${sq ? "18px 32px" : "16px 28px"};white-space:nowrap;
  border-radius:22px;border:1px solid #E4E1CE;box-shadow:0 14px 34px rgba(51,50,42,.16)">${name}</div>`).join("");
  return shell(sq ? `
<div style="position:absolute;left:72px;top:72px;width:936px">
  <span class="chip" style="font-size:17px;white-space:nowrap">${EYEBROW}</span>
  <h1 class="serif" style="font-size:72px;line-height:1.06;margin-top:30px">${esc(HEADLINE)}</h1>
</div>
<div style="position:absolute;left:120px;top:440px;width:840px;height:640px">${stickers}</div>` : `
<div style="position:absolute;left:64px;top:62px;width:560px">
  <span class="chip" style="font-size:15px;white-space:nowrap">${EYEBROW}</span>
  <h1 class="serif" style="font-size:60px;line-height:1.06;margin-top:26px">${esc(HEADLINE)}</h1>
</div>
<div style="position:absolute;left:690px;top:70px;width:460px;height:480px">${stickers}</div>`, sq)
    // keep the two accent dots clear of the stickers
    .replace(/left:(560|890)px;top:(60|300)px/, sq ? "left:900px;top:330px" : "left:520px;top:420px")
    .replace(/left:(610|940)px;top:(112|352)px/, sq ? "left:954px;top:380px" : "left:574px;top:470px");
}

async function screenshot(page, p) {
  await page.goto(BASE + p.url, { waitUntil: "networkidle0" });
  await page.addStyleTag({ content: "#cc-main,.site-header,header,.read-progress,.wg-share-top,.wg-share,.toc-rail{display:none!important}" });
  // tick a few checklist items so a checklist looks in use, and give calculators
  // a sample date (8 weeks ago, or a birth date 10 weeks ago) so the card shows a result
  await page.evaluate(() => {
    const app = document.querySelector(".tool-app");
    if (!app) return;
    app.querySelectorAll(".checklist input[type=checkbox]").forEach((c, i) => { if (i < 3 && !c.checked) c.click(); });
    // log a few entries on trackers that log with one tap (feeds, sleeps)
    [...app.querySelectorAll("button")].filter((b) => /^\W*(feed|sleep|nappy)\b/i.test(b.textContent.trim())).forEach((b) => { b.click(); b.click(); });
    const dates = app.querySelectorAll("input[type=date]");
    if (!dates.length) return;
    const d = new Date(Date.now() - (/parenting|postpartum/.test(location.pathname) ? 70 : 56) * 864e5);
    dates.forEach((i) => { i.value = d.toISOString().slice(0, 10); i.dispatchEvent(new Event("input", { bubbles: true })); i.dispatchEvent(new Event("change", { bubbles: true })); });
    const btn = [...app.querySelectorAll("button")].find((b) => !b.hasAttribute("data-wg-print") && /show|calculate|see|get|work|track|add|save|predict/i.test(b.textContent));
    if (btn) btn.click();
  });
  await new Promise((r) => setTimeout(r, 400));
  const el = await page.$(".tool-app");
  if (!el) throw new Error("no .tool-app on " + p.url);
  const box = await el.boundingBox();
  const shot = await page.screenshot({ clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, box.width * 1.15) }, encoding: "base64" });
  return shot;
}

module.exports = { shell, esc, loadFonts, fonts: () => FONTS, screenshot, LOGO, STAGES, BASE, CHROME, OUT, SQUARE_OUT, HEADLINE, EYEBROW, STICKERS };

if (require.main === module) (async () => {
  const args = process.argv.slice(2);
  const square = !args.includes("--no-square");
  const cards = !args.includes("--square-only");
  const only = args.filter((a) => !a.startsWith("--"));
  fs.mkdirSync(OUT, { recursive: true });
  await loadFonts();
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true });
  const page = await browser.newPage();
  await page.setViewport({ width: 760, height: 1200, deviceScaleFactor: 2 });
  const card = await browser.newPage();
  const render = async (html, w, h, file, quality) => {
    await card.setViewport({ width: w, height: h, deviceScaleFactor: 1 });
    await card.setContent(html, { waitUntil: "load" });
    await card.evaluate(() => document.fonts.ready);
    await card.screenshot({ path: file, type: "jpeg", quality });
  };
  if (!only.length || only.includes("default")) {
    if (cards) await render(defaultCard(), 1200, 630, path.join(OUT, "default.jpg"), 88);
    if (square) { fs.mkdirSync(SQUARE_OUT, { recursive: true }); await render(defaultCard(true), 1080, 1350, path.join(SQUARE_OUT, "Wholesome Girlies.jpg"), 90); }
    console.log("og default", square ? "+ square" : "");
  }
  for (const p of pages().filter((x) => !only.length || only.includes(x.slug))) {
    const shot = p.kind === "tool" ? await screenshot(page, p) : null;
    if (cards) await render(shot ? toolCard(p, shot) : guideCard(p), 1200, 630, path.join(OUT, p.slug + ".jpg"), 86);
    if (square) {
      const dir = path.join(SQUARE_OUT, STAGES[p.stage]);
      fs.mkdirSync(dir, { recursive: true });
      await render(shot ? toolSquare(p, shot) : guideSquare(p), 1080, 1350, path.join(dir, p.slug + ".jpg"), 90);
    }
    console.log("og", p.slug, square ? "+ square" : "");
  }
  await browser.close();
  console.log("version for the meta tags:", OG_VERSION);
})();
