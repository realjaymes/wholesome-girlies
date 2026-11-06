// POST /api/pass {pass}: turns a pass from the payment server into this site's wg_pass cookie.
// The cookie is what lets the program pages open (functions/programs/_middleware.js). Signing in adds programs
// and never removes them: the new pass is merged with whatever the cookie already holds.
// Nothing here is a secret: GATE_SECRET is a binding on the Pages project, set in the Cloudflare dashboard.
import { COOKIE, cookiePass, mergePasses, readPass, signPass } from "../_lib/pass.js";

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
  const { p, m, exp } = mergePasses(old, fresh, now);
  const merged = { v: 1, p, e: fresh.e, iat: now, exp, ...(Object.keys(m).length ? { m } : {}) };
  const cookie = `${COOKIE}=${await signPass(env.GATE_SECRET, merged)}; Path=/; Max-Age=${Math.max(exp - now, 0)}; HttpOnly; Secure; SameSite=Lax`;
  return reply({ ok: true, programs: merged.p }, 200, { "set-cookie": cookie });
}

// DELETE /api/pass: signing out of this phone ends the cookie, so the program pages lock again here.
export async function onRequestDelete({ request }) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return reply({ ok: false }, 403);
  return reply({ ok: true }, 200, { "set-cookie": `${COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax` });
}

export const onRequest = () => reply({ ok: false }, 405, { allow: "POST, DELETE" });
