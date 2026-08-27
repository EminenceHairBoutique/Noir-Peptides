/*
  Noir Peptides service worker — installable app shell + offline catalog.

  Design constraints (do not loosen):
  - GET only. /api/* and every non-font cross-origin request pass straight
    through to the network, always — payment, auth, verification, and
    analytics traffic must never be served from or written to a cache.
  - Navigations are network-first (4s timeout) with the cached shell as
    fallback, so a deploy is picked up on the next online load and offline
    still gets the app shell. The catalog then renders from the bundled
    fallback data — the shop genuinely works offline.
  - Hashed /assets/ files are immutable → cache-first. Other same-origin
    static assets and Google Fonts are stale-while-revalidate.

  The __NP_PRECACHE__ line is rewritten at build time by
  scripts/generate-sw-precache.mjs with the built asset list and a content
  version; in dev/preview-without-build it stays empty and the worker is
  runtime-caching only.
*/
/* eslint-env serviceworker */

const NP = self.__NP_PRECACHE__ || { version: "dev", assets: [] };

const PRECACHE = `np-precache-${NP.version}`;
const RUNTIME = `np-runtime-${NP.version}`;
const SHELL = "/index.html";
const NAV_TIMEOUT_MS = 4000;

const FONT_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(PRECACHE)
      .then((cache) => cache.addAll([SHELL, "/site.webmanifest", ...NP.assets]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("np-") && k !== PRECACHE && k !== RUNTIME)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

async function fromCaches(request) {
  // ignoreVary: assets are content-hashed and the shell is same-origin static;
  // Vary headers from the server (e.g. Origin on CORS-enabled hosting) must
  // not defeat offline lookups primed by install-time addAll.
  return (await caches.match(request, { ignoreVary: true })) || null;
}

async function networkFirstNavigation(request) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), NAV_TIMEOUT_MS);
    const response = await fetch(request, { signal: controller.signal });
    clearTimeout(timer);
    // Keep the shell fresh for the offline fallback.
    if (response.ok) {
      const cache = await caches.open(PRECACHE);
      cache.put(SHELL, response.clone());
    }
    return response;
  } catch {
    return (await fromCaches(SHELL)) || Response.error();
  }
}

async function cacheFirst(request) {
  const hit = await fromCaches(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (response.ok) {
    const cache = await caches.open(RUNTIME);
    cache.put(request, response.clone());
  }
  return response;
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(RUNTIME);
  const hit = await cache.match(request, { ignoreVary: true });
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => null);
  return hit || (await refresh) || Response.error();
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Cross-origin: only the font CDN is cacheable; everything else untouched.
  if (url.origin !== self.location.origin) {
    if (FONT_HOSTS.has(url.hostname)) {
      event.respondWith(staleWhileRevalidate(request));
    }
    return;
  }

  // Same-origin exclusions: API and the worker itself.
  if (url.pathname.startsWith("/api/") || url.pathname === "/sw.js") return;

  if (request.mode === "navigate") {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  if (url.pathname.startsWith("/assets/")) {
    // Vite content-hashed files — immutable.
    event.respondWith(cacheFirst(request));
    return;
  }

  const dest = request.destination;
  if (dest === "script" || dest === "style" || dest === "image" || dest === "font") {
    event.respondWith(staleWhileRevalidate(request));
  }
});
