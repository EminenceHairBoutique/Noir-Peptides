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
import { PRERENDER_EMPTY_ALLOWLIST, BUILD_META_FILE } from "./generate-static-seo.mjs";
import { assertPrerenderData } from "./assert-prerender-data.mjs";
import { researchArticles, researchDrafts } from "../src/data/research.js";
import { HOME_COPY } from "../src/data/pageCopy.js";

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

// Sept-11 T6: the noindex set is EXPLICIT. /calculator joins it whenever the
// build had VITE_FEATURE_CALCULATOR off (the default), and in that state it
// must carry the 404 body rather than the tool. (buildMeta is read in §5.)
{
  const metaEarly = JSON.parse(fs.readFileSync(path.join(DIST, BUILD_META_FILE), "utf8"));
  const calcOn = Boolean(metaEarly?.features?.calculator);
  const EXPECTED_NOINDEX = ["/404", "/login", "/register", "/verify-lot", ...(calcOn ? [] : ["/calculator"])].sort();
  ok(
    JSON.stringify([...noindexed].sort()) === JSON.stringify(EXPECTED_NOINDEX),
    `noindex set is exactly ${JSON.stringify(EXPECTED_NOINDEX)} (got ${JSON.stringify([...noindexed].sort())})`
  );
  const calc = fs.readFileSync(path.join(DIST, "calculator", "index.html"), "utf8");
  if (calcOn) {
    ok(calc.includes('<div id="root"></div>'), "/calculator (flag ON) ships the interactive tool: empty root, allowlisted");
    ok(locs.includes("/calculator"), "/calculator (flag ON) is in the sitemap");
  } else {
    ok(calc.includes("<h1>Page Not Found</h1>"), "/calculator (flag OFF) ships the prerendered 404 body");
    ok(/content="noindex/.test(calc), "/calculator (flag OFF) is noindex");
    ok(!locs.includes("/calculator"), "/calculator (flag OFF) is removed from the sitemap");
    ok(!PRERENDER_EMPTY_ALLOWLIST.includes("/calculator"), "/calculator (flag OFF) is not in the empty-root allowlist");
  }
}

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
// The build records whether it had database access (Sept-11 T2). Without it,
// /deals and /test-results are static shells and must contain NO row-like
// data. With it, /test-results carries REAL fetched rows — those are not
// fabricated, and the check that applies instead is the data-presence
// assertion (which the build already enforced; re-run here as a test).
const metaPath = path.join(DIST, BUILD_META_FILE);
const buildMeta = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, "utf8")) : null;
ok(buildMeta && typeof buildMeta.dbEnvPresent === "boolean", `build wrote ${BUILD_META_FILE} with dbEnvPresent`);
if (buildMeta?.dbEnvPresent) {
  console.log(`  ⓘ build had database access (${buildMeta.coaRowCount} COA rows, ${buildMeta.sdsRowCount} SDS rows) — real rows are expected`);
  let assertion = null;
  try {
    assertPrerenderData({
      pages: Object.fromEntries(
        ["/test-results", "/documents"].map((r) => [r, fs.readFileSync(path.join(DIST, r.slice(1), "index.html"), "utf8")])
      ),
      env: { VITE_SUPABASE_URL: "x", VITE_SUPABASE_ANON_KEY: "x" },
    });
  } catch (e) {
    assertion = e.message;
  }
  ok(assertion === null, `data-presence assertion holds on the built trust pages${assertion ? ` (${assertion.split("\n")[0]})` : ""}`);
  // /deals is still a shell either way (offers render live).
  const dealsHtml = fs.readFileSync(path.join(DIST, "deals", "index.html"), "utf8");
  const dealsRoot = dealsHtml.slice(dealsHtml.indexOf('<div id="root">'), dealsHtml.indexOf("</body>"));
  ok(!/\$\d|\d+%\s|LOT[- ]?\d|COA[- ]?\d/i.test(dealsRoot), "/deals shell contains no row-like data");
} else {
  for (const route of ["/deals", "/test-results"]) {
    const f = path.join(DIST, route.slice(1), "index.html");
    if (!fs.existsSync(f)) continue;
    const html = fs.readFileSync(f, "utf8");
    const root = html.slice(html.indexOf('<div id="root">'), html.indexOf("</body>"));
    // Synthetic rows would show as prices, percentages, or lot-like codes.
    const suspicious = /\$\d|\d+%\s|LOT[- ]?\d|COA[- ]?\d/i.test(root);
    ok(!suspicious, `${route} shell contains no row-like data (no prices/lots/percentages)`);
  }
  // And the shell must not pretend the SDS list was consulted.
  const docs = fs.readFileSync(path.join(DIST, "documents", "index.html"), "utf8");
  ok(!docs.includes('id="sds-list"'), "/documents shell (no DB at build) emits no SDS list container");
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

// ── 6b. Home posture sentence comes from the shared source ───────────────
// Sept-11 T4: the hero sentence was two independent literals and had drifted.
// The prerendered "/" must carry HOME_COPY.posture verbatim (the React page
// imports the same constant), and the retired "Access requires…" wording must
// be gone — it overstated the wall on a deliberately public catalog.
{
  const home = fs.readFileSync(path.join(DIST, "index.html"), "utf8");
  const root = home.slice(home.indexOf('<div id="root">'), home.indexOf("</body>"));
  ok(root.includes(HOME_COPY.posture), `prerendered / carries HOME_COPY.posture verbatim`);
  ok(
    HOME_COPY.posture.startsWith("Purchasing requires"),
    'HOME_COPY.posture says "Purchasing requires" (only purchase is gated)'
  );
  ok(!/Access requires an account/.test(root), 'retired "Access requires" wording is absent from /');
}

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
