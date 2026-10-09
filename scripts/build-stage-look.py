#!/usr/bin/env python3
"""Stamps the sticker look's stage onto every page, and puts the stage's guide in tool and stage headers.

1. <html data-stage="..."> on every page that belongs to a stage, from its address: /relationships/, /fertility/,
   /pregnancy/, /postpartum/, /parenting/, and the program pages, bridges and homes of each program (the Complete
   Motherhood Journey takes parenting). styles.css reads it for the page's stage colour (--s, --st, --s-on).
2. The stage's guide (a waist-up cast figure from assets/img/cast/guides/) at the right of the .tool-hero on each
   tool page and stage hub. Never on guides, shared result pages, loss pages, the mental-health check-ins or the
   warning signs guide.

Safe to run again. Run after adding pages:   python3 scripts/build-stage-look.py
The page check runs it with --check, which writes nothing and exits 1 when a page differs.
"""
import glob
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
GUIDE_VERSION = "20261009e"
STAGES = ("relationships", "fertility", "pregnancy", "postpartum", "parenting")
PROGRAMS = {"wife-material": "relationships", "trying-to-conceive": "fertility", "first-pregnancy": "pregnancy",
            "postpartum-reset": "postpartum", "first-baby": "parenting", "complete-motherhood": "parenting"}
# name, file, width, height of each stage's guide (the same set as "guides" in assets/data/program-homes.json)
GUIDES = {"relationships": ("Tolu", "tolu", 392, 620), "fertility": ("Amaka", "amaka", 255, 569),
          "pregnancy": ("Zainab", "zainab", 289, 563), "postpartum": ("Funmi", "funmi", 293, 569),
          "parenting": ("Funmi", "funmi", 293, 569)}
QUIET = re.compile(r"mind-check-in|the-wait-check-in|warning-signs|loss|miscarriage|stillbirth")
SKIP = {"branding-options.html", "logo-options.html"}
IMG = re.compile(r'\n?\s*<img class="hero-guide"[^>]*>')


def stage_of(path):
    first = path.split("/")[0]
    if first in STAGES:
        return first
    if first in ("programs", "go"):
        name = path.split("/")[1]
        for prefix, stage in PROGRAMS.items():
            if name.startswith(prefix):
                return stage
    return ""


def wants_guide(path, stage):
    if not stage or QUIET.search(path):
        return False
    return path == f"{stage}/index.html" or re.fullmatch(rf"{stage}/tools/[^/]+\.html", path) is not None


def build(path, src):
    stage = stage_of(path)
    s = re.sub(r"<html([^>]*?)\s+data-stage=\"[^\"]*\"", r"<html\1", src, count=1)
    if stage:
        s = re.sub(r"<html([^>]*)>", lambda m: f'<html{m.group(1)} data-stage="{stage}">', s, count=1)
    s = IMG.sub("", s)
    s = s.replace('<section class="tool-hero guided">', '<section class="tool-hero">')
    if wants_guide(path, stage) and '<section class="tool-hero">' in s:
        name, file, w, h = GUIDES[stage]
        start = s.index('<section class="tool-hero">')
        end = s.index("</section>", start)
        img = (f'  <img class="hero-guide" src="/assets/img/cast/guides/{file}.webp?v={GUIDE_VERSION}" '
               f'width="{w}" height="{h}" alt="Illustration of {name}" decoding="async">\n')
        s = s[:start] + '<section class="tool-hero guided">' + s[start + len('<section class="tool-hero">'):end] + img + s[end:]
    return s


def pages():
    os.chdir(ROOT)
    for p in sorted(glob.glob("**/*.html", recursive=True)):
        if p in SKIP or p.startswith(("_lab/", "node_modules/", ".")):
            continue
        yield p


def main(argv):
    check = "--check" in argv
    bad = 0
    for p in pages():
        src = open(p, encoding="utf-8").read()
        new = build(p, src)
        if new != src:
            bad += 1
            if check:
                print(f"  - {p}: stage look is stale; run python3 scripts/build-stage-look.py")
            else:
                open(p, "w", encoding="utf-8").write(new)
    print(f"build-stage-look: {bad} page(s) {'stale' if check else 'updated'}")
    return 1 if check and bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
