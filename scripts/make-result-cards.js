// Result cards for the quizzes and checkers, one set per result type in scripts/results.json.
// Each result gets two images from its cast scene (assets/img/cast/results/<art>.jpg):
//   assets/img/results/<tool>/<result>.jpg         1200x630 link preview for the result page
//   assets/img/results/<tool>/<result>-status.jpg  1080x1920 card she saves for WhatsApp Status or Stories
// It also renders the Naming Ceremony Card link preview for every name in the Baby Name Explorer:
//   assets/img/results/baby-name-explorer/<name>.jpg  1200x630, "Meet <name>. It means <meaning>." with the naming scene
// (the explorer draws that card's 1080x1920 Status version in the browser, so 136 tall images are not stored).
// The words come from results.json and are set in the layout, never drawn by the AI.
//
//   npm install --prefix /tmp/wgog puppeteer-core@23
//   NODE_PATH=/tmp/wgog/node_modules node scripts/make-result-cards.js [tool ...]
// Look B is the live look (scripts/og-looks.js); --look a|b|c|all renders review previews into _lab/og-preview/.
// After a re-render, bump RESULT_VERSION in scripts/make-result-pages.py.
const fs = require("fs");
const path = require("path");
const puppeteer = require("puppeteer-core");
const og = require("./make-og.js");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "assets/img/results");
const RESULTS = JSON.parse(fs.readFileSync(path.join(__dirname, "results.json"), "utf8"));
const ART = { "ready-for-love-quiz": "ready-for-love", "green-red-flags-checker": "flags", "situationship-checker": "situationship",
  "red-flag-radar": "radar", "is-he-husband-material": "husband", "girls-girl-quiz": "girls-girl",
  "3am-group-chat": "3am-group-chat",
  "delulu-or-clear-eyed": "delulu-or-clear-eyed",
  "how-do-you-love": "how-do-you-love",
  "how-well-do-you-know-me": "how-well-do-you-know-me",
  "milestone-guess": "milestone-guess",
  "mum-wrapped": "mum-wrapped",
  "new-parent-bingo": "new-parent-bingo",
  "old-wives-tales-baby": "old-wives-tales-baby",
  "old-wives-tales-pregnancy": "old-wives-tales-pregnancy",
  "omugwo-your-mum-or-his-mum": "omugwo-your-mum-or-his-mum",
  "pregnancy-cravings-tier-list": "pregnancy-cravings-tier-list",
  "put-a-finger-down-dating": "put-a-finger-down-dating",
  "visitors-bingo": "visitors-bingo",
  "what-kind-of-mum": "what-kind-of-mum",
  "which-nigerian-parent": "which-nigerian-parent" };
const art = (tool, id) => "data:image/jpeg;base64," + fs.readFileSync(path.join(ROOT, "assets/img/cast/results", `${ART[tool]}-${id}.jpg`)).toString("base64");

// Look B (cream, tint circle, ink-outlined sticker frame) from scripts/og-looks.js, for the link preview and the Status card.
const looks = require("./og-looks.js");
const ogCard = (t, r, img) => looks.resultCard("b", og, t, r, img);

// The names, read from the Baby Name Explorer's NAMES list, so a new name gets its card on the next run.
function readNames() {
  const src = fs.readFileSync(path.join(ROOT, "parenting/tools/baby-name-explorer.html"), "utf8");
  return [...src.matchAll(/\{n:"([^"]+)",g:"(\w)",o:"([^"]+)",m:"([^"]+)"\}/g)].map((m) => ({ n: m[1], o: m[3], m: m[4] }));
}
const nameSlug = (n) => n.toLowerCase().replace(/[^a-z]+/g, "-").replace(/^-|-$/g, "");
const meaningLine = (m) => (/^from /.test(m) ? `It comes ${m}.` : `It means ${m}.`);
const originLine = (o) => `${/^[AEIOU]/.test(o) ? "An" : "A"} ${o} name`;

const nameCard = (nm, img) => looks.nameCardB(og, nm, img, { meaningLine, originLine });

const statusCard = (t, r, img) => looks.statusCardB(og, t, r, img);

if (require.main === module) (async () => {
  // --look a|b|c|all: render the design options for review into _lab/og-preview/<look>/results/, never over assets/img/results/
  if (process.argv.includes("--look")) { await og.loadFonts(); return require("./og-looks.js").runResults(og, process.argv.slice(2), { RESULTS, art }); }
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
  if (!only.length || only.includes("baby-name-explorer")) {
    const dir = path.join(OUT, "baby-name-explorer");
    fs.mkdirSync(dir, { recursive: true });
    const img = "data:image/jpeg;base64," + fs.readFileSync(path.join(ROOT, "assets/img/cast/results/naming-ceremony.jpg")).toString("base64");
    for (const nm of readNames()) await render(nameCard(nm, img), 1200, 630, path.join(dir, `${nameSlug(nm.n)}.jpg`), 80);
    console.log("naming cards", readNames().length);
  }
  await browser.close();
})();

module.exports = { readNames, nameSlug, meaningLine, originLine };
