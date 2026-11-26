"""Shared kit for Wholesome Girlies original research pages under /insights/<slug>/.

Every study page carries the same four things, and this kit builds them so each new
study needs only a short script of its own (scripts/build-study-<name>.py):

1. A chart in the page, plain HTML and CSS, readable with no JavaScript and at phone
   width, with hover and keyboard tooltips. `stacked_bars()` draws a 100% stacked bar
   per row; add a new chart type here when a study needs one, never inline in a page.
2. The chart as a 1200 x 675 PNG (rendered at 2x), with the title and the source line
   built into the image, because a journalist embeds the image, not the page.
3. A PDF report in the press fact sheet's look (cream page, leaf logo, DM Serif Display
   headings, Nunito Sans body). Its words come from the page itself (title, lead, stat
   cards, intro, findings, method, limits), so the page stays the single source.
4. Download links under the chart (PNG and PDF). The page's "Use this data" box links
   the CSV, the PDF and the image by hand.

The chart sits between <!-- study-chart:start --> and <!-- study-chart:end -->. Never
edit inside the markers; change the study script and rerun it.

Page anatomy the PDF reads (keep it when writing a new study page; copy the first
study's page): <h1>, <p class="study-lead">, a "Published <date>" line, the byline,
<div class="study-stat"><strong>N</strong><span>label</span></div> cards, intro <p>s,
an <h2> followed by <div class="finding"><h3>..</h3><p>..</p></div> blocks,
<h2>Method</h2> with an <h3>Limits</h3> list, then <div class="use-data">.

Colours are validated with the dataviz skill's validate_palette.js before use: the
first study's blue #3A70B8 and green #5F8A1E pass every check on white. A third
series uses the neutral sand #DFDCC0 as "everything else".
"""
import html
import pathlib
import re
import subprocess
import tempfile

CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
START, END = "<!-- study-chart:start -->", "<!-- study-chart:end -->"
FONTS = ('<link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Nunito+Sans:wght@400;700;800'
         '&display=swap" rel="stylesheet">')
LOGO = ('<svg viewBox="0 0 56 56" width="40" height="40" aria-hidden="true"><circle cx="28" cy="28" r="27" fill="#6E7A3F"/>'
        '<path d="M18 38c0-11 8-18 20-18 0 11-8 18-20 18z" fill="#FBF8EF"/><path d="M20 37c5-6 11-10 17-12" '
        'stroke="#6E7A3F" stroke-width="1.9" fill="none" stroke-linecap="round"/></svg>')

CSS = """
.wgc{--wgc-ink:#33322A;--wgc-muted:#66645A;--wgc-line:#E4E1CE;--wgc-surface:#fff;
background:var(--wgc-surface);border:2px solid var(--wgc-ink);border-radius:18px;box-shadow:5px 5px 0 var(--wgc-ink);padding:24px;margin:26px 0 30px;color:var(--wgc-ink)}
.wgc-title{font-family:'Nunito Sans',sans-serif;font-weight:800;font-size:1.25rem;line-height:1.3;margin:0 0 4px;text-wrap:balance}
.wgc-sub{margin:0 0 16px;color:var(--wgc-muted);font-size:.95rem}
.wgc-legend{display:flex;flex-wrap:wrap;gap:6px 18px;margin:0 0 18px;padding:0;list-style:none;font-size:.9rem}
.wgc-legend li{display:flex;align-items:center;gap:7px}
.wgc-key{width:12px;height:12px;border-radius:3px;flex:none}
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

REPORT_CSS = """
@page{size:A4;margin:14mm 0;background:#FBF8EF}
@page:first{margin-top:0}
*{box-sizing:border-box}
html{background:#FBF8EF;-webkit-print-color-adjust:exact;print-color-adjust:exact}
body{font-family:'Nunito Sans',sans-serif;color:#33322A;font-size:11.5px;line-height:1.45;margin:0;padding:0 52px}
.first{padding-top:46px}
.top{display:flex;align-items:center;gap:12px;font-family:'DM Serif Display',serif;font-size:22px}
.eyebrow{margin:22px 0 0;font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#C0763F}
h1{font-family:'DM Serif Display',serif;font-weight:400;font-size:34px;line-height:1.1;margin:6px 0 8px}
h2{font-family:'DM Serif Display',serif;font-weight:400;font-size:19px;margin:16px 0 5px;break-after:avoid}
h3{font-size:13px;font-weight:800;margin:0 0 2px;break-after:avoid}
p{margin:0 0 8px} ul{margin:0 0 8px 18px;padding:0} li{margin:0 0 4px}
a{color:#33322A}
.meta{font-size:11px;color:#55534A}
.lead{font-size:13px}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:14px 0 16px}
.stat{background:#fff;border:2px solid #33322A;border-radius:14px;box-shadow:4px 4px 0 #33322A;padding:12px 14px;font-size:11.5px;line-height:1.35}
.stat b{display:block;font-family:'DM Serif Display',serif;font-weight:400;font-size:28px;line-height:1;margin-bottom:5px}
.finding{border-left:4px solid #D49A2A;padding:1px 0 1px 14px;margin:0 0 9px;break-inside:avoid}
.finding p{margin:0 0 4px}
table.data{width:100%;border-collapse:collapse;margin:8px 0 10px;break-inside:avoid;background:#fff;font-size:11.5px}
table.data th,table.data td{padding:5px 9px;border-bottom:1px solid #D7D3C8;text-align:left;vertical-align:top}
table.data th{background:#33322A;color:#fff;font-weight:700}
table.data td:nth-child(n+2){font-variant-numeric:tabular-nums}
.cite{background:#E3E6CC;border-radius:14px;padding:14px 18px;margin:16px 0 10px;break-inside:avoid}
.small{font-size:11px;color:#55534A}
.wgc.wgc-print{box-shadow:4px 4px 0 #33322A;border-radius:14px;padding:18px 20px;margin:14px 0 16px;break-inside:avoid}
.wgc-print .wgc-title{font-size:15px}.wgc-print .wgc-sub,.wgc-print .wgc-legend{font-size:11px;margin-bottom:10px}
.wgc-print .wgc-rows{gap:9px}.wgc-print .wgc-row,.wgc-print .wgc-axis{grid-template-columns:110px 1fr 120px}
.wgc-print .wgc-label{font-size:11.5px}.wgc-print .wgc-label small{font-size:10px}.wgc-print .wgc-axis{font-size:10px}.wgc-print .wgc-val{font-size:11px}.wgc-print .wgc-foot{font-size:10px;margin-top:12px;padding-top:10px}
"""

ABOUT = ("Wholesome Girlies is a health app and community that helps women through the hardest stretches of "
         "reproductive life: relationships, fertility, pregnancy and postpartum.")
CONTACT = "hello@wholesomegirlies.xyz"


def pct(n, d):
    return f"{100 * n / d:.1f}%" if d else "0.0%"


def text_of(fragment):
    flat = re.sub(r"\s+", " ", html.unescape(re.sub(r"<[^>]+>", " ", fragment))).strip()
    return re.sub(r" ([,.;:!?)])", r"\1", flat)


def _seg(color, n, total, row_label, series_label):
    """A focusable segment with a native title (no JavaScript) and a richer tooltip."""
    aria = html.escape(f"{row_label}: {series_label.lower()} held {n:,} of {total:,}", quote=True)
    tip = html.escape(f"{n:,} of {total:,} ({pct(n, total)})|{row_label}: {series_label.lower()}", quote=True)
    return (f'<span class="wgc-seg" style="flex:{n};background:{color}" tabindex="0" role="img" '
            f'aria-label="{aria}" title="{aria}" data-tip="{tip}"></span>')


def stacked_bars(*, title, subtitle, series, rows, source, downloads=(), export=False):
    """One 100% stacked bar per row.

    series: [(key, label, colour)] in stacking order.
    rows: [{"label", "sub", "values": {key: count}, "note": html beside the bar}].
    downloads: [(href, text)] shown under the chart on the page, hidden in the PNG.
    """
    body = []
    for r in rows:
        total = sum(r["values"].values())
        segs = "".join(_seg(c, r["values"][k], total, r["label"], lab) for k, lab, c in series if r["values"].get(k))
        body.append(f'<div class="wgc-row"><div class="wgc-label">{html.escape(r["label"])}<small>{html.escape(r.get("sub", ""))}</small></div>'
                    f'<div class="wgc-track"><div class="wgc-grid"></div><div class="wgc-stack">{segs}</div></div>'
                    f'<div class="wgc-val">{r.get("note", "")}</div></div>')
    legend = "".join(f'<li><span class="wgc-key" style="background:{c}"></span>{html.escape(lab)}</li>' for _k, lab, c in series)
    ticks = "".join(f'<span style="left:{25 * i}%">{25 * i}%</span>' for i in range(5))
    links = "" if export or not downloads else (
        "<span>" + " · ".join(f'<a class="wgc-dl" href="{h}" download>{html.escape(t)}</a>' for h, t in downloads) + "</span>")
    return (f'<h3 class="wgc-title">{html.escape(title)}</h3><p class="wgc-sub">{html.escape(subtitle)}</p>'
            f'<ul class="wgc-legend" aria-hidden="true">{legend}</ul>'
            f'<div class="wgc-body"><div class="wgc-rows">{"".join(body)}</div>'
            f'<div class="wgc-axis" aria-hidden="true"><span></span><span class="wgc-ticks">{ticks}</span><span></span></div></div>'
            f'<div class="wgc-foot"><span>{html.escape(source)}</span>{links}</div>')


def put_chart(page, chart_html, anchor):
    """Place the chart block before `anchor`, replacing any earlier block."""
    if START in page:
        page = page[:page.index(START)].rstrip("\n") + "\n" + page[page.index(END) + len(END):].lstrip("\n")
    block = (f'{START}\n<style>{CSS.strip()}</style>\n<figure class="wgc">{chart_html}</figure>\n'
             f'<script>{JS.strip()}</script>\n{END}')
    if anchor not in page:
        raise SystemExit(f"anchor not found on the page: {anchor}")
    return page.replace(anchor, block + "\n" + anchor, 1)


def page_parts(page):
    """The words the PDF reuses, read from the study page."""
    def one(rx):
        m = re.search(rx, page, re.S)
        if not m:
            raise SystemExit(f"study page is missing: {rx}")
        return m.group(1)
    findings_h2 = one(r"<h2>([^<]+)</h2>\s*<div class=\"finding\">")
    method_block = page[page.index("<h2>Method</h2>"):page.index('<div class="use-data">')]
    return {
        "title": text_of(one(r"<h1>(.*?)</h1>")),
        "canonical": one(r'<link rel="canonical" href="([^"]+)"'),
        "lead": text_of(one(r'<p class="study-lead">(.*?)</p>')),
        "published": text_of(one(r">Published ([^<]+)<")),
        "byline": text_of(one(r'<div class="byline">(.*?)</div>')),
        "stats": [(text_of(n), text_of(l)) for n, l in re.findall(r'<div class="study-stat"><strong>(.*?)</strong><span>(.*?)</span></div>', page)],
        "intro": [text_of(p) for p in re.findall(r"<p>(.*?)</p>", page[page.index('class="study-stats"'):page.index(f"<h2>{findings_h2}</h2>")], re.S)],
        "findings_h2": text_of(findings_h2),
        "findings": [(text_of(h), [text_of(p) for p in re.findall(r"<p>(.*?)</p>", b, re.S)])
                     for h, b in re.findall(r'<div class="finding"><h3>(.*?)</h3>(.*?)</div>', page, re.S)],
        "method": [text_of(p) for p in re.findall(r"<p>(.*?)</p>", method_block.split("<h3>Limits</h3>")[0], re.S)],
        "limits": [text_of(li) for li in re.findall(r"<li>(.*?)</li>", method_block, re.S)],
    }


def report_html(page, *, chart_html, sections_html, scope_note):
    """The PDF report. sections_html goes between the findings and the method (a data table)."""
    p, esc = page_parts(page), html.escape
    short = p["canonical"].split("://", 1)[1].rstrip("/")
    year = p["published"].split()[-1]
    stats = "".join(f'<div class="stat"><b>{esc(n)}</b>{esc(l)}</div>' for n, l in p["stats"])
    finds = "".join(f'<div class="finding"><h3>{esc(h)}</h3>' + "".join(f"<p>{esc(x)}</p>" for x in ps) + "</div>"
                    for h, ps in p["findings"])
    return f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><title>{esc(p['title'])}</title>{FONTS}
<style>{REPORT_CSS}{CSS}</style></head><body>
<div class="first"><div class="top">{LOGO}Wholesome Girlies</div>
<p class="eyebrow">Original research</p>
<h1>{esc(p['title'])}</h1>
<p class="meta">Published {esc(p['published'])}. {esc(p['byline'])}. The full study: <a href="{p['canonical']}">{esc(short)}</a></p></div>
<p class="lead">{esc(p['lead'])}</p>
<div class="stats">{stats}</div>
{''.join(f'<p>{esc(x)}</p>' for x in p['intro'])}
<figure class="wgc wgc-print">{chart_html}</figure>
<h2>{esc(p['findings_h2'])}</h2>
{finds}
{sections_html}
<h2>Method</h2>
{''.join(f'<p>{esc(x)}</p>' for x in p['method'])}
<h3>Limits</h3>
<ul>{''.join(f'<li>{esc(x)}</li>' for x in p['limits'])}</ul>
<div class="cite"><p><b>How to cite this study.</b> Wholesome Girlies ({year}). {esc(p['title'])}. {p['canonical']}</p>
<p>You may quote or republish the findings with a link to the study page. The data is on the page as a CSV file. Questions about the method: {CONTACT}</p></div>
<p class="small">{ABOUT} {esc(scope_note)}</p>
</body></html>"""


def render_png(chart_html, out):
    with tempfile.TemporaryDirectory() as tmp:
        src = pathlib.Path(tmp) / "chart.html"
        src.write_text(f'<!doctype html><meta charset="utf-8">{FONTS}<style>body{{margin:0;font-family:"Nunito Sans",sans-serif;background:#fff}}'
                       f'{CSS}</style><figure class="wgc wgc-export">{chart_html}</figure>')
        subprocess.run([CHROME, "--headless=new", "--hide-scrollbars", "--force-device-scale-factor=2",
                        "--window-size=1200,675", "--virtual-time-budget=4000", f"--screenshot={out}", src.as_uri()],
                       check=True, capture_output=True)
    print("wrote", out)


def render_pdf(report, out):
    with tempfile.TemporaryDirectory() as tmp:
        src = pathlib.Path(tmp) / "report.html"
        src.write_text(report)
        subprocess.run([CHROME, "--headless=new", "--no-pdf-header-footer", "--virtual-time-budget=4000",
                        f"--print-to-pdf={out}", src.as_uri()], check=True, capture_output=True)
    print("wrote", out)
