# Wholesome Girlies site: build rules

Static HTML on GitHub Pages, no framework. Preview with `python3 serve.py 8001` from the repo root (clean URLs work as on GitHub Pages). Before browser-testing, check which folder owns the port (`lsof -nP -iTCP:8001`). Stub `window.fetch` before clicking any checkout path, so a test never writes a row to the Checkout Intents sheet.

These rules apply to every page. `scripts/check-pages.py` enforces the machine-checkable ones and runs before every deploy. Run it before you commit:

```
python3 scripts/check-pages.py
```

**Hard rules** hold on every page today, and any violation fails. **Ratchet rules** have a known backlog that is frozen per page in `scripts/check-baseline.json`. A page fails only if it gets worse, or a new page breaks the rule. When you fix backlog pages, run `python3 scripts/check-pages.py --update-baseline` to lock in the lower counts. Never raise a baseline count to make a check pass.

The full plans live in the Obsidian vault under `Areas/Work/Wholesome Girlies/`: page templates in `01 - Website Architecture & Build Plan.md`, analytics in `Analytics Setup.md`, consent in `Consent Banner Build Scope.md`, checkout in `Checkout Intent Setup.md`, SEO in `SEO/02 - SEO Implementation Plan.md`, compliance in `_Resources/Compliance - Green and Red Tiering.md`, copy in `Content/_ChatGPT Project — WG Copy Engine/`, and sharing, print, games, and the app in `06 - Virality Plan.md`. When a rule changes, update it here, in the check script, and in the vault note that owns it.

## 1. Analytics and tracking

- GTM container `GTM-KW443M88` loads in `<head>` on every page, with its noscript iframe straight after `<body>`. GTM is the only tag loader: no gtag.js, no pixel init, no on-site InitiateCheckout or Purchase (Selar fires both). Lead fires only from `checkout-intent.js`; ViewContent only from GTM. Never run one event in two layers. *(hard)*
- Any page that loads `checkout-intent.js` starts `<head>` with the identity clean-up script (`window.__idq`), which strips personal details from the URL before any tag reads it. *(hard)*
- Selar links use `selar.com/<slug>?add_to_cart=1&email=&fullname=&mobile=` with the six product slugs. Diaspora pages add `currency=USD`; Nigerian pages never do. The `MOTHER` coupon appears only on the bundle upsell. *(hard, except the coupon placement)*
- Share links carry `?ref=wa|x|fb|th|li|ig|link`, and clicks push `share_click` with `share_channel`, `share_item`, and `share_surface`.
- GTM tags that wait for consent fire "Unlimited", never "Once per page" (container setting). GTM changes are staged by the service account and published by James. QA in a clean incognito window.

## 2. Consent and privacy

- `consent-defaults.js` loads in `<head>` after the identity script and before GTM. Every page loads `cookieconsent.css`, `wg-consent.css`, `cookieconsent.umd.js`, and `wg-consent.js`, and its footer carries the "Privacy choices" link (`data-cc="show-preferencesModal"`). *(hard)*
- Browser storage keys start with `wg_`, so the consent guard covers them. Tools compute on her device and store the segment, never raw health inputs on a server. *(hard)*
- A shared link never carries her answers, dates, or results.

## 3. SEO

- Every indexable page has a canonical equal to its own clean URL (no `.html`), the full Open Graph and Twitter card set with `og:url` equal to the canonical and an `og:image` that exists, the three favicon links, exactly one `<h1>`, alt text on every image, and `rel="noopener"` on new-tab links. *(hard)*
- `/go/` bridges, thank-you hubs, diaspora sales pages, and `404` carry `noindex, nofollow` and stay out of `sitemap.xml`. `robots.txt` has no Disallow lines, because a Disallow stops Google reading the noindex. *(hard)*
- `sitemap.xml` lists every indexable page by clean URL with a `<lastmod>`, and only `wg_release.py` (in `~/Documents/site-qa-tools/`) edits it, on release day. *(hard)*
- JSON-LD parses on every page. Guides: Article or MedicalWebPage, plus FAQPage and BreadcrumbList. Tools: SoftwareApplication and BreadcrumbList, and FAQPage *(ratchet)*. Nigerian sales pages: Product, FAQPage, BreadcrumbList. Home: Organization and WebSite. *(hard)*
- Every guide and tool is carded on its stage index, and every tool on `/tools/` too. Nothing ships unlinked. Every internal link and asset resolves. *(hard)*
- Meta descriptions run 155 characters or fewer *(ratchet)*; titles 50 to 60 characters, leading with the searched phrase.
- Tool trust layer: a Person author and a citation array in schema *(ratchet)*. Health pages that are sourced cite at least three recognised authorities and say plainly they are not yet reviewed by a clinician.
- **Every tool and guide has its own link preview card** at `/assets/img/og/<slug>.jpg?v=<version>`, used for both `og:image` and `twitter:image`, made by `scripts/make-og.js` *(hard)*. Tool cards show the title, a "Try it" pill and a live screenshot of the tool (checklists ticked, calculators filled with a sample date). Guide cards show a group chat: the hook from the Share Copy Bank winner (`scripts/og-hooks.json`, from `python3 scripts/share-bank.py --og-json`) as the message, the guide as the shared link. Sensitive guides get a single heart reaction. Every other indexable page uses `/assets/img/og/default.jpg?v=<version>` (the home headline beside the five stages as stickers); the Organization logo in schema is `icon-512.png`, never a card. Each run also saves a 1080×1350 (4:5) feed post of every card to `~/Downloads/Wholesome Girlies/Social Posts/<stage>/`, so a new tool or guide gets its post the same run it gets its card; `--square-only` remakes just the posts. When a card changes, re-render it and bump `OG_VERSION` and every meta tag, so WhatsApp, X and Facebook fetch the new image. The approved cast replaces this art next (plan in the vault's `Content/WG Cast/00 - WG Cast Bible.md`, Website images).
- **Brand profiles are the same five everywhere** *(hard)*: Facebook `/wholesomegirlies`, Instagram `@wholesomegirlieshq`, TikTok `@wholesomegirlies`, X `@wgirlieshq`, LinkedIn `/company/wholesomegirlies`. Every footer social row links all five, every page with an X card carries `<meta name="twitter:site" content="@wgirlieshq">`, and the home page Organization `sameAs` lists all five. The X share button adds `via=wgirlieshq`. A new profile (YouTube when it launches) goes into all three places and the check's `PROFILES` list together. The registry is the vault's `05 - Accounts & Platform IDs.md`.
- `llms.txt` URLs all resolve *(hard)*. No hreflang *(hard)*. Run `/seo-audit` and `/ai-seo` after any batch of page changes.

## 4. Page structure

- Sales pages, `/go/` bridges, and thank-you hubs carry no site navigation. *(hard)*
- Sales page sections alternate after the hero: plain, then `stage-band` (tinted), then plain, and so on. When you add or remove a section, re-alternate the rest of the page so two tinted or two plain sections never touch. *(judgement)*
- **Images.** Stage hubs and guides use cast illustrations from `assets/img/cast/`: 16:9 JPG at 1100×618, under 200 KB, `width="1100" height="618"`, alt text that starts "Illustration of" and never presents a cast member as a real woman. No cast character on loss pages, the mental-health check-ins, or the postpartum warning signs guide; those get a still life with no person. Sales pages carry no scene or cast images (the bundle mockup is the only picture) and no separate mechanism or differentiator section, so they stay lean. New cast images are made from the approved masters in the vault (`Content/WG Cast/Masters/`), with GPT Image, attaching only the sheets of the people in the scene.
- `/go/` bridges show no price, never link to Selar, link only to their own market's sales page, and carry the legal links row. Ads point only at `/go/`. *(hard)*
- Nigerian sales pages show naira only and load `geo-redirect.js`; diaspora pages show dollars on the page. Every sales page has `id="join"` and loads `checkout-intent.js`. *(hard)*
- Thank-you hubs write their `wg_<stage>_home` member flag, never gate what she paid for, and carry the share block. *(hard)*
- **Every resource page** (tool, guide, checklist, template, game, quiz) carries a share line in `<meta name="wg:share">`, `wg-rail.css`, and `wg-article.js` loaded after `member-cta.js`. Together they build the sticky contents panel when the page has two or more `<h2>` headings, and the share icons on every page: in the contents panel, in a row straight under the tool on tools (never inside the written guide) or under the byline on guides, and in an end row above the program card. A tool with no written guide under it gets only the row under the tool. It also carries the stage program card (`.program-cta`), which `member-cta.js` swaps for "Go to your [program] home" for buyers. *(hard)*
- **Every printable tool** loads `wg-print.css` with `media="print"` and `wg-print.js`, has a `data-wg-print` button labelled "Print or save as PDF", and has a QR code made by `scripts/make-print-qr.js`. The printout shows only the tool, its disclaimer, and its safety box. *(hard)*

## 5. Share copy

- `assets/js/wg-share.js` renders the icon row (WhatsApp, X, Facebook, Threads, LinkedIn, Instagram, copy link) from a `<div class="wg-share">` with `data-share-path`, `data-share-text`, and optional `data-share-size="sm"` and `data-share-align="center"`. Thank-you hub links point at the public program page, never the hub. *(hard)*
- The share line is written in the sharer's voice and must make sense to a stranger who sees it cold on WhatsApp or X. It never reveals her own stage, condition, or purchase. It stays under 250 characters so it fits X with the link (X counts any link as 23). *(hard: present, under 250)*
- `<meta name="wg:share-label">` sets a softer prompt on loss pages and private trackers.

## 6. Compliance

- Green tier only. Every health tool and guide carries "educational, not medical advice" and a when-to-see-a-doctor or safety block *(ratchet)*. Mental-health content routes to real care and MANI on 0809 111 6264.
- No review claim ("medically reviewed by", "reviewed by professionals") until a named clinician has signed. The credibility ceiling is "research and data-backed", or "sourced, not yet reviewed by a clinician". *(hard)*
- Never imply we know her condition. No diagnose, treat, or cure claims. No outcome or timeline promises: no conception promise, no marriage guarantee, no birth or body promise. *(judgement)*
- Banned trigger phrases: "get pregnant fast", "boost fertility", "bounce back", "get your body back", "sleep through the night", "make him marry you", "make him choose you". Guides may quote a searched question in order to answer it; share lines and every other page may not. *(hard)*
- Honest urgency only: no countdowns, fake scarcity, or guaranteed results. *(hard)* Testimonials are verbatim from the proof file with first name and initial, stage, and city. Sales pages with testimonials carry a results-vary line *(ratchet)*. Only the 6-Week Postpartum Reset ("300+ first-time mums") and the Wife Material Blueprint ("300+ women") may cite a number.

## 7. Brand and copy

- Say "assistant", never "bot". The public price label is "early-bird", never "founding". Program names are locked: The Trying-to-Conceive Blueprint, The First Pregnancy Plan, The 6-Week Postpartum Reset, The First Baby Playbook, The Wife Material Blueprint, The Complete Motherhood Journey. *(hard)*
- Never call the tools or content "free" in customer-facing copy. *(ratchet)*
- No em or en dashes in copy, including `<title>` and meta descriptions; use commas and periods. *(ratchet)* Plain language, short sentences, medical terms explained where they appear, the collective "we", no hype, fear, or pressure. James's writing rules (`~/CLAUDE.md`, Writing Style Guidelines) apply to all copy.
- James's own face never appears; women's faces are fine. Never present a stock or AI person as a real named woman. The founder stays private; Cynthia Obinatu is the named author and editor.

## 8. Commerce

- Prices: individual programs early-bird ₦13,700 / $27, standard ₦19,700 / $37; the bundle early-bird ₦39,700 / $77, standard ₦57,700. Diaspora pages are separate (`-diaspora`), dollar-priced, noindex, and reached only through diaspora bridges and the geo-redirect.
- The 30-day guarantee is conditional on doing the work, never an outcome, and sits after the price. No price in ads, hooks, or emails.

## 9. Operations

- Inline scripts must parse *(hard)*: the page check runs each one through Node, because one syntax error stops a whole tool working.
- Assets load with `?v=YYYYMMDD<letter>`. When you change an asset, bump its version in every file that references it, including the `wg-share.js` reference inside `wg-article.js`. Every `/assets/` script loads with a version *(ratchet: `member-cta.js`, `geo-redirect.js`, and `petals.js` load without one today)*. Mixed versions fail. *(hard)*
- Deploy is a push to `main`: GitHub Actions runs this check, then publishes to Pages. Check the current branch and unpushed commits first, because other sessions leave repos on their own branches. Cloudflare is DNS-only.
- Secrets never go in the repo or the vault. Everything in this repo is publicly readable on the site.
