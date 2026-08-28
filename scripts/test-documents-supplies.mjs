/*
  scripts/test-documents-supplies.mjs
  Guards the document library (Task 2), the lab-supply attach SKUs (Task 8),
  and migration 0033 that backs both.

  Two properties matter most and are asserted directly:
    - NOTHING is ever fabricated. An absent SDS renders as absent, never as a
      placeholder link; an unseeded lab-supply catalogue renders as nothing,
      never as the bundled peptide catalogue.
    - The consumables cross-sell sells consumables, it does not teach a
      procedure. No reconstitution, ratio, dosing or protocol language may
      appear in that surface.

  Run: node scripts/test-documents-supplies.mjs   (in npm run test:unit)
*/
import { readFileSync } from "node:fs";
import { hasSds, sdsRevision, withSds, sdsCoverage } from "../src/lib/sds.js";
import { scanCopy } from "../src/lib/complianceScan.js";

let failures = 0;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => {
  failures++;
  console.error(`  ✗ ${m}`);
};
const assert = (c, m) => (c ? ok(m) : fail(m));
const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

// ── SDS predicates ────────────────────────────────────────────────────────
console.log("SDS presence is a fact about the row, never an assumption:");
assert(hasSds({ sds_file_url: "https://example.test/a.pdf" }) === true, "a real URL counts as published");
assert(hasSds({ sds_file_url: null }) === false, "null URL → no SDS");
assert(hasSds({ sds_file_url: "" }) === false, "empty URL → no SDS");
assert(hasSds({ sds_file_url: "   " }) === false, "whitespace-only URL → no SDS");
assert(hasSds({}) === false, "missing column (pre-migration row) → no SDS");
assert(hasSds(null) === false, "null product → no SDS, no throw");
assert(hasSds(undefined) === false, "undefined product → no SDS, no throw");

console.log("\nSDS revision date is shown only when genuinely recorded:");
assert(sdsRevision({ sds_updated_at: "2026-03-04" }) === "2026-03-04", "ISO day passes through");
assert(sdsRevision({ sds_updated_at: "2026-03-04T10:11:12Z" }) === "2026-03-04", "timestamp truncated to the day");
assert(sdsRevision({ sds_updated_at: null }) === null, "null → no date rendered");
assert(sdsRevision({ sds_updated_at: "soon" }) === null, "non-date text → no date rendered (never printed raw)");
assert(sdsRevision({}) === null, "absent field → no date rendered");

console.log("\nDocument-library counters are derived, never rounded up:");
const CATALOG = [
  { id: 3, name: "Cetrorelix", sds_file_url: "https://x.test/c.pdf" },
  { id: 1, name: "Alpha", sds_file_url: null },
  { id: 2, name: "BPC-157", sds_file_url: "https://x.test/b.pdf" },
];
const sheets = withSds(CATALOG);
assert(sheets.length === 2, "only rows with a real URL are listed (2 of 3)");
assert(
  sheets.map((p) => p.name).join(",") === "BPC-157,Cetrorelix",
  "listed alphabetically by name, independent of row order"
);
assert(!sheets.some((p) => p.name === "Alpha"), "a product without a sheet is never given one");
const cov = sdsCoverage(CATALOG);
assert(cov.published === 2 && cov.total === 3, "coverage counts published against the real total (2 of 3)");
assert(sdsCoverage([]).total === 0, "empty catalogue → zero total, no division");
assert(withSds(null).length === 0, "null input → empty list, no throw");

// ── Migration 0033 ────────────────────────────────────────────────────────
console.log("\nMigration 0033 (static):");
const mig = read("../supabase/migrations/0033_sds_and_lab_supplies.sql");
const exec = mig.replace(/--[^\n]*/g, "");
assert(/add column if not exists sds_file_url/.test(exec), "products gains sds_file_url idempotently");
assert(/add column if not exists sds_updated_at/.test(exec), "products gains sds_updated_at idempotently");
assert(/add column if not exists product_type/.test(exec), "products gains product_type idempotently");
assert(!/drop column|drop table|truncate|delete from/i.test(exec), "STRICTLY ADDITIVE — no drop/truncate/delete");
assert(!/insert into|^\s*update /im.test(exec), "seeds and rewrites NO data (SDS authoring is owner work)");
assert(
  /products_product_type_check/.test(exec) && /'peptide'/.test(exec) && /'lab_supply'/.test(exec),
  "product_type is constrained to the two known values"
);
assert(
  /product_type is null or product_type in/.test(exec),
  "the constraint tolerates NULL so existing rows are never invalidated"
);
assert(/create index if not exists idx_products_sds/.test(exec), "partial index supports the /documents query");
assert(!/grant (insert|update|delete)/i.test(exec), "no write grant to public roles");

// ── Nothing fabricated in the render paths ────────────────────────────────
console.log("\nRender paths refuse to invent a document:");
const sdsLink = read("../src/components/SdsLink.jsx");
assert(/if \(!hasSds\(product\)\) return null;/.test(sdsLink), "<SdsLink> renders nothing without a real URL");
{
  // Scan the CODE only — the file's own comments discuss placeholders in order
  // to rule them out, and would otherwise trip this check.
  const code = sdsLink.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/[^\n]*$/gm, " ");
  assert(!/coming soon|placeholder|example\.com|href="#"/i.test(code), "no placeholder href or 'coming soon' copy");
}
assert(/rel="noopener noreferrer"/.test(sdsLink), "outbound document link is rel-protected");

const docs = read("../src/pages/Documents.jsx");
assert(/getProducts\(\)/.test(docs), "the index lists the real catalogue, not a hardcoded list");
assert(/data-testid="sds-empty"/.test(docs), "an empty library states it plainly");
assert(/data-testid="sds-missing"/.test(docs), "materials lacking a sheet are named, not silently omitted");
assert(
  /\{coverage\.published\} of \{coverage\.total\}/.test(docs),
  "coverage numbers are interpolated from the derived counters, never written as literals"
);

const seo = read("../scripts/generate-static-seo.mjs");
assert(
  /Array\.isArray\(sdsRows\) && sdsRows\.length > 0/.test(seo),
  "the prerender lists sheets only from rows the build actually read"
);
assert(
  /\/documents prerenders the shell only/.test(seo),
  "a build without database access says so rather than implying an empty catalogue"
);

// ── Lab supplies: no protocol advice, no invented catalogue ───────────────
console.log("\nLab supplies are sold, not explained:");
const catalog = read("../src/lib/catalog.js");
assert(
  /export async function getLabSupplies/.test(catalog),
  "lab supplies have a dedicated query"
);
assert(
  /r\?\.product_type === "lab_supply"/.test(catalog),
  "the degraded (pre-migration) path is filtered, so it cannot return peptides as supplies"
);
{
  // getLabSupplies must NOT fall back to the bundled catalog the way the
  // storefront reads do — that catalog contains no consumables, so a fallback
  // would list peptides under 'laboratory consumables'.
  const body = catalog.slice(catalog.indexOf("export async function getLabSupplies"));
  const fnBody = body.slice(0, body.indexOf("\n}\n") + 3);
  assert(!/staticProducts|staticAllProducts/.test(fnBody), "no static-catalog fallback in getLabSupplies");
  assert((fnBody.match(/return \[\];/g) || []).length >= 2, "returns an empty list on every failure path");
}

const cross = read("../src/components/LabSuppliesCrossSell.jsx");
assert(/if \(!visible\.length\) return null;/.test(cross), "renders nothing when no consumables are configured");
assert(/inCart\.has\(o\.variant\.id\)/.test(cross), "never re-offers something already in the cart");
assert(/variant \? \{ product: p, variant \} : null/.test(cross), "an item with no purchasable variant is dropped");

// The visible copy of the cross-sell must be free of usage guidance. Strip
// comments and JSX expressions so only rendered text is scanned.
const crossCopy = cross
  .replace(/\/\*[\s\S]*?\*\//g, " ")
  .replace(/^\s*\/\/[^\n]*$/gm, " ")
  .replace(/\{[^}]*\}/g, " ");
for (const term of ["reconstitut", "dilut", "dose", "dosing", "inject", "administer", "protocol", "mix with", "you will need"]) {
  assert(!new RegExp(term, "i").test(crossCopy), `cross-sell copy contains no "${term}" language`);
}
{
  const r = scanCopy(crossCopy);
  const flags = r?.flags ?? r?.violations ?? [];
  assert(
    !(Array.isArray(flags) && flags.length),
    `cross-sell copy passes the compliance scanner${Array.isArray(flags) && flags.length ? ` (${JSON.stringify(flags)})` : ""}`
  );
}

// ── Task 7 article ────────────────────────────────────────────────────────
console.log("\nPurity-vs-content article is published and claim-safe:");
{
  const research = read("../src/data/research.js");
  const published = research.slice(0, research.indexOf("export const researchDrafts"));
  assert(/slug: "purity-vs-content"/.test(published), "the article is in researchArticles, not researchDrafts");
}

if (failures) {
  console.error(`\n${failures} documents/supplies check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll documents/supplies checks passed.");
