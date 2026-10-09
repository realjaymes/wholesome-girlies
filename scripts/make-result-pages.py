#!/usr/bin/env python3
"""Result pages and the result share script, from scripts/results.json.

For every result type it writes /<stage>/tools/<tool>/result/<result>.html: a small noindex page whose
link preview is that result's card, so a result link pasted into WhatsApp or X shows the result.
The page never carries anyone's answers. It shows the cast scene, the result, and a button to take
the tool. It also writes assets/js/wg-result.js, which the tool pages call with wgShowResult(type)
to show the "Share your result" row and the "Save for your Status" button.

It also writes a naming page for every name in the Baby Name Explorer, at
/parenting/tools/baby-name-explorer/result/<name>.html, for the Naming Ceremony Card. That page carries only the name,
its meaning and its origin: never a birth date, weight, place of birth or photo.

Run after scripts/make-result-cards.js:  python3 scripts/make-result-pages.py
Header and footer are copied from the tool page, so they stay in step with the site.
"""
import html
import json
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SITE = "https://wholesomegirlies.xyz"
RESULT_VERSION = "20261008a"
ART = {"ready-for-love-quiz": "ready-for-love", "green-red-flags-checker": "flags", "situationship-checker": "situationship",
       "red-flag-radar": "radar", "is-he-husband-material": "husband"}
ALT = {
    "ready-for-love-grounded": "Illustration of Tolu walking down a sunny Lagos street",
    "ready-for-love-close": "Illustration of Tolu writing in her journal while Kemi gives her a thumbs up",
    "ready-for-love-pour-into-you": "Illustration of Tolu on the sofa with tea and a face mask, phone face down",
    "flags-healthy": "Illustration of Tolu and Femi laughing at a table while Kemi gives a thumbs up",
    "flags-watch": "Illustration of Tolu giving Femi a side-eye as he checks his phone on a date",
    "flags-red-outweighs": "Illustration of Kemi holding up a small red flag while Tolu side-eyes her phone",
    "flags-mixed": "Illustration of Tolu holding a green flag and a red flag while Kemi thinks",
    "situationship-going-somewhere": "Illustration of Femi taking a proud selfie with Tolu",
    "situationship-undefined": "Illustration of Tolu waiting on a reply while Kemi eats popcorn",
    "situationship-choose-you": "Illustration of Tolu walking away in sunglasses while Kemi cheers by the car",
    "radar-sharp": "Illustration of Tolu with her arms folded beside a green, a sand and a red flag sorted into pots while Kemi applauds",
    "radar-soft": "Illustration of Tolu handing Femi a bunch of green flags while a red flag pokes out of his pocket and Kemi laughs",
    "radar-strict": "Illustration of Kemi blowing a whistle and raising a red flag at Femi, who is holding flowers, while Tolu laughs",
    "radar-warming-up": "Illustration of Tolu squinting through binoculars while Kemi adjusts the focus for her",
    "husband-showing-it": "Illustration of Femi carrying Aunty Bisi's handbag and cooler at a family party while Tolu smiles",
    "husband-promising": "Illustration of Tolu asking Femi a question across a cafe table while he thinks it over",
    "husband-not-yet": "Illustration of Tolu and Kemi walking off arm in arm while Femi plays on his phone on a bench",
    "naming-ceremony": "Illustration of Tunde holding up the new baby at a naming ceremony while Funmi smiles and Aunty Bisi cheers",
}
NAME_TOOL = "baby-name-explorer"
NAME_VERSION = "20261008a"
data = json.load(open(os.path.join(ROOT, "scripts/results.json")))
e = lambda s: html.escape(s, quote=True)


def share_text(t, r):
    return t["share"].replace("{title}", r["title"].rstrip("."))


def page(tool, t, rid, r, art=None, title=None, eyebrow=None, lead=None, desc=None, card=None, share=None):
    src = open(os.path.join(ROOT, t["stage"], "tools", tool + ".html")).read()
    head = src[: src.index("<title>")]
    styles = re.findall(r'<link rel="(?:preconnect|stylesheet|icon|apple-touch-icon)"[^>]*>', src)
    body_top = src[src.index("<body>") : src.index("</header>") + len("</header>")]
    footer = src[src.index('<footer class="site-footer">') : src.index("</footer>") + len("</footer>")]
    tail = "\n".join(l for l in re.findall(r"<script [^>]*src=[^>]*></script>", src[src.index("</footer>") :])
                     if "cookieconsent" in l or "wg-consent" in l)
    path = f"/{t['stage']}/tools/{tool}/result/{rid}"
    title = title or f"My {t['name']} result: {r['title']}"
    card = card or f"{SITE}/assets/img/results/{tool}/{rid}.jpg?v={RESULT_VERSION}"
    art = art or f"{ART[tool]}-{rid}"
    desc = desc or f"What would yours say? Take the {t['name']} on Wholesome Girlies."
    eyebrow = eyebrow or f"A shared result · {t['name']}"
    lead = lead or f"Someone shared their result from the {t['name']}. It takes a couple of minutes, and what you answer stays on your phone."
    share = share or share_text(t, r)
    stage = t["stage"].capitalize()
    return f"""{head}<title>{e(title)} | Wholesome Girlies</title>
<meta name="robots" content="noindex, nofollow">
<meta name="description" content="{e(r['title'])} {e(desc)}">
<link rel="canonical" href="{SITE}{path}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Wholesome Girlies">
<meta property="og:title" content="{e(title)}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:url" content="{SITE}{path}">
<meta property="og:image" content="{card}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:site" content="@wgirlieshq">
<meta name="twitter:title" content="{e(title)}">
<meta name="twitter:description" content="{e(desc)}">
<meta name="twitter:image" content="{card}">
{chr(10).join(styles)}
<style>
  .shared-result {{ text-align: center; }}
  .shared-result img {{ width: 86%; max-width: 340px; height: auto; border-radius: 24px; box-shadow: var(--shadow); border: 6px solid #fff; transform: rotate(-2deg); }}
  .shared-result .lead {{ margin: 26px auto 18px; max-width: 46ch; }}
  .shared-result .sub {{ font-weight: 800; margin: 30px 0 10px; color: var(--terracotta-dark); }}
</style>
</head>
{body_top}

<main>
<section class="tool-hero">
  <div class="wrap narrow">
    <div class="breadcrumb"><a href="/">Home</a> / <a href="/{t['stage']}/">{stage}</a> / <a href="/{t['stage']}/tools/{tool}">{e(t['name'])}</a></div>
    <p class="eyebrow">{e(eyebrow)}</p>
    <h1>{e(r['title'])}</h1>
    <p class="muted">{e(r['summary'])}</p>
  </div>
</section>

<section>
  <div class="wrap narrow shared-result">
    <img src="/assets/img/cast/results/{art}.jpg" width="800" height="1200" alt="{e(ALT[art])}">
    <p class="lead">{e(lead)}</p>
    <a class="btn btn-primary" href="/{t['stage']}/tools/{tool}?ref=result">{e(t['cta'])} &rarr;</a>
    <p class="sub">Pass it on</p>
    <div class="wg-share" data-share-id="{tool}:{rid}" data-share-surface="result-page" data-share-path="{path}" data-share-text="{e(share)}" data-share-align="center"></div>
    <p class="muted" style="margin-top:28px;font-size:.9rem;">{e(t.get("note", "This is a reflection tool. It runs in your browser, and nothing anyone answers is saved or sent."))}</p>
  </div>
</section>
</main>

{footer}

<script src="/assets/js/wg-share.js?v=20261007a" defer></script>
{tail}
</body>
</html>
"""


JS = """// Share a quiz or checker result. Written by scripts/make-result-pages.py from scripts/results.json; do not edit by hand.
// Tool pages call wgShowResult("<result>") after scoring (or wgShowResult(null) to hide it), and carry an
// empty <div id="wg-result-share"></div> inside the result panel. The share link points at the result page,
// /<stage>/tools/<tool>/result/<result>, whose link preview is the result card. Her answers never leave the page.
(function () {
  var DATA = __DATA__;
  var V = "__V__";
  function tool() { var m = location.pathname.match(/\\/tools\\/([^\\/?#.]+)/); return m && m[1]; }
  function push(ev, id) { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ event: ev, share_item: id, share_surface: "result" }); }
  window.wgShowResult = function (type) {
    var box = document.getElementById("wg-result-share"), t = DATA[tool()];
    if (!box || !t) return;
    var r = type && t.results[type];
    box.innerHTML = "";
    box.hidden = !r;
    if (!r) return;
    var id = tool() + ":" + type, img = "/assets/img/results/" + tool() + "/" + type + "-status.jpg?v=" + V;
    box.innerHTML = '<p class="sub">Share your result</p><div class="wg-share" data-share-size="sm"></div>' +
      '<p style="margin:12px 0 0;"><a class="btn btn-ghost" style="background:#fff;" href="' + img + '" download="wholesome-girlies-' + type + '.jpg">Save for your Status</a></p>' +
      '<p class="muted" style="font-size:.85rem;margin:8px 0 0;">The link and the picture show your result only, never your answers.</p>';
    var s = box.querySelector(".wg-share");
    s.setAttribute("data-share-id", id);
    s.setAttribute("data-share-surface", "result");
    s.setAttribute("data-share-path", t.path + "/result/" + type);
    s.setAttribute("data-share-text", t.share.replace("{title}", r.title.replace(/\\.$/, "")));
    if (window.wgShareInit) window.wgShareInit();
    box.querySelector("a[download]").addEventListener("click", function (e) {
      push("result_save", id);
      if (!(navigator.canShare && /Android|iPhone|iPad/i.test(navigator.userAgent))) return;
      e.preventDefault();
      fetch(img).then(function (res) { return res.blob(); }).then(function (b) {
        var f = new File([b], "wholesome-girlies-" + type + ".jpg", { type: "image/jpeg" });
        if (navigator.canShare({ files: [f] })) return navigator.share({ files: [f] });
        location.href = img;
      }).catch(function () {});
    });
  };
})();
"""

out = {}
for tool, t in data.items():
    out[tool] = {"path": f"/{t['stage']}/tools/{tool}", "share": t["share"],
                 "results": {k: {"title": v["title"]} for k, v in t["results"].items()}}
    d = os.path.join(ROOT, t["stage"], "tools", tool, "result")
    os.makedirs(d, exist_ok=True)
    for rid, r in t["results"].items():
        open(os.path.join(d, rid + ".html"), "w").write(page(tool, t, rid, r))
        print("result page", f"/{t['stage']}/tools/{tool}/result/{rid}")
# Naming Ceremony Card pages, one per name in the Baby Name Explorer (same rules as make-result-cards.js)
src = open(os.path.join(ROOT, "parenting/tools", NAME_TOOL + ".html")).read()
names = re.findall(r'\{n:"([^"]+)",g:"(\w)",o:"([^"]+)",m:"([^"]+)"\}', src)
nt = {"stage": "parenting", "name": "Baby Name Explorer", "cta": "Find a name",
      "note": "Meanings differ by family. A name can carry a different meaning in another town or family, so ask the elders in yours."}
d = os.path.join(ROOT, "parenting/tools", NAME_TOOL, "result")
os.makedirs(d, exist_ok=True)
for n, g, o, m in names:
    slug = re.sub(r"[^a-z]+", "-", n.lower()).strip("-")
    meaning = f"It comes {m}." if m.startswith("from ") else f"It means {m}."
    origin = f"{'An' if o[0] in 'AEIOU' else 'A'} {o} name."
    r = {"title": f"Meet {n}.", "summary": f"{meaning} {origin}"}
    open(os.path.join(d, slug + ".html"), "w").write(page(
        NAME_TOOL, nt, slug, r, art="naming-ceremony", title=f"Meet {n}",
        eyebrow="A naming card · Baby Name Explorer",
        lead="Someone shared this name from the Baby Name Explorer. Search Yoruba, Igbo, Hausa and other names by what they mean.",
        desc=f"{meaning} {origin} Find a name and what it means on Wholesome Girlies.",
        card=f"{SITE}/assets/img/results/{NAME_TOOL}/{slug}.jpg?v={NAME_VERSION}",
        share=f"Meet {n}! {meaning} 💛 Look up what Yoruba, Igbo, Hausa and other names mean on Wholesome Girlies."))
print("naming pages", len(names))

open(os.path.join(ROOT, "assets/js/wg-result.js"), "w").write(
    JS.replace("__DATA__", json.dumps(out, ensure_ascii=False)).replace("__V__", RESULT_VERSION))
print("wrote assets/js/wg-result.js")
