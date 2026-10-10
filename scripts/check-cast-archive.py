#!/usr/bin/env python3
"""Every cast image on the site is archived and indexed.

Rule (vault Content/WG Cast/00 - WG Cast Bible.md, "Every character lives here"): every cast image lives in the
vault's WG Cast folder and in ~/Downloads/Wholesome Girlies/WG Cast/, in matching subfolders, with a row in the
folder's index note. ~/Documents/ai-image-tools/cast_scene.py exports and indexes new scenes automatically.

This checks, for every image under assets/img/cast/ (scenes, result scenes, guides) and every result Share Card
under assets/img/results/<tool>/ (tools in scripts/results.json):
  1. it exists in the vault and in Downloads under the matching subfolder (scenes and result scenes also need
     their raw PNG original in raw/),
  2. it has a row in the folder's index note (first column is the file name),
  3. a Share Card's archived copies match the site file byte for byte (regenerated cards must be copied again),
and that every image in the vault WG Cast folder also exists, identical, in Downloads.
Prints one line per problem and exits 1 if there is any. Skips (exit 0) where the vault is absent, as on the GitHub runner.
Lives in this repo, not in ai-image-tools, because it reads the site's asset folders and results.json, and
check-pages.py runs it with the other vault-only checks. Paths can be overridden with WG_CAST_VAULT and WG_CAST_DOWNLOADS.
"""
import filecmp, json, os, sys

ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
VAULT = os.environ.get("WG_CAST_VAULT") or os.path.expanduser(
    "~/Documents/James Obsidian Vault/Areas/Work/Wholesome Girlies/Content/WG Cast")
DL = os.environ.get("WG_CAST_DOWNLOADS") or os.path.expanduser("~/Downloads/Wholesome Girlies/WG Cast")
INDEX = {"Site Scenes": "00 - Site Scenes.md", "Result Cards": "00 - Result Cards.md", "App Guides": "00 - App Guides.md"}
GUIDE_NAMES = {"tolu": "Tolu", "amaka": "Amaka", "zainab": "Zainab", "funmi": "Funmi"}
IMG = (".jpg", ".png", ".webp")


def listing(d):
    return sorted(f for f in os.listdir(d) if f.lower().endswith(IMG)) if os.path.isdir(d) else []


def main():
    if not os.path.isdir(VAULT):
        print("check-cast-archive: vault WG Cast folder not found, skipped")
        return 0
    problems = []
    index_text = {}
    for folder, note in INDEX.items():
        p = os.path.join(VAULT, folder, note)
        index_text[folder] = open(p).read() if os.path.exists(p) else ""
        if not index_text[folder]:
            problems.append(f"index note missing: {folder}/{note}")

    def indexed(folder, fname):
        return any(l.startswith("|") and l.split("|")[1].strip() == fname for l in index_text[folder].splitlines())

    def need(rel, folder=None, row=None, raw=None, src=None):
        """rel is the path inside WG Cast, e.g. 'Site Scenes/x.jpg'. src, when given, is the site file the archived
        copy must match byte for byte, so a regenerated card cannot leave a stale copy behind."""
        paths = [rel] + ([raw] if raw else [])
        for root, label in ((VAULT, "vault"), (DL, "Downloads")):
            for r in paths:
                if not os.path.exists(os.path.join(root, r)):
                    problems.append(f"missing in {label} WG Cast: {r}")
                elif src and r == rel and not filecmp.cmp(src, os.path.join(root, r), shallow=False):
                    problems.append(f"stale in {label} WG Cast (differs from the site file): {r}")
        if folder and row and not indexed(folder, row):
            problems.append(f"no index row in {folder}/{INDEX[folder]}: {row}")

    cast = os.path.join(ROOT, "assets/img/cast")
    for f in listing(cast):
        need(f"Site Scenes/{f}", "Site Scenes", f, f"Site Scenes/raw/{f[:-4]}.png")
    for f in listing(os.path.join(cast, "results")):
        need(f"Result Cards/{f}", "Result Cards", f, f"Result Cards/raw/{f[:-4]}.png")
    for f in listing(os.path.join(cast, "guides")):
        name = GUIDE_NAMES.get(f[:-5], f[:-5].title()) + " - Guide.png"
        need(f"App Guides/{name}", "App Guides", name)
    rj = os.path.join(ROOT, "scripts/results.json")
    if os.path.exists(rj):
        rc = index_text["Result Cards"]
        for tool, t in json.load(open(rj)).items():
            for rid in t.get("results", {}):
                for f in (f"{rid}.jpg", f"{rid}-status.jpg"):
                    rel = f"Result Cards/Share Cards/{tool}/{f}"
                    site = os.path.join(ROOT, "assets/img/results", tool, f)
                    need(rel, src=site if os.path.exists(site) else None)
                    if f"Share Cards/{tool}/{f}" not in rc:
                        problems.append(f"no index row in Result Cards/{INDEX['Result Cards']}: Share Cards/{tool}/{f}")
    # everything in the vault archive must also be in Downloads
    for dp, _, fs in os.walk(VAULT):
        for f in fs:
            if f.lower().endswith(IMG):
                rel = os.path.relpath(os.path.join(dp, f), VAULT)
                if not os.path.exists(os.path.join(DL, rel)):
                    problems.append(f"in vault but not in Downloads WG Cast: {rel}")
                elif not filecmp.cmp(os.path.join(dp, f), os.path.join(DL, rel), shallow=False):
                    problems.append(f"vault and Downloads copies differ: {rel}")
    seen = set()
    for p in problems:
        if p not in seen:
            seen.add(p); print(p)
    if problems:
        print(f"check-cast-archive: {len(seen)} problem(s). Run ~/Documents/ai-image-tools/cast_scene.py (it exports and indexes), "
              "or copy the image into both archives and add the index row. Rule: vault WG Cast Bible, Every character lives here.")
        return 1
    print("check-cast-archive: ok, every cast image is archived in the vault and Downloads and indexed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
