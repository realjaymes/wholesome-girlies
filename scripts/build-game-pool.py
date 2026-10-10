#!/usr/bin/env python3
"""Writes assets/data/games.json, the pool the random game button picks from.

Source of truth: the cards on tools/index.html tagged Game or Quiz (path, name, line, stage from the path).
A game joins the pool when its card is on /tools/, so there is nothing else to register.
Run after adding or tagging a game:  python3 scripts/build-game-pool.py
"""
import json, re, html, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parent.parent
STAGES = ("relationships", "fertility", "pregnancy", "postpartum", "parenting")
page = (ROOT / "tools/index.html").read_text()
pool = []
for m in re.finditer(r'<a class="card ti" href="([^"]+)"[^>]*><span class="tag">(Game|Quiz)</span><h3>(.*?)</h3><p>(.*?)</p>', page):
    path, _, name, line = m.groups()
    stage = path.strip("/").split("/")[0]
    if stage not in STAGES: sys.exit("unknown stage in " + path)
    pool.append({"path": path, "name": html.unescape(name), "stage": stage, "line": html.unescape(line)})
out = {"_about": "Built by scripts/build-game-pool.py from the Game and Quiz cards on tools/index.html. Do not edit.", "games": pool}
(ROOT / "assets/data/games.json").write_text(json.dumps(out, ensure_ascii=False, indent=1) + "\n")
print(len(pool), "games")
