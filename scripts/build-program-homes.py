#!/usr/bin/env python3
"""Writes the program homes: the header and main of the 12 pages at programs/<slug>/thank-you.html.

Source of truth: assets/data/program-homes.json. "homes" holds each page's own words (heading, toolkit
link, community, help, safety, the next program, pass it on), "stages" the tools each stage lists in order,
and "tools" each tool's name, one line and saved-entries key. The block sits between
<!-- program-home:start --> and <!-- program-home:end -->, and this script is the only thing that writes it.
The head, the footer and the member-flag script below the footer stay hand-owned.

The app home (/app/) uses the same data: this script also writes APP_DATA (each stage's tools, each tool's
name and line, each program's stages and reader) between // program-homes:start and // program-homes:end
in app/index.html, so her program and tools show there without a network request.

Layout (vault: Wholesome Girlies/07 - User Journeys, Navigation & Wireframes, "The redesigned program home"):
slim header with Tools and My programs; who it is for, in a panel with the stage's guide (a waist-up cast
figure from assets/img/cast/guides/ and one line in a speech bubble); reading (the reader where one is built, else the
toolkit PDF; the bundle lists its four toolkits); Get the app (browser only); community (motherhood only);
your tools as a list with Saved marks and no videos; help and safety; the next program; pass it on.

Program code (vault journey F): each home has a "code" (PREFIX-XXXX, no look-alike characters). The home shows
it, and APP_DATA carries only the SHA-256 of each normalised code, so /app/ can add a program she typed.
Per-program manifests (journey C): manifests/<slug>.webmanifest is manifest.webmanifest with start_url
/app/?home=<slug> (same id, so it is the same app), and each home's <link rel="manifest"> points at its own.

  python3 scripts/build-program-homes.py           write every page (idempotent)
  python3 scripts/build-program-homes.py --check   write nothing; exit 1 if any page differs
"""
import hashlib
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "assets/data/program-homes.json")
START, END = "<!-- program-home:start -->", "<!-- program-home:end -->"
ASSET_VERSION = "20261011a"
CSS_TAG = f'<link rel="stylesheet" href="/assets/css/wg-program-home.css?v={ASSET_VERSION}">'
JS_TAG = f'<script defer src="/assets/js/wg-program-home.js?v={ASSET_VERSION}"></script>'
ARROW = ('<svg class="nav-dropdown-arrow" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">'
         '<path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>')


# What each program home saves on her phone (the flags its thank-you page writes), its locked name and its label.
STAGE_FLAG = {"relationships": "wg_relationships_home", "fertility": "wg_fertility_home", "pregnancy": "wg_pregnancy_home",
              "postpartum": "wg_pp_home", "parenting": "wg_parenting_home"}
PROGRAMS = {
    "wife-material-blueprint": ("The Wife Material Blueprint", "Wife Material home", ["relationships"]),
    "trying-to-conceive-blueprint": ("The Trying-to-Conceive Blueprint", "Conception home", ["fertility"]),
    "first-pregnancy-plan": ("The First Pregnancy Plan", "Pregnancy home", ["pregnancy"]),
    "postpartum-reset": ("The 6-Week Postpartum Reset", "Postpartum home", ["postpartum"]),
    "first-baby-playbook": ("The First Baby Playbook", "First Baby home", ["parenting"]),
    "complete-motherhood-journey": ("The Complete Motherhood Journey", "Motherhood Journey home",
                                    ["fertility", "pregnancy", "postpartum", "parenting"]),
}
CODE_RE = re.compile(r"^(WIFE|TTC|PREG|RESET|BABY|JOURNEY)-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}$")  # no 0, O, 1, I or L
MANIFEST = os.path.join(ROOT, "manifest.webmanifest")


def code_hash(code):
    """SHA-256 of the code as /app/ normalises what she types: capitals, letters and digits only."""
    return hashlib.sha256(re.sub(r"[^A-Z0-9]", "", code.upper()).encode()).hexdigest()


def flag_keys(h):
    return [STAGE_FLAG[s] for s in PROGRAMS[h["program"]][2]]


# Each tool row starts with an icon. wg-program-home.js draws the icon named in data-ico; games and quizzes
# get the rust chip. The first pattern that matches the tool's name wins.
ICONS = [(r"radar|game", "target", "game"), (r"quiz|ready for love", "bubble", "quiz"), (r"checker|husband", "check", ""),
         (r"planner|schedule|rota|routine|builder", "cal", ""), (r"worksheet|non-negotiables", "pen", ""),
         (r"checklist|bag|essentials|meet", "list", ""), (r"tracker|timeline|week", "chart", ""),
         (r"calculator|due date|ovulation", "calc", ""), (r"questions", "chat", ""), (r"check-in", "leaf", ""), (r"name", "heart", "")]


def icon(name):
    for pat, ico, kind in ICONS:
        if re.search(pat, html.unescape(name), re.I):
            return ico, kind
    return "leaf", ""


def ico_tag(name):
    ico, kind = icon(name)
    k = f' data-kind="{kind}"' if kind else ""
    return f'<span class="ph-ico" data-ico="{ico}"{k} aria-hidden="true"></span>'


def guide(m, h):
    """The stage's guide: name, image file, width, height. The bundle names its own."""
    return m["guides"][h.get("guide") or h["stages"][0]]


def guide_line(h):
    if h.get("reader"):
        return "Read one short lesson at a time. Your place is saved."
    if h.get("toolkits"):
        return "Your four toolkits are below. Open the one for where you are now."
    return f"Start with your {word(h)}. Your tools are below. Entries stay on this phone."


def load():
    with open(DATA, encoding="utf-8") as f:
        return json.load(f)


def attr(s):
    return html.escape(s, quote=True)


def page_of(slug):
    return f"programs/{slug}/thank-you.html"


def word(h):
    """The toolkit's own name from its button: "Open your Blueprint &rarr;" gives "Blueprint"."""
    return re.sub(r"^Open your (.*?) &rarr;$", r"\1", h["pdf_button"])


def lessons(reader):
    with open(os.path.join(ROOT, reader.lstrip("/") + ".html"), encoding="utf-8") as f:
        src = f.read()
    return len(re.findall(r'class="rd-lesson"', src)), len(re.findall(r'class="rd-part"', src))


def pdf_link(href, text, cls):
    return f'<a class="{cls}" href="{attr(href)}" target="_blank" rel="noopener">{text}</a>'


def kits(h):
    """The bundle's four toolkits: each row opens that toolkit's reader, and the PDFs stay one tap away underneath."""
    if not h.get("toolkits"):
        return ""
    rows = "".join(
        f'<a class="ph-tool" href="{attr(k["reader"])}"><span class="ph-ico" data-ico="book" aria-hidden="true"></span><span class="ph-tool-t"><b>{k["title"]}</b>'
        f'<span>{k["text"]}</span></span><span class="ph-chev" aria-hidden="true">&rsaquo;</span></a>' for k in h["toolkits"])
    pdfs = "".join(pdf_link(k["href"], k["title"] + " PDF", "") for k in h["toolkits"]).replace('<a class="" ', "<a ")
    return (f'\n        <div class="ph-read ph-kitlist">\n'
            f'          <p class="ph-label">Your four toolkits</p>\n'
            f'          <p class="muted ph-intro">Open each one when you reach that stage.</p>\n'
            f'          <div class="ph-tools ph-kits">{rows}</div>\n'
            f'        </div>\n'
            f'        <div class="ph-pdfs"><p class="muted">Prefer a PDF? Download one:</p>{pdfs}</div>')


def reading(h):
    w = word(h)
    if h.get("reader"):
        n, parts = lessons(h["reader"])
        key = "wg_read_" + h["reader"].strip("/").split("/")[1]
        size = f"{n} short lessons in {parts} parts" if parts > 1 else f"{n} short lessons"
        main = (f'<div class="ph-read" id="phRead" data-reader="{h["reader"]}" data-read-key="{key}">\n'
                f'          <p class="ph-label" id="phLabel">Read your {w}</p>\n'
                f'          <p class="ph-title" id="phTitle">{size}. Your place is saved on this phone.</p>\n'
                f'          <div class="ph-prog"><div class="ph-ring" id="phRing" aria-hidden="true"><span>0<small>started</small></span></div>'
                f'<p class="muted ph-count" id="phCount">Not started yet</p></div>\n'
                f'          <a class="btn btn-primary btn-lg" id="phGo" href="{h["reader"]}">Start reading &rarr;</a>\n'
                f'        </div>\n'
                f'        <p class="ph-links"><a href="{h["reader"]}">See your plan</a>'
                f'{pdf_link(h["pdf"], "Download the PDF", "")}</p>').replace('<a class="" ', "<a ")
        return main + kits(h)
    if h.get("toolkits"):
        rows = "".join(
            f'<a class="ph-tool" href="{attr(k["href"])}" target="_blank" rel="noopener"><span class="ph-ico" data-ico="book" aria-hidden="true"></span><span class="ph-tool-t"><b>{k["title"]}</b>'
            f'<span>{k["text"]}</span></span><span class="ph-chev" aria-hidden="true">&rsaquo;</span></a>' for k in h["toolkits"])
        return (f'<div class="ph-read">\n'
                f'          <p class="ph-label">Your {w}</p>\n'
                f'          <p class="muted ph-intro">{h["pdf_intro"]}</p>\n'
                f'          {pdf_link(h["pdf"], h["pdf_button"], "btn btn-primary btn-lg")}\n'
                f'        </div>\n'
                f'        <div class="ph-tools ph-kits">{rows}</div>')
    return (f'<div class="ph-read">\n'
            f'          <p class="ph-label">Your {w}</p>\n'
            f'          <p class="ph-title">Open it any time. A copy is also in your email.</p>\n'
            f'          {pdf_link(h["pdf"], h["pdf_button"], "btn btn-primary btn-lg")}\n'
            f'        </div>')


def tool_rows(m, stage):
    out = []
    for path in m["stages"][stage]:
        t = m["tools"][path]
        key = f' data-key="{t["key"]}"' if t.get("key") else ""
        out.append(f'<a class="ph-tool" href="{path}"{key}>{ico_tag(t["name"])}<span class="ph-tool-t"><b>{t["name"]}</b><span>{t["line"]}</span></span>'
                   f'<span class="ph-saved" hidden>Saved</span><span class="ph-chev" aria-hidden="true">&rsaquo;</span></a>')
    return "".join(out)


def tools(m, h):
    if len(h["stages"]) == 1:
        return f'<div class="ph-tools">{tool_rows(m, h["stages"][0])}</div>'
    return "\n      ".join(
        f'<details class="ph-group"><summary>{m["stage_names"][s]} <small>{len(m["stages"][s])}</small></summary>'
        f'<div class="ph-tools">{tool_rows(m, s)}</div></details>' for s in h["stages"])


GAMES = os.path.join(ROOT, "assets/data/program-games.json")
STAGE_PROGRAM = {"relationships": "wife-material-blueprint", "pregnancy": "first-pregnancy-plan",
                 "postpartum": "postpartum-reset", "parenting": "first-baby-playbook"}


def game_rows(g, program):
    """One row per game placed in that program's reader, in reading order, in the same row pattern as the tools."""
    out = []
    for m in g["play"].get(program, []):
        t = g["games"][m["game"]]
        out.append(f'<a class="ph-tool" href="{t["path"]}"><span class="ph-ico" data-ico="target" data-kind="game" aria-hidden="true"></span>'
                   f'<span class="ph-tool-t"><b>{t["name"]}</b><span>{m["when"]}: {t["line"]}</span></span>'
                   f'<span class="ph-chev" aria-hidden="true">&rsaquo;</span></a>')
    return "".join(out)


def play_section(m, h):
    """'Play': the games the reader places along the program. A single program lists its own; the bundle groups the three
    stages that have games. Fertility has none, by rule, so a fertility-only home and the bundle's fertility part show none."""
    with open(GAMES, encoding="utf-8") as f:
        g = json.load(f)
    if h["program"] == "complete-motherhood-journey":
        groups = [(s, game_rows(g, STAGE_PROGRAM[s])) for s in h["stages"] if s in STAGE_PROGRAM]
        body = "\n      ".join(f'<details class="ph-group"><summary>{m["stage_names"][s].replace(" tools", "")} games <small>{rows.count("ph-tool\"")}</small></summary>'
                              f'<div class="ph-tools">{rows}</div></details>' for s, rows in groups if rows)
    else:
        rows = game_rows(g, h["program"])
        body = f'<div class="ph-tools">{rows}</div>' if rows else ""
    if not body:
        return ""
    return (f'\n    <section class="ph-sec">\n      <h2>Play along</h2>\n'
            f'      <p class="muted" style="margin:0 0 10px">A game for each stretch of your program, to make following it fun. Your reader shows each one where it fits.</p>\n'
            f'      {body}\n    </section>')


def card(c, level="h3"):
    return (f'<div class="ph-card"><p class="eyebrow">{c["eyebrow"]}</p><{level}>{c["h2"]}</{level}>'
            f'<p class="muted">{c["text"]}</p>'
            f'<a class="btn btn-primary" href="{attr(c["href"])}">{c["button"]}</a>{link2(c)}</div>')


def link2(c):
    """A second, quieter line under the button (the Wife Material bridge names the bundle without a coupon)."""
    l = c.get("link2")
    if not l:
        return ""
    return (f'<p class="muted" style="margin-top:14px">{l["text"]} '
            f'<a href="{attr(l["href"])}">{l["button"]}</a></p>')


def next_cards(h):
    """The next-step cards: one section each. cross_sell is one card or a list. A section that offers the bundle
    carries data-bundle-offer, which wg-program-home.js hides for a Complete Motherhood Journey owner."""
    cs = h.get("cross_sell")
    if not cs:
        return ""
    out = ""
    for c in (cs if isinstance(cs, list) else [cs]):
        offer = "complete-motherhood-journey" in c["href"] or c.get("bundle_offer")
        out += f'\n    <section class="ph-sec"{" data-bundle-offer" if offer else ""}>{card(c)}</section>'
    return out


def block(m, h):
    sh, g = h["share"], guide(m, h)
    extra = f'\n      <p style="margin-top:10px;">{sh["extra"]}</p>' if sh.get("extra") else ""
    community = f'\n    <section class="ph-sec">{card(h["community"])}</section>' if h.get("community") else ""
    nxt = next_cards(h)
    code = (f'\n    <section class="ph-sec ph-code" style="text-align:center;padding-top:14px">'
            f'<p class="muted" style="margin:0">Your program code: <b>{h["code"]}</b></p>'
            f'<p class="muted" style="margin:6px auto 0;max-width:54ch;font-size:.9rem">Use it to add this program to the Girlies app on another phone, '
            f'or if you added the app before you bought.</p></section>')
    return f"""{START}
<header class="ph-head">
  <div class="wrap"><a class="brand" href="/"><span class="dot"></span> Wholesome Girlies</a>
  <nav><a href="/tools/">Tools</a><div class="nav-dropdown" id="phProgsDd" hidden><button class="nav-dropdown-trigger" id="phProgsBtn" type="button" aria-expanded="false" aria-haspopup="true">My programs {ARROW}</button><div class="nav-dropdown-menu" role="menu" id="phProgs"></div></div></nav></div>
</header>
<main class="ph">
  <section class="ph-top-wrap"><div class="wrap narrow ph-top">
    <div class="ph-hero">
      <div class="ph-hero-txt">
        <p class="ph-eyebrow">{h["eyebrow"]}</p>
        <h1>{h["h1"]}</h1>
        <p class="ph-say"><b>{g[0]}</b>{guide_line(h)}</p>
      </div>
      <img class="ph-hero-img" src="/assets/img/cast/guides/{g[1]}.webp?v={ASSET_VERSION}" width="{g[2]}" height="{g[3]}" alt="Illustration of {g[0]}">
    </div>
    <p class="muted ph-keep ph-site">Add Girlies to your home screen or bookmark this page so you can come back. The link is also in your email.</p>
  </div></section>
  <div class="wrap narrow">
    <section class="ph-sec" style="padding-top:12px">
        {reading(h)}
    </section>
  </div>
  <section class="sales-hero ph-appslot ph-site"><div class="wrap narrow"></div></section>
  <div class="wrap narrow">{code}{community}{play_section(m, h)}
    <section class="ph-sec">
      <h2>Your tools</h2>
      {tools(m, h)}
    </section>
    <section class="ph-sec">
      <div class="ph-safety"><h3>{h["safety"]["h3"]}</h3><p class="muted">{h["safety"]["text"]}</p></div>
      <div class="ph-help"><h3>Want private help?</h3><p class="muted">{h["help"]}</p></div>
    </section>{nxt}
    <section class="ph-pass">
      <p class="eyebrow">Pass it on</p>
      <h2>{sh["h2"]}</h2>
      <p class="muted" style="max-width:54ch;margin-left:auto;margin-right:auto;">{sh["text"]}</p>
      <div class="wg-share" data-share-id="{sh["id"]}" data-share-surface="thank_you" data-share-path="{sh["path"]}" data-share-align="center"
           data-share-text="{sh["share_text"]}"></div>
      <p class="muted" style="font-size:.85rem;margin-top:14px;">Your friend sees the program page. Nothing about you or your purchase is shared.</p>{extra}
    </section>
  </div>
</main>
{END}"""


MARK = re.compile(re.escape(START) + r".*?" + re.escape(END), re.S)
APP_PAGE = "app/index.html"
APP_START, APP_END = "// program-homes:start", "// program-homes:end"
APP_MARK = re.compile(re.escape(APP_START) + r".*?" + re.escape(APP_END), re.S)


def app_data(m):
    data = {
        "stageNames": m["stage_names"],
        "stages": m["stages"],
        "tools": {p: [html.unescape(t["name"]), html.unescape(t["line"]), *icon(t["name"])] for p, t in m["tools"].items()},
        "guides": m["guides"],
        "guideV": ASSET_VERSION,
        "homes": {slug: {"stages": h["stages"], **({"guide": h["guide"]} if h.get("guide") else {}),
                         **({"reader": h["reader"]} if h.get("reader") else {}),
                         "name": PROGRAMS[h["program"]][0], "label": PROGRAMS[h["program"]][1], "flags": flag_keys(h)}
                  for slug, h in m["homes"].items()},
        "codes": {code_hash(h["code"]): slug for slug, h in m["homes"].items()},
    }
    return f"{APP_START}\nvar APP_DATA = {json.dumps(data, ensure_ascii=False, separators=(',', ':'))};\n{APP_END}"


def expected_app(m):
    with open(os.path.join(ROOT, APP_PAGE), encoding="utf-8") as f:
        src = f.read()
    if len(APP_MARK.findall(src)) != 1:
        return APP_PAGE, src, None, f"{APP_PAGE}: needs exactly one {APP_START} ... {APP_END} block"
    new = APP_MARK.sub(lambda _: app_data(m), src)
    new = re.sub(r'wg-program-home\.(css|js)\?v=[0-9a-z]+', lambda x: f"wg-program-home.{x.group(1)}?v={ASSET_VERSION}", new)
    return APP_PAGE, src, new, None


def with_assets(src, slug):
    """The page loads the program home CSS and JS exactly once, at the current version, and its own manifest."""
    src = src.replace('<link rel="manifest" href="/manifest.webmanifest">', f'<link rel="manifest" href="/manifests/{slug}.webmanifest">')
    src = re.sub(r'\s*<link rel="stylesheet" href="/assets/css/wg-program-home\.css[^"]*">', "", src)
    src = re.sub(r'\s*<script defer src="/assets/js/wg-program-home\.js[^"]*"></script>', "", src)
    src, n = re.subn(r'(<link rel="stylesheet" href="/assets/css/styles\.css[^"]*">)', lambda x: x.group(1) + "\n" + CSS_TAG, src, count=1)
    if not n:
        raise SystemExit("no styles.css link to hang the program home CSS on")
    return src.replace("</body>", JS_TAG + "\n</body>", 1)


def expected(m, slug):
    path = page_of(slug)
    with open(os.path.join(ROOT, path), encoding="utf-8") as f:
        src = f.read()
    if len(MARK.findall(src)) != 1:
        return path, src, None, f"{path}: needs exactly one {START} ... {END} block"
    return path, src, with_assets(MARK.sub(lambda _: block(m, m["homes"][slug]), src), slug), None


def expected_manifest(slug):
    """manifests/<slug>.webmanifest: the main manifest with start_url /app/?home=<slug>. The id keeps it the same app."""
    with open(MANIFEST, encoding="utf-8") as f:
        man = json.load(f)
    man["start_url"] = f"/app/?home={slug}"
    path = f"manifests/{slug}.webmanifest"
    full = os.path.join(ROOT, path)
    old = open(full, encoding="utf-8").read() if os.path.exists(full) else None
    return path, old, json.dumps(man, indent=2, ensure_ascii=False) + "\n", None


def main(argv):
    check = "--check" in argv
    m = load()
    bad = []
    for path, old, new, err in ([expected(m, slug) for slug in m["homes"]] + [expected_app(m)]
                                + [expected_manifest(slug) for slug in m["homes"]]):
        if err:
            bad.append(err)
        elif new != old:
            if check:
                bad.append(f"{path}: is stale or missing; run python3 scripts/build-program-homes.py")
            else:
                os.makedirs(os.path.dirname(os.path.join(ROOT, path)), exist_ok=True)
                with open(os.path.join(ROOT, path), "w", encoding="utf-8") as f:
                    f.write(new)
                print("wrote", path)
    for b in bad:
        print("  -", b)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
