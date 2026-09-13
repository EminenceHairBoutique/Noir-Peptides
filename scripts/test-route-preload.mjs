/*
  scripts/test-route-preload.mjs   (opt cycle 3 — scorecard 4.7)
  Every prerendered page whose route maps to a lazy page chunk must announce
  that chunk with <link rel="modulepreload"> so it downloads alongside the
  main bundle instead of after it. Proves, over the built dist:
    - the mapped routes carry a modulepreload for THEIR page chunk
      (PublicLanding-*.js for /, Shop-*.js for /shop, …) and the file exists;
    - no page anywhere preloads the heavy lazy vendors (3D / PDF / QR);
    - the preload set stays bounded (≤ 24 per page; it is the page chunk's
      static import closure) — a list that grows unbounded is a regression.

  Run after `npm run build`: node scripts/test-route-preload.mjs
*/
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failures++; console.error(`  ✗ ${msg}`); }
};
const DIST = path.join(process.cwd(), "dist");
const walk = (d, out = []) => { for (const e of readdirSync(d)) { const p = path.join(d, e); if (statSync(p).isDirectory()) walk(p, out); else if (e === "index.html") out.push(p); } return out; };
const pages = walk(DIST).map((p) => ["/" + path.relative(DIST, path.dirname(p)).split(path.sep).filter(Boolean).join("/"), readFileSync(p, "utf8")]);
const preloads = (html) => [...html.matchAll(/<link rel="modulepreload"[^>]*href="([^"]+)"/g)].map((m) => m[1]);

const EXPECT = [
  ["/shop", "Shop"], ["/product/bpc-157", "ProductDetail"], ["/test-results", "TestResults"],
  ["/documents", "Documents"], ["/verify-lot", "VerifyLot"],
  ["/research", "Research"], ["/legal/terms", "Terms"], ["/legal/shipping", "ShippingRefunds"], ["/faqs", "Faqs"],
  ["/about", "About"], ["/contact", "Contact"], ["/deals", "Deals"], ["/coa-policy", "CoaPolicy"], ["/login", "Login"],
];
for (const [route, chunk] of EXPECT) {
  const page = pages.find(([p]) => p === route);
  if (!page) { ok(false, `${route} is prerendered`); continue; }
  const own = preloads(page[1]).filter((h) => new RegExp(`/assets/${chunk}-[\\w-]+\\.js$`).test(h));
  ok(own.length === 1, `${route} preloads its page chunk ${chunk}-*.js (${own.join(", ") || "none"})`);
  ok(own.every((h) => existsSync(path.join(DIST, h))), `${route}: preloaded file exists in dist`);
}
// The landing page is excluded on measurement (see ROUTE_PAGE_SOURCES in the
// generator): preloading its chunk made its largest paint ~900 ms later.
const home = pages.find(([p]) => p === "/");
ok(home && !preloads(home[1]).some((h) => /\/assets\/PublicLanding-/.test(h)), "/ does NOT preload its route chunk (measured regression; PLAYBOOK Hy-007)");
// Batch-history pages exist only when the build had database access.
const batches = pages.filter(([p]) => /^\/test-results\/[^/]+$/.test(p));
if (batches.length) ok(batches.every(([, html]) => preloads(html).some((h) => /\/assets\/TestResultsProduct-/.test(h))), `every batch-history page (${batches.length}) preloads the TestResultsProduct chunk`);
else console.log("  · no /test-results/<slug> pages in this build (no database env) — batch-history preload not checked");
// Category pages are Shop too.
const cats = pages.filter(([p]) => /^\/shop\/[^/]+$/.test(p));
ok(cats.length >= 5 && cats.every(([, html]) => preloads(html).some((h) => /\/assets\/Shop-/.test(h))), `every category page (${cats.length}) preloads the Shop chunk`);
const products = pages.filter(([p]) => /^\/product\//.test(p));
ok(products.length >= 40 && products.every(([, html]) => preloads(html).some((h) => /\/assets\/ProductDetail-/.test(h))), `every product page (${products.length}) preloads the ProductDetail chunk`);

const heavy = pages.filter(([, html]) => preloads(html).some((h) => /vendor-three|vendor-pdf|jsQR/.test(h))).map(([p]) => p);
ok(heavy.length === 0, `no page preloads vendor-three / vendor-pdf / jsQR (${JSON.stringify(heavy.slice(0, 5))})`);
// The list is the page chunk's STATIC import closure (the browser needs every
// one of them before the page module can run), so its size is the page's own
// import graph — the PDP's is 20 today. A bound still catches a runaway graph.
const bloated = pages.filter(([, html]) => preloads(html).length > 24).map(([p, html]) => `${p}:${preloads(html).length}`);
ok(bloated.length === 0, `no page carries more than 24 modulepreloads (${JSON.stringify(bloated.slice(0, 5))})`);
const missing = pages.filter(([, html]) => preloads(html).some((h) => !existsSync(path.join(DIST, h)))).map(([p]) => p);
ok(missing.length === 0, `every modulepreload on every page resolves to a file in dist (${JSON.stringify(missing.slice(0, 5))})`);
ok(!existsSync(path.join(DIST, ".vite")), "the Vite manifest is not left in dist (build input, not a deliverable)");

console.log(failures ? `\n${failures} assertion(s) failed` : "\nAll route-preload assertions passed");
process.exit(failures ? 1 : 0);
