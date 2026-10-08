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
import json
import os
import re
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
PAGES = sorted(p for p in glob.glob("**/*.html", recursive=True) if not p.startswith((".", "node_modules")))
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
    return "HUB"


KIND = {p: kind(p) for p in PAGES}
NOINDEX_KINDS = {"GO", "TY", "PROG-D", "404", "MOCKUP", "RESULT"}
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

# ---------- 7. Operations: one cache version per asset ----------

refs = {}
for p in PAGES + ["assets/js/wg-article.js"]:
    for name, ver in re.findall(r"/assets/(?:js|css)/([\w.-]+)\?v=(\w+)", SRC.get(p) or read(p)):
        refs.setdefault(name, {}).setdefault(ver, []).append(p)
for name, vers in refs.items():
    if len(vers) > 1:
        detail = ", ".join(f"?v={v} on {len(ps)} file(s)" for v, ps in vers.items())
        problems.append(f"{name}: mixed cache versions ({detail}); bump every reference to one value")

# Inline scripts must parse. One syntax error stops a whole tool working, so a broken
# script never ships. Uses Node when it is available (it is on the GitHub runner).
import shutil
import subprocess
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

# Every tool, game and quiz has a tool short brief in the vault video waves, written the day the
# tool is built. Runs only where the vault exists (James's machine); the GitHub runner skips it.
VIDEO_DIR = os.path.expanduser("~/Documents/James Obsidian Vault/Areas/Work/Wholesome Girlies/Content/AI Video")
if os.path.isdir(VIDEO_DIR):
    briefed = set()
    for f in glob.glob(os.path.join(VIDEO_DIR, "Wave */*.md")):
        m = re.search(r"^destination:\s*\"?([^\"\s]+)", read(f), re.M)
        if m:
            briefed.add(m.group(1).rstrip("/"))
    for p in PAGES:
        if KIND[p] == "TOOL" and not p.endswith("index.html") and "/" + p[:-5] not in briefed:
            fail(p, f"no tool short brief: add one under Content/AI Video/Wave N/ with destination: /{p[:-5]} (see 01 - Video Roadmap)")

# ---------- Ratchet rules (frozen backlog, no new violations) ----------


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
            add("free: never call the tools or content free", p, len(re.findall(r"(?<!-)\bfree\b(?! of)", text, flags=re.I)))
        add("dashes: no em or en dashes in copy", p, len(re.findall(r"[—–]", text)))
        d = re.search(r'<meta name="description" content="([^"]*)"', s)
        add("description: meta description 155 characters or fewer", p, int(bool(d and len(html.unescape(d.group(1))) > 155)))
        add("versions: every /assets/ script loads with ?v=", p, len(re.findall(r'src="/assets/[^"?]+\.js"', s)))
        if k == "TOOL":
            t = ld_types(s) or set()
            add("tool schema: FAQPage on every tool", p, int("FAQPage" not in t))
            add("tool trust: Person author and citation array in schema", p, int('"citation"' not in s) + int('"Person"' not in s))
        if k in ("TOOL", "GUIDE") and not p.startswith("relationships/"):
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
