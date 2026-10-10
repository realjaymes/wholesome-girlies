#!/usr/bin/env python3
"""Checks every page against the site's standing rules, so nothing slips as pages are added.

Run from anywhere:  python3 scripts/check-pages.py
The deploy workflow runs it before publishing; a failure stops the deploy and lists what to fix.
The rules are written out in CLAUDE.md, grouped the same way as the sections below.

Two kinds of check:
- Hard rules hold on every page today. Any violation fails.
- Ratchet rules have known backlogs (for example "free" in older copy). Today's count per page is
  frozen in scripts/check-baseline.json. A page fails only if it gets worse, or a new page breaks
  the rule. After fixing pages, run with --update-baseline to lock in the lower counts.
"""
import glob
import html
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
SITE = "https://wholesomegirlies.xyz"
BASELINE = "scripts/check-baseline.json"

problems = []
warnings = []


def fail(page, msg):
    problems.append(f"{page}: {msg}")


def warn(page, msg):
    warnings.append(f"{page}: {msg}")


def read(p):
    with open(p, encoding="utf-8") as f:
        return f.read()


# ---------- page inventory ----------

MOCKUPS = {"branding-options.html", "logo-options.html"}
PAGES = sorted(p for p in glob.glob("**/*.html", recursive=True) if not p.startswith((".", "node_modules", "_lab")))
SRC = {p: read(p) for p in PAGES}


def kind(p):
    if p in MOCKUPS:
        return "MOCKUP"
    if p == "404.html":
        return "404"
    if p.startswith("go/"):
        return "GO"
    if re.match(r"programs/[^/]+/thank-you\.html$", p):
        return "TY"
    if re.match(r"programs/[^/]+/read\.html$", p):
        return "READER"
    if re.match(r"programs/[^/]+-diaspora\.html$", p):
        return "PROG-D"
    if re.match(r"programs/[^/]+\.html$", p) and p != "programs/index.html":
        return "PROG"
    if re.search(r"/tools/[^/]+/result/[^/]+\.html$", p):
        return "RESULT"
    if "/guides/" in p:
        return "GUIDE"
    if "/tools/" in p:
        return "TOOL"
    if p.startswith("legal/"):
        return "LEGAL"
    if p.startswith("about/"):
        return "ABOUT"
    if p == "index.html":
        return "HOME"
    if p in ("app/index.html", "offline.html"):
        return "APP"
    return "HUB"


KIND = {p: kind(p) for p in PAGES}
NOINDEX_KINDS = {"GO", "TY", "READER", "PROG-D", "404", "MOCKUP", "RESULT", "APP"}
INDEXABLE = [p for p in PAGES if KIND[p] not in NOINDEX_KINDS]
RESOURCES = [p for p in PAGES if KIND[p] in ("TOOL", "GUIDE") or "/games/" in p or p.startswith("games/")]


def url_of(p):
    if p == "index.html":
        return SITE + "/"
    if p.endswith("/index.html"):
        return SITE + "/" + p[: -len("index.html")]
    return SITE + "/" + p[:-5]


def resolves(path):
    """Does a site path like /pregnancy/tools/x or /assets/a.css exist as GitHub Pages would serve it."""
    path = path.split("#")[0].split("?")[0]
    if not path.startswith("/"):
        return True
    rel = path.lstrip("/")
    if rel == "":
        return os.path.exists("index.html")
    if rel.endswith("/"):
        return os.path.exists(rel + "index.html")
    return os.path.exists(rel) or os.path.exists(rel + ".html") or os.path.exists(rel + "/index.html")


def head(s):
    i = s.find("</head>")
    return s[:i] if i != -1 else s


def visible(s):
    """Text a visitor or a link preview sees: body text, <title>, and meta descriptions."""
    t = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>", " ", s, flags=re.S | re.I)
    t = re.sub(r"<!--.*?-->", " ", t, flags=re.S)
    metas = " ".join(re.findall(r'<meta (?:name|property)="(?:description|og:title|og:description|twitter:title|twitter:description)" content="([^"]*)"', s))
    t = re.sub(r"<[^>]+>", " ", t)
    return html.unescape(t + " " + metas)


def ld_types(s):
    types = set()
    for block in re.findall(r'<script type="application/ld\+json">(.*?)</script>', s, flags=re.S):
        try:
            data = json.loads(block)
        except ValueError:
            return None
        stack = [data]
        while stack:
            x = stack.pop()
            if isinstance(x, dict):
                t = x.get("@type")
                types.update(t if isinstance(t, list) else [t] if t else [])
                stack.extend(x.values())
            elif isinstance(x, list):
                stack.extend(x)
    return types


# ---------- 1. Analytics and tracking ----------

for p in PAGES:
    if KIND[p] == "MOCKUP":
        continue
    s = SRC[p]
    if "googletagmanager.com/gtm.js" not in head(s) or "GTM-KW443M88" not in head(s):
        fail(p, "GTM container GTM-KW443M88 is missing from <head>")
    b = s.find("<body")
    if "ns.html?id=GTM-KW443M88" not in s[b : b + 700]:
        fail(p, "GTM noscript iframe must come right after <body>")
    if "checkout-intent.js" in s:
        h = head(s)
        idq, cd = h.find("__idq"), h.find("consent-defaults.js")
        if idq == -1 or (cd != -1 and idq > cd):
            fail(p, "loads checkout-intent.js, so the identity clean-up script (__idq) must be the first script in <head>")

TAG_BANS = [r"googletagmanager\.com/gtag/js", r"gtag\(\s*['\"](?:config|event|js)", r"fbq\(\s*['\"]init", r"ttq\.load", r"InitiateCheckout", r"['\"]Purchase['\"]"]
for p in PAGES + glob.glob("assets/js/*.js"):
    s = SRC.get(p) or read(p)
    for pat in TAG_BANS:
        if re.search(pat, s):
            fail(p, f"tags load only through GTM, and Selar owns checkout events (found {pat})")

SELAR_SLUGS = {"tryingtoconceiveblueprint", "firstpregnancyplan", "postpartumreset", "firstbabyplaybook", "wifematerialblueprint", "completemotherhoodjourney"}
for p in PAGES:
    for href in re.findall(r'href="(https://selar\.com/[^"]*)"', SRC[p]):
        slug = re.match(r"https://selar\.com/([^?/]+)", href).group(1)
        if slug not in SELAR_SLUGS:
            fail(p, f"Selar link uses an unknown product slug: {slug}")
        diaspora = "-diaspora" in p
        if ("currency=USD" in href) != diaspora:
            fail(p, "Selar links carry currency=USD on diaspora pages only")

# ---------- 2. Consent and privacy ----------

CONSENT_ASSETS = ["cookieconsent.css", "wg-consent.css", "cookieconsent.umd.js", "wg-consent.js"]
for p in PAGES:
    if KIND[p] == "MOCKUP":
        continue
    s = SRC[p]
    h = head(s)
    cd, gtm = h.find("consent-defaults.js"), h.find("googletagmanager.com/gtm.js")
    if cd == -1 or (gtm != -1 and cd > gtm):
        fail(p, "consent-defaults.js must load in <head> before the GTM snippet")
    for a in CONSENT_ASSETS:
        if a not in s:
            fail(p, f"consent banner asset missing: {a}")
    if 'data-cc="show-preferencesModal"' not in s:
        fail(p, 'footer is missing the "Privacy choices" link')

for p in PAGES + glob.glob("assets/js/*.js"):
    s = SRC.get(p) or read(p)
    keys = re.findall(r"(?:localStorage|sessionStorage)\.setItem\(\s*['\"]([^'\"]+)", s)
    keys += re.findall(r"\b\w*KEY\w*\s*=\s*['\"]([^'\"]+)['\"]", s)
    for k in keys:
        if not k.startswith("wg_"):
            fail(p, f"browser storage key '{k}' must start with wg_ (the consent guard covers wg_ keys only)")

# ---------- 3. SEO ----------

sitemap = read("sitemap.xml")
locs = re.findall(r"<loc>([^<]+)</loc>", sitemap)
if len(locs) != len(set(locs)):
    fail("sitemap.xml", "duplicate URLs")
if sitemap.count("<lastmod>") != len(locs):
    fail("sitemap.xml", "every URL needs a <lastmod>")
for loc in locs:
    if loc.endswith(".html") or not loc.startswith(SITE):
        fail("sitemap.xml", f"use clean URLs on {SITE}: {loc}")
    elif not resolves(loc[len(SITE):]):
        fail("sitemap.xml", f"URL does not resolve to a page: {loc}")
robots = read("robots.txt")
if re.search(r"^\s*Disallow", robots, flags=re.M):
    fail("robots.txt", "no Disallow lines: they stop Google reading the noindex on /go/ and thank-you pages")
if f"Sitemap: {SITE}/sitemap.xml" not in robots:
    fail("robots.txt", "missing the Sitemap line")

for p in PAGES:
    s, k = SRC[p], KIND[p]
    u = url_of(p)
    if k in NOINDEX_KINDS:
        if '<meta name="robots" content="noindex, nofollow">' not in s:
            fail(p, 'must carry <meta name="robots" content="noindex, nofollow">')
        if u in locs:
            fail(p, "noindex page must not be in sitemap.xml")
        continue
    m = re.search(r'<link rel="canonical" href="([^"]+)"', s)
    if not m or m.group(1) != u:
        fail(p, f"canonical must be its own clean URL ({u})")
    if u not in locs:
        fail(p, "indexable page missing from sitemap.xml (wg_release.py adds pages on release day)")
    for prop in ["og:type", "og:site_name", "og:title", "og:description", "og:url", "og:image"]:
        if f'property="{prop}"' not in s:
            fail(p, f"missing {prop}")
    for name in ["twitter:card", "twitter:title", "twitter:description", "twitter:image"]:
        if f'name="{name}"' not in s:
            fail(p, f"missing {name}")
    og = re.search(r'property="og:url" content="([^"]+)"', s)
    if og and og.group(1) != u:
        fail(p, "og:url must equal the canonical URL")
    img = re.search(r'property="og:image" content="([^"]+)"', s)
    if img and (not img.group(1).startswith(SITE) or not resolves(img.group(1)[len(SITE):].split("?")[0])):
        fail(p, "og:image must be an absolute URL to a file that exists")
    for f in ["favicon.svg", "favicon-32.png", "apple-touch-icon.png"]:
        if f not in s:
            fail(p, f"favicon link missing: {f}")

LD_REQUIRED = {
    "GUIDE": {"FAQPage", "BreadcrumbList"},  # plus Article or MedicalWebPage, checked below
    "TOOL": {"SoftwareApplication", "BreadcrumbList"},
    "PROG": {"Product", "FAQPage", "BreadcrumbList"},
    "PROG-D": {"FAQPage", "BreadcrumbList"},  # noindex, so no Product rich result needed
    "HOME": {"Organization", "WebSite"},
}
for p in PAGES:
    if KIND[p] == "MOCKUP":
        continue
    s = SRC[p]
    types = ld_types(s)
    if types is None:
        fail(p, "a JSON-LD block does not parse")
    else:
        missing = LD_REQUIRED.get(KIND[p], set()) - types
        if KIND[p] == "GUIDE" and not types & {"Article", "MedicalWebPage"}:
            missing = missing | {"Article or MedicalWebPage"}
        if missing:
            fail(p, f"schema missing: {', '.join(sorted(missing))}")
    if len(re.findall(r"<h1[\s>]", s)) != 1:
        fail(p, "needs exactly one <h1>")
    for tag in re.findall(r"<img\b[^>]*>", s):
        if "alt=" not in tag:
            fail(p, "every <img> needs alt text")
    for tag in re.findall(r"<a\b[^>]*target=\"_blank\"[^>]*>", s):
        if "noopener" not in tag:
            fail(p, 'links opening a new tab need rel="noopener"')
    for ref in re.findall(r'(?:href|src)="(/[^"/][^"]*|/)"', s):
        if not resolves(ref):
            fail(p, f"internal link or asset does not resolve: {ref}")

for p in PAGES:
    if KIND[p] not in ("TOOL", "GUIDE"):
        continue
    stage = p.split("/")[0]
    path = "/" + p[:-5]
    if f'href="{path}"' not in SRC.get(f"{stage}/index.html", ""):
        fail(p, f"not carded on its stage index ({stage}/index.html): nothing ships unlinked")
    if KIND[p] == "TOOL" and f'href="{path}"' not in SRC.get("tools/index.html", ""):
        fail(p, "tool not carded on /tools/")

# Tool <-> guide cross-links. Header, footer and head links do not count, only the page body.
def _body(s):
    return re.sub(r"<head>.*?</head>|<header.*?</header>|<footer.*?</footer>", "", s, flags=re.S)


# Tools that have no written guide to link, on purpose. Keep this list short: a new tool links a guide in its stage.
NO_GUIDE = {
    # No guide in the parenting stage covers home safety, so there is nothing relevant to link.
    "parenting/tools/babyproofing-safety-checklist.html",
    # No guide in the parenting stage covers paediatric visits, so there is nothing relevant to link.
    "parenting/tools/paediatric-visit-questions.html",
}
_guide_links = {}  # tool page -> guide pages that link it
_tool_guides = {}  # tool page -> guide paths in its stage that it links
for p in PAGES:
    if KIND[p] not in ("TOOL", "GUIDE") or p.endswith("index.html"):
        continue
    links = set(re.findall(r'href="(/[a-z]+/(?:tools|guides)/[a-z0-9-]+)(?:[?#"])', _body(SRC[p])))
    if KIND[p] == "GUIDE":
        for l in links:
            if "/tools/" in l and (l[1:] + ".html") in SRC:
                _guide_links.setdefault(l[1:] + ".html", []).append(p)
    else:
        _tool_guides[p] = {l for l in links if "/guides/" in l and l.startswith("/" + p.split("/")[0] + "/")}
for tool, guides in sorted(_guide_links.items()):
    if KIND.get(tool) != "TOOL":
        continue
    back = set(re.findall(r'href="(/[a-z]+/guides/[a-z0-9-]+)', _body(SRC[tool])))
    for g in guides:
        if "/" + g[:-5] not in back:
            fail(tool, f"guide {g[:-5]} links this tool but the tool does not link back")
for tool, gs in sorted(_tool_guides.items()):
    if not gs and tool not in NO_GUIDE:
        fail(tool, "links no guide in its stage: add a guide card to its Related block, or list it in NO_GUIDE with a reason")

# Result cards: every quiz or checker result type has its images, its result page, and the tool wires them up.
if os.path.exists("scripts/results.json"):
    for tool, t in json.load(open("scripts/results.json")).items():
        page = f"{t['stage']}/tools/{tool}.html"
        if page not in SRC:
            fail("scripts/results.json", f"{tool}: tool page {page} does not exist yet, so its result cards cannot be checked")
            continue
        for rid in t.get("results", {}):
            for img in (f"{rid}.jpg", f"{rid}-status.jpg"):
                if not os.path.exists(f"assets/img/results/{tool}/{img}"):
                    fail(page, f"result {rid}: assets/img/results/{tool}/{img} is missing: run node scripts/make-result-cards.js {tool}")
            rp = f"{t['stage']}/tools/{tool}/result/{rid}.html"
            if rp not in SRC:
                fail(page, f"result {rid}: result page {rp} is missing: run python3 scripts/make-result-pages.py")
        # The call can sit in the page or in the game engine it loads (wg-pair.js, wg-chatcard.js, wg-tierlist.js).
        _engines = [m for m in re.findall(r'src="/assets/js/(wg-[a-z-]+\.js)', SRC[page]) if m not in ("wg-result.js", "wg-app.js")]
        if "wgShowResult" not in SRC[page] and not any("wgShowResult" in read("assets/js/" + e) for e in _engines):
            fail(page, "quiz or checker must call wgShowResult(type) after scoring")
        if 'id="wg-result-share"' not in SRC[page]:
            fail(page, 'quiz or checker must carry id="wg-result-share" in its result panel')

# The app home: a line in APP_PROGRAMS for every program, and two game cards that point at real games or quizzes.
if os.path.exists("app/index.html") and os.path.exists("assets/data/program-homes.json"):
    _app_src = SRC["app/index.html"]
    _m = re.search(r"var APP_PROGRAMS = \{(.*?)\};", _app_src, flags=re.S)
    _prog_lines = _m.group(1) if _m else ""
    # One line per stage, for the Nigerian program. Diaspora homes share it and the Complete Motherhood Journey spans four stages.
    for slug in json.load(open("assets/data/program-homes.json"))["homes"]:
        if slug.endswith("-diaspora") or slug == "complete-motherhood-journey":
            continue
        if f"'{slug}'" not in _prog_lines:
            fail("app/index.html", f"program {slug} has no line in APP_PROGRAMS")
    _gm = re.search(r'id="appGames".*?<div class="grid[^>]*>(.*?)</div>\s*</div>', _app_src, flags=re.S)
    _cards = re.findall(r'<a class="card" href="(/[^"]+)"', _gm.group(1)) if _gm else []
    _tools_idx = SRC.get("tools/index.html", "")
    if len(_cards) != 2:
        fail("app/index.html", f'"Games to play and send to a friend" must hold exactly two cards, found {len(_cards)}')
    for href in _cards:
        _tag = re.search(r'href="' + re.escape(href) + r'"[^>]*><span class="tag">([^<]*)', _tools_idx)
        if (href[1:] + ".html") not in SRC:
            fail("app/index.html", f"game card {href} does not match a tool page")
        elif not _tag or _tag.group(1) not in ("Game", "Quiz"):
            fail("app/index.html", f"game card {href} must be a tool tagged Game or Quiz on /tools/")
    # James picks the two top games (CLAUDE.md section 10). Change this list only when he picks others.
    APP_TOP_GAMES = ["/relationships/tools/girls-girl-quiz", "/relationships/tools/is-he-husband-material"]
    if _cards and _cards != APP_TOP_GAMES:
        fail("app/index.html", f"the app's games must be {', '.join(APP_TOP_GAMES)} in that order, found {', '.join(_cards)}")

# Games lead every tool list (CLAUDE.md section 9): on the homepage Tools grid no tool card comes before a
# game card. A game is a tool tagged Game or Quiz on /tools/. Program reels are sorted by build-tool-reels.py.
if "index.html" in SRC and "tools/index.html" in SRC:
    _games = {h for h, t in re.findall(r'<a[^>]*href="(/[a-z]+/tools/[^"#?]+)"[^>]*>\s*<span class="tag">([^<]*)', SRC["tools/index.html"]) if t.strip() in ("Game", "Quiz")}
    _grid = re.search(r'id="toolGrid">(.*?)\n    </div>', SRC["index.html"], flags=re.S)
    _seen_tool = None
    for href in re.findall(r'<a class="card tool-item" href="([^"]+)"', _grid.group(1) if _grid else ""):
        if href in _games and _seen_tool:
            fail("index.html", f"Tools section: game {href} sits after the tool {_seen_tool}; games come first")
        elif href not in _games:
            _seen_tool = _seen_tool or href

for line in read("llms.txt").splitlines():
    for u in re.findall(r"https://wholesomegirlies\.xyz(/[^\s)>\]]*)", line):
        if not resolves(u):
            fail("llms.txt", f"URL does not resolve: {u}")

if re.search(r"hreflang", "".join(SRC.values())):
    fail("site", "no hreflang: the site is single-language")

# brand profiles: the footer row, the X card handle, and the home page sameAs list the same five
PROFILES = ["https://www.facebook.com/wholesomegirlies", "https://www.instagram.com/wholesomegirlieshq",
            "https://www.tiktok.com/@wholesomegirlies", "https://x.com/wgirlieshq",
            "https://www.linkedin.com/company/wholesomegirlies"]
for p in PAGES:
    s = SRC[p]
    foot = re.search(r'<div class="footer-social">(.*?)<div class="footer-bottom">', s, re.S)
    if foot:
        for u in PROFILES:
            if f'href="{u}"' not in foot.group(1):
                fail(p, f"footer social row is missing {u}")
    if 'name="twitter:card"' in s and '<meta name="twitter:site" content="@wgirlieshq">' not in s:
        fail(p, 'missing <meta name="twitter:site" content="@wgirlieshq">')
same = re.search(r'"sameAs":\[([^\]]*)\]', SRC.get("index.html", ""))
for u in PROFILES:
    if not same or f'"{u}"' not in same.group(1):
        fail("index.html", f"Organization sameAs is missing {u}")

# ---------- 4. Page structure ----------

for p in PAGES:
    s, k = SRC[p], KIND[p]
    if k in ("PROG", "PROG-D", "GO", "TY") and 'class="site-header"' in s:
        fail(p, "cold-traffic pages (sales, /go/, thank-you) carry no site navigation")
    if k == "GO":
        if "selar.com" in s:
            fail(p, "/go/ bridges link only to their own sales page, never to Selar")
        if re.search(r"₦\s?\d|\$\d", visible(s)):
            fail(p, "/go/ bridges show no price")
        if "wg-legal-links" not in s:
            fail(p, "/go/ bridge is missing its legal links row")
    if k == "PROG":
        if re.search(r"\$\d", visible(s)):
            fail(p, "Nigerian sales pages show naira only")
        if "geo-redirect.js" not in s:
            fail(p, "Nigerian sales pages load geo-redirect.js")
    if k == "PROG-D" and not re.search(r"\$\d", visible(s)):
        fail(p, "diaspora sales pages show dollar prices on the page")
    if k in ("PROG", "PROG-D"):
        for need in ['id="join"', "checkout-intent.js"]:
            if need not in s:
                fail(p, f"sales page is missing {need}")

qr_script = read("scripts/make-print-qr.js")
for p in RESOURCES:
    s = SRC[p]
    m = re.search(r'<meta name="wg:share" content="([^"]*)"', s)
    if not m or not m.group(1).strip():
        fail(p, 'missing <meta name="wg:share"> share line (see CLAUDE.md, Share copy)')
    elif len(html.unescape(m.group(1))) > 250:
        fail(p, "share line is over 250 characters; it must fit X with the link")
    if "wg-rail.css" not in s:
        fail(p, "missing wg-rail.css (sticky contents panel styles)")
    a, b = s.find("member-cta.js"), s.find("wg-article.js")
    if b == -1:
        fail(p, "missing wg-article.js (contents panel and share icons)")
    elif a == -1 or a > b:
        fail(p, "member-cta.js must load before wg-article.js")
    if "program-cta" not in s:
        fail(p, "missing the program card (.program-cta)")
    if KIND[p] == "GUIDE" and 'class="byline"' not in s:
        fail(p, "guide is missing its author byline (the top share row sits under it)")

for p in PAGES:
    s = SRC[p]
    if "window.print()" not in s:
        continue
    slug = os.path.basename(p)[:-5]
    if not re.search(r'wg-print\.css\?v=\w+" media="print"', s):
        fail(p, 'has a print button but no wg-print.css loaded with media="print"')
    if "wg-print.js" not in s:
        fail(p, "has a print button but no wg-print.js")
    for btn in re.findall(r"<button[^>]*window\.print\(\)[^>]*>[^<]*</button>", s):
        if "data-wg-print" not in btn or ">Print or save as PDF<" not in btn:
            fail(p, 'print button needs data-wg-print and the label "Print or save as PDF"')
    if not os.path.exists(f"assets/img/qr/{slug}.svg"):
        fail(p, f"no QR code at assets/img/qr/{slug}.svg (add it to scripts/make-print-qr.js and run it)")
    if f"/{slug}\"" not in qr_script:
        fail(p, "not listed in scripts/make-print-qr.js")

for p in PAGES:
    if KIND[p] != "TY":
        continue
    s = SRC[p]
    if 'class="wg-share"' not in s or "wg-share.js" not in s:
        fail(p, "thank-you hub is missing the share icons (wg-share)")
    for path in re.findall(r'data-share-path="([^"]*)"', s):
        if "thank-you" in path:
            fail(p, "share link points at a private thank-you hub; point it at the public program page")
    if "wg_" not in s:
        fail(p, "thank-you hub must write its wg_<stage>_home member flag")
    if "/assets/video/tool-shorts/" in s:
        fail(p, "no tool videos on a program home: buyers get the tool list (CLAUDE.md section 4)")

# The sticker look: each page's stage on <html data-stage>, and the stage's guide in tool and stage headers,
# written by scripts/build-stage-look.py. Rules: CLAUDE.md section 7.
_spec = importlib.util.spec_from_file_location("build_stage_look", os.path.join(ROOT, "scripts/build-stage-look.py"))
look = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(look)
for p in PAGES:
    if SRC[p] != look.build(p, SRC[p]):
        fail(p, "stage look is stale (data-stage or the header guide): run python3 scripts/build-stage-look.py")
    if 'class="hero-guide"' in SRC[p] and look.QUIET.search(p):
        fail(p, "no cast on loss pages, the mental-health check-ins or the warning signs guide")

# The program homes are written by scripts/build-program-homes.py from assets/data/program-homes.json.
_spec = importlib.util.spec_from_file_location("build_program_homes", os.path.join(ROOT, "scripts/build-program-homes.py"))
homes = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(homes)
HOMES = homes.load()
for slug in HOMES["homes"]:
    path, _old, _new, err = homes.expected(HOMES, slug)
    if err:
        fail(path, err)
    elif _new != _old:
        fail(path, "program home is stale against assets/data/program-homes.json: run python3 scripts/build-program-homes.py")
_path, _old, _new, err = homes.expected_app(HOMES)
if err:
    fail(_path, err)
elif _new != _old:
    fail(_path, "app home tool data (APP_DATA) is stale: run python3 scripts/build-program-homes.py")
# Program codes (journey F) and per-program manifests (journey C).
_seen_codes = {}
for slug, h in HOMES["homes"].items():
    code = h.get("code")
    if not code:
        fail("assets/data/program-homes.json", f"{slug} has no program code")
        continue
    if re.search(r"[01OIL]", code.split("-", 1)[-1]) or not homes.CODE_RE.match(code):
        fail("assets/data/program-homes.json", f"{slug} code {code} must be PREFIX-XXXX with no 0, O, 1, I or L")
    if code in _seen_codes:
        fail("assets/data/program-homes.json", f"{slug} and {_seen_codes[code]} share the code {code}")
    _seen_codes[code] = slug
    mpath, mold, mnew, _e = homes.expected_manifest(slug)
    if mold != mnew:
        fail(mpath, "per-program manifest is missing or stale: run python3 scripts/build-program-homes.py")
if os.path.exists("app/index.html"):
    _app = read("app/index.html")
    for code in _seen_codes:
        if code in _app or code.replace("-", "") in _app:
            fail("app/index.html", "a plaintext program code is in the app home; APP_DATA holds only hashes")
for p in PAGES:
    if KIND[p] == "TY" and p[len("programs/"):-len("/thank-you.html")] not in HOMES["homes"]:
        fail(p, "program home is missing from assets/data/program-homes.json")
for stage, paths in HOMES["stages"].items():
    for tp in paths:
        if tp not in HOMES["tools"]:
            fail("assets/data/program-homes.json", f"{tp} is listed under {stage} but has no entry in tools")
# A game placed in a program's "Play along" list (assets/data/program-games.json) counts as listed: it stays out of "Your tools".
_placed_games = set()
if os.path.exists("assets/data/program-games.json"):
    _placed_games = {g["path"] for g in json.load(open("assets/data/program-games.json"))["games"].values()}
for p in PAGES:
    if KIND[p] == "TOOL" and not p.endswith("index.html") and "/" + p[:-5] not in HOMES["tools"] and "/" + p[:-5] not in _placed_games:
        fail(p, "tool is missing from assets/data/program-homes.json and from assets/data/program-games.json, so no program home lists it (add it to tools and its stage, or place the game in program-games.json)")

# ---------- 5. Compliance and 6. Brand ----------

COPY_BANS = [
    (r"\bbots?\b|\bchatbots?\b", 'say "assistant", never "bot"'),
    (r"\bfounding\b", 'the public price label is "early-bird"'),
    (r"conception-circle|pregnancy-village|raising-together|ttc-blueprint|pregnancy-companion|Wholesome Woman", "retired program name or slug"),
    (r"medically reviewed by|doctor[- ]approved|reviewed by professionals", "no review claim until a named clinician has signed"),
    (r"\bonly \d+ (?:spots|places|seats) left\b|\bcountdown\b|\bguaranteed results?\b", "honest urgency only, no outcome guarantees"),
    (r"\bget pregnant fast\b|\bboost (?:your )?fertility\b|\bbounce back\b|\bget your body back\b|\bsleep through the night\b|\bmake him (?:marry|choose) you\b", "banned health and relationship trigger phrase"),
]
for p in PAGES:
    if KIND[p] == "MOCKUP":
        continue
    text = visible(SRC[p])
    share = " ".join(re.findall(r'<meta name="wg:share(?:-label)?" content="([^"]*)"', SRC[p]))
    for pat, why in COPY_BANS:
        # guides may quote a searched question ("Can folic acid boost fertility?") to answer it;
        # trigger phrases are banned in their share lines and on every other page
        scope = html.unescape(share) if (why.startswith("banned") and KIND[p] == "GUIDE") else text + " " + html.unescape(share)
        hits = set(re.findall(pat, scope, flags=re.I))
        hits = {h for h in hits if not (why.startswith("banned") and re.search(r"\b(?:no|not|never|without)\b[^.]{0,30}" + re.escape(h), text, flags=re.I))}
        if hits:
            fail(p, f"{why} (found: {', '.join(sorted(hits))})")

# Readers do not know the short name yet: copy says "Wholesome Girlies", never "WG". Checks the whole
# source outside HTML comments, so text built by inline scripts (result bands, review lists) counts too.
for p in PAGES:
    if KIND[p] != "MOCKUP" and re.search(r"\bWG\b", re.sub(r"<!--[\s\S]*?-->", "", SRC[p])):
        fail(p, 'write "Wholesome Girlies" in full, never "WG"')
if re.search(r"\bWG\b", read("scripts/results.json")):
    fail("scripts/results.json", 'write "Wholesome Girlies" in full, never "WG"')

# The installed app is the website, so one page serves both. Visible body text never says "site", "website" or
# "browser": a reader in the app has no such thing. Say "here", "on Wholesome Girlies", "on this device", or wrap the
# word as <span data-app-word="app">site</span>, which wg-app.js swaps for the attribute inside the installed app.
# Not read: head, meta tags, scripts, JSON-LD, comments, HTML attributes, URLs and domains, /legal/ (where
# "website" is the legal term), mockups. ALLOW_WEB_WORDS lists lines that must keep the word, each with its reason.
WEB_WORDS = re.compile(r"\b(?:web ?sites?|sites?|browsers?)\b", re.I)
ALLOW_WEB_WORDS = {
    ("about/medical-policy.html", "not a website"): "tells her to get a hospital, not a website: a general noun for other websites",
    ("postpartum/guides/omugwo.html", "health websites"): "names other health websites in a research claim",
    ("pregnancy/tools/due-date-calculator.html", "NHS site"): "names the NHS website as a separate source",
}


def web_word_text(s):
    b = s[s.find("<body"):] if "<body" in s else s
    b = re.sub(r"<(script|style|noscript|template)[^>]*>.*?</\1>|<!--.*?-->", " ", b, flags=re.S | re.I)
    b = re.sub(r"<span[^>]*\bdata-app-word=[^>]*>.*?</span>", " ", b, flags=re.S | re.I)
    b = html.unescape(re.sub(r"<[^>]+>", " ", b))
    return re.sub(r"https?://\S+|[\w.-]+\.(?:xyz|com|ng|org)\b\S*", " ", b)


for p in PAGES:
    if KIND[p] == "MOCKUP" or p.startswith("legal/"):
        continue
    t = web_word_text(SRC[p])
    found = set()
    for m in WEB_WORDS.finditer(t):
        around = t[max(0, m.start() - 40):m.end() + 20]
        if any(pg == p and phrase in around for (pg, phrase) in ALLOW_WEB_WORDS):
            continue
        found.add(re.sub(r"\s+", " ", around).strip())
    for ctx in sorted(found)[:3]:
        fail(p, f'"site", "website" or "browser" in text the installed app also shows (say "here", "on Wholesome Girlies" or "on this device", or wrap the word in data-app-word): ...{ctx}...')

# ---------- 7. Operations: one cache version per asset ----------

refs = {}
for p in PAGES + ["assets/js/wg-article.js"]:
    for name, ver in re.findall(r"/assets/(?:js|css)/([\w.-]+)\?v=(\w+)", SRC.get(p) or read(p)):
        refs.setdefault(name, {}).setdefault(ver, []).append(p)
for name, vers in refs.items():
    if len(vers) > 1:
        detail = ", ".join(f"?v={v} on {len(ps)} file(s)" for v, ps in vers.items())
        problems.append(f"{name}: mixed cache versions ({detail}); bump every reference to one value")

# An asset that differs from git HEAD must load under a new ?v=, because sw.js serves /assets/ cache-first
# and a changed file under the same version stays old on her phone. New files (not at HEAD) are exempt, and the
# check skips itself when git is unavailable or this is not a checkout (the GitHub runner checks out HEAD, so
# its diff is empty).
def _git(*args):
    try:
        r = subprocess.run(["git", *args], capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.SubprocessError):
        return None
    return r.stdout if r.returncode == 0 else None


if shutil.which("git"):
    _changed = _git("diff", "--name-only", "HEAD", "--", "assets/js", "assets/css")
    if _changed and _changed.strip():
        _old = _git("grep", "-h", "-o", "-E", r"/assets/(js|css)/[A-Za-z0-9_.-]+\?v=[A-Za-z0-9]+",
                    "HEAD", "--", "*.html", "assets/js/wg-article.js")
        if _old is not None:
            _head = {}
            for _m in re.finditer(r"/assets/(?:js|css)/([A-Za-z0-9_.-]+)\?v=([A-Za-z0-9]+)", _old):
                _head.setdefault(_m.group(1), set()).add(_m.group(2))
            for _f in sorted(set(_changed.split())):
                _name = os.path.basename(_f)
                if _name not in _head or _name not in refs:
                    continue
                _stale = sorted(set(refs[_name]) & _head[_name])
                if _stale:
                    problems.append(f"{_f}: changed since git HEAD but still loads as ?v={_stale[0]}, the version at HEAD "
                                    f"({len(refs[_name][_stale[0]])} reference(s)); bump it in every page that references it, "
                                    f"or the service worker keeps serving the old copy")

# Inline scripts must parse. One syntax error stops a whole tool working, so a broken
# script never ships. Uses Node when it is available (it is on the GitHub runner).
if shutil.which("node"):
    jobs = []
    for p in PAGES:
        for attrs, code in re.findall(r"<script([^>]*)>(.*?)</script>", read(p), flags=re.S):
            if "src=" in attrs or "json" in attrs or not code.strip():
                continue
            jobs.append({"p": p, "code": code})
    checker = ("const vm=require('vm');let d='';process.stdin.on('data',c=>d+=c).on('end',()=>{"
               "for(const j of JSON.parse(d)){try{new vm.Script(j.code)}catch(e){console.log(j.p+'\\t'+e.message)}}})")
    out = subprocess.run(["node", "-e", checker], input=json.dumps(jobs), capture_output=True, text=True).stdout
    for line in out.splitlines():
        page, msg = line.split("\t", 1)
        fail(page, f"inline script does not parse ({msg}); the tool on this page will not run")
else:
    print("check-pages: node not found, inline script check skipped")

# Every tool and guide has its own link preview card from scripts/make-og.js
for p in RESOURCES:
    s = read(p)
    img = re.search(r'property="og:image" content="([^"]+)"', s)
    slug = os.path.basename(p)[:-5]
    if not img or f"/assets/img/og/{slug}.jpg" not in img.group(1):
        fail(p, f"og:image must be its own card, /assets/img/og/{slug}.jpg (run scripts/make-og.js)")
    tw = re.search(r'name="twitter:image" content="([^"]+)"', s)
    if img and tw and tw.group(1) != img.group(1):
        fail(p, "twitter:image must match og:image")

# Tool and guide cards: an own-slug og:image that exists is checked above and in the indexable-page loop.
# Every shared result page carries its own result card as og:image, never default.jpg and never a missing file
for p in PAGES:
    if KIND[p] != "RESULT":
        continue
    s = read(p)
    img = re.search(r'property="og:image" content="([^"]+)"', s)
    m = re.search(r"([^/]+)/tools/([^/]+)/result/([^/]+)\.html$", p)
    if not img or "/og/default.jpg" in img.group(1) or f"/assets/img/results/{m.group(2)}/{m.group(3)}.jpg" not in img.group(1):
        fail(p, f"og:image must be its own result card, /assets/img/results/{m.group(2)}/{m.group(3)}.jpg (run scripts/make-result-cards.js)")
    elif not resolves(img.group(1).replace(SITE, "").split("?")[0]):
        fail(p, "og:image file does not exist: run node scripts/make-result-cards.js " + m.group(2))

# Every tool, game and quiz has a tool short brief in the vault video program folders, written the
# day the tool is built. Runs only where the vault exists (James's machine); the GitHub runner skips it.
# Briefs sit one level down in a folder per program (or Brand); the hub notes above them and
# Personas/ are not briefs.
VIDEO_DIR = os.path.expanduser("~/Documents/James Obsidian Vault/Areas/Work/Wholesome Girlies/Content/AI Video")


def video_briefs(pattern="*.md"):
    return sorted(f for f in glob.glob(os.path.join(VIDEO_DIR, "*", pattern))
                  if os.path.basename(os.path.dirname(f)) != "Personas")


if os.path.isdir(VIDEO_DIR):
    briefed = set()
    for f in video_briefs():
        m = re.search(r"^destination:\s*\"?([^\"\s]+)", read(f), re.M)
        if m:
            briefed.add(m.group(1).rstrip("/"))
    for p in PAGES:
        if KIND[p] == "TOOL" and not p.endswith("index.html") and "/" + p[:-5] not in briefed:
            fail(p, f"no tool short brief: add one under Content/AI Video/<Program>/ with destination: /{p[:-5]} (see 01 - Video Roadmap)")

# Every cast image is archived in the vault's WG Cast folder and in ~/Downloads/Wholesome Girlies/WG Cast/, and
# indexed (CLAUDE.md section 4, Cast archive). Same vault-only guard: the GitHub runner skips it.
if os.path.isdir(VIDEO_DIR):
    import subprocess as _sp
    _r = _sp.run([sys.executable, "scripts/check-cast-archive.py"], capture_output=True, text=True)
    if _r.returncode:
        for _l in _r.stdout.splitlines():
            if not _l.startswith("check-cast-archive:"):
                fail("cast archive", _l)

# ---------- Tool reels: every filmed tool short sits on every page it belongs to ----------
# assets/data/tool-shorts.json lists one entry per rendered tool short. scripts/build-tool-reels.py
# writes the reel on each program sales page; the motion kit's publish-to-site
# script writes the entry. Rules: CLAUDE.md section 9.
_spec = importlib.util.spec_from_file_location("build_tool_reels", os.path.join(ROOT, "scripts/build-tool-reels.py"))
reels = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(reels)
MANIFEST = reels.load()
for slug, tool in MANIFEST["tools"].items():
    for key in ("video", "poster"):
        if not os.path.exists(tool[key].lstrip("/")):
            fail("assets/data/tool-shorts.json", f"{slug}: {key} file {tool[key]} is missing")
    if not os.path.exists(reels.tool_file(tool["tool"])):
        fail("assets/data/tool-shorts.json", f"{slug}: tool page {tool['tool']} does not exist")
    elif reels.fingerprint(tool["tool"]) != tool["tool_fingerprint"]:
        fail(tool["tool"].strip("/") + ".html", "tool changed since its short was filmed: re-capture and re-render, then run publish-to-site")
    for prog in tool.get("programs", []):
        for path, _market, _k in reels.pages_of(prog):
            if tool["video"] not in SRC.get(path, ""):
                fail(path, f"tool reel is missing {slug}: every filmed tool short appears on each page it belongs to (run scripts/build-tool-reels.py)")
for prog in MANIFEST["programs"]:
    for path, market, kind in reels.pages_of(prog):
        _old, _new, err = reels.expected(path, MANIFEST, prog, market, kind)
        if err:
            fail(path, err)
        elif _new != _old:
            fail(path, "tool reel is stale against assets/data/tool-shorts.json: run python3 scripts/build-tool-reels.py")
# The app home lists tools, never reels.
if "tool-reel" in SRC.get("app/index.html", "") or "wg-tool-reel" in SRC.get("app/index.html", ""):
    fail("app/index.html", "the app home shows no tool videos: tools are listed, as on the program homes")
# A brief with no manifest entry means its short is still being rendered: advisory only.
if os.path.isdir(VIDEO_DIR):
    filmed = {t["brief"] for t in MANIFEST["tools"].values()}
    for f in video_briefs("*Tool Short*.md"):
        rel = f.split("AI Video/")[1]
        if rel not in filmed:
            warn(rel, "tool short brief has no entry in assets/data/tool-shorts.json yet (rendering pending); publish-to-site adds it")
    # Every tool short has a matching carousel: a ```carousel block and a "## Carousel post caption" in the
    # same brief, built by the motion kit's build-carousels.mjs. Advisory until the backlog is written.
    for f in video_briefs("*Tool Short*.md"):
        text = read(f)
        if "```carousel" not in text or "## Carousel post caption" not in text:
            warn(f.split("AI Video/")[1], "tool short brief has no carousel yet: add the ```carousel block and \"## Carousel post caption\" (see _Video Brief Template), then run build-carousels.mjs")
for p in PAGES:
    if KIND[p] in ("PROG", "PROG-D") and "Who guides you" in SRC[p]:
        fail(p, 'no "Who guides you" credentials section on sales pages: they stay lean (CLAUDE.md section 4)')

# ---------- The app: the website and the installed app are the same pages ----------
# manifest.webmanifest and sw.js make the site installable. scripts/add-app-tags.py puts the app tags on every page;
# the service worker loads pages from the network first, so a pushed page reaches the app the next time she opens it online.
for f in ("manifest.webmanifest", "sw.js", "app/index.html", "offline.html"):
    if not os.path.exists(f):
        fail(f, "the app needs this file")
APP_TAGS = ['<link rel="manifest" href="/manifest.webmanifest">', '<meta name="theme-color" content="#6E7A3F">',
            '<meta name="apple-mobile-web-app-title" content="Girlies">', 'src="/assets/js/wg-app.js?v=',
            'href="/assets/css/wg-arrows.css?v=', 'src="/assets/js/wg-arrows.js?v=']  # the site arrow (section 7)
for p in PAGES:
    if KIND[p] == "MOCKUP":
        continue
    _tags = APP_TAGS
    if KIND[p] == "TY" or p.endswith("/read.html"):  # a program home and its reader point at the program's own manifest (journey C)
        _tags = [f'<link rel="manifest" href="/manifests/{p.split("/")[1]}.webmanifest">' if t == APP_TAGS[0] else t for t in APP_TAGS]
    if any(t not in SRC[p] for t in _tags):
        fail(p, "missing the app tags: run python3 scripts/add-app-tags.py")
    m = re.search(r"<h4>Explore</h4>\s*<ul>(.*?)</ul>", SRC[p], flags=re.S)
    if m and 'href="/app/"' not in m.group(1):
        fail(p, 'footer Explore list is missing "Get the app": run python3 scripts/add-app-tags.py')
# Tools that read another tool's entries and save none of their own, so the app's saved tools never lists them.
READS_ONLY = {"postpartum/tools/mum-wrapped.html"}  # reads the Feeding and Sleep Tracker's wg_feedsleep_ entries
if os.path.exists("app/index.html"):
    app_src = SRC["app/index.html"]
    listed = dict(re.findall(r'\["(wg_[a-z0-9_]+)", "(/[a-z-]+/tools/[a-z0-9-]+)"', app_src))
    for p in PAGES:
        if KIND[p] != "TOOL":
            continue
        keys = {k for k in re.findall(r"""["'`](wg_[a-z0-9_]+)""", SRC[p]) if not re.search(r"_home$|^wg_lead$|^wg_app_|^wg_consent", k)}
        if p in READS_ONLY:
            continue
        if keys and url_of(p).replace(SITE, "") not in listed.values():
            fail(p, "this tool saves entries but is missing from APP_TOOLS in app/index.html, so the app home never shows it")
    for k, path in listed.items():
        page = path.lstrip("/") + ".html"
        if page not in SRC or k not in SRC[page]:
            fail("app/index.html", f"APP_TOOLS entry {k} does not match a key saved by {path}")


# ---------- Ratchet rules (frozen backlog, no new violations) ----------


# A game or quiz carded as Game or Quiz on /tools/ is exempt from the doctor box unless it carries health facts (HEALTH_GAMES).
HEALTH_GAMES = {"/pregnancy/tools/old-wives-tales-pregnancy", "/parenting/tools/old-wives-tales-baby",
                "/parenting/tools/milestone-guess", "/postpartum/tools/visitors-bingo"}
NON_HEALTH_GAMES = {m.group(1) for m in re.finditer(r'<a class="card ti" href="([^"]+)"[^>]*><span class="tag">(?:Game|Quiz)</span>',
                                                  SRC.get("tools/index.html", ""))} - HEALTH_GAMES


def ratchet_counts():
    c = {}

    def add(rule, page, n):
        if n:
            c.setdefault(rule, {})[page] = n

    for p in PAGES:
        s, k = SRC[p], KIND[p]
        if k == "MOCKUP":
            continue
        text = visible(s)
        if k != "LEGAL":
            add("free: never call the tools or content free", p, len(re.findall(r"(?<!-)(?<!set you )\bfree\b(?! of| yourself)", text, flags=re.I)))
        add("dashes: no em or en dashes in copy", p, len(re.findall(r"[—–]", text)))
        d = re.search(r'<meta name="description" content="([^"]*)"', s)
        add("description: meta description 155 characters or fewer", p, int(bool(d and len(html.unescape(d.group(1))) > 155)))
        add("versions: every /assets/ script loads with ?v=", p, len(re.findall(r'src="/assets/[^"?]+\.js"', s)))
        if k == "TOOL":
            t = ld_types(s) or set()
            add("tool schema: FAQPage on every tool", p, int("FAQPage" not in t))
            add("tool trust: Person author and citation array in schema", p, int('"citation"' not in s) + int('"Person"' not in s))
        if k in ("TOOL", "GUIDE") and not p.startswith("relationships/") and "/" + p[:-5] not in NON_HEALTH_GAMES:
            add("safety: health tools and guides carry a when-to-see-a-doctor block", p, int("doctor-box" not in s))
        if k in ("PROG", "PROG-D") and "testimonial" in s:
            add("results vary: sales pages with testimonials carry a results-vary line", p, int(not re.search(r"results (?:vary|differ)", text, flags=re.I)))
    return c


# ---------- Warnings (advisory, never fail the run) ----------

FILLER = re.compile(r"\b(honest(?:ly)?|calm(?:ly|er|ing|ness)?|gentl(?:e|y|er|eness))\b", re.I)
for p in PAGES:
    if KIND[p] == "MOCKUP":
        continue
    # testimonial quotes are verbatim customer words, so they are not counted
    body = re.sub(r'<p class="quote">.*?</p>', " ", SRC[p], flags=re.S)
    body = re.sub(r"<(script|style|noscript)[^>]*>.*?</\1>|<!--.*?-->", " ", body, flags=re.S | re.I)
    desc = re.findall(r'<meta name="description" content="([^"]*)"', SRC[p])
    hits = FILLER.findall(html.unescape(re.sub(r"<[^>]+>", " ", body) + " ".join(desc)))
    if len(hits) > 1:
        warn(p, f'"honest", "calm" or "gentle" used {len(hits)} times; say the specific thing, one literal use per page at most')

# A quiz or game never puts all its questions or options in one long stretch: more than 3 static questions need
# data-steps (wg-steps.js), and a long static list of choices (more than 6 option buttons or radios) is not allowed
# outside a stepper. The browser test scripts/test-one-screen.js covers the rest (height of the playing area).
for p in PAGES:
    if KIND[p] != "TOOL" or p.endswith("index.html"):
        continue
    _t = re.search(r'href="/' + re.escape(p[:-5]) + r'"[^>]*><span class="tag">([^<]*)', SRC.get("tools/index.html", ""))
    _eng = re.search(r"wg-(?:count|pair|truefalse|tierlist|chatcard|wrapped|daily|steps)\.js", SRC[p]) or "data-steps" in SRC[p]
    if (_t and _t.group(1) in ("Game", "Quiz")) or _eng:
        _app = SRC[p].split('class="tool-app', 1)[-1].split('class="disclaimer', 1)[0]
        _qs = len(re.findall(r'class="(?:q|rq)[ "]', _app))
        _stepped = "data-steps" in SRC[p]
        if _qs > 3 and not _stepped:
            fail(p, f"{_qs} questions and no data-steps: show one question at a time with wg-steps.js")
        _opts = len(re.findall(r'type="radio"', _app)) + len(re.findall(r'<button[^>]*class="[^"]*\b(?:opt|choice)\b', _app))
        if _opts > 6 and not _stepped:
            fail(p, f"{_opts} option buttons or radios in one long list: show a few at a time (stepper, paging or one-by-one)")

now = ratchet_counts()
if "--update-baseline" in sys.argv:
    with open(BASELINE, "w") as f:
        json.dump(now, f, indent=1, sort_keys=True, ensure_ascii=False)
    print(f"check-pages: baseline written to {BASELINE}")
    sys.exit(0)
base = json.load(open(BASELINE)) if os.path.exists(BASELINE) else {}
improved = 0
for rule, pages in now.items():
    for p, n in pages.items():
        allowed = base.get(rule, {}).get(p, 0)
        if n > allowed:
            fail(p, f"{rule} ({n} found, {allowed} allowed by the baseline)")
for rule, pages in base.items():
    for p, n in pages.items():
        if now.get(rule, {}).get(p, 0) < n:
            improved += 1

if warnings:
    print(f"check-pages: {len(warnings)} warning(s), not failing the run\n")
    print("\n".join("  - " + x for x in warnings) + "\n")
if problems:
    print(f"check-pages: {len(problems)} problem(s)\n")
    print("\n".join("  - " + x for x in problems))
    sys.exit(1)
backlog = sum(sum(v.values()) for v in now.values())
note = f"; {improved} backlog item(s) improved, run with --update-baseline to lock them in" if improved else ""
print(f"check-pages: OK ({len(PAGES)} pages, {len(RESOURCES)} resources; ratchet backlog {backlog}{note})")
