#!/usr/bin/env python3
"""Builds the web reader for a program, the on-site version of the toolkit PDF she buys.

The vault manuscript is the one source: Offers/<Program>/02 - Deliverables/00 - ... Manuscript.md.
Its "# " headings are parts, its "## " headings are lessons, and the text above the first part is "Start here".
The script writes programs/<slug>/read.html (noindex, served at /programs/<slug>/read). The page loads
wg-reader.css and wg-reader.js, which save her progress on her phone under wg_read_<slug> and lay the
parts out as a plan of cards, each with its own progress bar, that opens into one lesson at a time.

The "Play this" cards at the end of chosen lessons come from assets/data/program-games.json (the games placed in
each program), not from the manuscript, so the toolkit PDF stays as bought.
Edit the manuscript in the vault, never the page, then run:  python3 scripts/build-program-reader.py [slug ...]
"""
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OFFERS = os.path.expanduser("~/Documents/James Obsidian Vault/Areas/Work/Wholesome Girlies/Offers")
SITE = "https://wholesomegirlies.xyz"
READER_VERSION = "20261010a"
COVERS = "/assets/img/products/{}-cover.webp?v=20261009c"
# One manuscript per program. The diaspora home reads the same manuscript; its reader only links back to the diaspora home.
PROGRAMS = {
    "wife-material-blueprint": {
        "folder": "The Wife Material Blueprint", "stage": "relationships", "book": "Blueprint",
        "home": "Wife Material home", "cover": "/assets/img/products/wife-material-cover.webp?v=20261009a",
    },
    "trying-to-conceive-blueprint": {
        "folder": "The Trying-to-Conceive Blueprint", "stage": "fertility", "book": "Blueprint",
        "home": "Conception home", "cover": COVERS.format("trying-to-conceive-blueprint"), "flag": "wg_fertility_home",
    },
    "first-pregnancy-plan": {
        "folder": "The First Pregnancy Plan", "stage": "pregnancy", "book": "Plan",
        "home": "Pregnancy home", "cover": COVERS.format("first-pregnancy-plan"), "flag": "wg_pregnancy_home",
    },
    "postpartum-reset": {
        "folder": "The 6-Week Postpartum Reset", "stage": "postpartum", "book": "Reset",
        "home": "Postpartum home", "cover": COVERS.format("postpartum-reset"), "flag": "wg_pp_home",
    },
    "first-baby-playbook": {
        "folder": "The First Baby Playbook", "stage": "parenting", "book": "Playbook",
        "home": "First Baby home", "cover": COVERS.format("first-baby-playbook"), "flag": "wg_parenting_home",
    },
    "complete-motherhood-journey": {
        "folder": "The Complete Motherhood Journey", "stage": "fertility", "book": "Complete Motherhood Journey",
        "home": "Motherhood Journey home", "cover": COVERS.format("complete-motherhood-journey"),
    },
}
PROGRAMS.update({k + "-diaspora": v for k, v in list(PROGRAMS.items())})


def slugify(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower().replace("&", "and")).strip("-")


def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"\[\[(?:[^\]|]+\|)?([^\]]+)\]\]", r"\1", s)
    s = re.sub(r"\[([^\]]+)\]\(([^)\s]+)\)",
               lambda m: f'<a href="{local(m.group(2))}"{ext(m.group(2))}>{m.group(1)}</a>', s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    s = re.sub(r"(?<![*\w])\*(?!\s)(.+?)(?<!\s)\*(?![*\w])", r"<em>\1</em>", s)
    return s


def load_games():
    """assets/data/program-games.json: the games and where each program's reader plays them (keyed by base program)."""
    with open(os.path.join(ROOT, "assets", "data", "program-games.json"), encoding="utf-8") as f:
        return json.load(f)


def play_card(g, mom):
    """The 'Play this' card at the end of a lesson: tag with the day or week, game name, one line, button."""
    return (f'<aside class="rd-play"><p class="rd-play-tag">Play this<span> &middot; {html.escape(mom["when"], quote=False)}</span></p>'
            f'<p class="rd-play-name">{g["name"]}</p><p>{html.escape(mom["lead"], quote=False)}</p>'
            f'<a class="btn btn-primary" href="{g["path"]}">{g["button"]} &rarr;</a></aside>')


def toolkit_readers():
    """Drive file id of each toolkit PDF -> that program's slug, so a manuscript link to a toolkit PDF opens its reader."""
    with open(os.path.join(ROOT, "assets", "data", "program-homes.json"), encoding="utf-8") as f:
        homes = json.load(f)["homes"]
    out = {}
    for slug, h in homes.items():
        m = re.search(r"drive\.google\.com/file/d/([\w-]+)", h.get("pdf", ""))
        if m and not slug.endswith("-diaspora") and slug in PROGRAMS:
            out[m.group(1)] = slug
    return out


TOOLKITS = {}
MARKET = {"suffix": ""}  # "-diaspora" while a diaspora reader is built, so its toolkit links stay in that market


def local(url):
    m = re.search(r"drive\.google\.com/file/d/([\w-]+)", url)
    if m and m.group(1) in TOOLKITS:
        return f"/programs/{TOOLKITS[m.group(1)]}{MARKET['suffix']}/read"
    return url[len(SITE):] or "/" if url.startswith(SITE) else url


def ext(url):
    return "" if local(url).startswith("/") else ' target="_blank" rel="noopener"'


def blocks(lines):
    """Turns markdown lines into HTML blocks: paragraphs, lists, tool callouts and question-and-answer pairs."""
    out, para, items, rows = [], [], [], []

    def flush():
        if rows:
            cells = [[c.strip() for c in r.strip().strip("|").split("|")] for r in rows if not re.match(r"^\|[-:| ]+\|?$", r.strip())]
            head = "".join(f"<th>{inline(c)}</th>" for c in cells[0])
            trs = "".join("<tr>" + "".join(f'<td data-label="{html.escape(h, quote=True)}">{inline(c)}</td>' for h, c in zip(cells[0], r)) + "</tr>" for r in cells[1:])
            out.append(f'<div class="rd-table"><table><thead><tr>{head}</tr></thead><tbody>{trs}</tbody></table></div>')
            rows.clear()
        if para:
            text = "\n".join(para)
            q = re.match(r"\*\*(.+?\?)\*\*\n(.+)", text, re.S)
            tool = re.search(r"\]\(" + re.escape(SITE) + r"/[a-z-]+/tools/", text)
            if q:
                out.append(f'<details class="rd-qa"><summary>{inline(q.group(1))}</summary><p>{inline(q.group(2))}</p></details>')
            elif tool and len(re.findall(r"/tools/", text)) == 1:
                href = local(re.search(r"\]\(([^)]+)\)", text).group(1))
                out.append(f'<aside class="rd-tool"><p>{inline(text)}</p><a class="btn btn-primary" href="{href}">Open the tool &rarr;</a></aside>')
            else:
                out.append(f"<p>{inline(text)}</p>")
            para.clear()
        if items:
            out.append("<ul>" + "".join(f"<li>{inline(i)}</li>" for i in items) + "</ul>")
            items.clear()

    for line in lines:
        if not line.strip() or line.strip() == "---":
            flush()
        elif line.startswith("|"):
            if para or items:
                flush()
            rows.append(line)
        elif rows:
            flush()
            para.append(line.rstrip())
        elif line.startswith("### "):
            flush()
            out.append(f"<h4>{inline(line[4:].strip())}</h4>")
        elif re.match(r"[-*] ", line):
            if para:
                flush()
            items.append(line[2:].strip())
        elif items and line.startswith("  "):
            items[-1] += " " + line.strip()
        else:
            if items:
                flush()
            para.append(line.rstrip())
    flush()
    return "\n".join(out)


def parse(path):
    text = open(path, encoding="utf-8").read()
    text = re.sub(r"\A---\n.*?\n---\n", "", text, flags=re.S)
    # The program code line in the title block is for page 1 of the PDF; the program home already shows her code.
    text = re.sub(r"^(\*\*)?Your program code:.*\n", "", text, flags=re.M)
    lines = text.split("\n")
    title = next(l[2:].strip() for l in lines if l.startswith("# "))
    start = lines.index("# " + title) + 1
    parts, cur, lesson = [], {"title": "Start here", "intro": [], "lessons": []}, None
    front = []
    for line in lines[start:]:
        if line.startswith("# "):
            parts.append(cur)
            cur, lesson = {"title": line[2:].strip(), "intro": [], "lessons": []}, None
        elif line.startswith("## "):
            lesson = {"title": line[3:].strip(), "lines": []}
            cur["lessons"].append(lesson)
        elif lesson:
            lesson["lines"].append(line)
        elif not parts and not cur["lessons"]:
            front.append(line)
        else:
            cur["intro"].append(line)
    parts.append(cur)
    for p in parts:
        if not p["lessons"]:  # a part with no lessons (quick answers, next steps) reads as one lesson
            p["lessons"], p["intro"] = [{"title": p["title"], "lines": p["intro"]}], []
    sub = next((l[4:].strip() for l in front if l.startswith("### ")), "")
    parts[0]["intro"] = [l for l in front if not l.startswith("### ")] + parts[0]["intro"]
    return title, sub, parts


def play(lesson_title, plan, games):
    m = plan.pop(lesson_title, None)
    return play_card(games["games"][m["game"]], m) + "\n" if m else ""


def page(slug, cfg):
    MARKET["suffix"] = "-diaspora" if slug.endswith("-diaspora") else ""
    folder = os.path.join(OFFERS, cfg["folder"], "02 - Deliverables")
    path = next(os.path.join(folder, f) for f in sorted(os.listdir(folder)) if f.endswith("Manuscript.md"))
    title, sub, parts = parse(path)
    games = load_games()
    plan = {m["lesson"]: m for m in games["play"].get(slug.replace("-diaspora", ""), [])}
    home = f"/programs/{slug}/thank-you"
    seen, toc, body, n = set(), [], [], 0
    for pi, p in enumerate(parts):
        pid = f"part-{pi}"
        links, arts = [], []
        for le in p["lessons"]:
            lid = slugify(le["title"])
            while lid in seen:
                lid += "-2"
            seen.add(lid)
            n += 1
            links.append(f'<li><a href="#{lid}" data-lesson="{lid}"><span class="rd-tick" aria-hidden="true"></span><span>{inline(le["title"])}</span></a></li>')
            heading = "" if len(p["lessons"]) == 1 and le["title"] == p["title"] else f"<h3>{inline(le['title'])}</h3>"
            arts.append(f'<article class="rd-lesson" id="{lid}" data-part="{pid}" data-title="{html.escape(le["title"])}">\n{heading}\n{blocks(le["lines"])}\n{play(le["title"], plan, games)}'
                        f'<div class="rd-end"><button type="button" class="rd-done" data-lesson="{lid}">Done, next lesson</button></div>\n</article>')
        intro = blocks(p["intro"])
        toc.append(f'<div class="rd-toc-part" data-part="{pid}"><p class="rd-toc-title"><span>{inline(p["title"])}</span><span class="rd-count"></span></p><ol>{"".join(links)}</ol></div>')
        body.append(f'<section class="rd-part" id="{pid}"><header class="rd-part-head"><h2>{inline(p["title"])}</h2><p class="rd-part-meta"></p><div class="rd-part-bar" aria-hidden="true"><span></span></div></header>\n'
                    + (f'<div class="rd-intro">{intro}</div>\n' if intro else "") + "\n".join(arts) + "\n</section>")
    if plan:
        raise SystemExit(f"{slug}: program-games.json names lessons the manuscript does not have: {sorted(plan)}")
    flag = f' data-flag="{cfg["flag"]}"' if cfg.get("flag") else ""
    tpl = open(os.path.join(ROOT, "programs", slug, "thank-you.html"), encoding="utf-8").read()
    headtop = tpl[:tpl.index("<!-- No-crawl")]
    head_tail = re.search(r'<link rel="preconnect".*?<link rel="stylesheet" href="/assets/css/styles\.css[^>]*>', tpl, re.S).group(0)
    icons = re.search(r'<link rel="icon" type="image/svg\+xml".*?<meta name="apple-mobile-web-app-title"[^>]*>', tpl, re.S).group(0)
    consent_css = re.search(r'<link rel="stylesheet" href="/assets/vendor/cookieconsent/cookieconsent\.css[^>]*>\n<link rel="stylesheet" href="/assets/css/wg-consent\.css[^>]*>', tpl).group(0)
    noscript = re.search(r"<!-- Google Tag Manager \(noscript\) -->.*?<!-- End Google Tag Manager \(noscript\) -->", tpl, re.S).group(0)
    footer = re.search(r'<footer class="site-footer".*?</footer>', tpl, re.S).group(0)
    tail = re.search(r'<script defer src="/assets/vendor/cookieconsent/cookieconsent\.umd\.js.*?</body>', tpl, re.S).group(0)
    tail = re.sub(r'<script src="/assets/js/wg-share\.js[^>]*></script>\n|<script defer src="/assets/js/wg-tool-reel\.js[^>]*></script>\n', "", tail)
    return f"""{headtop}<!-- No-crawl: the program reader is for buyers, noindex and never in the sitemap. Built by scripts/build-program-reader.py from the vault manuscript; edit the manuscript, then rerun. -->
<meta name="robots" content="noindex, nofollow">
<title>Read {html.escape(title)} | Wholesome Girlies</title>
{head_tail}
<link rel="stylesheet" href="/assets/css/wg-reader.css?v={READER_VERSION}">
{icons}
{consent_css}
</head>
<body class="rd-page">
{noscript}

<header class="rd-header">
  <div class="wrap rd-header-row"><a class="rd-home" href="{home}">&larr; {html.escape(cfg["home"])}</a><span class="brand"><span class="dot"></span> Wholesome Girlies</span></div>
  <div class="rd-bar" aria-hidden="true"><span></span></div>
</header>

<main class="rd" data-program="{slug}" data-total="{n}"{flag}>
<div class="wrap rd-plan-page">
<section class="rd-hero">
  <img class="rd-cover" src="{cfg["cover"]}" width="480" height="600" alt="Cover of {html.escape(title)}">
  <div class="rd-hero-text">
    <p class="eyebrow">Your {html.escape(cfg["book"])}</p>
    <h1>{html.escape(title)}</h1>
    <p class="muted">{inline(sub)}</p>
  </div>
  <div class="rd-hero-go">
    <p class="rd-next-label">Up next<span class="rd-next-part"></span></p>
    <p class="rd-next-title"></p>
    <div class="rd-total-bar" aria-hidden="true"><span></span></div>
    <p class="rd-progress-text"><strong class="rd-done-count">0</strong> of {n} lessons done</p>
    <a class="btn btn-primary rd-continue" href="#{slugify(parts[0]["lessons"][0]["title"])}"><span class="rd-cta-long">Start reading &rarr;</span><span class="rd-cta-short">Start reading &rarr;</span></a>
  </div>
</section>
<nav class="rd-toc" aria-label="Contents">
{chr(10).join(toc)}
</nav>
</div>
<div class="wrap rd-read">
<div class="rd-body">
{chr(10).join(body)}
<nav class="rd-pager" aria-label="Lessons"><a class="rd-prev" href="#">&larr; <span></span></a><a class="rd-next btn btn-primary" href="#">Next &rarr;</a></nav>
</div>
</div>
</main>

{footer}

<script defer src="/assets/js/wg-reader.js?v={READER_VERSION}"></script>
{tail}
</html>
"""


def main():
    TOOLKITS.update(toolkit_readers())
    for slug in sys.argv[1:] or PROGRAMS:
        out = os.path.join(ROOT, "programs", slug, "read.html")
        s = page(slug, PROGRAMS[slug])
        if not os.path.exists(out) or open(out, encoding="utf-8").read() != s:
            open(out, "w", encoding="utf-8").write(s)
            print("program-reader: wrote", os.path.relpath(out, ROOT))


if __name__ == "__main__":
    main()
