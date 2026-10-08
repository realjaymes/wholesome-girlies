#!/usr/bin/env python3
"""Writes the tool reels (tap-to-play phone clips of the tools) onto the sales and thank-you pages.

Source of truth: assets/data/tool-shorts.json, one entry per tool short. The reel HTML sits between
<!-- tool-reel:start --> and <!-- tool-reel:end --> markers on each page, and this script is the only
thing that writes it. Run from anywhere:

  python3 scripts/build-tool-reels.py            write every page (idempotent)
  python3 scripts/build-tool-reels.py --check    write nothing; exit 1 if any page differs from the manifest
  python3 scripts/build-tool-reels.py --fingerprint /postpartum/tools/mind-check-in
                                                 print the fingerprint of a tool page

Fingerprint (the "tool changed since its short was filmed" guard). A SHA-256 over two things from the
tool page: (1) the markup of its <div class="tool-app"> container as tag, class, id, type, name and
text only, with every wg-share row, script, style and noscript left out; (2) the body's inline
<script> code (the tool's logic and data), whitespace-collapsed, with JSON-LD left out. Analytics,
consent, share rows, schema, the head and the written guide never count.

Markers for a new program page are placed once by hand (sales: after the price card; thank-you:
where the tool grid was); after that the script owns the block between them.
"""
import hashlib
import html
import json
import os
import re
import sys
from html.parser import HTMLParser

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MANIFEST = os.path.join(ROOT, "assets/data/tool-shorts.json")
START, END = "<!-- tool-reel:start -->", "<!-- tool-reel:end -->"
ASSET_VERSION = "20261008a"
CSS_TAG = f'<link rel="stylesheet" href="/assets/css/wg-tool-reel.css?v={ASSET_VERSION}">'
JS_TAG = f'<script defer src="/assets/js/wg-tool-reel.js?v={ASSET_VERSION}"></script>'
PRIVATE_LABEL = "Private. Stays on your phone."


# ---------- fingerprint ----------

VOID = {"br", "hr", "img", "input", "meta", "link", "source", "wbr", "area", "col", "embed", "param", "track"}


class _Tool(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.depth = 0          # nesting inside tool-app (0 = outside)
        self.skip = []          # stack of tags being skipped (share rows, script, style, noscript)
        self.out = []
        self.scripts = []
        self._script = None
        self.body = False

    def handle_starttag(self, tag, attrs):
        a = dict(attrs)
        if tag == "body":
            self.body = True
        if tag == "script":
            if self.body and "src" not in a and "json" not in (a.get("type") or ""):
                self._script = []
            return
        if self.skip:
            if tag not in VOID:
                self.skip.append(tag)
            return
        cls = a.get("class") or ""
        if tag in ("style", "noscript") or "wg-share" in cls.split():
            if tag not in VOID:
                self.skip.append(tag)
            return
        if self.depth == 0 and tag == "div" and "tool-app" in cls.split():
            self.depth = 1
        elif self.depth and tag not in VOID:
            self.depth += 1
        if self.depth:
            keep = [f"{k}={a[k]}" for k in ("class", "id", "type", "name", "for") if a.get(k)]
            self.out.append(f"<{tag} {' '.join(keep)}>")

    def handle_endtag(self, tag):
        if tag == "script":
            if self._script is not None:
                self.scripts.append(re.sub(r"\s+", " ", "".join(self._script)).strip())
                self._script = None
            return
        if self.skip:
            if tag == self.skip[-1]:
                self.skip.pop()
            return
        if self.depth and tag not in VOID:
            self.depth -= 1

    def handle_data(self, data):
        if self._script is not None:
            self._script.append(data)
        elif self.depth and not self.skip:
            t = re.sub(r"\s+", " ", data).strip()
            if t:
                self.out.append(t)


def fingerprint_html(src):
    p = _Tool()
    p.feed(src)
    blob = "\n".join(p.out) + "\n--\n" + "\n".join(s for s in p.scripts if s)
    return hashlib.sha256(blob.encode("utf-8")).hexdigest()[:16]


def tool_file(tool_path):
    rel = tool_path.strip("/") + ".html"
    return os.path.join(ROOT, rel)


def fingerprint(tool_path):
    with open(tool_file(tool_path), encoding="utf-8") as f:
        return fingerprint_html(f.read())


# ---------- manifest ----------

def load():
    with open(MANIFEST, encoding="utf-8") as f:
        return json.load(f)


def save(m):
    with open(MANIFEST, "w", encoding="utf-8") as f:
        json.dump(m, f, indent=1, ensure_ascii=False)
        f.write("\n")


def pages_of(slug):
    """(path, market, kind) for the four pages of a program."""
    return [
        (f"programs/{slug}.html", "home", "sales"),
        (f"programs/{slug}-diaspora.html", "diaspora", "sales"),
        (f"programs/{slug}/thank-you.html", "home", "thank_you"),
        (f"programs/{slug}-diaspora/thank-you.html", "diaspora", "thank_you"),
    ]


def members(m, slug, kind):
    """Tool ids in the reel of a program page: the program's order list first, then any others."""
    key = "programs" if kind == "sales" else "thank_you_programs"
    ids = [i for i, t in m["tools"].items() if slug in t.get(key, [])]
    order = m["programs"][slug][kind]["order"]
    return [i for i in order if i in ids] + [i for i in ids if i not in order]


def esc(s):
    return html.escape(s, quote=True)


def file_v(rel):
    with open(os.path.join(ROOT, rel.lstrip("/")), "rb") as f:
        return hashlib.sha1(f.read()).hexdigest()[:8]


def pick(d, market):
    return d.get(market) or d["home"]


def card(t, prog, market, kind):
    title = t["title"]
    if kind == "sales":
        cap, name = pick(t["sales_line"], market), title
    else:
        cap = pick(t["thank_you_line"], market)
        name = title if prog.get("bundle") else t.get("thank_you_title", title)
    vid, poster = t["video"], t["poster"]
    alt = f"{title} in use"
    out = [f'<li class="ts-card{" is-private" if t.get("private") else ""}"><p class="ts-cap">{esc(cap)}</p>',
           f'<div class="vph" data-vid="{vid}?v={file_v(vid)}"><img class="vposter" src="{poster}?v={file_v(poster)}" '
           f'width="432" height="768" alt="{esc(alt)}" loading="lazy" decoding="async">'
           f'<button type="button" class="vplay" aria-label="Play a short clip of {esc(title)}"><span aria-hidden="true"></span></button>'
           f'<span class="vhint" aria-hidden="true">Tap to play</span></div>',
           f'<p class="ts-name">{esc(name)}</p>']
    if t.get("private"):
        out.append(f'<span class="ts-priv">{PRIVATE_LABEL}</span>')
    if kind == "thank_you":
        out.append(f'<a class="ts-open" href="{t["tool"]}"><span>Open the tool &rarr;</span></a>')
    out.append("</li>")
    return "".join(out[:1]) + "\n" + "".join(out[1:2]) + "\n" + "".join(out[2:])


def block(m, slug, market, kind):
    prog = m["programs"][slug]
    cfg = prog[kind]
    cards = "".join(card(m["tools"][i], prog, market, kind) for i in members(m, slug, kind))
    row = (f'<div class="ts-rowwrap"><button type="button" class="ts-arrow prev" aria-label="Previous tools" hidden>&#8249;</button>'
           f'<ul class="ts-row" tabindex="0" aria-label="{esc(cfg["aria"])}">{cards}</ul>'
           f'<button type="button" class="ts-arrow next" aria-label="Next tools">&#8250;</button></div>')
    if kind == "sales":
        inner = (f'<div class="ts-show" id="tsShow">\n      <div class="ts-head"><h2>{esc(cfg["heading"])}</h2>\n'
                 f'<p class="muted ts-sub">{esc(pick(cfg["sub"], market))}</p></div>\n      {row}\n    </div>')
    elif cfg.get("heading"):
        inner = f'<h3 style="margin:30px 0 8px;">{esc(cfg["heading"])}</h3>\n    {row}'
    else:
        inner = row
    return f"{START}\n    {inner}\n    {END}"


# ---------- page writing ----------

MARK = re.compile(re.escape(START) + r".*?" + re.escape(END), re.S)


def with_assets(src):
    """Make sure the page loads the reel CSS and JS exactly once, at the current version."""
    src = re.sub(r'\s*<link rel="stylesheet" href="/assets/css/wg-tool-reel\.css[^"]*">', "", src)
    src = re.sub(r'\s*<script defer src="/assets/js/wg-tool-reel\.js[^"]*"></script>', "", src)
    src, n = re.subn(r'(<link rel="stylesheet" href="/assets/css/styles\.css[^"]*">)', lambda x: x.group(1) + "\n" + CSS_TAG, src, count=1)
    if not n:
        raise SystemExit("no styles.css link to hang the reel CSS on")
    return src.replace("</body>", JS_TAG + "\n</body>", 1)


def expected(path, m, slug, market, kind):
    with open(os.path.join(ROOT, path), encoding="utf-8") as f:
        src = f.read()
    if len(MARK.findall(src)) != 1:
        return src, None, f"{path}: needs exactly one {START} ... {END} block"
    new = MARK.sub(lambda _: block(m, slug, market, kind), src)
    return src, with_assets(new), None


def main(argv):
    if "--fingerprint" in argv:
        print(fingerprint(argv[argv.index("--fingerprint") + 1]))
        return 0
    check = "--check" in argv
    m = load()
    bad = []
    for slug in m["programs"]:
        for path, market, kind in pages_of(slug):
            old, new, err = expected(path, m, slug, market, kind)
            if err:
                bad.append(err)
            elif new != old:
                if check:
                    bad.append(f"{path}: tool reel is stale; run python3 scripts/build-tool-reels.py")
                else:
                    with open(os.path.join(ROOT, path), "w", encoding="utf-8") as f:
                        f.write(new)
                    print("wrote", path)
    for b in bad:
        print("  -", b)
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
