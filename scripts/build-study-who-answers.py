#!/usr/bin/env python3
"""Build the chart, its PNG and the PDF report for the study
"Who answers Nigerian women's health searches" (/insights/who-answers-nigerian-womens-health-searches/).

The numbers come from the study CSV, which scripts/analyse-womens-health-serps.py writes
from the September 2026 Google Nigeria results. The shared parts (chart, PNG, PDF, page
block) live in scripts/study_kit.py; this file holds only what is particular to this study.

    python3 scripts/build-study-who-answers.py              # page chart, PNG and PDF
    python3 scripts/build-study-who-answers.py --no-render  # page chart only
"""
import argparse
import csv
import html
import pathlib

import study_kit as kit

ROOT = pathlib.Path(__file__).resolve().parent.parent
SLUG = "who-answers-nigerian-womens-health-searches"
STUDY = ROOT / "insights" / SLUG
PAGE = STUDY / "index.html"
NAMES = kit.file_names(SLUG)
CSV = STUDY / NAMES["csv"]
PNG, PDF = NAMES["png"], NAMES["pdf"]
ANCHOR = '<div class="study-table-wrap">'  # the chart sits above the topic table

SERIES = [("foreign", "Foreign health publishers", "#3A70B8"),
          ("ng", "Nigerian sources", "#5F8A1E"),
          ("rest", "Everything else", "#DFDCC0")]


def chart(rows, export=False):
    bars = []
    for r in rows:
        slots, f, n = int(r["result_slots"]), int(r["foreign_health_slots"]), int(r["nigerian_slots"])
        bars.append({"label": r["topic"], "sub": f"{slots:,} results",
                     "values": {"foreign": f, "ng": n, "rest": slots - f - n},
                     "note": f"Nigerian: <b>{n}</b> ({kit.pct(n, slots)})"})
    return kit.stacked_bars(
        title="In every topic, Nigerian sources held under 5% of the first ten results",
        subtitle="Who held the first ten Google results for 237 searches made from Nigeria, by topic",
        series=SERIES, rows=bars, export=export,
        source=f"Source: Wholesome Girlies study of 2,370 Google results from Nigeria, September 2026. wholesomegirlies.xyz/insights/{SLUG}",
        downloads=[(PNG, "Download this chart (PNG)"), (PDF, "Full report (PDF)")])


def topic_table(rows):
    esc = html.escape
    body = "".join(
        f"<tr><td>{esc(r['topic'])}</td><td>{int(r['queries'])}</td><td>{int(r['result_slots']):,}</td>"
        f"<td>{r['foreign_health_slots']} ({r['foreign_health_share_percent']}%)</td>"
        f"<td>{r['nigerian_slots']} ({r['nigerian_share_percent']}%)</td>"
        f"<td>{r['clusters_with_no_nigerian_source']} of {r['sampled_clusters']}</td></tr>" for r in rows)
    return ('<h2>Who holds the results, by topic</h2>'
            '<p>"Nigerian" means a Nigerian-owned publisher or company, or a Nigerian government or university body. '
            'Foreign health publishers are counted apart from social networks, shops, journals and general news.</p>'
            '<table class="data"><tr><th>Topic</th><th>Searches</th><th>Result places</th><th>Foreign health publishers</th>'
            f'<th>Nigerian sources</th><th>Topic groups with no Nigerian source</th></tr>{body}</table>')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-render", action="store_true")
    args = ap.parse_args()
    rows = list(csv.DictReader(CSV.open()))
    page = kit.put_chart(PAGE.read_text(), chart(rows), ANCHOR)
    PAGE.write_text(page)
    print("updated", PAGE)
    if not args.no_render:
        kit.render_png(chart(rows, export=True), STUDY / PNG)
        kit.render_pdf(kit.report_html(page, chart_html=chart(rows, export=True), sections_html=topic_table(rows),
                                       scope_note="This study measures who appears in search results. It does not assess the medical quality of any page."),
                       STUDY / PDF)


if __name__ == "__main__":
    main()
