/*
  scripts/test-prerender-coverage.mjs
  Gates the SEO crawlability work (Aug-28). Runs against the BUILT dist/.

  1. COVERAGE: every emitted route must ship real crawlable body content inside
     <div id="root">. The ONLY routes allowed to ship an empty root are the
     interactive/auth surfaces in PRERENDER_EMPTY_ALLOWLIST. Before this pass
     19 of 73 routes shipped an empty root; a regression must fail the build.
  2. CANONICAL HYGIENE: one canonical URL form across every route (absolute
     https, no trailing slash except the site root), and the canonical must
     match the route's own path.
  3. SITEMAP/ROBOTS: every indexable route is in the sitemap, every noindex
     route is absent, robots blocks only transactional/auth paths, and no
     robots rule accidentally blocks an indexable page by PREFIX.
  4. NO FABRICATION: prerendered DB-driven shells must not contain row data.

  Run: node scripts/test-prerender-coverage.mjs   (wired into npm run test:unit)
*/
import fs from "node:fs";
import path from "node:path";
import { PRERENDER_EMPTY_ALLOWLIST } from "./generate-static-seo.mjs";
import { researchArticles, researchDrafts } from "../src/data/research.js";

const DIST = path.join(process.cwd(), "dist");

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

if (!fs.existsSync(path.join(DIST, "index.html"))) {
  // These checks read the BUILT output. In CI the build must precede them, so
  // a missing dist/ there is a real failure (the gate would otherwise be
  // silently lost). Locally, on a fresh clone with no build yet, skip loudly
  // rather than emit a confusing failure.
  if (process.env.CI) {
    console.error("dist/ missing in CI — `npm run build` must run BEFORE this check.");
    process.exit(1);
  }
  console.log("  ⓘ SKIPPED — dist/ not built. Run `npm run build` first to exercise this gate.");
  process.exit(0);
}

function routeFiles(dir = DIST, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) routeFiles(p, out);
    else if (e.name === "index.html") out.push(p);
  }
  return out;
}

const files = routeFiles();
const routeOf = (f) => {
  const r = "/" + path.relative(DIST, f).replace(/index\.html$/, "").replace(/\/$/, "");
  return r === "/" ? "/" : r;
};

console.log(`Prerender coverage — ${files.length} emitted routes:`);

// ── 1. Coverage vs the explicit allowlist ────────────────────────────────
const empties = files.filter((f) => fs.readFileSync(f, "utf8").includes('<div id="root"></div>')).map(routeOf).sort();
const allow = [...PRERENDER_EMPTY_ALLOWLIST].sort();
ok(
  JSON.stringify(empties) === JSON.stringify(allow),
  `only allowlisted routes ship an empty root (got ${JSON.stringify(empties)})`
);

// Every non-allowlisted route must have a real <main> with an <h1>.
let missingMain = [];
for (const f of files) {
  const route = routeOf(f);
  if (PRERENDER_EMPTY_ALLOWLIST.includes(route)) continue;
  const html = fs.readFileSync(f, "utf8");
  const root = html.slice(html.indexOf('<div id="root">'), html.indexOf("</body>"));
  if (!root.includes("<main>") || !root.includes("<h1")) missingMain.push(route);
}
ok(missingMain.length === 0, `every non-allowlisted route has <main> + <h1> (missing: ${JSON.stringify(missingMain)})`);

// ── 2. Canonical hygiene ────────────────────────────────────────────────
let badCanonical = [];
for (const f of files) {
  const html = fs.readFileSync(f, "utf8");
  const m = html.match(/rel="canonical" href="([^"]+)"/);
  if (!m) {
    badCanonical.push(`${routeOf(f)} (none)`);
    continue;
  }
  const href = m[1];
  const route = routeOf(f);
  const expected = route === "/" ? "/" : route;
  if (!/^https:\/\//.test(href)) badCanonical.push(`${route} not absolute https`);
  else {
    const p = new URL(href).pathname;
    if (p !== expected) badCanonical.push(`${route} -> ${p}`);
    if (p !== "/" && p.endsWith("/")) badCanonical.push(`${route} has trailing slash`);
  }
}
ok(badCanonical.length === 0, `all canonicals absolute, path-matched, no trailing slash (bad: ${JSON.stringify(badCanonical.slice(0, 5))})`);

// ── 3. Sitemap + robots ─────────────────────────────────────────────────
const sitemap = fs.readFileSync(path.join(DIST, "sitemap.xml"), "utf8");
const robots = fs.readFileSync(path.join(DIST, "robots.txt"), "utf8");
const locs = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => new URL(m[1]).pathname);

const indexable = [];
const noindexed = [];
for (const f of files) {
  const html = fs.readFileSync(f, "utf8");
  (/content="noindex/.test(html) ? noindexed : indexable).push(routeOf(f));
}
const missingFromSitemap = indexable.filter((r) => !locs.includes(r === "/" ? "/" : r));
ok(missingFromSitemap.length === 0, `every indexable route is in sitemap.xml (missing: ${JSON.stringify(missingFromSitemap)})`);
const noindexInSitemap = noindexed.filter((r) => locs.includes(r));
ok(noindexInSitemap.length === 0, `no noindex route appears in sitemap.xml (found: ${JSON.stringify(noindexInSitemap)})`);

// Sitemap <loc> must use the same canonical form.
ok(
  locs.every((p) => p === "/" || !p.endsWith("/")),
  "sitemap <loc> paths use the same no-trailing-slash form"
);

// No robots Disallow may block an INDEXABLE route. Rules ending in "$" are
// exact-match; others are prefixes (this is what silently blocked /verify-lot).
const disallows = [...robots.matchAll(/^Disallow:\s*(\S+)$/gm)].map((m) => m[1]);
const wronglyBlocked = [];
for (const rule of disallows) {
  const exact = rule.endsWith("$");
  const pat = exact ? rule.slice(0, -1) : rule;
  for (const r of indexable) {
    if (exact ? r === pat : r.startsWith(pat)) wronglyBlocked.push(`${rule} blocks ${r}`);
  }
}
ok(wronglyBlocked.length === 0, `no robots rule blocks an indexable route (${JSON.stringify(wronglyBlocked.slice(0, 5))})`);

// ── 4. lastmod must never be a synthetic build stamp ────────────────────
const lastmods = [...sitemap.matchAll(/<lastmod>([^<]+)<\/lastmod>/g)].map((m) => m[1]);
if (lastmods.length) {
  const distinct = new Set(lastmods);
  ok(distinct.size > 1, `sitemap lastmod values are content-derived, not one build stamp (${distinct.size} distinct)`);
  const today = new Date().toISOString().slice(0, 10);
  ok(!lastmods.every((d) => d === today), "lastmod is not uniformly today's date");
} else {
  console.log("  ⓘ no <lastmod> emitted (shallow clone) — omission is the correct fallback");
}

// ── 5. No fabricated data in the DB-driven shells ───────────────────────
for (const route of ["/deals", "/test-results"]) {
  const f = path.join(DIST, route.slice(1), "index.html");
  if (!fs.existsSync(f)) continue;
  const html = fs.readFileSync(f, "utf8");
  const root = html.slice(html.indexOf('<div id="root">'), html.indexOf("</body>"));
  // Synthetic rows would show as prices, percentages, or lot-like codes.
  const suspicious = /\$\d|\d+%\s|LOT[- ]?\d|COA[- ]?\d/i.test(root);
  ok(!suspicious, `${route} shell contains no row-like data (no prices/lots/percentages)`);
}

// ── 6. Compliance: RUO line on every prerendered informational page ──────
let missingRuo = [];
for (const f of files) {
  const route = routeOf(f);
  if (PRERENDER_EMPTY_ALLOWLIST.includes(route)) continue;
  const html = fs.readFileSync(f, "utf8");
  const root = html.slice(html.indexOf('<div id="root">'), html.indexOf("</body>"));
  if (!/For research use only/i.test(root)) missingRuo.push(route);
}
ok(missingRuo.length === 0, `every prerendered body carries the RUO line (missing: ${JSON.stringify(missingRuo)})`);

// ── 7. Unpublished drafts must never reach the build ────────────────────
// researchDrafts is a separate export precisely so drafts cannot leak; this
// asserts it, and that no draft slug collides with a published one.
const distBlob = files.map((f) => fs.readFileSync(f, "utf8")).join("") + sitemap + robots;
const leaked = researchDrafts.filter((d) => distBlob.includes(d.slug));
ok(leaked.length === 0, `no unpublished research draft reaches dist (leaked: ${JSON.stringify(leaked.map((d) => d.slug))})`);
const published = new Set(researchArticles.map((a) => a.slug));
ok(
  researchDrafts.every((d) => !published.has(d.slug)),
  "no draft slug collides with a published article slug"
);

if (failures) {
  console.error(`\n${failures} prerender-coverage check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll prerender-coverage checks passed.");
