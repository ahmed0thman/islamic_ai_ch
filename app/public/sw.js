/* scripts/build-offline.mjs injects a content hash and complete static precache. */
const CACHE_NAME = "huda-static-development";
const PRECACHE_URLS = ["/"];
const PREFIX = "huda-static-";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS)));
  // Wait for existing tabs to close before activating an updated edition.
});
self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name.startsWith(PREFIX) && name !== CACHE_NAME) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin) return;
  // Query depth is a client preference. Cache the same HTML for all ?d= values.
  let pathname = url.pathname;
  if (request.mode === "navigate" && !pathname.endsWith("/") && !pathname.split("/").pop().includes(".")) pathname += "/";
  if (!PRECACHE_URLS.includes(pathname)) return;
  // HTML requests must not serve an RSC .txt response (or vice versa).
  // The exported router's explicit .txt URL is independently precached.
  if (request.headers.get("RSC") === "1" && !pathname.endsWith(".txt")) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const hit = await cache.match(pathname);
    if (hit) return hit;
    const response = await fetch(request);
    if (response.ok && response.type === "basic") await cache.put(pathname, response.clone());
    return response;
  })());
});
