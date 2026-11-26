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
// A paid fertility buyer, signed in on her phone: her account and name (Amaka, the fertility guide in the picture), her
// program flag, 7 of 32 lessons read, a cycle date and a 12 day streak with its days filled in. Dates are set
// relative to the day of the run, so the app home always reads "Lesson 8 of 32 is next" and "12 days in a row".
const BUYER = () => {
  const day = (d) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);
  const read = ["welcome", "everything-in-one-place", "your-safety-first", "you-are-not-alone-come-inside-first",
    "your-cycle-in-plain-words", "your-fertile-window", "how-to-tell-you-have-ovulated"];
  return {
    wg_acct_skip_v1: "1",
    wg_session_v1: "media-kit-sample",
    wg_account_v1: { v: 1, at: Date.now(), saved: [], account: { email: "amaka@example.com", name: "Amaka",
      programs: [{ slug: "trying-to-conceive-blueprint", home: "/programs/trying-to-conceive-blueprint/thank-you" }] } },
    wg_name_v1: { v: 1, name: "Amaka", asked: true },
    wg_app_welcomed: "1",
    wg_fertility_home: { u: "/programs/trying-to-conceive-blueprint/thank-you", l: "Conception home" },
    "wg_read_trying-to-conceive-blueprint": { done: Object.fromEntries(read.map((i) => [i, 1])), last: read[read.length - 1] },
    wg_stage_fertility_v1: { v: 1, lmp: day(-10), cycle: 28, starts: [day(-38), day(-10)] },
    wg_streak_v1: { v: 1, count: 12, best: 12, last_day: day(-1), rest_used_week: null, milestones: [3, 7] },
    wg_streak_ui_v1: { v: 1, first: day(-12), days: Array.from({ length: 12 }, (_, i) => day(i - 12)), stage: "fertility" },
  };
};

const TOOLS = {
  "period-tracker": {
    name: "Period Tracker",
    url: "/fertility/tools/period-tracker", stage: "fertility",
    head: "Know when your next period is due",
    sub: "Your next three periods and your fertile days, worked out on your phone.",
    fill: { dates: { lmp: 18 }, click: "Predict my next periods", scrollTo: "#res" },
  },
  "ovulation-calculator": {
    name: "Ovulation Calculator",
    url: "/fertility/tools/ovulation-calculator", stage: "fertility",
    head: "See your most fertile days",
    sub: "Your fertile window and likely ovulation day, from the first day of your last period.",
    fill: { dates: { lmp: 9 }, click: "Show my fertile window", scrollTo: "#res" },
  },
  "due-date-calculator": {
    name: "Due Date Calculator",
    url: "/pregnancy/tools/due-date-calculator", stage: "pregnancy",
    head: "Find your due date",
    sub: "Your due date and how far along you are, from the first day of your last period.",
    fill: { dates: { lmp: 100 }, click: "Show my due date", scrollTo: "#res" },
  },
  "recovery-timeline-calculator": {
    name: "Recovery Timeline Calculator",
    url: "/postpartum/tools/recovery-timeline-calculator", stage: "postpartum",
    head: "Your recovery after birth, week by week",
    sub: "What to expect in the weeks after delivery, from the day your baby was born.",
    fill: { dates: { dd: 20 }, click: "Show my timeline", scrollTo: "#res" },
  },
  "vaccination-tracker": {
    name: "Vaccination Tracker",
    url: "/parenting/tools/vaccination-tracker", stage: "parenting",
    head: "Your baby's vaccines on Nigeria's schedule",
    sub: "Enter your baby's date of birth to see what is due, and tick off each one.",
    fill: { dates: { dob: 70 }, ticks: { sel: "#list input[type=checkbox]", n: 2 }, scrollTo: "#list" },
  },
  "app": {
    name: "Wholesome Girlies",
    url: "/app/", stage: "fertility",
    head: "Wholesome Girlies on your phone",
    sub: "Tools and guides for relationships, fertility, pregnancy and life after birth.",
    fill: { top: true, storage: BUYER() }, // the app home of a woman who bought the Trying-to-Conceive Blueprint
  },
  "mind-check-in": {
    name: "Postpartum Mind Check-in",
    url: "/postpartum/tools/mind-check-in", stage: "postpartum", guide: false,
    head: "A private check-in after birth",
    sub: "Five questions to reflect on each week, and where to find help.",
    fill: { scrollTo: ".tool-app" },
  },
  "girls-girl-quiz": {
    name: "Are You a Girl's Girl",
    url: "/relationships/tools/girls-girl-quiz", stage: "relationships",
    head: "Are you a girl's girl?",
    sub: "A quick quiz to play, then send to your friends.",
    fill: { radios: { sel: "#scenarios .rq", picks: [[0, 0], [1, 1]] }, scrollTo: ".tool-app" },
  },
};

const SIZES = { tall: [1080, 1920], wide: [1600, 900], square: [1080, 1080] };
const b64 = (f, type) => `data:${type};base64,${fs.readFileSync(f).toString("base64")}`;
const guideImg = (name) => b64(path.join(ROOT, "assets/img/cast/guides", name + ".webp"), "image/webp");
const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const sprig = (s, w = 56) => `<svg viewBox="0 0 56 56" width="${w}" height="${w}"><circle cx="28" cy="28" r="25.5" fill="${s}" stroke="${INK}" stroke-width="3"/><path d="M17 38c0-11 8-18 21-18 0 11-8 18-21 18z" fill="#FBF8EF" stroke="${INK}" stroke-width="2"/><path d="M20 37c5-6 11-10 17-12" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;

// The tool as it looks in the installed app on an iPhone, sample data in, scrolled to the result.
async function phoneScreen(page, t) {
  await page.goto(og.BASE + t.url + "?preview=installed", { waitUntil: "networkidle2", timeout: 60000 });
  if (t.fill.storage) { // a first-open sheet would cover the screen: mark it seen, then open the page again
    await page.evaluate((kv) => Object.entries(kv).forEach(([k, v]) => localStorage.setItem(k, typeof v === "string" ? v : JSON.stringify(v))), t.fill.storage);
    await page.goto(og.BASE + t.url + "?preview=installed", { waitUntil: "networkidle2", timeout: 60000 });
  }
  await new Promise((r) => setTimeout(r, 800));
  await page.addStyleTag({ content: "html{scroll-behavior:auto!important}#cc-main,.wg-app-bar,#appNotice,.wg-install-bar,.wg-resume,.wgs-toast,[class^=wgs-sheet],.wgn-offer,.program-cta{display:none!important}" });
  await page.evaluate(async (f) => {
    for (const [id, daysAgo] of Object.entries(f.dates || {})) {
      const i = document.getElementById(id);
      i.value = new Date(Date.now() - daysAgo * 864e5).toISOString().slice(0, 10);
      i.dispatchEvent(new Event("input", { bubbles: true }));
      i.dispatchEvent(new Event("change", { bubbles: true }));
    }
    if (f.click) {
      const b = [...document.querySelectorAll(".tool-app button")].find((x) => x.textContent.trim().startsWith(f.click));
      if (b) b.click();
    }
    if (f.ticks) {
      await new Promise((r) => setTimeout(r, 400));
      [...document.querySelectorAll(f.ticks.sel)].slice(0, f.ticks.n).forEach((c) => { if (!c.checked) c.click(); });
    }
    for (const [q, a] of (f.radios ? f.radios.picks : [])) {
      document.querySelectorAll(f.radios.sel)[q].querySelectorAll("input[type=radio]")[a].click();
      await new Promise((r) => setTimeout(r, 700));
    }
  }, t.fill);
  await new Promise((r) => setTimeout(r, 900));
  // the result, scrolled up under the sticky header, the way she sees it after pressing the button
  if (!t.fill.top) await page.evaluate((sel) => {
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
  const [W, H] = SIZES[size], s = STG[t.stage], sticker = look === "a", guide = look !== "b" && t.guide !== false;
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

// ---------- the press page's files (/press/) ----------
// --site: from the finished set, a JPG of every image (the download) and a small WebP preview, in assets/img/press/.
// --extras: the logo pack (icon 1024px, wordmark in ink and in cream, transparent) and the fact sheet PDF.
const PRESS = path.join(ROOT, "assets/img/press");
const finalName = (k, z) => `${TOOLS[k].name === "Wholesome Girlies" ? "Wholesome Girlies home" : "Wholesome Girlies " + TOOLS[k].name} ${z}.png`;
function siteAssets() {
  const { execFileSync } = require("child_process");
  fs.mkdirSync(path.join(PRESS, "thumb"), { recursive: true });
  for (const k of Object.keys(TOOLS)) for (const z of Object.keys(SIZES)) {
    const src = path.join(FINAL, "Tool screenshots", finalName(k, z));
    if (!fs.existsSync(src)) throw new Error("render the finished set first (--final c): missing " + src);
    execFileSync("magick", [src, "-quality", "88", path.join(PRESS, `${k}-${z}.jpg`)]);
    execFileSync("magick", [src, "-resize", z === "wide" ? "640x" : "360x", "-quality", "80", path.join(PRESS, "thumb", `${k}-${z}.webp`)]);
  }
  console.log("press images written to", path.relative(ROOT, PRESS));
}

const WORDMARK = (ink, leaf) => `<!doctype html><html><head><meta charset="utf-8"><style>${og.fonts()}*{margin:0}body{background:transparent}
.m{display:inline-flex;align-items:center;gap:56px;padding:40px}.m b{font-family:'DM Serif Display',serif;font-weight:400;font-size:230px;line-height:1;color:${ink}}</style></head>
<body><div class="m"><svg viewBox="0 0 56 56" width="300" height="300"><circle cx="28" cy="28" r="27" fill="#6E7A3F"/><path d="M18 38c0-11 8-18 20-18 0 11-8 18-20 18z" fill="${leaf}"/><path d="M20 37c5-6 11-10 17-12" stroke="#6E7A3F" stroke-width="1.9" fill="none" stroke-linecap="round"/></svg><b>Wholesome Girlies</b></div></body></html>`;

// The fact sheet: every line from the funding boilerplate (vault WG Company Boilerplate) or the live site.
const FACT_SHEET = (o) => `<!doctype html><html><head><meta charset="utf-8"><style>${og.fonts()}
@page{size:A4;margin:0}*{box-sizing:border-box;margin:0}body{font-family:'Nunito Sans',sans-serif;color:${INK};font-size:12.5px;line-height:1.5;padding:46px 52px;background:#FBF8EF;width:210mm;min-height:297mm}
h1{font-family:'DM Serif Display',serif;font-weight:400;font-size:34px;line-height:1.1;margin-top:18px}h2{font-family:'DM Serif Display',serif;font-weight:400;font-size:19px;margin:18px 0 6px}
p{margin:0 0 8px}ul{margin:0 0 8px 18px;padding:0}li{margin:0 0 4px}.top{display:flex;align-items:center;gap:12px;font-family:'DM Serif Display',serif;font-size:22px}
.cols{display:grid;grid-template-columns:1fr 1fr;gap:6px 26px}.small{font-size:11px;color:#55534A}a{color:${INK}}</style></head><body>
<div class="top">${sprig("#6E7A3F", 40)}Wholesome Girlies</div>
<h1>Fact sheet</h1>
<p style="font-size:14px;margin-top:10px">Wholesome Girlies is a health app and community that helps women through the hardest stretches of reproductive life: relationships, fertility, pregnancy and postpartum. It is built for African women at home and in the diaspora, starting in Nigeria.</p>
<h2>Why it exists</h2>
<p>James Praise and his wife built Wholesome Girlies because Nigerian women meet the same problems at every stage: too few specialists to ask, warning signs that are hard to read, and care after birth that is often overlooked. Wholesome Girlies gives women the tools, resources and research-backed guidance to close that information gap at each stage. Every woman who uses it learns what to ask, what to watch out for, and when to go to hospital.</p>
<h2>What is live</h2>
<div class="cols"><ul>
<li><b>Relationships:</b> games and checklists such as <a href="https://wholesomegirlies.xyz/relationships/tools/girls-girl-quiz">Are You a Girl's Girl?</a> and the <a href="https://wholesomegirlies.xyz/relationships/tools/green-red-flags-checker">Green and Red Flags Checker</a>.</li>
<li><b>Trying to conceive:</b> the <a href="https://wholesomegirlies.xyz/fertility/tools/period-tracker">Period Tracker</a> and the <a href="https://wholesomegirlies.xyz/fertility/tools/ovulation-calculator">Ovulation and Fertile Window Calculator</a>.</li>
<li><b>Pregnancy:</b> the <a href="https://wholesomegirlies.xyz/pregnancy/tools/due-date-calculator">Due Date Calculator</a> and the <a href="https://wholesomegirlies.xyz/pregnancy/tools/week-by-week-tracker">Week-by-Week Tracker</a>.</li></ul><ul>
<li><b>After birth:</b> the <a href="https://wholesomegirlies.xyz/postpartum/tools/recovery-timeline-calculator">Recovery Timeline Calculator</a> and the <a href="https://wholesomegirlies.xyz/postpartum/tools/mind-check-in">Postpartum Mind Check-in</a>.</li>
<li><b>Parenting:</b> the <a href="https://wholesomegirlies.xyz/parenting/tools/vaccination-tracker">Vaccination Tracker</a>, on Nigeria's childhood immunisation schedule.</li>
<li><b>Visit question lists</b> for <a href="https://wholesomegirlies.xyz/pregnancy/tools/antenatal-appointment-questions">antenatal</a>, <a href="https://wholesomegirlies.xyz/fertility/tools/fertility-appointment-questions">fertility</a>, <a href="https://wholesomegirlies.xyz/postpartum/tools/check-up-questions">six-week</a> and <a href="https://wholesomegirlies.xyz/parenting/tools/paediatric-visit-questions">children's clinic</a> appointments.</li></ul></div>
<p>It opens in the phone's browser and can be added to the home screen with no app store download. Once added, the tools keep working without data.</p>
<h2>How women's data is handled</h2>
<p>What a woman types into a tool stays on her phone, and we never collect it. An account is optional and keeps only her stage, her progress and the tools she saved. She can switch off advertising and analytics at any time, or ask us to delete her account. We do not sell health data, and our code is public, so anyone can check this.</p>
<h2>Company</h2>
<p>Wholesome Girlies Media Limited, incorporated in Nigeria in July 2026. Founder: James Praise, founder and researcher.</p>
<h2>Images, logos and contact</h2>
<p>Images of every tool in three sizes, logos and founder photos: <a href="https://wholesomegirlies.xyz/press/">wholesomegirlies.xyz/press</a>. Please credit "Image: Wholesome Girlies".</p>
<p>${o.contact}</p>
<p class="small">Educational content, not medical advice. Our health pages are built on published research and are not yet reviewed by a clinician.</p>
</body></html>`;

async function extras(browser) {
  fs.mkdirSync(PRESS, { recursive: true });
  const pg = await browser.newPage();
  await pg.setViewport({ width: 1024, height: 1024, deviceScaleFactor: 1 });
  await pg.setContent(`<html><body style="margin:0;background:transparent">${fs.readFileSync(path.join(ROOT, "assets/img/favicon.svg"), "utf8").replace(/width="56" height="56"/, 'width="1024" height="1024"')}</body></html>`);
  await pg.screenshot({ path: path.join(PRESS, "wholesome-girlies-icon.png"), omitBackground: true, clip: { x: 0, y: 0, width: 1024, height: 1024 } });
  for (const [file, ink, leaf] of [["wholesome-girlies-wordmark-ink.png", INK, "#FBF8EF"], ["wholesome-girlies-wordmark-cream.png", "#FBF8EF", "#FBF8EF"]]) {
    await pg.setViewport({ width: 2600, height: 400, deviceScaleFactor: 1 });
    await pg.setContent(WORDMARK(ink, leaf), { waitUntil: "load" });
    await pg.evaluate(() => document.fonts.ready);
    const el = await pg.$(".m");
    await el.screenshot({ path: path.join(PRESS, file), omitBackground: true });
  }
  await pg.setContent(FACT_SHEET({ contact: process.env.WG_PRESS_CONTACT || "For an interview with our founder James Praise, data or other image sizes, email hello@wholesomegirlies.xyz." }), { waitUntil: "load" });
  await pg.evaluate(() => document.fonts.ready);
  await pg.pdf({ path: path.join(PRESS, "wholesome-girlies-fact-sheet.pdf"), format: "A4", printBackground: true });
  console.log("logos and fact sheet written to", path.relative(ROOT, PRESS));
}

(async () => {
  const args = process.argv.slice(2);
  if (args.includes("--site")) return siteAssets();
  if (args.includes("--extras")) {
    await og.loadFonts();
    const b = await puppeteer.launch({ executablePath: og.CHROME, headless: true });
    await extras(b);
    return b.close();
  }
  const final = args.includes("--final");
  const lookArg = args[args.indexOf(final ? "--final" : "--look") + 1] || "all";
  const looks = lookArg === "all" ? ["a", "b", "c"] : [lookArg];
  const flagged = new Set([args.indexOf("--look") + 1, args.indexOf("--final") + 1]);
  const only = args.filter((a, i) => !a.startsWith("--") && !flagged.has(i));
  const tools = Object.keys(TOOLS).filter((k) => !only.length || only.includes(k));
  const out = final ? FINAL : LAB;
  fs.mkdirSync(final ? path.join(out, "Tool screenshots") : out, { recursive: true });
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
      const file = final ? path.join(out, "Tool screenshots", finalName(k, z)) : path.join(out, `${l}-${k}-${z}.png`);
      await card.screenshot({ path: file, type: "png" });
      console.log("media kit", path.basename(file));
    }
  }
  if (!final) fs.writeFileSync(path.join(out, "index.html"), labIndex(looks, tools));
  await browser.close();
})();
