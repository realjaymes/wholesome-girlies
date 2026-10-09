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

  python3 scripts/build-program-homes.py           write every page (idempotent)
  python3 scripts/build-program-homes.py --check   write nothing; exit 1 if any page differs
"""
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "assets/data/program-homes.json")
START, END = "<!-- program-home:start -->", "<!-- program-home:end -->"
ASSET_VERSION = "20261009e"
CSS_TAG = f'<link rel="stylesheet" href="/assets/css/wg-program-home.css?v={ASSET_VERSION}">'
JS_TAG = f'<script defer src="/assets/js/wg-program-home.js?v={ASSET_VERSION}"></script>'
ARROW = ('<svg class="nav-dropdown-arrow" width="10" height="6" viewBox="0 0 10 6" fill="none" aria-hidden="true">'
         '<path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>')


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


def reading(h):
    w = word(h)
    if h.get("reader"):
        n, parts = lessons(h["reader"])
        key = "wg_read_" + h["reader"].strip("/").split("/")[1]
        return (f'<div class="ph-read" id="phRead" data-reader="{h["reader"]}" data-read-key="{key}">\n'
                f'          <p class="ph-label" id="phLabel">Read your {w}</p>\n'
                f'          <p class="ph-title" id="phTitle">{n} short lessons in {parts} parts. Your place is saved on this phone.</p>\n'
                f'          <div class="ph-prog"><div class="ph-ring" id="phRing" aria-hidden="true"><span>0<small>started</small></span></div>'
                f'<p class="muted ph-count" id="phCount">Not started yet</p></div>\n'
                f'          <a class="btn btn-primary btn-lg" id="phGo" href="{h["reader"]}">Start reading &rarr;</a>\n'
                f'        </div>\n'
                f'        <p class="ph-links"><a href="{h["reader"]}">See your plan</a>'
                f'{pdf_link(h["pdf"], "Download the PDF", "")}</p>').replace('<a class="" ', "<a ")
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


def card(c, level="h3"):
    return (f'<div class="ph-card"><p class="eyebrow">{c["eyebrow"]}</p><{level}>{c["h2"]}</{level}>'
            f'<p class="muted">{c["text"]}</p>'
            f'<a class="btn btn-primary" href="{attr(c["href"])}">{c["button"]}</a></div>')


def block(m, h):
    sh, g = h["share"], guide(m, h)
    extra = f'\n      <p style="margin-top:10px;">{sh["extra"]}</p>' if sh.get("extra") else ""
    community = f'\n    <section class="ph-sec">{card(h["community"])}</section>' if h.get("community") else ""
    nxt = f'\n    <section class="ph-sec">{card(h["cross_sell"])}</section>' if h.get("cross_sell") else ""
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
  <div class="wrap narrow">{community}
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
                         **({"reader": h["reader"]} if h.get("reader") else {})} for slug, h in m["homes"].items()},
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


def with_assets(src):
    """The page loads the program home CSS and JS exactly once, at the current version."""
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
    return path, src, with_assets(MARK.sub(lambda _: block(m, m["homes"][slug]), src)), None


def main(argv):
    check = "--check" in argv
    m = load()
    bad = []
    for path, old, new, err in [expected(m, slug) for slug in m["homes"]] + [expected_app(m)]:
        if err:
            bad.append(err)
        elif new != old:
            if check:
                bad.append(f"{path}: program home is stale; run python3 scripts/build-program-homes.py")
            else:
                with open(os.path.join(ROOT, path), "w", encoding="utf-8") as f:
                    f.write(new)
                print("wrote", path)
    for b in bad:
        print("  -", b)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
