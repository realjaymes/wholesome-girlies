#!/usr/bin/env python3
"""Build the chart, its PNG and the PDF report for the "Who answers Nigerian women's
health searches" study page.

The chart is plain HTML and CSS, so it reads with no JavaScript and reflows at
phone width. A small script adds hover and keyboard tooltips. It sits in the
"Who holds the results, by topic" section, above the table.

The PNG (1200 x 675 at 2x) is rendered by headless Chrome from the same markup,
with the title and the source line built into the image, because a journalist
embeds the image, not the page.

The PDF report takes its findings, method and limits from the page itself and its
numbers from the study CSV, so the page stays the single source. It follows the
house document format (Arial, black text, 10pt body, 1.15 line spacing).

    python3 scripts/build-study-charts.py              # page markup, PNG and PDF
    python3 scripts/build-study-charts.py --no-render  # page markup only
"""
import argparse
import csv
import html
import pathlib
import re
import subprocess
import tempfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
STUDY = ROOT / "insights/who-answers-nigerian-womens-health-searches"
PAGE = STUDY / "index.html"
CSV = STUDY / "nigerian-womens-health-search-results-summary.csv"
PNG = "chart-by-topic.png"
PDF = "who-answers-nigerian-womens-health-searches.pdf"
URL = "https://wholesomegirlies.xyz/insights/who-answers-nigerian-womens-health-searches/"
SHORT_URL = "wholesomegirlies.xyz/insights/who-answers-nigerian-womens-health-searches"
CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
START, END = "<!-- study-chart:start -->", "<!-- study-chart:end -->"
ANCHOR = '<div class="study-table-wrap">'
FONTS = ('<link href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;700;800'
         '&display=swap" rel="stylesheet">')

CSS = """
.wgc{--wgc-ink:#33322A;--wgc-muted:#66645A;--wgc-line:#E4E1CE;--wgc-foreign:#3A70B8;--wgc-ng:#5F8A1E;--wgc-rest:#DFDCC0;--wgc-surface:#fff;
background:var(--wgc-surface);border:2px solid var(--wgc-ink);border-radius:18px;box-shadow:5px 5px 0 var(--wgc-ink);padding:24px;margin:26px 0 30px;color:var(--wgc-ink)}
.wgc-title{font-family:'Nunito Sans',sans-serif;font-weight:800;font-size:1.25rem;line-height:1.3;margin:0 0 4px;text-wrap:balance}
.wgc-sub{margin:0 0 16px;color:var(--wgc-muted);font-size:.95rem}
.wgc-legend{display:flex;flex-wrap:wrap;gap:6px 18px;margin:0 0 18px;padding:0;list-style:none;font-size:.9rem}
.wgc-legend li{display:flex;align-items:center;gap:7px}
.wgc-key{width:12px;height:12px;border-radius:3px;flex:none}
.wgc-k-foreign,.wgc-c-foreign{background:var(--wgc-foreign)}.wgc-k-ng,.wgc-c-ng{background:var(--wgc-ng)}.wgc-k-rest,.wgc-c-rest{background:var(--wgc-rest)}
.wgc-rows{display:grid;gap:14px}
.wgc-row,.wgc-axis{display:grid;grid-template-columns:150px 1fr 120px;gap:12px}
.wgc-row{align-items:center}
.wgc-label{font-weight:700;font-size:.95rem;line-height:1.25}
.wgc-label small{display:block;font-weight:400;color:var(--wgc-muted);font-size:.8rem}
.wgc-track{position:relative;height:24px}
.wgc-grid{position:absolute;inset:-7px 0;pointer-events:none;background:linear-gradient(to right,var(--wgc-line) 1px,transparent 1px) 0 0/25% 100%;border-right:1px solid var(--wgc-line)}
.wgc-stack{position:relative;display:flex;gap:2px;height:24px}
.wgc-seg{height:100%;min-width:3px;outline-offset:2px}
.wgc-seg:last-child{border-radius:0 4px 4px 0}
.wgc-seg:hover,.wgc-seg:focus-visible{filter:brightness(1.12);outline:2px solid var(--wgc-ink)}
.wgc-val{font-size:.9rem;font-variant-numeric:tabular-nums;white-space:nowrap}
.wgc-val b{font-weight:800}
.wgc-axis{margin-top:6px;font-size:.78rem;color:var(--wgc-muted);font-variant-numeric:tabular-nums}
.wgc-ticks{position:relative;height:1.3em}.wgc-ticks span{position:absolute;top:0;transform:translateX(-50%)}.wgc-ticks span:first-child{transform:none}.wgc-ticks span:last-child{transform:translateX(-100%)}
.wgc-foot{display:flex;flex-wrap:wrap;justify-content:space-between;gap:8px 18px;margin-top:18px;padding-top:14px;border-top:1px solid var(--wgc-line);font-size:.82rem;color:var(--wgc-muted)}
.wgc-dl{font-weight:700}
.wgc-tip{position:fixed;z-index:50;pointer-events:none;background:#33322A;color:#fff;border-radius:10px;padding:8px 11px;font-size:.85rem;line-height:1.35;max-width:260px;box-shadow:0 6px 18px rgba(0,0,0,.18)}
.wgc-tip b{display:block;font-size:1rem}
@media(max-width:620px){.wgc{padding:18px}.wgc-row{grid-template-columns:1fr;gap:6px}.wgc-axis{grid-template-columns:1fr}.wgc-axis>span:not(.wgc-ticks){display:none}}
.wgc-export{width:1200px;height:675px;box-sizing:border-box;margin:0;border:0;border-radius:0;box-shadow:none;padding:44px 56px;display:flex;flex-direction:column}
.wgc-export .wgc-title{font-size:2rem}.wgc-export .wgc-sub{font-size:1.15rem}.wgc-export .wgc-legend{font-size:1.05rem}
.wgc-export .wgc-row,.wgc-export .wgc-axis{grid-template-columns:230px 1fr 190px}
.wgc-export .wgc-label{font-size:1.1rem}.wgc-export .wgc-val{font-size:1.05rem}.wgc-export .wgc-body{flex:1}
.wgc-export .wgc-foot{font-size:.95rem}.wgc-export .wgc-dl{display:none}
"""

JS = """
(function(){var tip=null;function show(e){var el=e.currentTarget,t=el.getAttribute('data-tip');if(!t)return;if(!tip){tip=document.createElement('div');tip.className='wgc-tip';tip.setAttribute('role','presentation');document.body.appendChild(tip);}
var parts=t.split('|');tip.textContent='';var b=document.createElement('b');b.textContent=parts[0];tip.appendChild(b);tip.appendChild(document.createTextNode(parts[1]||''));tip.style.display='block';
var r=el.getBoundingClientRect(),x=e.clientX||r.left+r.width/2,y=(e.clientY||r.top)-12,w=tip.offsetWidth,h=tip.offsetHeight;tip.style.left=Math.max(8,Math.min(innerWidth-w-8,x-w/2))+'px';tip.style.top=Math.max(8,y-h)+'px';}
function hide(){if(tip)tip.style.display='none';}
document.querySelectorAll('.wgc [data-tip]').forEach(function(el){el.removeAttribute('title');el.addEventListener('pointermove',show);el.addEventListener('pointerleave',hide);el.addEventListener('focus',show);el.addEventListener('blur',hide);});})();
"""


def pct(n, d):
    return f"{100 * n / d:.1f}%"


def seg(cls, flex, value, label, aria):
    """A focusable segment with a native title (no JavaScript) and a richer tooltip."""
    a = html.escape(aria, quote=True)
    t = html.escape(f"{value}|{label}", quote=True)
    return (f'<span class="wgc-seg {cls}" style="flex:{flex}" tabindex="0" role="img" aria-label="{a}" '
            f'title="{a}" data-tip="{t}"></span>')


def chart(rows, export=False):
    body = []
    for r in rows:
        slots, f, n = int(r["result_slots"]), int(r["foreign_health_slots"]), int(r["nigerian_slots"])
        rest, topic = slots - f - n, r["topic"]
        segs = [seg("wgc-c-foreign", f, f"{f} of {slots} ({pct(f, slots)})", f"{topic}: foreign health publishers",
                    f"{topic}: foreign health publishers held {f} of {slots} results")]
        if n:
            segs.append(seg("wgc-c-ng", n, f"{n} of {slots} ({pct(n, slots)})", f"{topic}: Nigerian sources",
                            f"{topic}: Nigerian sources held {n} of {slots} results"))
        segs.append(seg("wgc-c-rest", rest, f"{rest} of {slots} ({pct(rest, slots)})", f"{topic}: everything else",
                        f"{topic}: everything else held {rest} of {slots} results"))
        body.append(f'<div class="wgc-row"><div class="wgc-label">{topic}<small>{slots:,} results</small></div>'
                    f'<div class="wgc-track"><div class="wgc-grid"></div><div class="wgc-stack">{"".join(segs)}</div></div>'
                    f'<div class="wgc-val">Nigerian: <b>{n}</b> ({pct(n, slots)})</div></div>')
    ticks = "".join(f'<span style="left:{25 * i}%">{25 * i}%</span>' for i in range(5))
    axis = f'<div class="wgc-axis" aria-hidden="true"><span></span><span class="wgc-ticks">{ticks}</span><span></span></div>'
    links = '' if export else (f'<span><a class="wgc-dl" href="{PNG}" download>Download this chart (PNG)</a> · '
                               f'<a class="wgc-dl" href="{PDF}" download>Full report (PDF)</a></span>')
    return ('<h3 class="wgc-title">In every topic, Nigerian sources held under 5% of the first ten results</h3>'
            '<p class="wgc-sub">Who held the first ten Google results for 237 searches made from Nigeria, by topic</p>'
            '<ul class="wgc-legend" aria-hidden="true"><li><span class="wgc-key wgc-k-foreign"></span>Foreign health publishers</li>'
            '<li><span class="wgc-key wgc-k-ng"></span>Nigerian sources</li>'
            '<li><span class="wgc-key wgc-k-rest"></span>Everything else</li></ul>'
            f'<div class="wgc-body"><div class="wgc-rows">{"".join(body)}</div>{axis}</div>'
            f'<div class="wgc-foot"><span>Source: Wholesome Girlies study of 2,370 Google results from Nigeria, '
            f'September 2026. {SHORT_URL}</span>{links}</div>')


def page_block(rows):
    return (f'{START}\n<style>{CSS.strip()}</style>\n<figure class="wgc">{chart(rows)}</figure>\n'
            f'<script>{JS.strip()}</script>\n{END}')


def text_of(fragment):
    return re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()


def report_html(page, rows):
    """The PDF report, built from the page's own words and the CSV."""
    lead = text_of(re.search(r'<p class="study-lead">(.*?)</p>', page, re.S).group(1))
    intro = [text_of(p) for p in re.findall(r"<p>(.*?)</p>", page[page.index('class="study-stats"'):page.index("<h2>Five findings</h2>")], re.S)]
    findings = re.findall(r'<div class="finding"><h3>(.*?)</h3>(.*?)</div>', page, re.S)
    method_block = page[page.index("<h2>Method</h2>"):page.index('<div class="use-data">')]
    method = text_of(re.search(r"<p>(.*?)</p>", method_block, re.S).group(1))
    limits = [text_of(li) for li in re.findall(r"<li>(.*?)</li>", method_block, re.S)]
    esc = html.escape
    rows_html = "".join(
        f"<tr><td>{esc(r['topic'])}</td><td>{int(r['queries'])}</td><td>{int(r['result_slots']):,}</td>"
        f"<td>{r['foreign_health_slots']} ({r['foreign_health_share_percent']}%)</td>"
        f"<td>{r['nigerian_slots']} ({r['nigerian_share_percent']}%)</td>"
        f"<td>{r['clusters_with_no_nigerian_source']} of {r['sampled_clusters']}</td></tr>" for r in rows)
    finds = "".join(f"<h3>{esc(text_of(h))}</h3>" + "".join(f"<p>{esc(text_of(p))}</p>" for p in re.findall(r"<p>(.*?)</p>", b, re.S))
                    for h, b in findings)
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>Who answers Nigerian women's health searches</title>
<style>
@page{{size:A4;margin:18mm 18mm 20mm}}
body{{font-family:Arial,Helvetica,sans-serif;font-size:10pt;line-height:1.15;color:#000;margin:0}}
h1{{font-size:20pt;font-weight:normal;margin:0 0 6pt}}
h2{{font-size:16pt;font-weight:normal;margin:16pt 0 6pt;break-after:avoid}}
h3{{font-size:12pt;font-weight:normal;margin:10pt 0 3pt;break-after:avoid}}
p{{margin:0 0 6pt}} ul{{margin:0 0 6pt;padding-left:16pt}} li{{margin:0 0 3pt}}
a{{color:#000}}
.meta{{margin:0 0 10pt}}
.stats{{width:100%;border-collapse:collapse;margin:8pt 0 10pt}}
.stats td{{border:0.75pt solid #000;padding:6pt 8pt;width:25%;vertical-align:top}}
.stats .n{{font-size:16pt;display:block;margin-bottom:2pt}}
figure{{margin:8pt 0 10pt;break-inside:avoid}} figure img{{width:100%;box-sizing:border-box;display:block;border:0.75pt solid #000}}
table.topics{{width:100%;border-collapse:collapse;margin:6pt 0 8pt;break-inside:avoid}}
table.topics th,table.topics td{{border:0.75pt solid #000;padding:4pt 6pt;text-align:left;font-weight:normal}}
table.topics th{{background:#eee}}
.cite{{border:0.75pt solid #000;padding:8pt 10pt;margin-top:12pt;break-inside:avoid}}
</style></head><body>
<h1>Who answers Nigerian women's health searches</h1>
<p class="meta">Original research by Wholesome Girlies. Published 26 November 2026, by James Praise, founder and researcher.<br>
The full study, with every Nigerian source named: <a href="{URL}">{SHORT_URL}</a></p>
<p>{esc(lead)}</p>
<table class="stats"><tr><td><span class="n">237</span>searches studied</td><td><span class="n">2,370</span>organic result places</td>
<td><span class="n">572</span>distinct domains</td><td><span class="n">1.9%</span>of places held by Nigerian sources</td></tr></table>
{''.join(f'<p>{esc(p)}</p>' for p in intro)}
<figure><img src="{(STUDY / PNG).as_uri()}" alt="In every topic, Nigerian sources held under 5% of the first ten results"></figure>
<h2>Five findings</h2>
{finds}
<h2>Who holds the results, by topic</h2>
<p>"Nigerian" means a Nigerian-owned publisher or company, or a Nigerian government or university body. Foreign health publishers are counted apart from social networks, shops, journals and general news.</p>
<table class="topics"><tr><th>Topic</th><th>Searches</th><th>Result places</th><th>Foreign health publishers</th><th>Nigerian sources</th><th>Topic groups with no Nigerian source</th></tr>{rows_html}</table>
<h2>Method</h2>
<p>{esc(method)}</p>
<h3>Limits</h3>
<ul>{''.join(f'<li>{esc(l)}</li>' for l in limits)}</ul>
<div class="cite"><p><b>How to cite this study.</b> Wholesome Girlies (2026). Who answers Nigerian women's health searches. {URL}</p>
<p>You may quote or republish the findings with a link to the study page. The topic data is on the page as a CSV file. Questions about the method: care@wholesomegirlies.xyz</p></div>
</body></html>"""


def render(rows, page):
    with tempfile.TemporaryDirectory() as tmp:
        src = pathlib.Path(tmp) / "chart.html"
        src.write_text(f'<!doctype html><meta charset="utf-8">{FONTS}<style>body{{margin:0;font-family:"Nunito Sans",sans-serif;background:#fff}}'
                       f'{CSS}</style><figure class="wgc wgc-export">{chart(rows, export=True)}</figure>')
        subprocess.run([CHROME, "--headless=new", "--hide-scrollbars", "--force-device-scale-factor=2",
                        "--window-size=1200,675", "--virtual-time-budget=4000",
                        f"--screenshot={STUDY / PNG}", src.as_uri()], check=True, capture_output=True)
        print("wrote", STUDY / PNG)
        rep = pathlib.Path(tmp) / "report.html"
        rep.write_text(report_html(page, rows))
        subprocess.run([CHROME, "--headless=new", "--no-pdf-header-footer", "--virtual-time-budget=4000",
                        f"--print-to-pdf={STUDY / PDF}", rep.as_uri()], check=True, capture_output=True)
        print("wrote", STUDY / PDF)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-render", action="store_true")
    args = ap.parse_args()
    rows = list(csv.DictReader(CSV.open()))
    text = PAGE.read_text()
    if START in text:
        text = text[:text.index(START)].rstrip("\n") + "\n" + text[text.index(END) + len(END):].lstrip("\n")
    text = text.replace(ANCHOR, page_block(rows) + "\n" + ANCHOR, 1)
    PAGE.write_text(text)
    print("updated", PAGE)
    if not args.no_render:
        render(rows, text)


if __name__ == "__main__":
    main()
