#!/usr/bin/env python3
"""Builds "Post Captions.md", the one file Cynthia posts the Wholesome Girlies videos, carousels and image ads from.

Every caption is written once, in the note that holds the piece, and this script collects them. Nothing is edited in
the output, because each run rewrites it.

  - Videos: every brief in the vault (Content/AI Video/<Program>/NN - ....md) carries a "## Post caption" section. A
    brief is collected when its video exists in ~/Downloads/Wholesome Girlies/Videos, matched by the brief's NN in
    Tool Shorts/<Program>/, UGC and Dialogue/<Program>/ or Converted Films/<Program>/. The Brand launch films are
    matched in Launch Films/NN <Title>/. A sales film is matched at the top level of Sales Films/ by its title, because
    the sales films of different programs share NNs (a Direct Offer cut keeps "Direct Offer" in its file name and heading).
  - Carousels: a tool short brief also carries a "## Carousel post caption", collected when its slides exist in
    ~/Downloads/Wholesome Girlies/Carousels/<Program>/NN - <Tool>/ (made by build-carousels.mjs in the site motion kit).
  - Image ads: the "Organic post caption" block under each "### Top N." heading of
    Content/<Program>/Image Ads/01 - Image Ad Concepts.md, collected when ~/Downloads/Wholesome Girlies/Image Ads/<Program>/
    holds the NN - <Title> 4x5 and 9x16 images. They sit in their own "Image Ads" section at the end, with #### headings.

Entries are grouped by program, and the same file is written to two places:

  - the vault:     Content/Post Captions.md
  - the Downloads: ~/Downloads/Wholesome Girlies/Post Captions.md

The Drive copy Cynthia reads on her phone is a Google Doc named "Post Captions" in the Wholesome Girlies folder on Drive. This
script does not write it. When the file changes, the script prints a reminder, and Claude recreates the Doc through the Drive
connector (same name, same folder, markdown converted to a Google Doc) and trashes the old one.

A piece whose files are not made yet is left out until they appear. A file is only rewritten when its content changes
(the Updated line is ignored). Set POST_CAPTIONS_OUT_DIR to write vault.md and downloads.md into that folder instead,
for a test run.

Run it after changing a caption or rendering a video, carousel or image:  /usr/bin/python3 scripts/build-post-captions.py
"""
import datetime
import glob
import os
import re

VAULT = os.path.expanduser("~/Documents/James Obsidian Vault/Areas/Work/Wholesome Girlies/Content/AI Video")
VIDEOS = os.path.expanduser("~/Downloads/Wholesome Girlies/Videos")
DOWNLOADS = os.path.expanduser("~/Downloads/Wholesome Girlies")
CAROUSELS = os.path.expanduser("~/Downloads/Wholesome Girlies/Carousels")
IMAGE_ADS = os.path.expanduser("~/Downloads/Wholesome Girlies/Image Ads")
CONTENT = os.path.dirname(VAULT)


def outputs():
    test = os.environ.get("POST_CAPTIONS_OUT_DIR")
    if test:
        return [os.path.join(test, n) for n in ("vault.md", "downloads.md")]
    return [os.path.join(CONTENT, "Post Captions.md"), os.path.join(DOWNLOADS, "Post Captions.md")]


PROGRAMS = ["The Wife Material Blueprint", "The Trying-to-Conceive Blueprint", "The First Pregnancy Plan",
            "The 6-Week Postpartum Reset", "The First Baby Playbook", "The Complete Motherhood Journey", "Brand"]
FORMAT_ORDER = {"9x16": 0, "4x5": 1, "16x9": 2}


def squash(text):
    return re.sub(r"[^a-z0-9]", "", text.lower())


def videos_for(program, nn, title=""):
    found = []
    for sub in ("Tool Shorts", "UGC and Dialogue", "Converted Films"):
        folder = os.path.join(VIDEOS, sub, program)
        if os.path.isdir(folder):
            found += [(f"{sub}/{program}", f) for f in os.listdir(folder) if f.startswith(nn + " - ") and f.endswith(".mp4")]
    launch = os.path.join(VIDEOS, "Launch Films")
    if program == "Brand" and os.path.isdir(launch):
        for d in sorted(os.listdir(launch)):
            if d.startswith(nn + " ") and os.path.isdir(os.path.join(launch, d)):
                found += [(f"Launch Films/{d}", f) for f in os.listdir(os.path.join(launch, d)) if f.endswith(".mp4")]
    sales = os.path.join(VIDEOS, "Sales Films")
    if os.path.isdir(sales):
        want = squash(title)
        for f in os.listdir(sales):
            m = re.match(r"^" + nn + r" - (.*?)[ -]+(?:9x16|4x5|16x9)\.mp4$", f)
            if m and squash(m.group(1)) in (want, want + "directoffer"):
                found.append(("Sales Films", f))
    fmt = lambda f: next((FORMAT_ORDER[k] for k in FORMAT_ORDER if k in f), 9)
    return sorted(sorted(found), key=lambda x: fmt(x[1]))


def slides_for(program, title):
    folder = os.path.join(CAROUSELS, program, title)
    if not os.path.isdir(folder):
        return []
    num = lambda f: int(re.search(r"Slide (\d+)\.png$", f).group(1))
    return sorted((f for f in os.listdir(folder) if re.search(r" Slide \d+\.png$", f)), key=num)


def caption(text, heading="Post caption"):
    m = re.search(r"^## " + heading + r"\n.*?\n---\n\n(.*?)\n\n---\n", text, re.S | re.M)
    return m.group(1).strip() if m else None


def image_ads():
    """One #### entry per image ad whose 4x5 and 9x16 images exist, captioned from its concept note."""
    entries = []
    for program in PROGRAMS:
        note = os.path.join(CONTENT, program, "Image Ads", "01 - Image Ad Concepts.md")
        folder = os.path.join(IMAGE_ADS, program)
        if not (os.path.isfile(note) and os.path.isdir(folder)):
            continue
        sections = {int(n): body for n, body in re.findall(r"^### Top (\d+)\..*?\n(.*?)(?=^##)", open(note, encoding="utf-8").read() + "\n##", re.S | re.M)}
        for nn in sorted({f[:2] for f in os.listdir(folder) if re.match(r"\d\d - ", f)}):
            names = {fmt: next((f for f in os.listdir(folder) if f.startswith(nn + " - ") and f.endswith(f" {fmt}.png")), None) for fmt in ("4x5", "9x16")}
            m = re.search(r"\*\*Organic post caption:\*\*\n\n---\n\n(.*?)\n\n---\n", sections.get(int(nn), ""), re.S)
            if all(names.values()) and m:
                title = names["4x5"][:-len(" 4x5.png")]
                file_lines = "\n\n".join(f"`{names[k]}`" for k in ("4x5", "9x16"))
                entries.append(f"#### {program}: {title}\n\n**Folder:** Image Ads/{program}\n\n**Files:**\n\n{file_lines}\n\n---\n\n{m.group(1).strip()}\n\n---")
    return entries


def build():
    blocks, count, slides_count = [], 0, 0
    for program in PROGRAMS:
        entries = []
        for path in sorted(glob.glob(os.path.join(VAULT, program, "[0-9][0-9] - *.md"))):
            name = os.path.basename(path)[:-3]
            text = open(path, encoding="utf-8").read()
            title = re.sub(r"^(\d\d) - (?:Tool Short|UGC Sale|Dialogue Sale|Sales Film|UGC|Dialogue) - ", r"\1 - ", name)
            files, cap = videos_for(program, name[:2], title[5:]), caption(text)
            if files and cap:
                folder = files[0][0]
                heading = title + (" (Direct Offer)" if "Direct Offer" in files[0][1] and "Direct Offer" not in title else "")
                file_lines = "\n\n".join(f"`{f}`" for _, f in files)
                entries.append(f"### {heading}\n\n**Folder:** {folder}\n\n**Files:**\n\n{file_lines}\n\n---\n\n{cap}\n\n---")
                count += 1
            slides, ccap = slides_for(program, title), caption(text, "Carousel post caption")
            if slides and ccap:
                entries.append(f"### {title} (carousel)\n\n**Folder:** Carousels/{program}/{title}\n\n"
                               f"**Slides:** {len(slides)}, posted in order from `{slides[0]}`\n\n"
                               f"**LinkedIn:** post `{title}.pdf` from the same folder as a document\n\n---\n\n{ccap}\n\n---")
                slides_count += 1
        if entries:
            blocks.append(f"## {program}\n\n" + "\n\n".join(entries))
    ads = image_ads()
    if ads:
        blocks.append("## Image Ads\n\nPost the 4x5 image as a feed post on Instagram and Facebook, and the 9x16 image as a photo post on TikTok. "
                      "The image carries the same caption on every platform.\n\n" + "\n\n".join(ads))
    head = ("# Wholesome Girlies Post Captions\n\n"
            "Each video, carousel and image ad below has its caption between two lines. Find the video or image by its file name, or "
            "the carousel by its folder, copy everything between the two lines and paste it as the post caption. "
            "The same caption works on TikTok, Instagram, Facebook, X and LinkedIn, and the 9x16, 4x5 and 16x9 versions of a "
            "video share it. Post a carousel's slides in number order, and on LinkedIn post its PDF instead.\n\n"
            "For the story, talking-head, UGC, dialogue, sales and Direct Offer films and the image ads, which show AI people, and for the launch films The Girlies App and Game Night, "
            "which have an AI voice, switch on the platform's AI label when you post.\n\n"
            f"**Videos:** {count}\n\n"
            f"**Carousels:** {slides_count}\n\n"
            f"**Image ads:** {len(ads)}\n\n"
            f"**Updated:** {datetime.date.today().strftime('%-d %B %Y')}\n")
    return head + "\n" + "\n\n".join(blocks) + "\n"


def x_length(text):
    """Length as X counts it: every link counts as 23 characters."""
    return len(re.sub(r"\S*wholesomegirlies\.xyz\S*|https?://\S+", "x" * 23, text))


def main():
    body = build()
    for title, cap in re.findall(r"### (.*?)\n.*?\n---\n\n(.*?)\n\n---", body, re.S):
        if x_length(cap) > 280:
            print(f"post-captions: WARNING {title} runs {x_length(cap)} characters on X (over 280), so it needs X Premium on the posting account or a shorter X cut")
    changed = False
    for out in outputs():
        old = open(out, encoding="utf-8").read() if os.path.exists(out) else ""
        strip = lambda s: re.sub(r"\*\*Updated:\*\* .*\n", "", s)
        if strip(old) != strip(body):
            open(out, "w", encoding="utf-8").write(body)
            changed = True
            print("post-captions: wrote", out)
    if changed:
        print("post-captions: captions changed, so recreate the Post Captions Google Doc in the Wholesome Girlies folder on Drive and trash the old one.")


if __name__ == "__main__":
    main()
