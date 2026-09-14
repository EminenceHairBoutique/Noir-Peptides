/*
  scripts/test-coa-state.mjs   (opt cycle 12 — scorecard 4.7, TBT)
  The certificate pages seed their state from the mirrored published rows
  and then ask the database. When the answer is the same rows, the state must
  NOT be replaced — replacing it re-rendered /shop's 44 cards and
  /test-results' 19 rows a second time for nothing (measured: /shop TBT 205 ms,
  /test-results 171 ms on the cycle-12 lane, over the 200 ms budget in CI).
  Proves the structural comparers and that every seeded page uses them, and
  that the product page settles in one batch (tiers + certificate map with
  the page; related cards mount managed).
  Run: node scripts/test-coa-state.mjs   (wired into npm run test:unit)
*/
import fs from "node:fs";
import { bundleComponents } from "./_render-jsx.mjs";
let failures = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { failures++; console.error(`  ✗ ${m}`); } };
const src = (p) => fs.readFileSync(p, "utf8");

const { sameCoaRows, sameLatestCoaMap, getSeedCoas, getSeedLatestCoaMap, getAllCoas, getLatestCoaMap } = await bundleComponents(
  'export { sameCoaRows, sameLatestCoaMap, getSeedCoas, getSeedLatestCoaMap, getAllCoas, getLatestCoaMap } from "../src/lib/coas.js";\n',
  "coastate",
  { realCoas: true }
);

console.log("Structural comparers:");
{
  const a = getSeedCoas(), b = getSeedCoas();
  ok(a !== b && a.length === 19 && sameCoaRows(a, b), "two fresh seed reads are different arrays with the same 19 rows → same");
  ok(sameCoaRows(a, a), "a list is the same as itself");
  ok(!sameCoaRows(a, a.slice(1)), "a shorter list is not the same");
  const changed = b.map((r, i) => (i === 3 ? { ...r, purity_percent: 12.34 } : r));
  ok(!sameCoaRows(a, changed), "one changed column (purity) on one row → not the same");
  const reordered = b.map((r) => Object.fromEntries(Object.entries(r).reverse()));
  ok(sameCoaRows(a, reordered), "the same rows with keys in a different order → same (structure, not key order)");
  const nested = b.map((r) => ({ ...r, lab: r.lab ? { ...r.lab } : { name: "X" } }));
  ok(!sameCoaRows(a, nested) === a.some((r) => !r.lab), "a nested lab object counts (added where the seed has none → not the same)");
  ok(!sameCoaRows(a, null) && !sameCoaRows(undefined, b) && !sameCoaRows(a, {}), "non-lists are never the same as a list");

  const m1 = getSeedLatestCoaMap(), m2 = getSeedLatestCoaMap();
  ok(m1 !== m2 && Object.keys(m1).length === 15 && sameLatestCoaMap(m1, m2), "two fresh seed maps are different objects with the same 15 entries → same");
  ok(!sameLatestCoaMap(m1, { ...m2, extra: m2[Object.keys(m2)[0]] }), "an extra product → not the same");
  const k = Object.keys(m1)[0];
  ok(!sameLatestCoaMap(m1, { ...m2, [k]: { ...m2[k], file_url: "/other.pdf" } }), "a changed certificate for one product → not the same");
  const { [k]: _drop, ...rest } = m2;
  ok(!sameLatestCoaMap(m1, { ...rest, other: m2[k] }), "the same count with a different product id → not the same");
  ok(!sameLatestCoaMap(m1, null) && !sameLatestCoaMap(null, m2) && sameLatestCoaMap(null, null), "null handling: null equals only null");
  // Without a client every reader answers the seed — so the live answer IS
  // the seed in env-less builds, and the pages must treat it as a no-op.
  const live = await getAllCoas(), liveMap = await getLatestCoaMap();
  ok(sameCoaRows(getSeedCoas(), live) && sameLatestCoaMap(getSeedLatestCoaMap(), liveMap), "without a client the live answer equals the seed (the no-op case the pages rely on)");
}

console.log("\nThe seeded pages keep their state on an identical answer:");
{
  const shop = src("src/pages/Shop.jsx");
  ok(/setLatestCoaMap\(\(cur\) => \(sameLatestCoaMap\(cur, map\) \? cur : map\)\)/.test(shop), "Shop replaces the certificate map only when it differs");
  ok(!/setLatestCoaMap\(map\)/.test(shop), "Shop has no unconditional map replacement");
  const tr = src("src/pages/TestResults.jsx");
  ok(/setCoas\(\(cur\) => \(sameCoaRows\(cur, rows\) \? cur : rows\)\)/.test(tr) && !/setCoas\(rows\)/.test(tr), "TestResults replaces its rows only when they differ");
  const trp = src("src/pages/TestResultsProduct.jsx");
  ok(/setCoas\(\(cur\) => \(sameCoaRows\(cur, seeded\) \? cur : seeded\)\)/.test(trp) && /setCoas\(\(cur\) => \(sameCoaRows\(cur, next\) \? cur : next\)\)/.test(trp) && !/setCoas\(seeded\)|setCoas\(publishedOnly\(rows\)\)/.test(trp), "TestResultsProduct: neither the seed nor an identical live answer replaces the rows");
}

console.log("\nThe product page settles in one batch:");
{
  const pdp = src("src/pages/ProductDetail.jsx");
  ok(/getCoasForProduct\(p\.id\),\s*getLatestCoaMap\(\),/.test(pdp), "the grid's certificate map loads with the page");
  ok(/const firstTiers = firstId \? await getTiers\(firstId\) : \[\];/.test(pdp) && /tiersForRef\.current = firstId;/.test(pdp), "the first variant's tiers load before the page renders");
  ok(/if \(tiersForRef\.current === selectedVariant\.id\) return undefined;/.test(pdp), "the tiers effect skips the variant it already has");
  ok(/<ProductCard key=\{p\.id\} product=\{p\} latestCoa=\{latestCoaMap \? latestCoaMap\[p\.id\] \|\| null : undefined\} \/>/.test(pdp), "related cards mount managed (no per-card certificate fetch)");
  ok(/setTiers\(\(cur\) => \(cur\.length \? \[\] : cur\)\)/.test(pdp) && /setCoas\(\(cur\) => \(cur\.length \? \[\] : cur\)\)/.test(pdp), "resetting empty lists keeps the same empty array (no identity churn)");
}

if (failures) { console.error(`\n${failures} COA-state check(s) FAILED`); process.exit(1); }
console.log("\nAll COA-state checks passed.");
