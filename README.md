# Wholesome Girlies

Free tools and honest, research-backed guidance for women, at every stage: fertility, pregnancy, postpartum, parenting, and the relationships around them. Built for African women, at home and in the diaspora.

Live site: https://wholesomegirlies.xyz (in setup) · Preview: https://realjaymes.github.io/wholesome-girlies/

## Why I'm building this

Over the years, I've become quite aware of the many complications women face for the simple fact that they have reproductive systems.

I've also seen how frustrating it is to get specialized care for women, especially in Nigeria, where there is a dearth of obstetricians and gynaecologists, and even basic healthcare.

I believe every woman deserves immediate support, expert advice, and a community that truly understands.

Wholesome Girlies is how I'm working to close a little of that gap. It maps to those three needs directly: genuinely useful free tools for immediate support, plain-language guidance built on research and real data for expert advice, and a community of women who have been where you are. It starts with the journey into motherhood, one of the most searched and least supported stretches of a woman's life, and grows out from there into wellness, beauty, confidence, and relationships.

## Find me on the web

- Website: https://www.jamespraise.xyz
- LinkedIn: https://www.linkedin.com/in/jamespraise
- X (Twitter): https://x.com/realjaymes

## What Wholesome Girlies is

A free-tools-first ecosystem that turns search into support, built as a ladder:

- **Tools and guides** that solve a real problem in a minute (calculators, trackers, checklists, and evergreen guides), one set per life stage. This is how women find us.

- **Community** on Telegram, where women get answers and are actually understood.

- **Programs**, the paid guidance-plus-community bundles that go deeper per stage.

A woman finds a tool in search, the tool helps her for free, the guidance and community earn her trust, and the programs are there when she wants to go further.

## What's built

- Home and five stage sections: Fertility, Pregnancy, Postpartum, Parenting, and Relationships.

- 20 working tools, checklists, and guides (five per launch stage), all client-side JavaScript, so no health input ever leaves the browser.

- Six offers, each with a Nigerian and a diaspora sales page: The Trying-to-Conceive Blueprint, The First Pregnancy Plan, the Postpartum Reset, Raising Together, the Wife Material Blueprint, and the Complete Motherhood Journey bundle. Each ships with an ad-bridge (pre-sell) page and a thank-you page.

- About and three legal pages (privacy, terms, medical disclaimer).

- `robots.txt` and `sitemap.xml`, with ad-bridge and thank-you pages kept out of search on purpose.

## Tech stack

Static, hand-coded HTML, no framework, built and maintained with Claude Code in the same pattern as the Marketing In Action site.

- **Hosting:** GitHub Pages, deployed on every push to `main` via GitHub Actions (`.github/workflows/static.yml`).

- **DNS, CDN, and first-party analytics:** Cloudflare (in setup).

- **Commerce:** Selar. **Community:** Telegram. **Newsletter:** Beehiiv, on a subdomain (planned).

- **Design tokens** (the Olive and Cream palette, DM Serif Display + Nunito Sans) live in `assets/css/styles.css`.

## Preview locally

Run a local server from this folder for clean absolute paths:

```
python3 -m http.server 8080
```

Then visit http://localhost:8080

## Compliance (baked into the templates)

This is a your-money-or-your-life health space, so the guardrails are built in, not bolted on:

- "Educational, not medical advice" and a "when to see a doctor" block on every health tool and guide.

- No diagnose, treat, or cure language.

- Health content is framed as research and data-backed; a named medical-reviewer byline is added as reviewers come on board.

- Results-vary framing on any testimonial that mentions an outcome.

## Status

Pre-launch. Open before go-live: custom domain and analytics wiring (Cloudflare), Selar products and live pricing, a named medical reviewer, legal review of the three legal pages, real photography, and the newsletter.
