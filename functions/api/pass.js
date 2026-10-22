// POST /api/pass {pass}: turns a pass from the payment server into this site's wg_pass cookie.
// The cookie is what lets the program pages open (functions/programs/_middleware.js). Signing in adds programs
// and never removes them: the new pass is merged with whatever the cookie already holds.
// Nothing here is a secret: GATE_SECRET is a binding on the Pages project, set in the Cloudflare dashboard.
import { COOKIE, cookiePass, readPass, signPass } from "../_lib/pass.js";

const reply = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json; charset=utf-8", "cache-control": "private, no-store", ...headers } });

export async function onRequestPost({ request, env }) {
  // Not switched on yet: look the same as a site that has no such address, so the page ignores it.
  if (!env.GATE_SECRET) return reply({ ok: false }, 404);
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return reply({ ok: false }, 403);

  let body = null;
  try {
    const text = await request.text();
    if (text.length < 5000) body = JSON.parse(text);
  } catch (e) {}
  const fresh = await readPass(env.GATE_SECRET, body && body.pass);
  if (!fresh) return reply({ ok: false }, 400);

  const old = await cookiePass(request, env.GATE_SECRET);
  const now = Math.floor(Date.now() / 1000);
  const exp = Math.max(fresh.exp, old ? old.exp : 0);
  const merged = { v: 1, p: [...new Set([...(old ? old.p : []), ...fresh.p])].sort(), e: fresh.e, iat: now, exp };
  const cookie = `${COOKIE}=${await signPass(env.GATE_SECRET, merged)}; Path=/; Max-Age=${exp - now}; HttpOnly; Secure; SameSite=Lax`;
  return reply({ ok: true, programs: merged.p }, 200, { "set-cookie": cookie });
}

export const onRequest = () => reply({ ok: false }, 405, { allow: "POST" });
