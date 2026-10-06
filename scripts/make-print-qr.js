// Builds the static QR codes printed at the foot of each printable tool.
// Each code points back to the tool with ?ref=print so printed sheets show up in GA4.
//
// Run:  npm install --prefix /tmp/wgqr qrcode@1
//       NODE_PATH=/tmp/wgqr/node_modules node scripts/make-print-qr.js
// Output: assets/img/qr/<tool-slug>.svg (commit these; the site never generates QR codes live)
// Add a tool here whenever a new tool gets a print button.

const fs = require("fs");
const path = require("path");
const QRCode = require("qrcode");

const SITE = "https://wholesomegirlies.xyz";
const TOOLS = [
  "fertility/tools/fertility-appointment-questions",
  "parenting/tools/paediatric-visit-questions",
  "postpartum/tools/check-up-questions",
  "postpartum/tools/night-feed-rota",
  "postpartum/tools/partner-support-planner",
  "pregnancy/tools/antenatal-appointment-questions",
  "pregnancy/tools/baby-essentials-checklist",
  "pregnancy/tools/birth-plan-builder",
  "relationships/tools/standards-non-negotiables-worksheet",
];

const outDir = path.join(__dirname, "..", "assets", "img", "qr");
fs.mkdirSync(outDir, { recursive: true });

(async () => {
  for (const tool of TOOLS) {
    const url = `${SITE}/${tool}?ref=print`;
    const svg = await QRCode.toString(url, {
      type: "svg",
      errorCorrectionLevel: "M",
      margin: 1,
      color: { dark: "#33322A", light: "#FFFFFF" },
    });
    const slug = tool.split("/").pop();
    fs.writeFileSync(path.join(outDir, `${slug}.svg`), svg);
    console.log(`${slug}.svg -> ${url}`);
  }
})();
