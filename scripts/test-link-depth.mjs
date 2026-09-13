/*
  scripts/test-link-depth.mjs   (opt cycle 2 — scorecard 4.6)
  The Aug-28 crawlability pass claimed "any public page ≤2 clicks from any
  other". This makes the claim mechanical. Over the BUILT dist/:
    1. every indexable page is reachable from "/" by internal links;
    2. every ORDERED PAIR of indexable pages is within 2 clicks;
    3. no indexable page has zero inbound links (an orphan);
    4. no page links to a soft-launch-hidden category or product.
  Only <a href="/..."> links inside the prerendered document count — that is
  what a crawler sees before hydration. noindex pages are excluded from the
  pair set (they may still be linked).

  Run: node scripts/test-link-depth.mjs   (wired into npm run test:unit)
*/
import fs from "node:fs";
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
if (!fs.existsSync(path.join(DIST, "index.html"))) {
  if (process.env.CI) { console.error("dist/ missing in CI — build must precede this check."); process.exit(1); }
  console.log("  ⓘ SKIPPED — dist/ not built.");
  process.exit(0);
}

const pages = {};
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name === "index.html") {
      let r = "/" + path.relative(DIST, path.dirname(p)).split(path.sep).join("/");
      if (r === "/.") r = "/";
      pages[r] = fs.readFileSync(p, "utf8");
    }
  }
})(DIST);

const norm = (h) => { const x = h.replace(/[?#].*$/, "").replace(/\/+$/, ""); return x === "" ? "/" : x; };
const links = {};
for (const [r, html] of Object.entries(pages)) {
  links[r] = new Set([...html.matchAll(/<a\s[^>]*href="(\/[^"]*)"/g)].map((m) => norm(m[1])).filter((x) => x in pages && x !== r));
}
const indexable = Object.keys(pages).filter((r) => !/content="noindex/.test(pages[r])).sort();
const inbound = {};
for (const r of indexable) inbound[r] = 0;
for (const [, set] of Object.entries(links)) for (const t of set) if (t in inbound) inbound[t]++;

function bfs(s) {
  const d = { [s]: 0 }; const q = [s];
  while (q.length) { const u = q.shift(); for (const v of links[u] || []) if (!(v in d)) { d[v] = d[u] + 1; q.push(v); } }
  return d;
}

console.log(`Link depth — ${indexable.length} indexable pages of ${Object.keys(pages).length} emitted:`);
{
  const fromHome = bfs("/");
  const unreachable = indexable.filter((r) => !(r in fromHome));
  ok(unreachable.length === 0, `every indexable page is reachable from / (unreachable: ${JSON.stringify(unreachable.slice(0, 6))})`);
  const deep = indexable.filter((r) => (fromHome[r] ?? Infinity) > 2);
  ok(deep.length === 0, `every indexable page is ≤2 clicks from / (deeper: ${JSON.stringify(deep.slice(0, 6))})`);
}
{
  let worst = 0; const far = [];
  for (const s of indexable) {
    const d = bfs(s);
    for (const t of indexable) { const k = d[t] ?? Infinity; if (k > worst) worst = k; if (k > 2) far.push(`${s} -> ${t} (${k === Infinity ? "unreachable" : k})`); }
  }
  ok(far.length === 0, `every ordered pair of indexable pages is within 2 clicks (worst ${worst === Infinity ? "unreachable" : worst}; ${far.length} pair(s) over — e.g. ${JSON.stringify(far.slice(0, 3))})`);
}
{
  const orphans = indexable.filter((r) => r !== "/" && inbound[r] === 0);
  ok(orphans.length === 0, `no indexable page is an orphan (zero inbound links): ${JSON.stringify(orphans)}`);
}
{
  const metaPath = path.join(DIST, "prerender-meta.json");
  const hidden = fs.existsSync(metaPath) ? JSON.parse(fs.readFileSync(metaPath, "utf8")).hiddenCategories || [] : [];
  const linkedHidden = [];
  for (const [r, set] of Object.entries(links)) for (const t of set) if (hidden.some((slug) => t === `/shop/${slug}`) || (/content="noindex/.test(pages[t] || "") && /<h1>Page Not Found<\/h1>/.test(pages[t] || ""))) linkedHidden.push(`${r} -> ${t}`);
  ok(linkedHidden.length === 0, `no page links to a hidden category or a 404-body route (${JSON.stringify(linkedHidden.slice(0, 4))})`);
}

if (failures) {
  console.error(`\n${failures} link-depth check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll link-depth checks passed.");
