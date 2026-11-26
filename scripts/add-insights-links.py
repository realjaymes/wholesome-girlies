#!/usr/bin/env python3
"""Add the Insights link to every full footer, safely on repeat runs.

The link sits in the Explore list after Tools. Run from anywhere:
python3 scripts/add-insights-links.py
"""

import glob
import os
import re


ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
SKIP = {"branding-options.html", "logo-options.html"}

changed = 0
for path in sorted(glob.glob("**/*.html", recursive=True)):
    if path in SKIP or path.startswith(("_lab/", "lab/", "node_modules/", ".")):
        continue
    source = before = open(path, encoding="utf-8").read()
    source = re.sub(
        r'(<h4>Explore</h4>\s*<ul>)((?:(?!</ul>).)*?)(</ul>)',
        lambda match: match.group(0)
        if 'href="/insights/"' in match.group(2)
        else match.group(1)
        + re.sub(
            r'(<li><a href="/tools/">Tools</a></li>)',
            r'\1<li><a href="/insights/">Insights</a></li>',
            match.group(2),
            count=1,
        )
        + match.group(3),
        source,
        count=1,
        flags=re.S,
    )
    if source != before:
        open(path, "w", encoding="utf-8").write(source)
        changed += 1

print(f"add-insights-links: {changed} page(s) updated")
