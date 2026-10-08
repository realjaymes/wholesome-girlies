// Wholesome Girlies service worker: lets the installed app (and the site) open the tools without a connection.
// It caches pages and files only. It never reads, stores or sends what she types into a tool; her entries stay
// in her browser's own storage, exactly as on the website.
//
// On install it saves the app home, the offline page, the tools index and every tool linked from it, plus the
// /assets/ files those pages load, so a tool she has never opened still works offline. Pages load from the
// network first and fall back to the saved copy; versioned /assets/ files load from the cache first.
// Bump VERSION when this file's logic changes; the old cache is deleted on activate.
const VERSION = "wg-20261008a";
const CORE = ["/app/", "/offline", "/tools/", "/manifest.webmanifest"];
const SKIP = /^\/go\/|^\/programs\/[^/]+$|^\/assets\/video\//; // ad bridges, sales pages and video clips always come from the network
const LATER = /^\/assets\/img\/tool-shorts\//; // reel posters are cached when she scrolls to them, so installing costs less data

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE);
    const tools = await (await cache.match("/tools/")).text();
    const pages = [...new Set([...tools.matchAll(/href="(\/[a-z-]+\/tools\/[a-z0-9-]+)"/g)].map((m) => m[1]))];
    const assets = new Set();
    for (const url of ["/app/", "/offline", ...pages]) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const html = await res.clone().text();
        await cache.put(url, res);
        for (const m of html.matchAll(/(?:src|href)="(\/assets\/[^"#]+)"/g)) if (!SKIP.test(m[1]) && !LATER.test(m[1])) assets.add(m[1]);
      } catch (e) {}
    }
    await Promise.all([...assets].map((a) => cache.add(a).catch(() => {})));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const key of await caches.keys()) if (key !== VERSION) await caches.delete(key);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  const fonts = url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com";
  if (url.origin !== self.location.origin && !fonts) return; // analytics, checkout and every other site pass straight through
  if (url.origin === self.location.origin && (SKIP.test(url.pathname) || url.pathname === "/sw.js")) {
    if (req.mode === "navigate") event.respondWith(fetch(req).catch(async () => (await caches.open(VERSION)).match("/offline")));
    return;
  }

  if (req.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const key = url.pathname; // pages are stored without their query string
      try {
        const res = await fetch(req);
        if (res.ok && res.type === "basic") cache.put(key, res.clone());
        return res;
      } catch (e) {
        return (await cache.match(key)) || (await cache.match(key.replace(/\/$/, "") || "/")) || (await cache.match("/offline"));
      }
    })());
    return;
  }

  if (fonts || url.pathname.startsWith("/assets/")) {
    event.respondWith((async () => {
      const cache = await caches.open(VERSION);
      const hit = await cache.match(req);
      if (hit) return hit;
      try {
        const res = await fetch(req);
        if (res.ok || res.type === "opaque") cache.put(req, res.clone());
        return res;
      } catch (e) {
        return hit || Response.error();
      }
    })());
  }
});
