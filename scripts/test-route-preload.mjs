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
// Opt cycle 11: preloads live on the paint-first boot tag (data-preload) —
// read those too, so the assertions hold whichever way a page announces them.
const preloads = (html) => [
  ...[...html.matchAll(/<link rel="modulepreload"[^>]*href="([^"]+)"/g)].map((m) => m[1]),
  ...[...html.matchAll(/<script src="\/boot\.js" defer data-entry="[^"]*" data-preload="([^"]*)"/g)].flatMap((m) => m[1].split(",").filter(Boolean)),
];

const EXPECT = [
  ["/", "PublicLanding"], ["/shop", "Shop"], ["/product/bpc-157", "ProductDetail"], ["/test-results", "TestResults"],
  ["/documents", "Documents"], ["/verify-lot", "VerifyLot"],
  ["/research", "Research"], ["/legal/terms", "Terms"], ["/legal/shipping", "ShippingRefunds"], ["/faqs", "Faqs"],
  ["/about", "About"], ["/contact", "Contact"], ["/partners", "Partners"], ["/deals", "Deals"], ["/coa-policy", "CoaPolicy"], ["/login", "Login"],
];
for (const [route, chunk] of EXPECT) {
  const page = pages.find(([p]) => p === route);
  if (!page) { ok(false, `${route} is prerendered`); continue; }
  const own = preloads(page[1]).filter((h) => new RegExp(`/assets/${chunk}-[\\w-]+\\.js$`).test(h));
  ok(own.length === 1, `${route} preloads its page chunk ${chunk}-*.js (${own.join(", ") || "none"})`);
  ok(own.every((h) => existsSync(path.join(DIST, h))), `${route}: preloaded file exists in dist`);
}
// Opt cycle 11: with paint-first loading every preload starts after the first
// frame, so the landing page announces its chunk like every other route.
const home = pages.find(([p]) => p === "/");
ok(home && preloads(home[1]).some((h) => /\/assets\/PublicLanding-/.test(h)), "/ preloads its route chunk behind the boot tag");
ok(pages.every(([, html]) => /<script src="\/boot\.js" defer data-entry="\/assets\/index-[\w-]+\.js"/.test(html) && !/<script type="module" crossorigin src="\/assets\/index-/.test(html)), "every page loads the app through /boot.js — no parse-time module script");
ok(existsSync(path.join(DIST, "boot.js")), "dist/boot.js is shipped");
// Opt cycle 12 (4.7): the loader starts the app on the first-contentful-paint
// entry (never before the paint — two animation frames raced it and the
// Lighthouse LCP median flipped run to run), keeps the frame fallback for
// browsers without paint timing, and the 1500 ms timer for no paint at all.
{
  const boot = readFileSync(path.join(DIST, "boot.js"), "utf8");
  ok(/first-contentful-paint/.test(boot) && /observe\(\{ type: "paint", buffered: true \}\)/.test(boot), "boot.js waits for the first-contentful-paint entry before requesting the app");
  ok(/requestAnimationFrame\(start\)/.test(boot) && /setTimeout\(start, 1500\)/.test(boot), "boot.js keeps the frame fallback and the 1500 ms timer");
  ok(!/<script|innerHTML|eval\(/.test(boot), "boot.js contains no inline-script or eval shape (CSP gate stays honest)");
}
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
// Opt cycle 12: the bound is split — the vendor wave (shared, ≤ 8) and the
// route's own closure (≤ 20; the PDP is 16 today) — so a vendor split can
// never quietly raise the route budget or vice versa.
const isVendor = (h) => /\/assets\/vendor-/.test(h);
const bloated = pages.filter(([, html]) => preloads(html).filter((h) => !isVendor(h)).length > 20).map(([p, html]) => `${p}:${preloads(html).filter((h) => !isVendor(h)).length}`);
ok(bloated.length === 0, `no page carries more than 20 route-chunk modulepreloads (${JSON.stringify(bloated.slice(0, 5))})`);
const vendorHeavy = pages.filter(([, html]) => preloads(html).filter(isVendor).length > 8).map(([p, html]) => `${p}:${preloads(html).filter(isVendor).length}`);
ok(vendorHeavy.length === 0, `no page preloads more than 8 vendor chunks (${JSON.stringify(vendorHeavy.slice(0, 5))})`);
const missing = pages.filter(([, html]) => preloads(html).some((h) => !existsSync(path.join(DIST, h)))).map(([p]) => p);
ok(missing.length === 0, `every modulepreload on every page resolves to a file in dist (${JSON.stringify(missing.slice(0, 5))})`);
ok(!existsSync(path.join(DIST, ".vite")), "the Vite manifest is not left in dist (build input, not a deliverable)");

console.log(failures ? `\n${failures} assertion(s) failed` : "\nAll route-preload assertions passed");
process.exit(failures ? 1 : 0);
