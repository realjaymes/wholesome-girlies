#!/usr/bin/env python3
"""Post-deploy check: every tool, guide and shared result page is live and carries its own link preview.

Run it after every push that adds a tool, game, quiz or result, once GitHub Pages has published:

    python3 scripts/check-live-previews.py [https://wholesomegirlies.xyz]

The page list is what the repo says should be live: the tool and guide pages in sitemap.xml and on disk, the result pages
from scripts/results.json (they are noindex, so they are not in the sitemap), and the Baby Name Explorer naming
pages found under parenting/tools/baby-name-explorer/result/. For each page it checks:
  1. the page returns 200 on the live domain (a page that is not pushed yet fails here),
  2. og:image is present and is not assets/img/og/default.jpg (tools, guides and results each need their own card),
  3. the og:image URL returns 200 with an image/jpeg content type.
Exits 1 on any failure and prints a short summary. This is the live twin of scripts/check-pages.py, which checks the
files before the push.
"""
import json
import os
import re
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOMAIN = (sys.argv[1] if len(sys.argv) > 1 else "https://wholesomegirlies.xyz").rstrip("/")
UA = {"User-Agent": "Mozilla/5.0 (compatible; WG-live-preview-check/1.0; +https://wholesomegirlies.xyz)"}
STAGES = ("relationships", "fertility", "pregnancy", "postpartum", "parenting")
NAME_TOOL = ("parenting", "baby-name-explorer")


def fetch(url, want_body=True, tries=2):
    """Returns (status, content_type, body) and never raises: a network error is status 0."""
    last = (0, "", b"")
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=25) as r:
                return r.status, r.headers.get("Content-Type", ""), (r.read() if want_body else b"")
        except urllib.error.HTTPError as e:
            last = (e.code, e.headers.get("Content-Type", "") if e.headers else "", b"")
            if e.code == 404:
                break
        except Exception as e:  # DNS, timeout, reset
            last = (0, str(e)[:60], b"")
        time.sleep(1)
    return last


def local_paths():
    """(kind, path) for every page that should be live."""
    pages = []
    sm = open(os.path.join(ROOT, "sitemap.xml")).read()
    for loc in re.findall(r"<loc>([^<]+)</loc>", sm):
        m = re.match(r"https?://[^/]+(/(?:%s)/(tools|guides)/[^/]+)$" % "|".join(STAGES), loc)
        if m:
            pages.append(("tool" if m.group(2) == "tools" else "guide", m.group(1)))
    # pages on disk that the sitemap does not list yet (release day adds them), so a new game is checked too
    for stage in STAGES:
        for sub, kind in (("tools", "tool"), ("guides", "guide")):
            d = os.path.join(ROOT, stage, sub)
            if os.path.isdir(d):
                for f in sorted(os.listdir(d)):
                    if f.endswith(".html") and f != "index.html":
                        pages.append((kind, f"/{stage}/{sub}/{f[:-5]}"))
    results = json.load(open(os.path.join(ROOT, "scripts/results.json")))
    for tool, t in results.items():
        for rid in t.get("results", {}):
            pages.append(("result", f"/{t['stage']}/tools/{tool}/result/{rid}"))
    stage, tool = NAME_TOOL
    d = os.path.join(ROOT, stage, "tools", tool, "result")
    if os.path.isdir(d):
        for f in sorted(os.listdir(d)):
            if f.endswith(".html"):
                pages.append(("result", f"/{stage}/tools/{tool}/result/{f[:-5]}"))
    seen, out = set(), []
    for k, p in pages:
        if p not in seen:
            seen.add(p)
            out.append((k, p))
    return out


image_cache = {}


def check_image(url):
    if url not in image_cache:
        status, ctype, _ = fetch(url, want_body=False)
        if status != 200:
            image_cache[url] = f"image returns {status or 'no response'} ({url.replace(DOMAIN, '')})"
        elif "image/jpeg" not in ctype.lower():
            image_cache[url] = f"image is {ctype or 'unknown type'}, not image/jpeg ({url.replace(DOMAIN, '')})"
        else:
            image_cache[url] = None
    return image_cache[url]


def check(item):
    kind, path = item
    status, _, body = fetch(DOMAIN + path)
    if status != 200:
        return kind, path, f"page returns {status or 'no response'}"
    html = body.decode("utf-8", "replace")
    m = re.search(r'property="og:image" content="([^"]+)"', html)
    if not m:
        return kind, path, "no og:image"
    img = m.group(1)
    if re.search(r"/og/default\.jpg", img):
        return kind, path, "og:image is default.jpg (the page has no card of its own live)"
    if img.startswith("/"):
        img = DOMAIN + img
    err = check_image(img)
    return kind, path, err


def main():
    items = local_paths()
    with ThreadPoolExecutor(max_workers=8) as ex:
        results = list(ex.map(check, items))
    fails = [(k, p, e) for k, p, e in results if e]
    by_kind = {}
    for k, _, e in results:
        by_kind.setdefault(k, [0, 0])
        by_kind[k][0] += 1
        by_kind[k][1] += 1 if e else 0
    print(f"check-live-previews: {DOMAIN}")
    for k, (n, f) in sorted(by_kind.items()):
        print(f"  {k + 's':8} {n - f}/{n} ok")
    if fails:
        print(f"\n{len(fails)} failing:")
        for k, p, e in fails[:40]:
            print(f"  FAIL {k:6} {p}: {e}")
        if len(fails) > 40:
            print(f"  ... and {len(fails) - 40} more")
        print("\nIf these are new pages, push them (and wait for the Pages deploy), then run this again.")
        sys.exit(1)
    print("all pages live with their own link preview")


if __name__ == "__main__":
    main()
