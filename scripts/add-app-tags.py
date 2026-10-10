#!/usr/bin/env python3
"""Adds the installable-app tags to every page, and is safe to run again.

- In <head>, after the apple-touch-icon link: the manifest link, the theme colour and the iPhone home-screen name.
- In <head>, after the styles.css link: /assets/css/wg-arrows.css, the site arrow (CLAUDE.md section 7).
- Before </body>: /assets/js/wg-arrows.js (swaps the text arrows for the site arrow), then /assets/js/wg-app.js
  (registers the service worker and shows the add-to-home-screen offers).
- In the footer's Explore list: a "Get the app" link to /app/. Never in the site menu, which is full.

Run from anywhere after adding pages:  python3 scripts/add-app-tags.py
When wg-app.js changes, bump APP_JS_VERSION here and run it again; it rewrites the version on every page.
When wg-arrows.css or wg-arrows.js changes, bump ARROWS_VERSION the same way.
"""
import glob
import os
import re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
APP_JS_VERSION = "20261011a"
HEAD = ('<link rel="manifest" href="/manifest.webmanifest">\n'
        '<meta name="theme-color" content="#6E7A3F">\n'
        '<meta name="apple-mobile-web-app-title" content="Girlies">')
ARROWS_VERSION = "20261010b"
ARROWS_CSS = f'<link rel="stylesheet" href="/assets/css/wg-arrows.css?v={ARROWS_VERSION}">'
SCRIPT = (f'<script defer src="/assets/js/wg-arrows.js?v={ARROWS_VERSION}"></script>\n'
          f'<script defer src="/assets/js/wg-app.js?v={APP_JS_VERSION}"></script>')
SKIP = {"branding-options.html", "logo-options.html"}

changed = 0
for p in sorted(glob.glob("**/*.html", recursive=True)):
    if p in SKIP or p.startswith(("_lab/", "lab/", "node_modules/", ".")):
        continue
    s = before = open(p, encoding="utf-8").read()
    if 'rel="manifest"' not in s:
        s = re.sub(r'(<link rel="apple-touch-icon"[^>]*>)', r"\1\n" + HEAD, s, count=1)
    # wg-app.js sits just before the tool reel script, which scripts/build-tool-reels.py keeps last before </body>
    s = re.sub(r'\n?<link rel="stylesheet" href="/assets/css/wg-arrows\.css\?v=[0-9a-z]+">', "", s)
    css = re.search(r'<link rel="stylesheet" href="/assets/css/styles\.css[^"]*">', s)
    s = s[:css.end()] + "\n" + ARROWS_CSS + s[css.end():] if css else s.replace("</head>", ARROWS_CSS + "\n</head>", 1)
    s = re.sub(r"<script defer src=\"/assets/js/wg-(?:app|arrows)\.js\?v=[0-9a-z]+\"></script>\n?", "", s)
    reel = re.search(r'<script defer src="/assets/js/wg-tool-reel\.js[^"]*"></script>', s)
    s = s[:reel.start()] + SCRIPT + "\n" + s[reel.start():] if reel else s.replace("</body>", SCRIPT + "\n</body>", 1)
    s = re.sub(r"(<h4>Explore</h4>\s*<ul>)((?:(?!</ul>).)*?)(</ul>)",
               lambda m: m.group(0) if 'href="/app/"' in m.group(2) else m.group(1) + m.group(2) + '<li><a href="/app/">Get the app</a></li>' + m.group(3),
               s, count=1, flags=re.S)
    if s != before:
        open(p, "w", encoding="utf-8").write(s)
        changed += 1
print(f"add-app-tags: {changed} page(s) updated")
