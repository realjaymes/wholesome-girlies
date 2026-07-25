# Wholesome Girlies — website (v1)

First version of the static site. Hand-coded HTML, no framework, in the MIA-website pattern. See the strategy and build plan in the Obsidian vault: `Areas/Work/Wholesome Girlies/`.

## Preview locally

Open `index.html` in a browser, or run a local server from this folder for clean absolute paths:

```
python3 -m http.server 8080
```

Then visit http://localhost:8080

## What is built in v1

- **Home** (`index.html`) — free-tools hero, tool search, stage band, trust, newsletter capture.
- **Postpartum hub** (`postpartum/index.html`) — stage landing with tools and guides.
- **Tools** (working, client-side):
  - `postpartum/tools/recovery-timeline-calculator.html` — date in, week-by-week milestones out.
  - `postpartum/tools/recovery-checklist.html` — tickable, saves progress to the device (localStorage).
- **Guide** (`postpartum/guides/postpartum-recovery-timeline.html`) — topical-authority article with FAQ schema.
- **About** (`about/index.html`) — real-women-fronted, founder private, no fictional team.
- **Sales page** (`programs/postpartum-reset.html`) — the info-product + community bundle.
- **Ad bridge** (`go/postpartum-reset.html`) — noindex pre-sell page; ads point here.
- **Legal** (`legal/disclaimer.html`) — placeholder medical disclaimer, privacy, terms.
- `robots.txt`, `sitemap.xml` — `/go/` and thank-you pages excluded on purpose.

## Design

Warm & nurturing palette, all tokens in `assets/css/styles.css` (`:root` variables). Fonts: Fraunces + Nunito Sans (Google Fonts).

## Compliance components (baked in)

- "Educational, not medical advice" disclaimer on every health tool and guide.
- "When to see a doctor" block on tools and guides.
- Medically-reviewed-by byline (placeholder name/credentials).
- No diagnose / treat / cure language.

## Placeholders to replace before launch

- Real analytics IDs (GTM, Google Ads, Meta Pixel, GA4, server-side GTM).
- Selar checkout URLs and real pricing on the sales page.
- Real medical reviewer name and credentials in the bylines.
- Newsletter signup wired to Beehiiv.
- Lawyer-reviewed legal pages (NDPR, GDPR).
- Real brand handles, logo treatment, and imagery.

## Not decided yet

- Single brand vs a Wholesome Woman umbrella.
- Free vs paid split per tool.
- One retained medical reviewer vs a rotating bench.
