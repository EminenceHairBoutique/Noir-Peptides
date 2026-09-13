/*
  scripts/db-shape-diff.mjs   (opt cycle 9 — addendum §E "static↔DB shape diff"; scorecard 4.3)
  db:verify proves the COUNTS; this proves the ROWS: every product, variant
  and price tier the static catalog (src/data/tier1Catalog.js, getAllProducts())
  defines exists in the database with the same slug, category, size, price and
  tier ladder, and the
  database carries no catalog row the static source does not know.
  STRICTLY READ-ONLY (three PostgREST selects with the service role).

  env: SUPABASE_URL (or VITE_SUPABASE_URL) + SUPABASE_SERVICE_ROLE_KEY
  Exit 0 with a note when the env is absent (same posture as db-verify),
  1 on any drift. Runs in .github/workflows/db-gates.yml against the fresh
  Supabase stack after the migrations (0009 seeds the catalog).
*/
import { getAllProducts } from "../src/data/tier1Catalog.js";

const URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
if (!URL || !KEY) { console.log("db-shape-diff: SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not set — skipped (not a failure)."); process.exit(0); }

async function rows(table, select) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const res = await fetch(`${URL}/rest/v1/${table}?select=${encodeURIComponent(select)}`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Range: `${from}-${from + 999}` } });
    if (!res.ok) throw new Error(`${table}: HTTP ${res.status} ${(await res.text()).slice(0, 200)}`);
    const page = await res.json();
    out.push(...page);
    if (page.length < 1000) return out;
  }
}
const num = (x) => Number(x);
let drift = 0;
const bad = (m) => { drift++; console.error(`  ✗ ${m}`); };
const ok = (m) => console.log(`  ✓ ${m}`);

const products = await rows("products", "id,slug,name,category_slug,price");
const variants = await rows("product_variants", "id,product_id,vial_size_mg,price,size_label,sort_order");
const tiers = await rows("price_tiers", "variant_id,min_quantity,unit_price,savings_pct");
const staticProducts = getAllProducts();

console.log(`Static ↔ DB shape (${staticProducts.length} static products; DB ${products.length} products / ${variants.length} variants / ${tiers.length} tiers)\n`);

// Products: same id set; slug == id; name matches; from-price = min variant price.
const dbById = new Map(products.map((p) => [p.id, p]));
for (const p of staticProducts) {
  const d = dbById.get(p.id);
  if (!d) { bad(`product ${p.id}: missing in DB`); continue; }
  if (d.slug !== p.id) bad(`product ${p.id}: slug ${d.slug}`);
  if (d.name !== p.name) bad(`product ${p.id}: name "${d.name}" ≠ static "${p.name}"`);
  if (num(d.price) !== num(p.fromPrice)) bad(`product ${p.id}: price ${d.price} ≠ static from-price ${p.fromPrice}`);
  if (d.category_slug !== p.category_slug) bad(`product ${p.id}: category ${d.category_slug} ≠ static ${p.category_slug}`);
}
for (const d of products) if (!staticProducts.some((p) => p.id === d.id)) bad(`product ${d.id}: in DB but not in the static catalog`);
if (!drift) ok(`${staticProducts.length} products match by id, slug, name and from-price`);

// Variants: same id set (pid-<mg>mg), size, price, label, order.
const before = drift;
const dbVar = new Map(variants.map((v) => [v.id, v]));
let staticVariants = 0;
for (const p of staticProducts) {
  p.variants.forEach((v, i) => {
    staticVariants++;
    const id = v.id;
    const d = dbVar.get(id);
    if (!d) { bad(`variant ${id}: missing in DB`); return; }
    if (d.product_id !== p.id) bad(`variant ${id}: product_id ${d.product_id}`);
    if (num(d.vial_size_mg) !== num(v.vial_size_mg)) bad(`variant ${id}: size ${d.vial_size_mg} ≠ ${v.vial_size_mg}`);
    if (num(d.price) !== num(v.price)) bad(`variant ${id}: price ${d.price} ≠ static ${v.price}`);
    if (d.size_label !== v.size_label) bad(`variant ${id}: label "${d.size_label}" ≠ "${v.size_label}"`);
    if (num(d.sort_order) !== i) bad(`variant ${id}: sort_order ${d.sort_order} ≠ ${i}`);
  });
}
const staticVariantIds = new Set(staticProducts.flatMap((p) => p.variants.map((v) => v.id)));
for (const d of variants) if (!staticVariantIds.has(d.id)) bad(`variant ${d.id}: in DB but not in the static catalog`);
if (drift === before) ok(`${staticVariants} variants match by id, product, size, price, label and order`);

// Price tiers: per variant, the ladder tiersForPrice() derives.
const before2 = drift;
const byVariant = new Map();
for (const t of tiers) { if (!byVariant.has(t.variant_id)) byVariant.set(t.variant_id, []); byVariant.get(t.variant_id).push(t); }
let staticTiers = 0;
for (const p of staticProducts) for (const v of p.variants) {
  const id = v.id;
  const want = (v.tiers || []).slice().sort((a, b) => a.min_quantity - b.min_quantity);
  const got = (byVariant.get(id) || []).slice().sort((a, b) => a.min_quantity - b.min_quantity);
  staticTiers += want.length;
  if (got.length !== want.length) { bad(`tiers ${id}: ${got.length} rows ≠ ${want.length} derived`); continue; }
  want.forEach((w, i) => {
    const g = got[i];
    if (num(g.min_quantity) !== num(w.min_quantity) || num(g.unit_price) !== num(w.unit_price) || num(g.savings_pct) !== num(w.savings_pct)) bad(`tiers ${id} @${w.min_quantity}: DB ${g.min_quantity}/${g.unit_price}/${g.savings_pct} ≠ derived ${w.min_quantity}/${w.unit_price}/${w.savings_pct}`);
  });
}
for (const t of tiers) if (!staticVariantIds.has(t.variant_id)) bad(`tier for ${t.variant_id} @${t.min_quantity}: variant not in the static catalog`);
if (drift === before2) ok(`${staticTiers} price tiers match the derived ladder per variant`);

if (drift) { console.error(`\n${drift} shape difference(s) between the static catalog and the database.`); process.exit(1); }
console.log("\nStatic catalog and database rows are in sync.");
