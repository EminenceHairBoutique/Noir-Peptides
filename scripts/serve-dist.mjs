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
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const PORT = Number(process.argv[2] || 4180);

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

function send(res, status, body, type) {
  res.writeHead(status, { "Content-Type": type || "text/plain; charset=utf-8" });
  res.end(body);
}

http
  .createServer((req, res) => {
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
    // 3. Prerendered /404 page when present, served with a REAL 404 status.
    const custom404 = path.join(ROOT, "404", "index.html");
    if (fs.existsSync(custom404)) {
      return send(res, 404, fs.readFileSync(custom404), TYPES[".html"]);
    }
    // 4. SPA fallback (what Vercel's rewrite does) — note Vercel returns 200.
    return send(res, 200, fs.readFileSync(path.join(ROOT, "index.html")), TYPES[".html"]);
  })
  .listen(PORT, () => console.log(`[serve-dist] http://localhost:${PORT} (Vercel-style filesystem-first routing)`));
