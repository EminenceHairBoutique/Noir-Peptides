/*
  scripts/test-code-name.mjs   (opt cycle 9 — addendum C7; scorecards 4.1 / 4.3)
  products.code_name: an optional storefront display name, set on nothing.
  Proves (1) the one display-name rule, (2) the three-step degrading select
  (0036 → 0033 → base) so a deploy ahead of the migration still reads the live
  catalog WITH its SDS columns, (3) every shopper surface renders the display
  name while the certificate surfaces keep the substance name, (4) the
  prerender overlays code names from the database and (5) the admin API holds
  the field to the public-copy rules. The real handler is exercised in
  scripts/test-admin-copy-doors.mjs.
  Run: node scripts/test-code-name.mjs   (wired into npm run test:unit)
*/
import { readFileSync, existsSync } from "node:fs";
import { displayNameOf, CODE_NAME_MAX } from "../src/lib/displayName.js";
import { selectDegrading } from "../src/lib/pgSelect.js";
import { getAllProducts } from "../src/data/tier1Catalog.js";

let failures = 0;
const ok = (cond, msg) => { if (cond) console.log(`  ✓ ${msg}`); else { failures++; console.error(`  ✗ ${msg}`); } };
const read = (p) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

console.log("1. The display-name rule:");
ok(displayNameOf(null) === "", "null row → empty string");
ok(displayNameOf({ name: "Semaglutide" }) === "Semaglutide", "no code_name → substance name");
ok(displayNameOf({ name: "Semaglutide", code_name: null }) === "Semaglutide", "null code_name → substance name");
ok(displayNameOf({ name: "Semaglutide", code_name: "   " }) === "Semaglutide", "blank code_name → substance name");
ok(displayNameOf({ name: "Semaglutide", code_name: " Compound A-7 " }) === "Compound A-7", "code_name wins, trimmed");
ok(CODE_NAME_MAX === 80, "CODE_NAME_MAX is 80 (matches the migration's check constraint)");
ok(/between 1 and 80/.test(read("supabase/migrations/0036_products_code_name.sql")), "migration 0036 constrains the length to 1–80");
ok(getAllProducts().every((p) => p.codeName === null), `the static catalog sets a code name on nothing (${getAllProducts().length} products)`);

console.log("\n2. Three-step degrading select:");
{
  const missing = { data: null, error: { code: "42703", message: 'column products.code_name does not exist' } };
  const calls = [];
  const run = (cols) => { calls.push(cols); return Promise.resolve(cols.includes("code_name") ? missing : { data: [{ id: "x" }], error: null }); };
  const r = await selectDegrading(run, "id, code_name", "id, sds_file_url", "id");
  ok(calls.length === 2 && calls[1] === "id, sds_file_url" && r.data?.[0]?.id === "x", "0036 column missing → falls to the 0033 list, not straight to base");
  const calls2 = [];
  const run2 = (cols) => { calls2.push(cols); return Promise.resolve(cols === "id" ? { data: [], error: null } : missing); };
  await selectDegrading(run2, "id, code_name", "id, sds_file_url", "id");
  ok(calls2.length === 3 && calls2[2] === "id", "both newer lists missing → base");
  const other = { data: null, error: { code: "PGRST301", message: "JWT expired" } };
  const r3 = await selectDegrading(() => Promise.resolve(other), "id, code_name", "id");
  ok(r3 === other, "a non-column error is returned untouched on the first attempt");
  const okFirst = { data: [1], error: null };
  const r4 = await selectDegrading(() => Promise.resolve(okFirst), "id, code_name", "id, sds_file_url", "id");
  ok(r4 === okFirst, "first list succeeds → returned as-is");
}

console.log("\n3. Source contracts — shopper surfaces show the display name, certificates keep the name:");
{
  const catalog = read("src/lib/catalog.js");
  ok(/PRODUCT_COLUMNS = PRODUCT_COLUMNS_0033 \+ ", code_name"/.test(catalog), "client select names code_name on top of the 0033 list");
  ok((catalog.match(/PRODUCT_COLUMNS,\s*(?:\/\/[^\n]*\n\s*)?PRODUCT_COLUMNS_0033,/g) || []).length >= 6, "every product select degrades through the 0033 list (≥ 6 call sites)");
  ok(/displayName: displayNameOf\(row\)/.test(catalog) && /code_name: row\.code_name \?\? null/.test(catalog), "normalizeProduct maps code_name and displayName");
  ok(/code_name: p\.codeName \?\? null/.test(catalog), "the static fallback mirrors codeName");
  const uses = (file, min) => ok((read(file).match(/displayName \|\| /g) || []).length >= min, `${file} prefers displayName (${(read(file).match(/displayName \|\| /g) || []).length} site(s) ≥ ${min})`);
  uses("src/components/ProductCard.jsx", 3);
  uses("src/pages/ProductDetail.jsx", 7);
  uses("src/components/LabSuppliesCrossSell.jsx", 1);
  uses("src/pages/Shop.jsx", 3);
  ok(/name: product\.displayName \|\| product\.name/.test(read("src/context/CartContext.jsx")), "cart lines carry the display name (CartContext)");
  ok(/item_name: src\.displayName \|\| src\.name/.test(read("src/utils/track.js")), "analytics item_name is the display name");
  for (const f of ["src/pages/TestResults.jsx", "src/pages/TestResultsProduct.jsx", "src/components/CoaCard.jsx", "src/pages/Documents.jsx"]) ok(!/displayName/.test(read(f)), `${f} keeps the substance name (certificates are about the substance)`);
  const pdp = read("src/pages/ProductDetail.jsx");
  ok(/productName=\{product\.name\}/.test(pdp) && /Full batch history for \{product\.name\}/.test(pdp), "the PDP's batch-history block keeps the substance name");
}

console.log("\n4. Prerender overlays code names from the database:");
{
  const seo = read("scripts/generate-static-seo.mjs");
  ok(/async function fetchCodeNamesAtBuild\(\)/.test(seo) && /select=id,code_name&code_name=not\.is\.null/.test(seo), "fetches id + code_name for products that have one");
  ok(/codeNames = await fetchCodeNamesAtBuild\(\)/.test(seo), "runs at build before the routes are assembled");
  ok(/const catalogProducts = withDisplayNames\(getVisibleProducts\(\)\)/.test(seo), "shop list uses display names");
  ok((seo.match(/withDisplayNames\(getVisibleProductsInCategory\(/g) || []).length === 2, "category pages and PDP related rails use display names");
  for (const marker of ["name: `${dn(p)} — Research Reference Material`", "<h1>${escapeHtml(dn(p))} — Research Reference Material</h1>", "name: `${dn(p)} ${v.size_label}`", "${escapeHtml(dn(p))}</a> — from", "${escapeHtml(dn(r))}</a> — from"]) ok(seo.includes(marker), `prerender surface: ${marker.slice(0, 48)}…`);
  ok((seo.match(/title: `\$\{dn\(p\)\} — Research Reference Material`/g) || []).length === 2, "product route + JSON-LD titles use the display name");
  ok(/`<h1>\$\{escapeHtml\(prod\.name\)\} — Batch Test History<\/h1>`/.test(seo), "batch-history permalinks keep the substance name");
  ok(/codeNameCount: codeNames\.size/.test(seo), "prerender-meta records how many code names were applied");
  if (existsSync(new URL("../dist/prerender-meta.json", import.meta.url))) {
    const meta = JSON.parse(read("dist/prerender-meta.json"));
    ok(Number.isInteger(meta.codeNameCount), `built prerender-meta.json carries codeNameCount (${meta.codeNameCount})`);
  }
}

console.log("\n5. Admin API holds the field to the public-copy rules:");
{
  const api = read("api/admin/catalog.js");
  ok(/PRODUCT_COLUMNS = `\$\{PRODUCT_COLUMNS_0033\}, code_name`/.test(api), "admin select names code_name; loadProducts steps 0036 → 0033 → base");
  ok(/\[PRODUCT_COLUMNS, null\], \[PRODUCT_COLUMNS_0033,/.test(api), "three-step degradation in loadProducts");
  ok(/if \("code_name" in body\)/.test(api) && /checkLabelText\(clean\)\.length/.test(api) && /clean\.length > CODE_NAME_MAX/.test(api), "pickFields: copy door + length cap on code_name; \"\" clears");
  const ui = read("src/pages/AdminHome.jsx");
  ok(/function CodeNameRow\(/.test(ui) && /"code_name" in row/.test(ui) && /code_name: edit\.trim\(\)/.test(ui), "Control Room: a Code name row, hidden until the column exists, PATCHes the field");
  ok(/<CodeNameRow row=\{p\}/.test(ui), "the row is rendered under each expanded product");
  ok(/\| 0036 \|/.test(read("docs/SCHEMA.md")) && existsSync(new URL("../docs/MIGRATIONS_0036.md", import.meta.url)), "SCHEMA.md lists 0036 and the apply note exists");
}

if (failures) { console.error(`\n${failures} code-name check(s) FAILED`); process.exit(1); }
console.log("\nAll code-name checks passed.");
