/*
  scripts/test-coa-stats.mjs
  W2/W3/W6: counters, average-purity threshold + zero-row cases, filter
  agreement with the /shop category taxonomy, grouping order.
  Style mirrors scripts/test-guardrail.mjs.

  Run: node scripts/test-coa-stats.mjs   (wired into npm run test:unit)
*/
import {
  deriveCoaStats,
  filterCoas,
  groupByProduct,
  latestByProduct,
  MIN_LOTS_FOR_AVERAGE,
} from "../src/lib/coaStats.js";
import { getCategories, getAllProducts } from "../src/data/tier1Catalog.js";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

const row = (over = {}) => ({
  product_id: "bpc-157",
  lot_number: "L1",
  purity_percent: 99.1,
  tested_at: "2026-05-01",
  ms_confirmed: true,
  hplc: "99.1%",
  is_published: true,
  ...over,
});

console.log("deriveCoaStats — zero and edge cases:");
const zero = deriveCoaStats([]);
ok(zero.totalCerts === 0 && zero.productsWithCerts === 0, "zero rows → zero counts");
ok(zero.latestTestedAt === null && zero.avgPurity === null, "zero rows → null latest + null average (caller suppresses)");
ok(deriveCoaStats(null).totalCerts === 0, "null input tolerated");

console.log("\nderiveCoaStats — unpublished rows never counted:");
const mixed = deriveCoaStats([row(), row({ is_published: false, product_id: "other" })]);
ok(mixed.totalCerts === 1 && mixed.productsWithCerts === 1, "is_published:false excluded from every counter");

console.log("\nderiveCoaStats — counters:");
const many = [
  row({ lot_number: "A", tested_at: "2026-01-10" }),
  row({ lot_number: "B", tested_at: "2026-06-02" }),
  row({ product_id: "tb-500", lot_number: "C", tested_at: "2026-03-15" }),
];
const s = deriveCoaStats(many);
ok(s.totalCerts === 3, "total certificates = rows");
ok(s.productsWithCerts === 2, "distinct products counted");
ok(s.latestTestedAt === "2026-06-02", "latest tested_at is the max");

console.log("\naverage purity — threshold suppression (W6):");
const below = Array.from({ length: MIN_LOTS_FOR_AVERAGE - 1 }, (_, i) => row({ lot_number: `L${i}`, purity_percent: 99 }));
ok(deriveCoaStats(below).avgPurity === null, `below ${MIN_LOTS_FOR_AVERAGE} lots → average suppressed (null)`);
const at = Array.from({ length: MIN_LOTS_FOR_AVERAGE }, (_, i) => row({ lot_number: `L${i}`, purity_percent: 98 + i * 0.5 }));
const atStats = deriveCoaStats(at);
ok(atStats.avgPurity !== null && atStats.purityLots === MIN_LOTS_FOR_AVERAGE, `at ${MIN_LOTS_FOR_AVERAGE} lots → average computed with sample size`);
const expected = Math.round(((98 + 98.5 + 99 + 99.5 + 100) / 5) * 100) / 100;
ok(atStats.avgPurity === expected, `average is the arithmetic mean (${expected})`);
ok(
  deriveCoaStats([...at, row({ lot_number: "NOP", purity_percent: null })]).purityLots === MIN_LOTS_FOR_AVERAGE,
  "rows without a purity value do not dilute the sample"
);

console.log("\nfilterCoas — CAS + category, taxonomy agreement (W3):");
const products = getAllProducts();
const catalogIndex = Object.fromEntries(products.map((p) => [p.id, { category_slug: p.category_slug, name: p.name }]));
const catSlugs = new Set(getCategories().map((c) => c.slug));
ok(
  products.every((p) => catSlugs.has(p.category_slug)),
  "every catalog product's category exists in the /shop taxonomy (single taxonomy)"
);
const p1 = products.find((p) => p.category_slug === getCategories()[0].slug);
const p2 = products.find((p) => p.category_slug !== p1.category_slug);
const rowsForFilter = [
  row({ product_id: p1.id, cas_number: "7732-18-5" }),
  row({ product_id: p2.id, cas_number: null, lot_number: "X" }),
];
ok(
  filterCoas(rowsForFilter, { category: p1.category_slug }, catalogIndex).length === 1,
  "category filter uses the shop taxonomy via the catalog index"
);
ok(filterCoas(rowsForFilter, { cas: " 7732‐18‐5 " }, catalogIndex).length === 1, "CAS search normalizes dashes/whitespace on both sides");
ok(filterCoas(rowsForFilter, { cas: "50-00-0" }, catalogIndex).length === 0, "non-matching CAS → empty result, not everything");
ok(filterCoas(rowsForFilter, { cas: "7732-18-5", category: p2.category_slug }, catalogIndex).length === 0, "filters compose (AND)");

console.log("\ngrouping (W4/W5):");
const grouped = groupByProduct(many);
ok(grouped.get("bpc-157")?.length === 2 && grouped.get("tb-500")?.length === 1, "grouped by product");
ok(grouped.get("bpc-157")[0].lot_number === "B", "each group sorted newest test first");
ok(latestByProduct(many)["bpc-157"].lot_number === "B", "latestByProduct picks the newest lot");

if (failures) {
  console.error(`\n${failures} COA-stats check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll COA-stats checks passed.");
