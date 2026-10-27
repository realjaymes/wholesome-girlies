#!/usr/bin/env python3
"""Writes the comparison pages: /<stage>/compare/<slug> (head-to-head, alternatives, best-of).

The copy lives in scripts/compare-data/: common.json (author, sources, review quotes, shared FAQ answers) and
one <slug>.json per page, with "type" set to head-to-head, alternatives or best-of. Layout A is the shipped layout
for all three types. The page shell (head, header, footer and scripts) is read from a published guide, so a change to
the menu or the script versions reaches these pages on the next run.

    python3 scripts/build-compare-pages.py            write every page
    python3 scripts/build-compare-pages.py --check    exit 1 when a page on disk differs from what this would write
    python3 scripts/build-compare-pages.py --paths    print the page paths (the release command takes these)
    python3 scripts/build-compare-pages.py --lint     only run the copy lint

A new page is a new <slug>.json in scripts/compare-data/. Run scripts/build-stage-look.py and scripts/add-app-tags.py
afterwards only if the page check says a page is stale. The link preview card is a PAGE_CARDS entry in
scripts/og-looks.js named after the slug (run node scripts/make-og.js --pages <slug>). The sitemap is edited only by
wg_release.py on release day. Quotes are checked against the raw review pull by scripts/verify-compare-quotes.py.
"""
import glob
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "scripts", "compare-data")
SITE = "https://wholesomegirlies.xyz"
CSS_VERSION = "20261027a"
OG_VERSION = "20261027a"
# One published guide per stage supplies the page shell (fertility) and the stage's program card.
SHELL = "fertility/guides/fertile-window-explained.html"
STAGE_GUIDE = {"fertility": "fertility/guides/fertile-window-explained.html",
               "pregnancy": "pregnancy/guides/trimester-by-trimester.html",
               "postpartum": "postpartum/guides/postpartum-recovery-timeline.html",
               "parenting": "parenting/guides/starting-solids.html",
               "relationships": "relationships/guides/dating-on-purpose.html"}
STAGE_NAME = {"fertility": "Fertility", "pregnancy": "Pregnancy", "postpartum": "Postpartum",
              "parenting": "Parenting", "relationships": "Relationships"}


def read(p):
    with open(os.path.join(ROOT, p), encoding="utf-8") as f:
        return f.read()


def e(t):
    return html.escape(t, quote=False)


def ea(t):
    return html.escape(t, quote=True)


def load():
    common = json.load(open(os.path.join(DATA, "common.json"), encoding="utf-8"))
    pages = []
    for f in sorted(glob.glob(os.path.join(DATA, "*.json"))):
        if os.path.basename(f) != "common.json":
            pages.append(json.load(open(f, encoding="utf-8")))
    return common, pages


def out_path(page):
    return f"{page['stage']}/compare/{page['slug']}.html"


def url_of(page):
    return f"{SITE}/{page['stage']}/compare/{page['slug']}"


# ---------------------------------------------------------------- shell, read from a published guide

def shell(stage):
    ref = read(SHELL)
    head_open = ref[: ref.index("<title>")]
    after_tw = ref.index('<meta name="twitter:image"')
    after_tw = ref.index("\n", after_tw) + 1
    mid = ref[after_tw: ref.index('<script type="application/ld+json">')]
    tail_css = ref[ref.index('<link rel="stylesheet" href="/assets/vendor/cookieconsent'): ref.index("</head>")]
    tail_css = tail_css.rstrip("\n") + f'\n<link rel="stylesheet" href="/assets/css/wg-compare.css?v={CSS_VERSION}">\n'
    body_pre = ref[ref.index("</head>"): ref.index("<main>")]
    foot = ref[ref.index("</main>"):].replace("/assets/js/member-cta.js\"", "/assets/js/member-cta.js?v=20261008a\"")
    head_open = re.sub(r'<html lang="en"[^>]*>', f'<html lang="en" data-stage="{stage}">', head_open)
    sg = read(STAGE_GUIDE[stage])
    m = re.search(r'<div class="card program-cta">.*?</div>', sg, re.S)
    return head_open, mid, tail_css, body_pre, foot, m.group(0)


# ---------------------------------------------------------------- small renderers

def review_label(q):
    where = f" from {q['country']}" if q.get("country") else ""
    return f"{q['stars']}-star {q['store']} review{where}, {q['month']} {q['year']}"


def quote(q, r, good=False):
    text = e(q["t"]) + (" …" if q.get("cut") else "")
    url, label = q.get("url", r["listing"]), q.get("listing_label", r["listing_label"])
    return (f'<figure class="voice{" good" if good else ""}"><blockquote data-wg-tool cite="{ea(url)}"><p>“{text}”</p></blockquote>'
            f'<figcaption>{e(review_label(q))} <span class="voice-src">quoted from '
            f'<a href="{ea(url)}" rel="noopener" target="_blank">{e(label)}</a></span></figcaption></figure>')


def reviews(common, key, title, level="h2"):
    r = common["reviews"][key]
    out = [f'<div class="cmp-rv"><{level}>{e(title)}</{level}>', f'<p class="share">{e(r["share"])}</p>',
           "<h4>What women find hard</h4>"]
    out += [quote(q, r) for q in r["complaints"]]
    out.append("<h4>What women like</h4>")
    out += [quote(q, r, True) for q in r["praise"]]
    if r.get("note"):
        out.append(f'<p class="rvnote">{e(r["note"])}</p>')
    out.append(f'<p class="rvnote">{e(common["review_footer"])}</p></div>')
    return "\n".join(out)


def faq_items(common, items):
    out = []
    for it in items:
        if "ref" in it:
            it = common["faq"][it["ref"]]
        out.append(f'<details class="faq-item"><summary>{e(it["q"])}</summary><div class="faq-a">{e(it["a"])}</div></details>')
    return '<div style="margin-top:14px;">' + "".join(out) + "</div>"


def faq_pairs(common, items):
    return [(common["faq"][i["ref"]]["q"], common["faq"][i["ref"]]["a"]) if "ref" in i else (i["q"], i["a"]) for i in items]


def table(cols, rows, kind):
    """kind 'h2h': rows carry wg, other and kind (win, even, other). kind 'multi': rows carry cells and win (indices)."""
    n = len(cols)
    out = [f'<div class="cmp-table-wrap"><table class="cmp-table n{n}" role="table" style="--n:{n}"><thead><tr role="row">'
           + "".join(f'<th scope="col" role="columnheader">{e(c)}</th>' for c in cols) + "</tr></thead><tbody>"]
    for r in rows:
        if kind == "h2h":
            ahead = '<span class="cmp-ahead">%s ahead</span>' % e(cols[1]) if r["kind"] == "other" else ""
            win = r["kind"] == "win"
            cells = [(r["wg"], win), (r["other"], False)]
        else:
            ahead = ""
            cells = [(t, i in r["win"]) for i, t in enumerate(r["cells"])]
        out.append(f'<tr role="row"><th scope="row" role="rowheader">{e(r["label"])}{ahead}</th>')
        for (t, w), c in zip(cells, cols):
            tick = '<span class="cmp-tick" role="img" aria-label="Ahead">✓</span>' if w else ""
            cls = ' class="win"' if w else ""
            out.append(f'<td role="cell"{cls} data-label="{ea(c)}">{tick}{e(t)}</td>')
        out.append("</tr>")
    out.append("</tbody></table></div>")
    return "".join(out)


def cards(items, ahead=False):
    tick = "" if ahead else '<span class="cmp-tick" role="img" aria-label="Ahead">✓</span>'
    cls = "cmp-card ahead" if ahead else "cmp-card"
    return '<div class="cmp-grid">' + "".join(
        f'<div class="{cls}"><h3>{tick}{e(i["h"])}</h3><p>{e(i["b"])}</p></div>' for i in items) + "</div>"


def pick_card(x):
    return (f'<div class="cmp-pick{" first" if x["rank"] == 1 else ""}"><div class="top"><span class="cmp-rank">{x["rank"]}</span>'
            f'<div><h3>{e(x["name"])}</h3><span class="cmp-pill">{e(x["label"])}</span></div></div>'
            f'<dl><dt>Who it suits</dt><dd>{e(x["suits"])}</dd><dt>What it does</dt><dd>{e(x["does"])}</dd>'
            f'<dt>Watch for</dt><dd>{e(x["watch"])}</dd><dt>Price in Nigeria</dt><dd>{e(x["price"])}</dd></dl></div>')


def related(items):
    cards_ = "".join(
        f'<a class="card" href="{ea(i["href"])}"><span class="tag">{e(i["tag"])}</span><h3>{e(i["h"])}</h3><p>{e(i["p"])}</p>'
        f'<span class="arrow">{e(i["cta"])} &rarr;</span></a>' for i in items)
    return f'<div class="related"><h3>Keep going</h3><div class="grid grid-2" style="margin-top:16px;">{cards_}</div></div>'


def sources_block(common, ids):
    lis = "".join(
        f'<li>Read <a href="{ea(common["sources"][i]["url"])}" rel="noopener" target="_blank">{e(common["sources"][i]["title"])}</a> from {e(common["sources"][i]["publisher"])}.</li>'
        for i in ids)
    return f'<h2 style="margin-top:34px;">Sources</h2><ul class="muted sources">{lis}</ul><p class="cmp-note">{e(common["fx"]["line"])}</p>'


class Sections:
    """Collects page sections and alternates plain and tinted bands after the first section."""

    def __init__(self):
        self.parts = []

    def add(self, inner):
        band = ' class="stage-band"' if len(self.parts) % 2 == 1 else ""
        self.parts.append(f'<section{band}><div class="wrap narrow">\n{inner}\n</div></section>')

    def html(self):
        return "\n\n".join(self.parts)


# ---------------------------------------------------------------- the three page types, layout A

def intro(common, p):
    img = p["image"]
    d = p["disclaimer"]
    return "\n".join([
        f'<p class="cmp-lead">{e(p["kicker"])}</p>',
        f'<div class="cmp-answer"><p>{e(p["answer"])}</p></div>',
        f'<p class="cmp-note">{e(common["disclosure"])}</p>',
        f'<div class="disclaimer"><strong>{e(d["strong"])}</strong> {e(d["rest"])}</div>',
        f'<img class="cmp-img" width="1100" height="618" src="{ea(img["src"])}" alt="{ea(img["alt"])}" loading="lazy">',
    ])


def body_head_to_head(common, p, S):
    S.add(intro(common, p))
    S.add(f'<h2>{e(p["table_title"])}</h2>' + table(p["cols"], p["rows"], "h2h") + f'<p class="cmp-legend">{e(p["legend"])}</p>')
    S.add(f'<h2>{e(p["wins_title"])}</h2>' + cards(p["wins"]))
    S.add(f'<h2>{e(p["other_ahead_title"])}</h2>' + cards(p["other_ahead"], True))
    if p.get("statements"):
        st = p["statements"]
        figs = "".join(
            f'<figure class="voice"><blockquote data-wg-tool cite="{ea(q["url"])}"><p>“{e(q["t"])}”</p></blockquote><figcaption>{e(q["who"])} '
            f'<span class="voice-src">quoted from <a href="{ea(q["url"])}" rel="noopener" target="_blank">{e(q["label"])}</a></span></figcaption></figure>'
            for q in st["items"])
        S.add(f'<div class="cmp-rv"><h2>{e(st["title"])}</h2><p class="share">{e(st["lead"])}</p>{figs}</div>')
    if p.get("reviews"):
        S.add(reviews(common, p["reviews"][0], p["reviews_title"]))
    S.add(f'<h2>{e(p["picks_title"])}</h2><ul class="plain">' + "".join(f'<li><b>{e(i["h"])}</b> {e(i["b"])}</li>' for i in p["picks"]) + "</ul>")
    how = p.get("how")
    if how:
        S.add(f'<h2>{e(how["title"])}</h2>' + "".join(f"<p>{t}</p>" for t in how["paras"]))


def body_alternatives(common, p, S):
    S.add(intro(common, p))
    S.add(f'<h2>{e(p["picks_title"])}</h2>' + "".join(pick_card(x) for x in p["picks"]))
    rows = [{"label": p["glance_labels"][k], "cells": [x[k] for x in p["picks"]], "win": []} for k in p["glance_rows"]]
    S.add(f'<h2>{e(p["glance_title"])}</h2>' + table([x["name"] for x in p["picks"]], rows, "multi"))
    for r in p["reviews"]:
        S.add(reviews(common, r["key"], r.get("title") or "What women say about " + common["reviews"][r["key"]]["name"]))
    S.add(f'<h2>{e(p["why_title"])}</h2><p>{e(p["why"])}</p><h3 style="margin-top:16px">{e(p["criteria_title"])}</h3><ul class="plain">'
          + "".join(f"<li>{e(c)}</li>" for c in p["criteria"]) + "</ul>")


def body_best_of(common, p, S):
    S.add(intro(common, p))
    S.add(f'<h2>{e(p["method_title"])}</h2><ul class="plain">' + "".join(f"<li>{e(m)}</li>" for m in p["method"]) + "</ul>")
    S.add(f'<h2>{e(p["table_title"])}</h2>' + table(p["cols"], p["rows"], "multi"))
    for a in p["apps"]:
        rv = reviews(common, a["key"], "What women say about " + common["reviews"][a["key"]]["name"], "h3") if a["key"] in common["reviews"] else ""
        S.add(f'<h2>{a["rank"]}. {e(a["name"])}</h2><p>{e(a["body"])}</p><p><b>Best for:</b> {e(a["best"])}</p><p><b>Watch for:</b> {e(a["watch"])}</p>{rv}')


BODY = {"head-to-head": body_head_to_head, "alternatives": body_alternatives, "best-of": body_best_of}


# ---------------------------------------------------------------- the page

def schema(common, p):
    url = url_of(p)
    stage = STAGE_NAME[p["stage"]]
    cites = [{"@type": "CreativeWork", "name": common["sources"][i]["title"], "url": common["sources"][i]["url"], "publisher": common["sources"][i]["publisher"]} for i in p["sources"]]
    faq = {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in faq_pairs(common, p["faq"])]}
    crumbs = {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Home", "item": SITE + "/"},
        {"@type": "ListItem", "position": 2, "name": stage, "item": f"{SITE}/{p['stage']}/"},
        {"@type": "ListItem", "position": 3, "name": p["crumb"], "item": url}]}
    art = {"@context": "https://schema.org", "@type": "Article", "name": p["h1"], "headline": p["h1"], "description": p["description"],
           "datePublished": p["updated_iso"], "dateModified": p["updated_iso"], "inLanguage": "en",
           "author": {"@type": "Person", "name": common["author"]["name"], "jobTitle": common["author"]["role"], "url": SITE + common["author"]["url"]},
           "publisher": {"@type": "Organization", "name": "Wholesome Girlies", "logo": {"@type": "ImageObject", "url": SITE + "/assets/img/icon-512.png"}},
           "image": SITE + p["image"]["src"], "mainEntityOfPage": url, "citation": cites}
    return "\n".join(f'<script type="application/ld+json">\n{json.dumps(x, ensure_ascii=False)}\n</script>' for x in (faq, crumbs, art))


def render(common, p):
    head_open, mid, tail_css, body_pre, foot, program_cta = shell(p["stage"])
    url = url_of(p)
    og = f'{SITE}/assets/img/og/{p["slug"]}.jpg?v={OG_VERSION}'
    t, d = ea(p["title"]), ea(p["description"])
    head = "\n".join([
        f"<title>{e(p['title'])}</title>",
        f'<meta name="description" content="{d}">',
        f'<meta name="wg:share" content="{ea(p["share"])}">',
        f'<link rel="canonical" href="{url}">',
        '<meta property="og:type" content="article">', '<meta property="og:site_name" content="Wholesome Girlies">',
        f'<meta property="og:title" content="{t}">', f'<meta property="og:description" content="{d}">',
        f'<meta property="og:url" content="{url}">', f'<meta property="og:image" content="{og}">',
        '<meta name="twitter:card" content="summary_large_image">', '<meta name="twitter:site" content="@wgirlieshq">',
        f'<meta name="twitter:title" content="{t}">', f'<meta name="twitter:description" content="{d}">',
        f'<meta name="twitter:image" content="{og}">', ""])
    a = common["author"]
    S = Sections()
    BODY[p["type"]](common, p, S)
    S.add(sources_block(common, p["sources"]))
    S.add(f'<h2>Questions women ask</h2>{faq_items(common, p["faq"])}'
          f'<div class="doctor-box"><h4>When to see a doctor</h4><p class="muted" style="margin:0;">{e(p["doctor"])}</p></div>'
          f'\n{program_cta}\n{related(p["related"])}')
    hero = f'''<main>
<section class="tool-hero">
  <div class="wrap narrow">
    <div class="breadcrumb"><a href="/">Home</a> / <a href="/{p["stage"]}/">{STAGE_NAME[p["stage"]]}</a> / Compare</div>
    <p class="eyebrow">{e(p["eyebrow"])}</p>
    <h1>{e(p["h1"])}</h1>
    <p class="muted" style="font-size:.85rem;margin:.5rem 0 0;">Last updated: {e(p["updated"])}</p>
    <div class="byline"><span class="av" style="background:none;overflow:hidden;"><img src="/assets/img/team/cynthia-obinatu-sm.jpg" alt="{ea(a["name"])}" width="34" height="34" loading="lazy" style="width:100%;height:100%;object-fit:cover;display:block;"></span> <span>Written by <a href="{a["url"]}">{e(a["name"])}</a>, {e(a["role"])} &middot; Every claim comes from a cited source. Not yet reviewed by a clinician, so read it with our <a href="/about/medical-policy">medical policy</a>.</span></div>
  </div>
</section>

'''
    page = head_open + head + mid + schema(common, p) + "\n" + tail_css + body_pre + hero + '<div class="cmp">\n' + S.html() + "\n</div>\n" + foot
    return page


# ---------------------------------------------------------------- lint: rules the copy must keep

MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December"
CAPTURE = re.compile(rf"(?i)\b(?:checked|read|pulled|verified|captured|accessed|fetched)\s+(?:on|in)\b|\b\d{{1,2}}\s+(?:{MONTHS})\b|\bnot verified\b|\btodo\b|\bplaceholder\b|\blorem\b")
BANNED = re.compile(r"\bfree\b|\bWG\b|\bbots?\b|\bwebsites?\b|\bsites?\b|\bbrowsers?\b|—|–|\bhonest(?:ly)?\b|\bcalm(?:ly|er)?\b|\bgentl(?:e|y)\b", re.I)


def lint(common, pages):
    problems = []
    for p in pages:
        strings = []

        def walk(x, key=""):
            if isinstance(x, dict):
                for k, v in x.items():
                    if k not in ("updated", "updated_iso", "slug", "href", "src", "stage", "type", "ref", "key", "sources", "month", "year"):
                        walk(v, k)
            elif isinstance(x, list):
                for v in x:
                    walk(v, key)
            elif isinstance(x, str):
                strings.append(x)
        walk(p)
        for ref in [i for i in p["faq"] if "ref" in i]:
            walk(common["faq"][ref["ref"]])
        for k in {r if isinstance(r, str) else r["key"] for r in p.get("reviews", [])} | {a["key"] for a in p.get("apps", []) if a["key"] in common["reviews"]}:
            r = common["reviews"][k]
            walk({"share": r["share"], "note": r["note"]})
        for s in strings + [common["disclosure"], common["review_footer"]]:
            text = re.sub(r"<[^>]+>", "", s)
            m = CAPTURE.search(text) or BANNED.search(text)
            if m:
                problems.append(f'{p["slug"]}: "{m.group(0)}" in: {text[:90]}')
            for n in re.finditer(r"₦[\d,]+", text):
                if "$" not in text[n.end(): n.end() + 110]:
                    problems.append(f'{p["slug"]}: naira price with no dollar figure after it: {text[max(0, n.start() - 30): n.end() + 40]}')
        if not 50 <= len(p["title"]) <= 60:
            problems.append(f'{p["slug"]}: title is {len(p["title"])} characters, needs 50 to 60')
        if not 120 <= len(p["description"]) <= 155:
            problems.append(f'{p["slug"]}: description is {len(p["description"])} characters, needs 120 to 155')
        if len(p["share"]) > 250:
            problems.append(f'{p["slug"]}: share line is {len(p["share"])} characters, needs 250 or fewer')
        for k in ("doctor", "disclaimer", "image"):
            if k not in p:
                problems.append(f'{p["slug"]}: missing "{k}"')
        for i in p["sources"]:
            if i not in common["sources"]:
                problems.append(f'{p["slug"]}: unknown source {i}')
    return problems


def main(argv):
    common, pages = load()
    if "--paths" in argv:
        print("\n".join(out_path(p) for p in pages))
        return 0
    problems = lint(common, pages)
    if problems:
        print("\n".join("lint: " + x for x in problems))
        return 1
    if "--lint" in argv:
        print(f"build-compare-pages: lint clean ({len(pages)} pages)")
        return 0
    stale = 0
    for p in pages:
        path, new = out_path(p), render(common, p)
        full = os.path.join(ROOT, path)
        if "--check" in argv:
            if not os.path.exists(full) or read(path) != new:
                print(f"  - {path}: stale; run python3 scripts/build-compare-pages.py")
                stale += 1
            continue
        os.makedirs(os.path.dirname(full), exist_ok=True)
        with open(full, "w", encoding="utf-8") as f:
            f.write(new)
        print("wrote", path)
    if "--check" in argv:
        print(f"build-compare-pages: {stale} page(s) stale")
    return 1 if stale else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
