/*
  scripts/test-product-specs.mjs   (opt cycle 11 — scorecard 4.4)
  Dry technical specs are transcribed, never derived. Proves:
    - every entry in src/data/productSpecs.js names an existing product, a
      source, and well-formed values (CAS check digit, "N g/mol", residue
      alphabet);
    - migration 0038 is exactly what the generator emits from the data
      (byte-compare, like the 0009 seed gate) and only ever coalesces;
    - the static fallback exposes the same columns; the panel omits what is
      not on record; the admin API validates the three fields (real handler);
    - the coverage is REPORTED (n/44), not asserted — the rest is owner data.
  Run: node scripts/test-product-specs.mjs   (wired into npm run test:unit)
*/
import { readFileSync } from "node:fs";
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";
import { PRODUCT_SPECS, specColumnsFor } from "../src/data/productSpecs.js";
import { getAllProducts } from "../src/data/tier1Catalog.js";
import { isValidCas } from "../lib/cas.js";
import { SQL } from "./gen-specs-migration.mjs";

let failures = 0;
const ok = (cond, msg) => { if (cond) console.log(`  ✓ ${msg}`); else { failures++; console.error(`  ✗ ${msg}`); } };
const products = getAllProducts();
const ids = new Set(products.map((p) => p.id));

console.log("Spec data:");
let seq = 0, mw = 0, cas = 0;
for (const [id, s] of Object.entries(PRODUCT_SPECS)) {
  ok(ids.has(id), `${id}: is a catalog product`);
  ok(typeof s.source === "string" && s.source.length > 3, `${id}: names its source (${s.source})`);
  if (s.sequence) { seq++; ok(/^[A-Za-z0-9()[\]\-–·+,. βγα]+$/.test(s.sequence) && s.sequence.length <= 200, `${id}: sequence is a residue string`); }
  if (s.molecularWeight) { mw++; ok(/^\d{2,6}(\.\d{1,3})? g\/mol$/.test(s.molecularWeight), `${id}: molecular weight reads like N g/mol (${s.molecularWeight})`); }
  if (s.cas) { cas++; ok(isValidCas(s.cas), `${id}: CAS ${s.cas} has a valid check digit`); }
}
console.log(`  · coverage: ${Object.keys(PRODUCT_SPECS).length}/${products.length} products with any spec — sequence ${seq}, molecular weight ${mw}, CAS ${cas} (reported, not gated; the rest is owner data, Owner Sprint D5b)`);
ok(!("tb-500" in PRODUCT_SPECS), "TB-500 carries no spec (its legacy values referenced the parent protein — left for the owner to verify)");

console.log("\nMigration 0038 is generated from the data:");
const committed = readFileSync("supabase/migrations/0038_product_specs.sql", "utf8");
ok(committed === SQL, "supabase/migrations/0038_product_specs.sql equals the generator output (re-run scripts/gen-specs-migration.mjs after editing productSpecs.js)");
ok(/^update public\.products set /m.test(committed) && !/insert|delete|alter/i.test(committed), "update-only");
ok((committed.match(/coalesce\(/g) || []).length >= 25 && !/set peptide_sequence = '/.test(committed), "every assignment coalesces — a value the owner entered is never overwritten");

console.log("\nStatic fallback + panel + compare table:");
const bpc = products.find((p) => p.id === "bpc-157");
ok(bpc.specs?.cas === "137525-51-0", "getAllProducts() carries the spec object");
ok(specColumnsFor("bpc-157").peptide_sequence === "GEPPPGKPADDAGLV" && specColumnsFor("nope").cas_number === null, "specColumnsFor maps to the three columns, nulls when absent");
const catalog = readFileSync("src/lib/catalog.js", "utf8");
ok(/peptide_sequence: p\.specs\?\.sequence \?\? null/.test(catalog) && /cas_number: p\.specs\?\.cas \?\? null/.test(catalog), "the static fallback exposes the columns");
const panel = readFileSync("src/components/PeptideSpecsPanel.jsx", "utf8");
ok(/if \(value === null \|\| value === undefined \|\| value === ""\) return null;/.test(panel) && !/"—"/.test(panel.split("function Row")[1].split("export default")[0]), "the panel omits a row with no value (no dash placeholder)");

console.log("\nAdmin API (real handler):");
process.env.VITE_SUPABASE_URL ||= "https://placeholder.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY ||= "placeholder";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "placeholder";
const outfile = path.join(process.cwd(), `.specs-test-${Date.now()}.mjs`);
await build({ entryPoints: [path.join(process.cwd(), "scripts/_admin-entry.mjs")], bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  plugins: [{ name: "stubs", setup(b) {
    b.onResolve({ filter: /supabaseServer\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-supabase.mjs") }));
    b.onResolve({ filter: /_utils\/auth\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-auth.mjs") }));
    b.onResolve({ filter: /_utils\/rateLimit\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_stub-rate-limit.mjs") }));
  } }] });
const { catalogHandler, FIXTURES, LOG } = await import(`file://${outfile}`);
fs.unlinkSync(outfile);
FIXTURES.products = [{ id: "bpc-157", slug: "bpc-157", name: "BPC-157", price: 44, stock_status: "in_stock", peptide_sequence: null, molecular_weight: null, cas_number: null }];
const call = async (body) => { const r = { statusCode: null, payload: null, headers: {} }; r.setHeader = () => {}; r.end = (p) => { try { r.payload = JSON.parse(p); } catch { r.payload = p; } }; await catalogHandler({ method: "PATCH", headers: {}, body }, r); return r; };
let r = await call({ kind: "product", id: "bpc-157", cas_number: "137525-51-1" });
ok(r.statusCode === 400 && /check digit/.test(JSON.stringify(r.payload)), "a CAS with a wrong check digit → 400");
r = await call({ kind: "product", id: "bpc-157", molecular_weight: "about 1.4 kDa" });
ok(r.statusCode === 400 && /g\/mol/.test(JSON.stringify(r.payload)), "a molecular weight without the g/mol shape → 400");
r = await call({ kind: "product", id: "bpc-157", peptide_sequence: "take 250 mcg daily" });
ok(r.statusCode === 400, "use language in a sequence field → 400");
r = await call({ kind: "product", id: "bpc-157", peptide_sequence: "GEPPPGKPADDAGLV", molecular_weight: "1419.53 g/mol", cas_number: "137525-51-0" });
const upd = LOG.filter((l) => l.table === "products" && l.op === "update").pop();
ok(r.statusCode === 200 && upd?.payload?.cas_number === "137525-51-0" && upd?.payload?.molecular_weight === "1419.53 g/mol", "valid specs → 200, written");
r = await call({ kind: "product", id: "bpc-157", cas_number: "" });
ok(r.statusCode === 200 && LOG.filter((l) => l.table === "products" && l.op === "update").pop()?.payload?.cas_number === null, `"" clears a spec`);

if (failures) { console.error(`\n${failures} product-spec check(s) FAILED`); process.exit(1); }
console.log("\nAll product-spec checks passed.");
