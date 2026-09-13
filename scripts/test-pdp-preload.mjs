/*
  scripts/test-pdp-preload.mjs   (opt cycle 1 — scorecard 4.7)
  A product page's first paint must not pull the 3D (vendor-three), PDF
  (vendor-pdf) or QR-decoder (jsQR) chunks. Reads every emitted
  dist/product/<slug>/index.html and asserts none preloads or scripts them.
  Runs against the BUILT dist/ (skips loudly if absent; hard-fails in CI).

  Run: node scripts/test-pdp-preload.mjs   (wired into npm run test:unit)
*/
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

const DIST = path.join(process.cwd(), "dist");
const PRODUCTS = path.join(DIST, "product");
if (!existsSync(PRODUCTS)) {
  if (process.env.CI) { console.error("dist/product missing in CI — build must precede this check."); process.exit(1); }
  console.log("  ⓘ SKIPPED — dist/ not built.");
  process.exit(0);
}
const HEAVY = /vendor-three|vendor-pdf|jsQR/;
// Opt cycle 4 (Hy-005): the flat-label renderer and the QR library it pulls are
// label-studio code; they ride the PDP only when an approved label exists.
const LABEL_STUDIO = /LabelPreview-|\bbrowser-/;
const pages = readdirSync(PRODUCTS).map((slug) => path.join(PRODUCTS, slug, "index.html")).filter(existsSync);
console.log(`PDP first-paint budget — ${pages.length} product pages:`);
const offenders = [];
const labelStudio = [];
for (const f of pages) {
  const html = readFileSync(f, "utf8");
  const tags = [...html.matchAll(/<(?:link[^>]*rel="modulepreload"|script)[^>]*>/g)].map((m) => m[0]);
  if (tags.some((t) => HEAVY.test(t))) offenders.push(path.relative(DIST, f));
  if (tags.some((t) => LABEL_STUDIO.test(t))) labelStudio.push(path.relative(DIST, f));
}
ok(pages.length >= 40, `at least 40 product pages were emitted (${pages.length})`);
ok(offenders.length === 0, `no PDP preloads or scripts vendor-three / vendor-pdf / jsQR (offenders: ${JSON.stringify(offenders.slice(0, 5))})`);
ok(labelStudio.length === 0, `no PDP preloads the flat-label renderer or the QR library (Hy-005; offenders: ${JSON.stringify(labelStudio.slice(0, 5))})`);
{
  const sample = readFileSync(pages[0], "utf8");
  const preloads = [...sample.matchAll(/rel="modulepreload"[^>]*href="([^"]+)"/g)].map((m) => m[1]);
  console.log(`  ⓘ ${path.relative(DIST, pages[0])} preloads: ${preloads.map((p) => p.replace(/^\/assets\//, "").replace(/-[A-Za-z0-9_-]+\.js$/, "")).join(", ")}`);
}

if (failures) {
  console.error(`\n${failures} PDP-preload check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll PDP-preload checks passed.");
