// The First 1,000 program-page redirect. Every sales page sends the visitor to /first/ (with her stage when the page has one)
// until James turns it off in campaign.json, an optional end date passes, or the payment server reports 1,000 places taken.
// It is a 302 (temporary), so Google keeps the sales pages and they come back the day the redirect ends. The visitor's query
// string travels with her (UTM tags, fbclid, ttclid, buy, coupon, email, order); only "stage" is overwritten by the page's own stage.
// Sales pages: /programs/, /programs/<slug> (with or without .html or a trailing slash), /go/<slug>. Read pages, thank-you pages
// (/programs/<slug>/read, /programs/<slug>/thank-you), /first/, sign-in, tools, the app, legal pages and the blog never reach this redirect.
const STATUS_URL = "https://wg-pay.realjaymes.workers.dev/first1000/status";
const PLACES = 1000;
const STATUS_TTL = 60; // seconds
const NO_STORE = "private, no-store";

// The program each sales page sells, and the stage it is for. The bundle has no stage.
const STAGE = {
  "wife-material-blueprint": "relationships",
  "trying-to-conceive-blueprint": "fertility",
  "first-pregnancy-plan": "pregnancy",
  "postpartum-reset": "postpartum",
  "first-baby-playbook": "parenting",
  "complete-motherhood-journey": "",
};

// Returns {stage} when the path is a sales page, otherwise null. The path is read the way the file server reads it.
export function salesPage(pathname) {
  let p;
  try { p = decodeURIComponent(pathname).toLowerCase(); } catch (e) { return null; }
  p = p.replace(/\/{2,}/g, "/").replace(/\/index(\.html)?$/, "/").replace(/\.html$/, "").replace(/\/+$/, "");
  if (p === "/programs") return { stage: "" };
  const m = /^\/(?:programs|go)\/([^/]+)$/.exec(p);
  if (!m) return null;
  const slug = m[1].replace(/-diaspora$/, "");
  return slug in STAGE ? { stage: STAGE[slug] } : null;
}

export function targetFor(url, stage) {
  const q = new URLSearchParams(url.search);
  q.delete("stage");
  if (stage) q.set("stage", stage);
  const s = q.toString();
  return `/first/${s ? `?${s}` : ""}`;
}

let configCache = null;
async function config(env, url) {
  const now = Date.now();
  if (configCache && now - configCache.at < STATUS_TTL * 1000) return configCache.value;
  let value = { redirect: true, endDate: "" }; // if the file cannot be read, keep redirecting
  try {
    const res = await env.ASSETS.fetch(new URL("/campaign.json", url));
    if (res.ok) value = await res.json();
  } catch (e) { /* keep the default */ }
  configCache = { at: now, value };
  return value;
}

// Places claimed so far, or null when the payment server cannot be reached. Cached for a minute.
async function placesTaken() {
  const key = new Request("https://campaign.wholesomegirlies.invalid/first1000-status");
  try {
    const hit = await caches.default.match(key);
    if (hit) { const n = (await hit.json()).taken; if (typeof n === "number") return n; }
  } catch (e) { /* no cache here: ask the server */ }
  try {
    const res = await fetch(STATUS_URL, { signal: AbortSignal.timeout(2500) });
    const body = await res.json();
    if (!res.ok || body.ok === false || typeof body.taken !== "number") return null;
    try {
      await caches.default.put(key, new Response(JSON.stringify({ taken: body.taken }), { headers: { "content-type": "application/json", "cache-control": `public, max-age=${STATUS_TTL}` } }));
    } catch (e) { /* not cached: the next visitor asks again */ }
    return body.taken;
  } catch (e) {
    return null;
  }
}

// Returns a 302 Response when this request should be redirected, otherwise null (serve the page as normal).
export async function campaignRedirect(request, env) {
  if (request.method !== "GET" && request.method !== "HEAD") return null;
  const url = new URL(request.url);
  const page = salesPage(url.pathname);
  if (!page) return null;
  const cfg = await config(env, url);
  if (cfg.redirect !== true) return null;
  if (typeof cfg.endDate === "string" && cfg.endDate.trim()) {
    const end = Date.parse(cfg.endDate.trim());
    if (Number.isFinite(end) && Date.now() >= end) return null;
  }
  const taken = await placesTaken();
  if (taken !== null && taken >= PLACES) return null; // every place is claimed: the sales pages come back
  return new Response(null, { status: 302, headers: { location: targetFor(url, page.stage), "cache-control": NO_STORE } });
}
