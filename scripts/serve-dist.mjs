/*
  scripts/serve-dist.mjs
  Static server for dist/ that mimics VERCEL's routing precedence, for local
  verification of the prerendered routes.

  WHY THIS EXISTS: `vite preview` applies its SPA fallback BEFORE resolving a
  directory index, so it serves dist/index.html (the HOME page) for
  /product/bpc-157, /shop, /about, and every other prerendered route. Any local
  check of prerendered per-route HTML, JSON-LD, or Lighthouse run against
  `vite preview` is therefore measuring the home page, not the route.

  Vercel resolves the filesystem FIRST (dist/product/bpc-157/index.html) and
  only falls back to the SPA rewrite for paths with no matching file. This
  server does the same, so local verification matches production.

  Usage: node scripts/serve-dist.mjs [port]     (default 4180)
*/
import http from "node:http";
import zlib from "node:zlib";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PORT = Number(process.argv[2] || 4180);

// The client-route rewrites, read from vercel.json so the two never drift
// (scripts/test-routing.mjs asserts this). path-to-regexp subset: `:name`
// = one segment, `:name*` = zero or more segments.
export function rewriteToRegex(source) {
  const re = source
    .replace(/[.+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\/:([A-Za-z0-9_]+)\*/g, "(?:/[^?#]*)?")
    .replace(/:([A-Za-z0-9_]+)/g, "[^/]+");
  return new RegExp(`^${re}/?$`);
}
const CLIENT_ROUTES = (() => {
  try {
    const v = JSON.parse(fs.readFileSync(path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "vercel.json"), "utf8"));
    return (v.rewrites || []).filter((r) => r.destination === "/index.html").map((r) => rewriteToRegex(r.source));
  } catch { return []; }
})();

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
  ".xml": "application/xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webmanifest": "application/manifest+json",
  ".ico": "image/x-icon",
};

// Opt cycle 3 (4.7): gzip text responses when the client accepts it, so
// throttled measurements over this server resemble Vercel (which compresses)
// instead of over-counting bytes ~5× on CSS/JS.
let currentReq = null;
function send(res, status, body, type) {
  const t = type || "text/plain; charset=utf-8";
  const compressible = /^(text\/|application\/(json|javascript|xml|manifest))/.test(t);
  const accepts = /\bgzip\b/.test(String(currentReq?.headers?.["accept-encoding"] || ""));
  if (compressible && accepts && body && body.length > 512) {
    res.writeHead(status, { "Content-Type": t, "Content-Encoding": "gzip", Vary: "Accept-Encoding" });
    return res.end(zlib.gzipSync(body));
  }
  res.writeHead(status, { "Content-Type": t });
  res.end(body);
}

// Importable without side effects (scripts/test-routing.mjs imports the
// matcher); the server starts only when this file is the entry point.
const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop());
if (isMain) http
  .createServer((req, res) => {
    currentReq = req;
    const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
    // Block traversal.
    const safe = path.normalize(urlPath).replace(/^(\.\.[/\\])+/, "");
    const abs = path.join(ROOT, safe);

    // 1. Exact file (assets, sitemap.xml, robots.txt, sw.js …)
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      return send(res, 200, fs.readFileSync(abs), TYPES[path.extname(abs)]);
    }
    // 2. Directory index — the prerendered per-route HTML. This is the step
    //    `vite preview` skips.
    const idx = path.join(abs, "index.html");
    if (fs.existsSync(idx)) {
      return send(res, 200, fs.readFileSync(idx), TYPES[".html"]);
    }
    // 3. Client-side routes (opt c8): exactly the vercel.json rewrites — the
    //    SPA shell with a 200 — so this server and Vercel agree on which
    //    paths are pages and which are not.
    if (CLIENT_ROUTES.some((re) => re.test(safe))) {
      return send(res, 200, fs.readFileSync(path.join(ROOT, "index.html")), TYPES[".html"]);
    }
    // 4. Everything else: the prerendered 404 page with a REAL 404 status
    //    (Vercel serves dist/404.html the same way).
    const custom404 = path.join(ROOT, "404", "index.html");
    if (fs.existsSync(custom404)) {
      return send(res, 404, fs.readFileSync(custom404), TYPES[".html"]);
    }
    return send(res, 404, "Not found", TYPES[".txt"]);
  })
  .listen(PORT, () => console.log(`[serve-dist] http://localhost:${PORT} (Vercel-style filesystem-first routing)`));
