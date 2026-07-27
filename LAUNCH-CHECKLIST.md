# Wholesome Girlies — Pre-Launch Checklist (replace every placeholder)

This site is a first version built for review. **Nothing below should ship live until it is replaced with the real thing.** Grouped by type. Search the codebase for the words "placeholder", "go here", "₦ —", and "Reviewer name" to find them fast.

## 1. Legal and compliance (blocking, do first)
- [x] Full **plain-language drafts written as three separate pages**: `legal/privacy.html` (Privacy Policy, NDPA + GDPR), `legal/terms.html` (Terms of Use), `legal/disclaimer.html` (Medical Disclaimer, now standalone). Footers across the site link to all three. **Still a draft — see the two items below before launch.**
- [ ] Have a **lawyer review all three legal pages** and confirm they fit Nigeria (NDPA) + diaspora/EU (GDPR) and the health/YMYL context.
- [ ] Fill the inline `[confirm before launch]` placeholders in the legal pages: **registered business name + address**, **contact emails** (used `hello@` and `privacy@wholesomegirlies.xyz` as defaults), **refund policy** wording, and the **effective date**. Search the three pages for `class="placeholder"`.
- [ ] Confirm the "educational, not medical advice" line and "when to see a doctor" block on every tool and guide.
- [ ] Register the business entity.
- [ ] Line up the **named medical reviewer(s)** before any diagnostic-adjacent content goes live (also required for E-E-A-T).

## 2. Medical reviewer bylines (currently placeholders)
Every health tool, guide, and the sales page shows a reviewer byline reading "Reviewer name and credentials go here" or "Names and credentials shown at signup".
- [ ] Replace with the real reviewer's **name, credential, and (ideally) photo**, on: `postpartum/tools/recovery-timeline-calculator.html`, `postpartum/tools/recovery-checklist.html`, `postpartum/guides/postpartum-recovery-timeline.html`, `programs/postpartum-reset.html`, `index.html` (trust section), plus every new tool/guide.

## 3. Testimonials (placeholders on the sales page)
`programs/postpartum-reset.html` has three placeholder quotes and a visible note that real ones come after the first cohort.
- [ ] Replace with **real, permissioned testimonials** after the first group. Never fabricate. Apply the earnings/results-disclaimer rule if any quote cites a body or health outcome.

## 4. Team / About (generic placeholders)
`about/index.html` team cards say "Named team members go here".
- [ ] Add the real fronting women (e.g. Cynthia Obinatu), the medical reviewer(s), and partners, with real names and photos.
- [ ] **"Come build this with us" partner card (about page):** change the messaging and CTA from the current "See what we are building" → `/programs/` link to a **real way to reach us — an email or WhatsApp number** — so women who want to partner or work with us can actually make contact. (James's reminder, 2026-07-18.)

## 5. Commerce and pricing (placeholders)
- [ ] Replace `₦ —` on `programs/postpartum-reset.html` with real pricing.
- [ ] Wire the **Selar checkout URL** (`selar.com/[product]?add_to_cart=1&...`). Currently the sales-page "Join now" points to the `/go/` bridge as a stand-in; final flow is: ad → `/go/` bridge → sales page → **Selar checkout**.
- [ ] Set up the thank-you page (post-purchase delivery + Telegram invite). A worked example exists at `programs/postpartum-reset/thank-you.html` (demo, placeholders); finalize and replicate per program.
- [ ] **JAMES: create the bundle coupon code `MOTHER` on Selar** when building the Complete Motherhood Journey product (code chosen 2026-07-19; already wired into the conception-circle + pregnancy-village thank-you pages). Coupons apply ONLY to the bundle upsell (fertility/pregnancy thank-you pages), never on stage cross-sells. Confirm Selar's coupon URL param so the pre-applied `?coupon=MOTHER` link works; if it can't pre-apply, buyers enter `MOTHER` manually. Share the final Selar product links so the checkout URLs can be finalized.

## 6. Newsletter & waitlist capture (placeholder forms)
Email forms (homepage newsletter — now removed; and the **program waitlist forms** on the Conception Circle and Pregnancy Village pages) currently just show a JavaScript confirmation and **discard the email**.
- [ ] Wire the **program waitlist forms** to a real endpoint. Options: Netlify Forms (if hosted on Netlify, zero-code), Google Apps Script → Google Sheet (free, works on GitHub Pages), a form service (Tally/Formspree), or route into Beehiiv as a tagged signup. **The waitlist is the demand gauge, so this must be live before featuring the programs publicly.**
- [ ] Wire the newsletter to **Beehiiv** (or Substack) on `newsletter.wholesomegirlies.xyz` when the newsletter side is built; add a "latest posts" module on the homepage then.

## 7. Analytics and search
- [x] **GTM** container `GTM-KW443M88` installed sitewide (single container) ✅ 2026-07-27
- [x] **GA4** `G-3JFKC4KYD5` live through GTM ✅ 2026-07-27
- [x] **Microsoft Clarity** live via GTM integration (+ linked to GA4) ✅ 2026-07-27
- [x] **Google Search Console** verified (Domain); `sitemap.xml` submitted ✅ 2026-07-27
- [ ] Still through GTM (with/before ads): **Google Ads gtag, Meta Pixel, TikTok/Snapchat/X pixels, server-side GTM**, consent banner; plus **Bing Webmaster Tools**.
- [ ] GA4 hygiene: 14-month data retention, internal-traffic filter, link Search Console.

## 8. Brand assets (placeholders / missing)
- [x] Logo: the **Sprig** mark (SVG) is applied in the header (olive) and footer (rust). Options at `/logo-options.html`. A polished/professional version can still be commissioned later; the leaf-badge option makes a good favicon/app icon.
- [ ] Add **real photography** (African women, warm, on-brand). No stock clichés. This also unlocks a proper two-column hero. **Real photography is still required for anyone fronting the brand (faces, testimonials)** — AI cannot fake a real named person (brand rule).
- [ ] **When the site is live, try Pomelli (Google Labs)** to generate free, on-brand *marketing/illustration/ad* content: https://labs.google.com/u/0/pomelli/onboarding — it scans the live site to learn the brand, so it needs the site up first. Helps close the photography gap for **decorative, illustrative, and ad creative** (AI-labelled per our imagery rule). It does **not** replace real-women fronting/testimonial photography. See [[Brand & Voice]] §7.
- [x] **Per-page social meta wired site-wide:** canonical, Open Graph, and Twitter Card tags now on all 33 indexable pages; homepage carries Organization + WebSite (SearchAction) schema; BreadcrumbList on 32 pages; tool pages keep their SoftwareApplication schema. All JSON-LD validates.
- [x] **OG/social share image built** — branded 1200×630 at `/assets/img/og-default.png` (olive & cream, sprig mark, tagline, "Reviewed by professionals"). Wired site-wide as `og:image`/`twitter:image`. Optional later: a couple of page-type-specific variants (tool vs program).
- [x] **Favicon built and wired** on all pages — `favicon.svg` (leaf badge) + `favicon-32.png`, `apple-touch-icon.png` (180), `icon-192.png`, `icon-512.png` in `/assets/img/`.

## 9. Domain and infra
- [ ] Point `wholesomegirlies.xyz` (and `.ng`/`.com` if bought) at the host.
- [ ] Confirm `robots.txt` disallow of `/go/` and thank-you pages, and that neither is in `sitemap.xml`.
- [ ] Lock the `@wholesomegirlies` handles.

## 10. Plain-language editorial pass (brand rule)
Every woman must understand exactly what we say and what is happening to her body. Short sentences, everyday words, no jargon; any unavoidable medical term explained in plain words on the spot.
- [ ] Do a plain-language pass over every tool, guide, and program page before launch. Flag and rewrite any jargon (e.g. diastasis recti, lochia, anomaly scan, hCG, trimester) that is not explained in plain words right where it appears.

## 11. Future builds referenced but not built
- [ ] The **trained Telegram helper/bot** (mentioned in the program) — separate build.
- [ ] Red-tier tools (symptom/risk checkers) — only after the medical partner + review process exist.

---

**Rule of thumb:** if a line names a person, a price, a number, a quote, or a legal term and it is not real yet, it is a placeholder. It does not go live.
