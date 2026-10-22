// The gate on the paid program pages: /programs/<slug>/thank-you and /programs/<slug>/read (and .html).
// A device with a wg_pass cookie that lists the program (or the bundle that covers it) gets the page. Any other
// visitor goes to the sign-in screen for that program. Sales pages (/programs/<slug>), /go/, tools, /app/ and
// /signin/ are not under /programs/<slug>/ or never reach this file (_routes.json). Closing the program pages
// is phase 8 of the Selar to Bachs migration; CLAUDE.md section 4 holds the rule.
import { cookiePass, covers } from "../_lib/pass.js";

const NO_STORE = "private, no-store";

let homesCache = null;
async function homes(env, request) {
  if (!homesCache) {
    const res = await env.ASSETS.fetch(new URL("/assets/data/program-flags.json", request.url));
    homesCache = (await res.json()).homes || {};
  }
  return homesCache;
}

function lock(slug) {
  const to = /^[a-z0-9-]+$/.test(slug) ? `/signin/?program=${slug}` : "/signin/";
  return new Response(null, { status: 302, headers: { location: to, "cache-control": NO_STORE } });
}

// The buyer has just paid and Bachs sent her back with ?order=&t=. The page hides the program until the
// payment server says paid (wg-order.js). When PAY_API is set, a made-up order or token is refused here too.
async function justPaid(url, env) {
  const order = url.searchParams.get("order") || "", t = url.searchParams.get("t") || "";
  if (!/^ord_[0-9a-f]{24}$/.test(order) || !/^[\w-]{20,100}$/.test(t)) return false;
  if (!env.PAY_API) return true;
  try {
    const res = await fetch(`${env.PAY_API.replace(/\/+$/, "")}/order/${order}?t=${encodeURIComponent(t)}`);
    return res.status !== 404;
  } catch (e) {
    return true; // the payment server is down: do not lock out someone who just paid
  }
}

export async function onRequest({ request, env, next }) {
  if (request.method !== "GET" && request.method !== "HEAD") return next();
  const url = new URL(request.url);
  // Read the path the way the file server will, so %74hank-you or a double slash cannot get past the check.
  let path;
  try { path = decodeURIComponent(url.pathname).toLowerCase().replace(/\/{2,}/g, "/"); } catch (e) { return lock(""); }
  const m = /^\/programs\/([^/]+)\/(.+)$/.exec(path);
  if (!m) return next(); // a sales page
  const slug = m[1];

  let open = false;
  if (env.GATE_SECRET) {
    const pass = await cookiePass(request, env.GATE_SECRET);
    open = !!pass && covers(await homes(env, request), pass.p, slug);
  }
  if (!open && /^thank-you(\.html)?\/?$/.test(m[2])) open = await justPaid(url, env);
  if (!open) return lock(slug);

  const res = await next();
  const out = new Response(res.body, res);
  out.headers.set("cache-control", NO_STORE);
  return out;
}
