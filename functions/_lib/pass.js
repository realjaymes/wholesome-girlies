// The pass: a small signed note that says "this device proved it owns these programs".
// The payment server (wg-pay, src/pass.ts) makes it and this site reads it with the same secret, GATE_SECRET.
// Keep the two formats the same:  base64url(JSON payload) + "." + base64url(HMAC-SHA256(GATE_SECRET, base64url(JSON payload)))
// The payload is {v: 1, p: [program home slugs], e: who proved it, iat, exp}, with iat and exp in seconds.
// The site cookie wg_pass holds the same kind of token, signed here after merging every pass this device has earned.
const enc = new TextEncoder();

export const COOKIE = "wg_pass";

function b64url(bytes) {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function unb64url(text) {
  return Uint8Array.from(atob(text.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0));
}

function key(secret, usage) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, [usage]);
}

// Returns the payload when the signature is right and the pass has not run out. Otherwise null.
export async function readPass(secret, token, nowSeconds = Math.floor(Date.now() / 1000)) {
  if (!secret || typeof token !== "string" || token.length > 4000) return null;
  const parts = token.split(".");
  if (parts.length !== 2 || !parts[0] || !parts[1]) return null;
  try {
    // verify() compares the signatures in constant time
    if (!(await crypto.subtle.verify("HMAC", await key(secret, "verify"), unb64url(parts[1]), enc.encode(parts[0])))) return null;
    const payload = JSON.parse(new TextDecoder().decode(unb64url(parts[0])));
    if (payload.v !== 1 || !Array.isArray(payload.p) || typeof payload.exp !== "number" || payload.exp <= nowSeconds) return null;
    return { v: 1, p: payload.p.filter((s) => typeof s === "string"), e: String(payload.e || ""), iat: Number(payload.iat) || 0, exp: payload.exp };
  } catch (e) {
    return null;
  }
}

export async function signPass(secret, payload) {
  const body = b64url(enc.encode(JSON.stringify(payload)));
  return `${body}.${b64url(new Uint8Array(await crypto.subtle.sign("HMAC", await key(secret, "sign"), enc.encode(body))))}`;
}

export function cookieValue(request, name = COOKIE) {
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return "";
}

// Her programs, from the wg_pass cookie on this request. Empty when there is no cookie or it is bad.
export async function cookiePass(request, secret) {
  return readPass(secret, cookieValue(request));
}

// The bundle rule, from assets/data/program-flags.json: a Complete Motherhood Journey home covers every
// single-program home in the same market whose stages (flags) it holds. The wife material program is not inside it.
export function covers(homes, passSlugs, slug) {
  if (passSlugs.includes(slug)) return true;
  const mine = homes[slug] && homes[slug].flags;
  if (!mine || !mine.length) return false;
  const diaspora = slug.endsWith("-diaspora");
  return passSlugs.some((b) => /^complete-motherhood-journey/.test(b) && b.endsWith("-diaspora") === diaspora
    && homes[b] && mine.every((f) => homes[b].flags.includes(f)));
}
