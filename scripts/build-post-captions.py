#!/usr/bin/env python3
"""Builds "Post Captions.md", the one file Cynthia posts the Wholesome Girlies videos and carousels from.

Every video brief in the vault (Content/AI Video/<Program>/NN - ....md) carries a "## Post caption" section.
This script collects the caption of every brief whose video exists in ~/Downloads/Wholesome Girlies/Videos
(Tool Shorts/<Program>/ or UGC and Dialogue/<Program>/, matched by the brief's NN, and for the Brand launch films
Launch Films/NN <Title>/). A tool short brief also
carries a "## Carousel post caption", collected when its slides exist in
~/Downloads/Wholesome Girlies/Carousels/<Program>/NN - <Tool>/ (made by build-carousels.mjs in the site motion
kit). Entries are grouped by program, and the same file is written to two places:

  - the vault:     Content/AI Video/06 - Post Captions.md
  - the Downloads: ~/Downloads/Wholesome Girlies/Videos/Post Captions.md (uploaded to Google Drive for Cynthia)

A brief whose video or slides are not made yet is left out until its files appear. Edit captions in the briefs, never in
the output, because each run rewrites it. The file is only rewritten when its content changes.

Run it after changing a caption or rendering a video or carousel:  python3 scripts/build-post-captions.py
"""
import datetime
import glob
import os
import re

VAULT = os.path.expanduser("~/Documents/James Obsidian Vault/Areas/Work/Wholesome Girlies/Content/AI Video")
VIDEOS = os.path.expanduser("~/Downloads/Wholesome Girlies/Videos")
CAROUSELS = os.path.expanduser("~/Downloads/Wholesome Girlies/Carousels")
OUTPUTS = [os.path.join(VAULT, "06 - Post Captions.md"), os.path.join(VIDEOS, "Post Captions.md")]
PROGRAMS = ["The Wife Material Blueprint", "The Trying-to-Conceive Blueprint", "The First Pregnancy Plan",
            "The 6-Week Postpartum Reset", "The First Baby Playbook", "The Complete Motherhood Journey", "Brand"]
FORMAT_ORDER = {"9x16": 0, "4x5": 1, "16x9": 2}


def videos_for(program, nn):
    found = []
    for sub in ("Tool Shorts", "UGC and Dialogue"):
        folder = os.path.join(VIDEOS, sub, program)
        if os.path.isdir(folder):
            found += [(f"{sub}/{program}", f) for f in os.listdir(folder) if f.startswith(nn + " - ") and f.endswith(".mp4")]
    launch = os.path.join(VIDEOS, "Launch Films")
    if program == "Brand" and os.path.isdir(launch):
        for d in sorted(os.listdir(launch)):
            if d.startswith(nn + " ") and os.path.isdir(os.path.join(launch, d)):
                found += [(f"Launch Films/{d}", f) for f in os.listdir(os.path.join(launch, d)) if f.endswith(".mp4")]
    fmt = lambda f: next((FORMAT_ORDER[k] for k in FORMAT_ORDER if k in f), 9)
    return sorted(found, key=lambda x: fmt(x[1]))


def slides_for(program, title):
    folder = os.path.join(CAROUSELS, program, title)
    if not os.path.isdir(folder):
        return []
    num = lambda f: int(re.search(r"Slide (\d+)\.png$", f).group(1))
    return sorted((f for f in os.listdir(folder) if re.search(r" Slide \d+\.png$", f)), key=num)


def caption(text, heading="Post caption"):
    m = re.search(r"^## " + heading + r"\n.*?\n---\n\n(.*?)\n\n---\n", text, re.S | re.M)
    return m.group(1).strip() if m else None


def build():
    blocks, count, slides_count = [], 0, 0
    for program in PROGRAMS:
        entries = []
        for path in sorted(glob.glob(os.path.join(VAULT, program, "[0-9][0-9] - *.md"))):
            name = os.path.basename(path)[:-3]
            text = open(path, encoding="utf-8").read()
            title = re.sub(r"^(\d\d) - (?:Tool Short|UGC Sale|Dialogue Sale|UGC|Dialogue) - ", r"\1 - ", name)
            files, cap = videos_for(program, name[:2]), caption(text)
            if files and cap:
                folder = files[0][0]
                file_lines = "\n\n".join(f"`{f}`" for _, f in files)
                entries.append(f"### {title}\n\n**Folder:** {folder}\n\n**Files:**\n\n{file_lines}\n\n---\n\n{cap}\n\n---")
                count += 1
            slides, ccap = slides_for(program, title), caption(text, "Carousel post caption")
            if slides and ccap:
                entries.append(f"### {title} (carousel)\n\n**Folder:** Carousels/{program}/{title}\n\n"
                               f"**Slides:** {len(slides)}, posted in order from `{slides[0]}`\n\n"
                               f"**LinkedIn:** post `{title}.pdf` from the same folder as a document\n\n---\n\n{ccap}\n\n---")
                slides_count += 1
        if entries:
            blocks.append(f"## {program}\n\n" + "\n\n".join(entries))
    head = ("# Wholesome Girlies Post Captions\n\n"
            "Each video and carousel below has its caption between two lines. Find the video by its file name, or "
            "the carousel by its folder, copy everything between the two lines and paste it as the post caption. "
            "The same caption works on TikTok, Instagram and Facebook, and the 9x16, 4x5 and 16x9 versions of a "
            "video share it. Post a carousel's slides in number order, and on LinkedIn post its PDF instead.\n\n"
            "For the story and talking-head videos, which show AI people, and for the launch films The Girlies App and Game Night, "
            "which have an AI voice, switch on the platform's AI label when you post.\n\n"
            f"**Videos:** {count}\n\n"
            f"**Carousels:** {slides_count}\n\n"
            f"**Updated:** {datetime.date.today().strftime('%-d %B %Y')}\n")
    return head + "\n" + "\n\n".join(blocks) + "\n"


def main():
    body = build()
    for out in OUTPUTS:
        old = open(out, encoding="utf-8").read() if os.path.exists(out) else ""
        strip = lambda s: re.sub(r"\*\*Updated:\*\* .*\n", "", s)
        if strip(old) != strip(body):
            open(out, "w", encoding="utf-8").write(body)
            print("post-captions: wrote", out)


if __name__ == "__main__":
    main()
