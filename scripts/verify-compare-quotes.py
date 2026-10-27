#!/usr/bin/env python3
"""Checks every review quote in scripts/compare-data/common.json against the raw review pull
(~/Documents/swipe-research/app-reviews/all_reviews.csv) and prints each source line for review.
Exit 1 when a quote is missing, ambiguous or its store, country, stars or month do not match."""
import csv, json, os, re, sys
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REVIEWS = json.load(open(os.path.join(ROOT, "scripts", "compare-data", "common.json"), encoding="utf-8"))["reviews"]
CSV = os.path.expanduser("~/Documents/swipe-research/app-reviews/all_reviews.csv")
norm = lambda s: re.sub(r"\s+", " ", s).strip()
rows = list(csv.DictReader(open(CSV, encoding="utf-8")))
M = {m: "%02d" % (i + 1) for i, m in enumerate("January February March April May June July August September October November December".split())}
CC = {"United States": "us", "United Kingdom": "gb", "Nigeria": "ng", "Australia": "au", "Canada": "ca"}
bad = 0
for key, r in REVIEWS.items():
    for q in r["complaints"] + r["praise"]:
        m = [x for x in rows if x["app"] == r["name"] and norm(x["text"]) == norm(q["t"])] or \
            [x for x in rows if x["app"] == r["name"] and norm(x["text"]).startswith(norm(q["t"]))]
        if len(m) != 1:
            print("NOT FOUND/AMBIGUOUS", q["t"][:60], len(m)); bad += 1; continue
        x = m[0]
        ok = (x["rating"] == str(q["stars"]) and x["date"].startswith("%d-%s" % (q["year"], M[q["month"]]))
              and (q.get("country") is None or x["country"] == CC[q["country"]])
              and x["store"] == ("apple" if q["store"] == "App Store" else "play"))
        full = norm(x["text"]) == norm(q["t"])
        if not full and not q.get("cut"):
            ok = False
        print("OK " if ok else "MISMATCH", "full" if full else "CUT ", r["name"], "|", q["store"], q.get("country"), q["stars"], q["month"], q["year"], "|", q["t"][:60])
        bad += (not ok)
sys.exit(1 if bad else 0)
