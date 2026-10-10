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
RESULT_VERSION = "20261010b"
ART = {"ready-for-love-quiz": "ready-for-love", "green-red-flags-checker": "flags", "situationship-checker": "situationship",
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
       "which-nigerian-parent": "which-nigerian-parent"}
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
    "girls-girl-certified": "Illustration of Tolu cheering for Kemi with a little megaphone at Kemi's market table",
    "girls-girl-ride-or-die": "Illustration of Kemi in sunglasses guarding Tolu like a bodyguard while Tolu smiles behind her",
    "girls-girl-lowkey": "Illustration of Tolu passing Kemi a cup of tea on the sofa",
    "girls-girl-own-time": "Illustration of Tolu rushing in with flowers and a gift while Kemi laughs and opens her arms",
    "girls-girl-pick-me": "Illustration of Tolu laughing at Femi's joke at a café table while Kemi stands behind them holding the bill and a bag, one eyebrow raised",
    "3am-group-chat-card": "Illustration of Funmi on a sofa at night with her baby asleep on her shoulder while Kemi laughs on a video call",
    "delulu-or-clear-eyed-certified-delulu": "Illustration of Tolu laughing at her phone on her bed beside a notebook of hearts while Kemi watches from the doorway",
    "delulu-or-clear-eyed-hopeful": "Illustration of Tolu at a window with her phone in her hand and a hopeful half smile",
    "delulu-or-clear-eyed-clear-eyed": "Illustration of Tolu sitting upright at a table with a cup of tea and her phone face down",
    "delulu-or-clear-eyed-case-closed": "Illustration of Tolu closing a laptop and putting her phone in her bag while Kemi gives a thumbs up",
    "how-do-you-love-reassurer": "Illustration of Tolu texting on a sofa while Kemi reads over her shoulder and laughs",
    "how-do-you-love-space-keeper": "Illustration of Tolu reading by a sunny window with a cup of tea, a bunch of flowers on the table beside her",
    "how-do-you-love-steady-one": "Illustration of Tolu writing in a planner at a neat desk with a wall calendar behind her",
    "how-do-you-love-all-in": "Illustration of Tolu carrying a big gift box and balloons through a door while Kemi laughs behind her",
    "how-well-do-you-know-me-back-of-my-hand": "Illustration of Funmi and Tunde laughing together on a sofa over her phone",
    "how-well-do-you-know-me-well-with-surprises": "Illustration of Tunde looking pleasantly surprised at Funmi's phone while she grins",
    "how-well-do-you-know-me-half-and-half": "Illustration of Funmi and Tunde sitting close with a phone each, comparing answers with raised eyebrows",
    "how-well-do-you-know-me-ask-more": "Illustration of Tunde scratching his head with a smile while Funmi laughs and points at the phone",
    "milestone-guess-spot-on": "Illustration of Funmi on the floor with her baby sitting up on a mat between her knees",
    "milestone-guess-close": "Illustration of Funmi and Tunde kneeling beside a baby on a play mat while Tunde points and Funmi laughs",
    "milestone-guess-own-clock": "Illustration of Funmi sitting on a play mat with her phone, watching her baby reach for a toy",
    "mum-wrapped-night-shift-legend": "Illustration of Funmi walking a quiet hallway at night with a sleeping baby on her shoulder",
    "mum-wrapped-milk-bar-manager": "Illustration of Funmi feeding her baby in an armchair with a phone propped beside her and a plate of snacks",
    "mum-wrapped-visitor-hostess": "Illustration of Funmi handing a cup of water to Aunty Bisi and Mama Ngozi, who sit on the sofa cooing at the baby",
    "mum-wrapped-cold-tea-queen": "Illustration of Funmi holding her baby and looking fondly at a steaming mug of tea she has not reached yet",
    "mum-wrapped-one-tap-at-a-time": "Illustration of Funmi on the bed with her baby, thumb on her phone, smiling at the baby",
    "new-parent-bingo-just-landed": "Illustration of Funmi in a nursery doorway holding a sleeping baby and a half-folded bib",
    "new-parent-bingo-a-few-nights-in": "Illustration of Funmi and Tunde on a sofa in lamplight with a baby between them, laughing quietly over a phone",
    "new-parent-bingo-deep-in-it": "Illustration of Funmi walking a living room at night with a baby on her shoulder while Tunde holds up a phone",
    "new-parent-bingo-full-bingo": "Illustration of Funmi and Tunde holding a baby in front of a fridge with a ticked grid pinned to it",
    "old-wives-tales-baby-sharp": "Illustration of Funmi holding her baby on her shoulder in a bright room with her phone in her other hand",
    "old-wives-tales-baby-half": "Illustration of Funmi and Aunty Bisi laughing at Funmi's phone at a table with a baby between them",
    "old-wives-tales-baby-raised": "Illustration of Funmi holding her baby and smiling while Mama Ngozi tells a story with her hands",
    "old-wives-tales-pregnancy-sharp": "Illustration of Zainab on a sofa with her phone while Aunty Bisi holds up a finger mid-story",
    "old-wives-tales-pregnancy-half": "Illustration of Zainab and Aunty Bisi leaning over one phone, Zainab laughing and Aunty Bisi raising an eyebrow",
    "old-wives-tales-pregnancy-raised": "Illustration of Mama Ngozi telling a story with her hands while Zainab listens with a fond smile",
    "omugwo-your-mum-or-his-mum-team-my-mum": "Illustration of Funmi on a sofa with her baby while Mama Ngozi stands behind her holding a bowl of food and Tunde smiles nearby",
    "omugwo-your-mum-or-his-mum-team-his-mum": "Illustration of Funmi on a sofa with her baby while Aunty Bisi hands her a warm drink and Tunde sits beside them",
    "omugwo-your-mum-or-his-mum-team-both": "Illustration of Funmi on a sofa between Mama Ngozi and Aunty Bisi, all three smiling at the baby",
    "omugwo-your-mum-or-his-mum-team-just-us": "Illustration of Funmi and Tunde relaxing on a sofa with their baby and two gift bags by the door",
    "pregnancy-cravings-tier-list-street": "Illustration of Zainab on a bench by a roadside grill holding a suya wrap while Kemi laughs beside her with roasted corn",
    "pregnancy-cravings-tier-list-sweet": "Illustration of Kemi holding a plate of puff-puff and a glass of chapman while Zainab reaches for one",
    "pregnancy-cravings-tier-list-pot": "Illustration of Zainab at a family table with a plate of jollof rice while Mama Ngozi serves her a second spoon",
    "pregnancy-cravings-tier-list-mixed": "Illustration of Zainab at a kitchen counter pointing playfully at a mango, a plate of puff-puff and a bowl of pepper soup",
    "put-a-finger-down-dating-none-left": "Illustration of Tolu and Kemi laughing on a bed with their phones, Tolu's hands open and empty",
    "put-a-finger-down-dating-last-fingers": "Illustration of Tolu holding up one finger at a restaurant table while Kemi and Amaka lean in laughing",
    "put-a-finger-down-dating-half-a-hand": "Illustration of Tolu holding up five fingers and counting with Kemi on a balcony with drinks",
    "put-a-finger-down-dating-mostly-up": "Illustration of Tolu raising her hand with her fingers up while Femi and Kemi laugh at a phone",
    "put-a-finger-down-dating-all-up": "Illustration of Tolu in front of a mirror with all ten fingers lifted and a bright smile",
    "visitors-bingo-first-guests": "Illustration of Funmi on a sofa holding a baby and looking at the front door with a small smile",
    "visitors-bingo-a-few-visits-in": "Illustration of Funmi holding a baby and a cup of tea while Aunty Bisi leans in and talks",
    "visitors-bingo-open-house": "Illustration of a crowded living room where Aunty Bisi, Mama Ngozi and a neighbour all talk at once around Funmi and her baby",
    "visitors-bingo-full-house": "Illustration of Funmi in a doorway holding a baby while Aunty Bisi, Mama Ngozi and Kemi arrive with food bowls and gift bags",
    "what-kind-of-mum-planner": "Illustration of Zainab at a tidy table ticking items off a checklist with a notebook and a cup of tea",
    "what-kind-of-mum-soft-life": "Illustration of Zainab in an armchair with her feet up and a book, one hand on her belly",
    "what-kind-of-mum-hype": "Illustration of Zainab laughing at a baby shower while Amaka and Kemi cheer and hold up their phones",
    "what-kind-of-mum-naija-strict": "Illustration of Zainab holding a clipboard in a neat living room with a small bag packed by the door",
    "which-nigerian-parent-remote-control": "Illustration of Funmi holding the TV remote to her chest with a mock-serious look while Tunde laughs with his hands up",
    "which-nigerian-parent-ask-your-father": "Illustration of Funmi pointing playfully at Tunde, who looks up from his phone with wide eyes, while a child waits beside them",
    "which-nigerian-parent-long-speech": "Illustration of Funmi on the sofa with a child, one finger raised and an open book in her lap",
    "which-nigerian-parent-soft-landing": "Illustration of Funmi hugging a laughing child in the kitchen and handing over a bowl of noodles while Tunde smiles in the doorway",
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
    <p class="muted" style="margin-top:28px;font-size:.9rem;">{e(t.get("note", "This is a reflection tool. It runs on this device, and nothing anyone answers is saved or sent."))}</p>
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
