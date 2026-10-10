// Link preview looks for review: three directions for the Open Graph (OG) cards, built to match the Sticker and
// Cream carousel covers, the drawn cast and the stage guides. Nothing here writes to assets/img/og/ or
// assets/img/results/: previews go to _lab/og-preview/<look>/, which is never committed.
//
//   look a  Sticker with the stage guide: stage-tint page, the tool screen as a sticker card, the guide beside it.
//   look b  Cream with a cast scene: cream page, the stage's drawn scene in a framed postcard, no screenshot.
//   look c  The carousel cover: stage-tint page, a very large title, a speech bubble and a big guide.
//
// Run (site on :8001):
//   NODE_PATH=/tmp/wgog/node_modules node scripts/make-og.js --look a|b|c|all [slug ... | default]
//   NODE_PATH=/tmp/wgog/node_modules node scripts/make-result-cards.js --look a|b|c|all [tool ...]
// Without slugs it renders the representative review set (SAMPLE_TOOLS, default, SAMPLE_RESULTS).
// Words on the cards: no em or en dashes, never "free", "Wholesome Girlies" in full, never "WG".
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");

const ROOT = path.join(__dirname, "..");
const PREVIEW = path.join(ROOT, "_lab/og-preview");
const LOOKS = ["a", "b", "c"];
const INK = "#33322A";

// stage colours as in the carousels and styles.css: full colour, tint, and the text that sits on the colour
const STG = {
  relationships: { s: "#C0763F", t: "#F4DCCB", on: "#fff", guide: "tolu", scene: "relationships-tolu-journal.jpg", label: "Relationships" },
  fertility: { s: "#6E7A3F", t: "#E3E6CC", on: "#fff", guide: "amaka", scene: "fertility-amaka-planner.jpg", label: "Trying to conceive" },
  pregnancy: { s: "#D49A2A", t: "#F6E4BC", on: INK, guide: "zainab", scene: "pregnancy-zainab-checklist.jpg", label: "Pregnancy" },
  postpartum: { s: "#E39A7B", t: "#F8E1D6", on: INK, guide: "funmi", scene: "postpartum-funmi-planner.jpg", label: "Postpartum" },
  parenting: { s: "#6F93BF", t: "#DCE6F2", on: "#fff", guide: "funmi", scene: "parenting-funmi-reading.jpg", label: "Parenting" },
};
// tools with no cast: loss, mental health, The Wait Check-in, warning signs, safety. Cream, still life, no person.
const CAST_FREE = { "the-wait-check-in": "fertility-still-life-window.jpg", "mind-check-in": "postpartum-still-life-nursery.jpg" };
const SAMPLE_TOOLS = ["red-flag-radar", "situationship-checker", "ovulation-calculator", "period-tracker", "due-date-calculator",
  "hospital-bag-checklist", "recovery-checklist", "night-feed-rota", "baby-name-explorer", "milestone-tracker", "the-wait-check-in"];
const SAMPLE_RESULTS = [["red-flag-radar", "strict"], ["girls-girl-quiz", "pick-me"], ["is-he-husband-material", "showing-it"]];

const b64 = (f, type) => `data:${type};base64,${fs.readFileSync(f).toString("base64")}`;
const guideImg = (name) => b64(path.join(ROOT, "assets/img/cast/guides", name + ".webp"), "image/webp");
const sceneImg = (file) => b64(path.join(ROOT, "assets/img/cast", file), "image/jpeg");
const GH = { tolu: [392, 620], amaka: [255, 569], zainab: [289, 563], funmi: [293, 569] }; // guide pixel sizes
const gw = (name, h) => Math.round((GH[name][0] / GH[name][1]) * h);

const sprig = (s) => `<svg viewBox="0 0 56 56" width="52" height="52"><circle cx="28" cy="28" r="25.5" fill="${s}" stroke="${INK}" stroke-width="3"/><path d="M17 38c0-11 8-18 21-18 0 11-8 18-21 18z" fill="#FBF8EF" stroke="${INK}" stroke-width="2"/><path d="M20 37c5-6 11-10 17-12" stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round"/></svg>`;

function base(og, bg, s, body, extraCss = "") {
  return `<!doctype html><html><head><meta charset="utf-8"><style>${og.fonts()}
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;overflow:hidden;background:${bg};font-family:'Nunito Sans',sans-serif;color:${INK};position:relative}
.serif{font-family:'DM Serif Display',serif;font-weight:400;letter-spacing:-.01em}
.chip{display:inline-block;background:${s.s};color:${s.on};border:3px solid ${INK};font-weight:800;font-size:25px;letter-spacing:.06em;text-transform:uppercase;padding:9px 22px;border-radius:999px}
.stk{background:#fff;border:4px solid ${INK};box-shadow:10px 10px 0 ${INK}}
.pill{display:inline-block;background:${s.s};color:${s.on};border:4px solid ${INK};box-shadow:7px 7px 0 ${INK};font-weight:800;font-size:32px;padding:11px 30px;border-radius:999px}
.brand{position:absolute;left:64px;bottom:42px;display:flex;align-items:center;gap:16px}
.brand b{display:block;font-family:'DM Serif Display',serif;font-weight:400;font-size:36px;line-height:1}
.brand span{display:block;font-size:22px;color:#55534A;margin-top:5px;font-weight:700}
.abs{position:absolute}
${extraCss}</style></head><body>
${body}
<div class="brand">${sprig(s.s)}<div><b>Wholesome Girlies</b><span>wholesomegirlies.xyz</span></div></div>
</body></html>`;
}
const brandless = (html) => html; // reserved: a look that drops the footer would override here

const fit = (t, a, b, c) => (t.length > 34 ? c : t.length > 22 ? b : a);

// ---------- tool cards ----------
function toolCard(look, og, p, shot) {
  const s = STG[p.stage];
  const free = CAST_FREE[p.slug];
  const title = og.esc(p.title).replace(/[A-Za-z]+(?:-[A-Za-z]+)+/g, (w) => `<span style="white-space:nowrap">${w}</span>`); // hyphenated words never break
  if (look === "a") {
    const size = fit(p.title, 74, 64, 54);
    const gh = 470;
    const card = `<div class="abs stk" style="right:${free ? 150 : 215}px;top:${free ? 70 : 62}px;width:410px;max-height:${free ? 480 : 440}px;border-radius:30px;overflow:hidden;transform:rotate(2.5deg)">
      <img src="data:image/png;base64,${shot}" style="width:100%;display:block"></div>`;
    const guide = free ? "" : `<img class="abs" src="${guideImg(s.guide)}" style="right:18px;bottom:0;height:${gh}px">`;
    return base(og, free ? "#FBF8EF" : s.t, s, `
<div class="abs" style="left:64px;top:62px;width:495px"><span class="chip">${s.label}</span>
  <h1 class="serif" style="font-size:${size}px;line-height:1.04;margin-top:26px">${title}</h1>
  <div style="margin-top:34px"><span class="pill">Try it &rarr;</span></div></div>${card}${guide}`);
  }
  if (look === "b") {
    const size = fit(p.title, 74, 64, 54);
    const scene = free || s.scene;
    return base(og, "#FBF8EF", s, `
<div class="abs" style="right:-210px;top:-230px;width:640px;height:640px;border-radius:50%;background:${s.t}"></div>
<div class="abs" style="left:64px;top:70px;width:520px"><span class="chip">${s.label}</span>
  <h1 class="serif" style="font-size:${size}px;line-height:1.04;margin-top:26px">${title}</h1>
  <div style="margin-top:28px;display:inline-block;font-weight:800;font-size:34px;border-bottom:7px solid ${s.s};padding-bottom:3px">Try it &rarr;</div></div>
<div class="abs stk" style="right:56px;top:128px;width:560px;height:315px;border-radius:30px;overflow:hidden;transform:rotate(1.5deg)">
  <img src="${sceneImg(scene)}" style="width:100%;height:100%;object-fit:cover;display:block"></div>`);
  }
  // c: the carousel cover
  const size = fit(p.title, 86, 74, 62);
  const gh = 580;
  const guide = free ? "" : `<img class="abs" src="${guideImg(s.guide)}" style="right:40px;bottom:0;height:${gh}px">`;
  const still = free ? `<div class="abs stk" style="right:56px;top:140px;width:560px;height:315px;border-radius:30px;overflow:hidden;transform:rotate(1.5deg)"><img src="${sceneImg(free)}" style="width:100%;height:100%;object-fit:cover"></div>` : "";
  const bubble = free ? "" : `<div class="stk" style="display:inline-block;margin-top:26px;border-radius:30px;padding:16px 28px;font-weight:800;font-size:36px;line-height:1.2;transform:rotate(-1.5deg)">Try it on your phone.</div>`;
  return base(og, free ? "#FBF8EF" : s.t, s, `
<div class="abs" style="left:64px;top:56px;width:${free ? 560 : 600}px"><span class="chip">${s.label}</span>
  <h1 class="serif" style="font-size:${size}px;line-height:1.02;margin-top:22px">${title}</h1>${bubble}</div>${still}${guide}`)
    .replace("<div class=\"brand\">", "<div class=\"brand\" style=\"z-index:2\">");
}

// ---------- the site-wide default card ----------
function defaultCard(look, og) {
  const s = STG.fertility;
  const HEAD = og.HEADLINE, EYE = og.EYEBROW;
  if (look === "a") {
    const order = ["relationships", "fertility", "pregnancy", "postpartum", "parenting"];
    const at = [[10, 6, -5], [70, 104, 4], [0, 210, 3], [150, 316, -4], [30, 420, 5]];
    const chips = order.map((k, i) => `<div class="abs" style="left:${at[i][0]}px;top:${at[i][1]}px;transform:rotate(${at[i][2]}deg);background:${STG[k].s};color:${STG[k].on};border:4px solid ${INK};box-shadow:8px 8px 0 ${INK};border-radius:26px;font-family:'DM Serif Display',serif;font-size:40px;padding:12px 30px;white-space:nowrap">${STG[k].label}</div>`).join("");
    return base(og, "#FBF8EF", s, `
<div class="abs" style="right:-170px;top:-210px;width:560px;height:560px;border-radius:50%;background:#EAE9D2"></div>
<div class="abs" style="left:64px;top:56px;width:560px"><span class="chip" style="font-size:19px;white-space:nowrap">${og.esc(EYE)}</span>
  <h1 class="serif" style="font-size:68px;line-height:1.04;margin-top:24px">${og.esc(HEAD)}</h1></div>
<div class="abs" style="left:730px;top:100px;width:440px;height:520px">${chips}</div>`);
  }
  const guides = ["tolu", "amaka", "zainab", "funmi"];
  if (look === "b") {
    return base(og, "#FBF8EF", s, `
<div class="abs" style="right:-210px;top:-230px;width:640px;height:640px;border-radius:50%;background:#EAE9D2"></div>
<div class="abs" style="left:64px;top:62px;width:540px"><span class="chip" style="font-size:19px;white-space:nowrap">${og.esc(EYE)}</span>
  <h1 class="serif" style="font-size:68px;line-height:1.04;margin-top:24px">${og.esc(HEAD)}</h1></div>
<div class="abs stk" style="right:56px;top:150px;width:560px;height:315px;border-radius:30px;overflow:hidden;transform:rotate(1.5deg)">
  <img src="${sceneImg("parenting-funmi-tunde-play.jpg")}" style="width:100%;height:100%;object-fit:cover"></div>`);
  }
  // c: the four stage guides standing together, as on the home hero
  const gh = 372;
  const colours = ["relationships", "fertility", "pregnancy", "postpartum"];
  let x = 566;
  const row = guides.map((g, i) => { const w = gw(g, gh); const html = `<div class="abs" style="left:${x}px;bottom:0;width:${w}px"><img src="${guideImg(g)}" style="height:${gh}px;display:block"></div>`; x += w - 46; return html; }).join("");
  const dots = colours.map((k, i) => `<div style="width:30px;height:30px;border-radius:50%;background:${STG[k].s};border:3px solid ${INK}"></div>`).join("");
  return base(og, "#EFEBCF", s, `
<div class="abs" style="left:64px;top:56px;width:520px"><span class="chip" style="font-size:19px;white-space:nowrap">${og.esc(EYE)}</span>
  <h1 class="serif" style="font-size:70px;line-height:1.02;margin-top:24px">${og.esc(HEAD)}</h1></div>
${row}`);
}

// ---------- result cards ----------
function resultCard(look, og, t, r, img) {
  const s = STG[t.stage] || STG.relationships;
  const size = r.title.length > 32 ? 56 : 66;
  const copy = (w) => `<span class="chip" style="font-size:22px">${og.esc(t.name)}</span>
  <p style="margin-top:26px;font-size:24px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#9A5A28">My result</p>
  <h1 class="serif" style="font-size:${size}px;line-height:1.04;margin-top:8px">${og.esc(r.title)}</h1>
  <div style="margin-top:28px"><span class="pill" style="font-size:28px">${og.esc(t.cta)} &rarr;</span></div>`;
  if (look === "a") return base(og, s.t, s, `
<div class="abs" style="left:64px;top:54px;width:620px">${copy()}</div>
<div class="abs stk" style="right:74px;top:40px;width:380px;height:550px;border-radius:30px;overflow:hidden;transform:rotate(2.5deg)">
  <img src="${img}" style="width:100%;height:100%;object-fit:cover;object-position:center 30%;display:block"></div>`);
  if (look === "b") return base(og, "#FBF8EF", s, `
<div class="abs" style="right:-210px;top:-230px;width:640px;height:640px;border-radius:50%;background:${s.t}"></div>
<div class="abs" style="left:64px;top:54px;width:620px">${copy()}</div>
<div class="abs stk" style="right:80px;top:40px;width:370px;height:545px;border-radius:30px;overflow:hidden;transform:rotate(-2deg);border-width:4px">
  <img src="${img}" style="width:100%;height:100%;object-fit:cover;object-position:center 30%;display:block"></div>`);
  return base(og, s.t, s, `
<div class="abs" style="left:64px;top:54px;width:620px">${copy()}</div>
<div class="abs" style="right:0;top:0;width:430px;height:630px;border-left:5px solid ${INK};overflow:hidden">
  <img src="${img}" style="width:100%;height:100%;object-fit:cover;object-position:center 30%;display:block"></div>`);
}

// ---------- runners ----------
function parseLooks(args) {
  const i = args.indexOf("--look");
  if (i < 0) return null;
  const v = (args[i + 1] || "").toLowerCase();
  const looks = v === "all" ? LOOKS : v.split(",").filter((x) => LOOKS.includes(x));
  if (!looks.length) throw new Error("--look takes a, b, c or all");
  return { looks, rest: args.filter((a, j) => j !== i && j !== i + 1) };
}

async function runOg(og, args) {
  const { looks, rest } = parseLooks(args);
  const only = rest.filter((a) => !a.startsWith("--"));
  await og.loadFonts();
  const browser = await puppeteer.launch({ executablePath: og.CHROME, headless: true });
  const page = await browser.newPage();
  page.on("dialog", (d) => d.dismiss());
  await page.setRequestInterception(true);
  page.on("request", (r) => (/googletagmanager|google-analytics|doubleclick/.test(r.url()) ? r.abort() : r.continue()));
  await page.setViewport({ width: 760, height: 1200, deviceScaleFactor: 2 });
  const card = await browser.newPage();
  const render = async (html, file) => {
    await card.bringToFront();
    await card.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    await card.setContent(html, { waitUntil: "load" });
    await card.evaluate(() => document.fonts.ready);
    await card.screenshot({ path: file, type: "jpeg", quality: 90 });
  };
  const slugs = only.length ? only : ["default", ...SAMPLE_TOOLS];
  const all = og.pages();
  for (const slug of slugs) {
    if (slug === "default") {
      for (const l of looks) { fs.mkdirSync(path.join(PREVIEW, l), { recursive: true }); await render(defaultCard(l, og), path.join(PREVIEW, l, "default.jpg")); }
      console.log("preview default", looks.join(","));
      continue;
    }
    const p = all.find((x) => x.slug === slug && x.kind === "tool");
    if (!p) { console.log("skip (not a tool page):", slug); continue; }
    const shot = await og.screenshot(page, p);
    for (const l of looks) { fs.mkdirSync(path.join(PREVIEW, l), { recursive: true }); await render(toolCard(l, og, p, shot), path.join(PREVIEW, l, slug + ".jpg")); }
    console.log("preview", slug, looks.join(","));
  }
  await browser.close();
  console.log("previews in", PREVIEW, "(the real assets/img/og files are untouched)");
}

async function runResults(og, args, helpers) {
  const { looks, rest } = parseLooks(args);
  const only = rest.filter((a) => !a.startsWith("--"));
  await og.loadFonts();
  const browser = await puppeteer.launch({ executablePath: og.CHROME, headless: true });
  const page = await browser.newPage();
  const pairs = only.length ? SAMPLE_RESULTS.filter(([t]) => only.includes(t)) : SAMPLE_RESULTS;
  for (const [tool, id] of pairs) {
    const t = helpers.RESULTS[tool], r = t.results[id];
    const img = helpers.art(tool, id);
    for (const l of looks) {
      fs.mkdirSync(path.join(PREVIEW, l, "results"), { recursive: true });
      await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
      await page.setContent(resultCard(l, og, t, r, img), { waitUntil: "load" });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: path.join(PREVIEW, l, "results", `${tool}-${id}.jpg`), type: "jpeg", quality: 90 });
    }
    console.log("preview result", tool, id, looks.join(","));
  }
  await browser.close();
}


// ---------- pages that are not a tool or guide: each gets its own card, alternating look A and look C ----------
// A: stage-tint page, a cast scene on a sticker card, the stage guide. C: the carousel cover (big title, bubble, guide).
// The legal pages, 404 and offline stay on default.jpg. Diaspora sales pages reuse their Nigerian page's card.
const FOUR = ["tolu", "amaka", "zainab", "funmi"];
const PAGE_CARDS = [
  { name: "home", look: "a", home: true },
  { name: "tools", look: "c", stage: "relationships", chip: "Games and tools", title: "Play it. Send it to the group.", bubble: "Quizzes, trackers and more.", guides: ["tolu"] },
  { name: "app", look: "a", stage: "fertility", chip: "The app", title: "Wholesome Girlies on your phone", pill: "Get the app", scene: "parenting-funmi-reading.jpg", guides: ["funmi"] },
  { name: "relationships", look: "c", stage: "relationships", chip: "Relationships", title: "Is it a relationship or a situationship?", bubble: "Tools and guides for dating.", guides: ["tolu"] },
  { name: "fertility", look: "a", stage: "fertility", chip: "Trying to conceive", title: "Trying to conceive? Start with your cycle.", pill: "Start here", guides: ["amaka"] },
  { name: "pregnancy", look: "c", stage: "pregnancy", chip: "Pregnancy", title: "From your first test to your hospital bag", bubble: "Tools and guides for each week.", guides: ["zainab"] },
  { name: "postpartum", look: "a", stage: "postpartum", chip: "Postpartum", title: "What should I be doing in my first six weeks postpartum?", pill: "Start here", guides: ["funmi"] },
  { name: "parenting", look: "c", stage: "parenting", chip: "Parenting", title: "What should my baby be doing at this age?", bubble: "Tools and guides for baby.", guides: ["funmi"] },
  { name: "about", look: "a", stage: "fertility", chip: "About", title: "Women-led, and built on research and real data", pill: "Who we are", scene: "fertility-amaka-planner.jpg", guides: ["amaka"] },
  { name: "editorial-policy", look: "c", stage: "pregnancy", chip: "About", title: "Editorial policy", bubble: "How we write our pages.", guides: ["zainab"] },
  { name: "medical-policy", look: "a", stage: "postpartum", chip: "About", title: "Medical policy", pill: "How we keep it safe", guides: ["funmi"] },
  { name: "programs", look: "c", stage: "fertility", chip: "Programs", title: "Support that meets you where you are", bubble: "One for every stage.", guides: FOUR },
  { name: "wife-material-blueprint", look: "a", stage: "relationships", chip: "Relationships", title: "The Wife Material Blueprint", pill: "See the program", guides: ["tolu"] },
  { name: "trying-to-conceive-blueprint", look: "c", stage: "fertility", chip: "Trying to conceive", title: "The Trying-to-Conceive Blueprint", bubble: "See what is inside.", guides: ["amaka"] },
  { name: "first-pregnancy-plan", look: "a", stage: "pregnancy", chip: "Pregnancy", title: "The First Pregnancy Plan", pill: "See the program", guides: ["zainab"] },
  { name: "postpartum-reset", look: "c", stage: "postpartum", chip: "Postpartum", title: "The 6-Week Postpartum Reset", bubble: "See what is inside.", guides: ["funmi"] },
  { name: "first-baby-playbook", look: "a", stage: "parenting", chip: "Parenting", title: "The First Baby Playbook", pill: "See the program", guides: ["funmi"] },
  { name: "complete-motherhood-journey", look: "c", stage: "parenting", chip: "All four stages", title: "The Complete Motherhood Journey", bubble: "Four programs in one.", guides: FOUR },
];

function guideRow(names, gh, right, overlap = 46) {
  if (names.length === 1) return `<img class="abs" src="${guideImg(names[0])}" style="right:${right}px;bottom:0;height:${gh}px">`;
  const h = Math.round(gh * 0.64);
  const widths = names.map((g) => gw(g, h));
  let x = 1200 - (widths.reduce((a, b) => a + b, 0) - overlap * (names.length - 1)) - 10;
  return names.map((g, i) => { const html = `<div class="abs" style="left:${x}px;bottom:0"><img src="${guideImg(g)}" style="height:${h}px;display:block"></div>`; x += widths[i] - overlap; return html; }).join("");
}

function pageCard(og, spec) {
  if (spec.home) return defaultCard("a", og);
  const s = STG[spec.stage];
  const title = og.esc(spec.title).replace(/[A-Za-z0-9]+(?:-[A-Za-z0-9]+)+/g, (w) => `<span style="white-space:nowrap">${w}</span>`);
  const multi = spec.guides.length > 1;
  if (spec.look === "a") {
    const size = spec.title.length > 40 ? 50 : spec.title.length > 26 ? 58 : 70;
    const scene = sceneImg(spec.scene || s.scene);
    return base(og, s.t, s, `
<div class="abs" style="left:64px;top:60px;width:470px"><span class="chip">${spec.chip}</span>
  <h1 class="serif" style="font-size:${size}px;line-height:1.04;margin-top:26px">${title}</h1>
  <div style="margin-top:30px"><span class="pill">${og.esc(spec.pill)} &rarr;</span></div></div>
<div class="abs stk" style="right:${multi ? 70 : 262}px;top:70px;width:380px;height:214px;border-radius:30px;overflow:hidden;transform:rotate(2deg)">
  <img src="${scene}" style="width:100%;height:100%;object-fit:cover;display:block"></div>
${guideRow(spec.guides, 440, 18)}`);
  }
  const size = multi ? (spec.title.length > 26 ? 62 : 74) : spec.title.length > 40 ? 62 : spec.title.length > 26 ? 74 : 86;
  const bubble = `<div class="stk" style="display:inline-block;margin-top:26px;border-radius:30px;padding:16px 28px;font-weight:800;font-size:34px;line-height:1.2;transform:rotate(-1.5deg)">${og.esc(spec.bubble)}</div>`;
  return base(og, s.t, s, `
<div class="abs" style="left:64px;top:56px;width:${multi ? 540 : 600}px"><span class="chip">${spec.chip}</span>
  <h1 class="serif" style="font-size:${size}px;line-height:1.02;margin-top:22px">${title}</h1>${bubble}</div>
${guideRow(spec.guides, 540, 40)}`);
}

// ---------- result cards, look B, for real runs ----------
function statusCardB(og, t, r, img) {
  const s = STG[t.stage] || STG.relationships;
  const size = r.title.length > 32 ? 76 : 88;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${og.fonts()}
*{box-sizing:border-box;margin:0}
body{width:1080px;height:1920px;overflow:hidden;background:#FBF8EF;font-family:'Nunito Sans',sans-serif;color:${INK};position:relative}
.serif{font-family:'DM Serif Display',serif;font-weight:400;letter-spacing:-.01em}
.abs{position:absolute}
</style></head><body>
<div class="abs" style="width:760px;height:760px;border-radius:50%;right:-300px;top:-300px;background:${s.t}"></div>
<div class="abs" style="left:80px;top:130px;width:920px">
  <span style="display:inline-block;background:${s.s};color:${s.on};border:4px solid ${INK};font-weight:800;font-size:30px;letter-spacing:.06em;text-transform:uppercase;padding:12px 28px;border-radius:999px">${og.esc(t.name)}</span>
  <p style="margin-top:44px;font-size:32px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#9A5A28">My result</p>
  <h1 class="serif" style="font-size:${size}px;line-height:1.05;margin-top:14px">${og.esc(r.title)}</h1>
</div>
<div class="abs" style="left:110px;top:${r.title.length > 32 ? 560 : 520}px;width:860px;height:1060px;border-radius:44px;overflow:hidden;transform:rotate(-2deg);background:#fff;border:7px solid ${INK};box-shadow:18px 18px 0 ${INK}">
  <img src="${img}" style="width:100%;height:100%;object-fit:cover;object-position:center 35%;display:block"></div>
<div class="abs" style="left:80px;right:80px;bottom:90px;display:flex;align-items:center;justify-content:space-between">
  <div style="display:flex;align-items:center;gap:20px">${sprig(s.s).replace('width="52" height="52"', 'width="72" height="72"')}
    <div><b class="serif" style="font-size:44px;font-weight:400;display:block;line-height:1">Wholesome Girlies</b>
    <span style="display:block;font-size:28px;color:#55534A;margin-top:6px;font-weight:700">wholesomegirlies.xyz</span></div></div>
  <div style="background:${s.s};color:${s.on};border:5px solid ${INK};box-shadow:9px 9px 0 ${INK};font-weight:800;font-size:32px;padding:16px 32px;border-radius:999px">${og.esc(t.cta)} &rarr;</div>
</div></body></html>`;
}

function nameCardB(og, nm, img, helpers) {
  const s = STG.parenting;
  const meaning = helpers.meaningLine(nm.m);
  return base(og, "#FBF8EF", s, `
<div class="abs" style="right:-210px;top:-230px;width:640px;height:640px;border-radius:50%;background:${s.t}"></div>
<div class="abs" style="left:64px;top:54px;width:620px"><span class="chip" style="font-size:22px">${og.esc(helpers.originLine(nm.o))}</span>
  <h1 class="serif" style="font-size:${nm.n.length > 9 ? 72 : 84}px;line-height:1.04;margin-top:26px">Meet ${og.esc(nm.n)}.</h1>
  <p class="serif" style="font-size:${meaning.length > 40 ? 34 : 44}px;line-height:1.16;margin-top:14px;color:#55602F">${og.esc(meaning)}</p>
  <div style="margin-top:26px"><span class="pill" style="font-size:28px">Find a name &rarr;</span></div></div>
<div class="abs stk" style="right:80px;top:40px;width:370px;height:545px;border-radius:30px;overflow:hidden;transform:rotate(-2deg)">
  <img src="${img}" style="width:100%;height:100%;object-fit:cover;object-position:center 30%;display:block"></div>`);
}

async function runPages(og, args) {
  const only = args.filter((a) => !a.startsWith("--"));
  await og.loadFonts();
  const browser = await puppeteer.launch({ executablePath: og.CHROME, headless: true });
  const page = await browser.newPage();
  for (const spec of PAGE_CARDS.filter((x) => !only.length || only.includes(x.name))) {
    await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
    await page.setContent(pageCard(og, spec), { waitUntil: "load" });
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: path.join(og.OUT, spec.name + ".jpg"), type: "jpeg", quality: 88 });
    console.log("og page", spec.name, "look", spec.look);
  }
  await browser.close();
}

module.exports = { runPages, PAGE_CARDS, pageCard, statusCardB, nameCardB, runOg, runResults, parseLooks, toolCard, defaultCard, resultCard, STG, SAMPLE_TOOLS, SAMPLE_RESULTS, PREVIEW };
