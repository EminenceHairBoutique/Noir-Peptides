/*
  scripts/_sitemap-routes.mjs   (opt cycle 9 — addendum B1/B2)
  One reader for "every public route": the <loc> paths of a sitemap. Used by
  the screenshot matrix, the all-routes axe sweep and the live probe so the
  three never disagree about what "every route" means.
*/
import fs from "node:fs";
import path from "node:path";

/** Paths ("/shop", "/product/bpc-157", …) from sitemap XML, in document order. */
export function parseSitemapPaths(xml) {
  const out = [];
  for (const m of xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)) {
    try {
      const u = new URL(m[1]);
      out.push(u.pathname.replace(/\/+$/, "") || "/");
    } catch {
      /* skip a malformed loc */
    }
  }
  return [...new Set(out)];
}

/** Routes of the built site, from dist/sitemap.xml. */
export function sitemapRoutes(distDir = path.join(process.cwd(), "dist")) {
  const file = path.join(distDir, "sitemap.xml");
  if (!fs.existsSync(file)) throw new Error(`${file} missing — run the build first`);
  return parseSitemapPaths(fs.readFileSync(file, "utf8"));
}

/** Directory-safe name for a route: "/" → "home", "/product/bpc-157" → "product__bpc-157". */
export function routeSlug(route) {
  return route.replace(/^\/+/, "").replace(/\/+/g, "__").replace(/[^A-Za-z0-9_.-]/g, "_") || "home";
}
