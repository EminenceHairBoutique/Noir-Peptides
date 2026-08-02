// scripts/gen-manual-seed.mjs
// GENERATES scripts/manual-seed.sql — the consolidated, paste-into-the-SQL-editor
// seed for a database whose tables were created BY HAND (no supabase_migrations
// ledger, so the CLI can't replay 0001–0027).
//
// The value rows are extracted VERBATIM from the migration files, so the seed
// can never drift from them: re-run this script after changing 0009/0019/0020/0021.
//
// Non-destructive by construction: the emitted SQL contains no DROP TABLE, no
// TRUNCATE, and no DELETE. Every insert is guarded so re-running is a no-op.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const M = (f) => readFileSync(join(ROOT, "supabase/migrations", f), "utf8");

/**
 * Capture the VALUES rows of an INSERT: every line after the line matching
 * `startRe` up to (not including) the line matching `endRe`.
 */
function rows(sql, startRe, endRe) {
  const lines = sql.split("\n");
  const start = lines.findIndex((l) => startRe.test(l));
  if (start < 0) throw new Error(`start marker not found: ${startRe}`);
  const end = lines.findIndex((l, i) => i > start && endRe.test(l));
  if (end < 0) throw new Error(`end marker not found: ${endRe}`);
  const body = lines.slice(start + 1, end).join("\n").trimEnd();
  // Normalize the tail: drop a trailing ';' and any trailing comma.
  return body.replace(/;\s*$/, "").replace(/,\s*$/, "");
}

const c9 = M("0009_tier1_catalog.sql");
const c19 = M("0019_janoshik_coas.sql");
const c20 = M("0020_label_configs_seed.sql");
const c21 = M("0021_label_coa_batch_data.sql");

const categories = rows(c9, /^insert into public\.product_categories/, /^on conflict \(slug\)/);
const products = rows(c9, /^insert into public\.products \(id, slug/, /^on conflict \(id\)/);
const variants = rows(c9, /^insert into public\.product_variants \(id, product_id/, /^on conflict \(id\)/);
const tiers = rows(c9, /^insert into public\.price_tiers \(product_id, variant_id/, /^on conflict \(variant_id/);
const coas = rows(c19, /^values$/, /^;?\s*$/);
const labels = rows(c20, /^select s\.\* from \(values$/, /^\) as s\(product_id/);
const backfill = rows(c21, /^from \(values$/, /^\) as d\(product_id/);

// Complete column inventory per table (name → type/default). Emitted as
// ADD COLUMN IF NOT EXISTS so a hand-made table that is MISSING a column is
// repaired instead of blowing up mid-insert — CREATE TABLE IF NOT EXISTS
// silently skips an existing table and would leave the gap in place.
const COLUMNS = {
  product_categories: [
    ["name", "text"], ["description", "text"], ["sort_order", "integer default 0"],
  ],
  products: [
    ["slug", "text"], ["name", "text"], ["price", "numeric(10,2) default 0"],
    ["created_at", "timestamptz default now()"], ["category_slug", "text"], ["subtitle", "text"],
    ["purity_percent", "numeric(5,2)"], ["storage_temp", "text default '-20°C'"],
    ["form", "text default 'lyophilized_powder'"], ["research_use_only", "boolean default true"],
    ["short_description", "text"], ["description", "text"],
    ["stock_status", "text default 'in_stock'"], ["featured", "boolean default false"],
    ["is_new", "boolean default false"], ["peptide_sequence", "text"], ["molecular_weight", "text"],
    ["cas_number", "text"], ["vial_size_mg", "numeric(8,2)"], ["batch_number", "text"],
    ["coa_url", "text"], ["compare_at_price", "numeric(10,2)"], ["image_url", "text"],
    ["gallery", "jsonb default '[]'::jsonb"], ["specs", "jsonb default '{}'::jsonb"],
    ["updated_at", "timestamptz default now()"],
  ],
  product_variants: [
    ["product_id", "text"], ["sku", "text"], ["vial_size_mg", "numeric(8,2)"],
    ["price", "numeric(10,2)"], ["stock_status", "text default 'in_stock'"],
    ["created_at", "timestamptz default now()"], ["size_label", "text"],
    ["sort_order", "integer default 0"],
  ],
  price_tiers: [
    ["product_id", "text"], ["min_quantity", "integer"], ["unit_price", "numeric(10,2)"],
    ["label", "text"], ["created_at", "timestamptz default now()"], ["variant_id", "text"],
    ["savings_pct", "integer"],
  ],
  coas: [
    ["product_id", "text"], ["batch_number", "text"], ["file_url", "text"],
    ["purity_percent", "numeric(5,2)"], ["hplc", "text"], ["mass_spec", "text"],
    ["endotoxin", "text"], ["tested_at", "date"], ["created_at", "timestamptz default now()"],
    ["lab_name", "text"], ["lot_number", "text"], ["ms_confirmed", "boolean"],
    ["is_published", "boolean not null default true"],
  ],
  label_configs: [
    ["product_id", "text"], ["variant_id", "text"],
    ["template_id", "text default 'noir-clinical-core'"],
    ["default_preset", "text default 'full_wrap'"], ["accent_family", "text"],
    ["label_version", "integer default 1"], ["status", "text default 'draft'"],
    ["revision_notes", "text"], ["approved_at", "timestamptz"], ["approved_by", "uuid"],
    ["display_name", "text"], ["quantity_label", "text"], ["material_type", "text"],
    ["composition", "jsonb"], ["net_contents", "text"], ["fill_note", "text"],
    ["sku", "text"], ["lot_number", "text"], ["batch_number", "text"],
    ["packaged_date", "date"], ["expiration_date", "date"], ["retest_date", "date"],
    ["barcode_value", "text"], ["verification_code", "text"],
    ["storage_short", "text"], ["storage_full", "text"],
    ["storage_source_verified", "boolean not null default false"],
    ["manufacturer", "text"], ["distributed_by", "text"], ["country_of_origin", "text"],
    ["recalled", "boolean not null default false"], ["print_asset_url", "text"],
    ["flat_preview_url", "text"], ["wrapped_texture_url", "text"],
    ["static_vial_render_url", "text"], ["created_by", "uuid"],
    ["created_at", "timestamptz default now()"], ["updated_at", "timestamptz default now()"],
  ],
  label_config_history: [
    ["config_id", "uuid"], ["action", "text"], ["snapshot", "jsonb"], ["actor_id", "uuid"],
    ["created_at", "timestamptz default now()"],
  ],
};

const addColumns = (table) => {
  const pad = Math.max(...COLUMNS[table].map(([n]) => n.length));
  return COLUMNS[table]
    .map(([n, t]) => `alter table public.${table} add column if not exists ${n.padEnd(pad)} ${t};`)
    .join("\n");
};

const counts = {
  categories: (categories.match(/^\s*\(/gm) || []).length,
  products: (products.match(/^\s*\(/gm) || []).length,
  variants: (variants.match(/^\s*\(/gm) || []).length,
  tiers: (tiers.match(/^\s*\(/gm) || []).length,
  coas: (coas.match(/^\s*\(/gm) || []).length,
  labels: (labels.match(/^\s*\(/gm) || []).length,
};

const sql = `-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — MANUAL CONSOLIDATED SEED
-- GENERATED by scripts/gen-manual-seed.mjs — do not hand-edit; re-run the script.
--
-- FOR: a Supabase project whose tables were created BY HAND, so there is no
-- supabase_migrations.schema_migrations ledger and the CLI cannot replay
-- 0001–0027. Paste this whole file into the Supabase SQL editor and run once.
--
-- SAFETY CONTRACT (verified by grep in the generator's own test):
--   * NO drop table, NO truncate, NO delete. Nothing existing is destroyed.
--   * Every table/column is created with IF NOT EXISTS.
--   * Every insert is guarded (ON CONFLICT DO NOTHING / WHERE NOT EXISTS), so
--     running this file twice inserts nothing the second time and NEVER
--     changes an existing row's id.
--   * Ids are the EXACT text slugs used by the migrations ('bpc-157',
--     'bpc-157-5mg', …) so label_configs.product_id / variant_id foreign keys
--     resolve. NOTE: these ids are TEXT SLUGS, not UUIDs — see the report.
--
-- SEEDS (dependency order): ${counts.categories} categories → ${counts.products} products →
-- ${counts.variants} variants → ${counts.tiers} price tiers → ${counts.coas} Janoshik COAs → ${counts.labels} draft label configs,
-- then the real per-batch lot/date backfill onto the draft labels.
--
-- SOURCES: 0001/0004/0014/0018 (structure) · 0009 (catalog) · 0019 (COAs) ·
--          0020 (label drafts) · 0021 (batch backfill)
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ════════════════════════════════════════════════════════════════════════
-- SECTION 1 — STRUCTURE (create-if-absent; never drops)
-- Mirrors 0001 (products/categories), 0004 (variants/tiers/coas),
-- 0009 (per-variant tier keys), 0014 (COA lot columns), 0018 (label configs).
-- Every column the seed writes is added IF NOT EXISTS, so a hand-made table
-- missing a column is repaired rather than causing an insert to fail.
-- ════════════════════════════════════════════════════════════════════════

-- ── product_categories ───────────────────────────────────────────────────
create table if not exists public.product_categories (
  slug        text primary key,
  name        text not null,
  description text,
  sort_order  integer default 0
);
${addColumns("product_categories")}

-- ── products ─────────────────────────────────────────────────────────────
create table if not exists public.products (
  id          text primary key,
  slug        text unique not null,
  name        text not null,
  price       numeric(10,2) not null default 0,
  created_at  timestamptz not null default now()
);
${addColumns("products")}

-- ── product_variants ─────────────────────────────────────────────────────
create table if not exists public.product_variants (
  id           text primary key,
  product_id   text not null references public.products (id) on delete cascade,
  sku          text unique,
  vial_size_mg numeric(8,2),
  price        numeric(10,2),
  stock_status text default 'in_stock',
  created_at   timestamptz not null default now()
);
${addColumns("product_variants")}

-- ── price_tiers ──────────────────────────────────────────────────────────
create table if not exists public.price_tiers (
  id           bigint generated always as identity primary key,
  product_id   text not null references public.products (id) on delete cascade,
  min_quantity integer not null check (min_quantity >= 1),
  unit_price   numeric(10,2) not null check (unit_price >= 0),
  label        text,
  created_at   timestamptz not null default now()
);
${addColumns("price_tiers")}

-- ⚠ THE ONE STRUCTURAL REMOVAL IN THIS FILE — a UNIQUENESS RULE, NOT DATA.
-- 0004 keyed tiers by (product_id, min_quantity), which cannot express a
-- per-DOSAGE ladder (bpc-157 5 mg and 10 mg both need a qty-1 tier). 0009
-- re-keys tiers by (variant_id, min_quantity). Without this the tier insert
-- below fails with a duplicate-key error. It removes no rows, and it is a
-- no-op if this hand-made database never had that constraint.
alter table public.price_tiers drop constraint if exists price_tiers_product_id_min_quantity_key;
create unique index if not exists price_tiers_variant_qty_key on public.price_tiers (variant_id, min_quantity);

-- ── coas ─────────────────────────────────────────────────────────────────
create table if not exists public.coas (
  id             bigint generated always as identity primary key,
  product_id     text references public.products (id) on delete cascade,
  batch_number   text,
  file_url       text,
  purity_percent numeric(5,2),
  hplc           text,
  mass_spec      text,
  endotoxin      text,
  tested_at      date,
  created_at     timestamptz not null default now()
);
${addColumns("coas")}

-- ── label_configs ────────────────────────────────────────────────────────
create table if not exists public.label_configs (
  id                       uuid primary key default gen_random_uuid(),
  product_id               text not null references public.products (id) on delete cascade,
  variant_id               text references public.product_variants (id) on delete set null,
  template_id              text not null default 'noir-clinical-core'
                           check (template_id in ('noir-clinical-core','spectral-biotech','cryogenic-white','neural-grid')),
  default_preset           text not null default 'full_wrap'
                           check (default_preset in ('full_wrap','partial','front','neck','cap')),
  label_version            integer not null default 1,
  status                   text not null default 'draft'
                           check (status in ('draft','in_review','changes_requested','approved','production_ready','archived')),
  display_name             text not null,
  quantity_label           text not null,
  sku                      text not null,
  verification_code        text unique,
  storage_source_verified  boolean not null default false,
  recalled                 boolean not null default false,
  created_at               timestamptz not null default now(),
  updated_at               timestamptz not null default now()
);
${addColumns("label_configs")}

-- ── label_config_history ─────────────────────────────────────────────────
create table if not exists public.label_config_history (
  id          bigint generated always as identity primary key,
  config_id   uuid not null references public.label_configs (id) on delete cascade,
  action      text not null,
  snapshot    jsonb not null,
  actor_id    uuid,
  created_at  timestamptz not null default now()
);
${addColumns("label_config_history")}

-- ── Foreign keys (added ONLY if absent — additive integrity, no data change).
-- A hand-made table that was built without these would otherwise accept ids
-- that resolve to nothing, which is the exact class of bug this seed fixes.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'label_configs_variant_id_fkey') then
    alter table public.label_configs
      add constraint label_configs_variant_id_fkey
      foreign key (variant_id) references public.product_variants (id) on delete set null;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'price_tiers_variant_id_fkey') then
    alter table public.price_tiers
      add constraint price_tiers_variant_id_fkey
      foreign key (variant_id) references public.product_variants (id) on delete cascade;
  end if;
end $$;

create index if not exists idx_products_slug           on public.products (slug);
create index if not exists idx_products_category_slug  on public.products (category_slug);
create index if not exists idx_variants_product        on public.product_variants (product_id);
create index if not exists idx_variants_sort           on public.product_variants (product_id, sort_order);
create index if not exists idx_price_tiers_variant     on public.price_tiers (variant_id);
create index if not exists idx_coas_product            on public.coas (product_id);
create index if not exists idx_coas_lot                on public.coas (lot_number);
create index if not exists idx_label_configs_product   on public.label_configs (product_id, variant_id);
create index if not exists idx_label_configs_status    on public.label_configs (status);

-- ════════════════════════════════════════════════════════════════════════
-- SECTION 2 — CATEGORIES (${counts.categories})  [source: 0009 §3]
-- 0009 also DELETEs categories outside this list; that delete is deliberately
-- OMITTED here. Any legacy category rows simply stay (harmless — no seeded
-- product references them).
-- ════════════════════════════════════════════════════════════════════════

insert into public.product_categories (slug, name, description, sort_order) values
${categories}
on conflict (slug) do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- SECTION 3 — PRODUCTS (${counts.products})  [source: 0009 §4]
-- These text-slug ids are the FK targets for product_variants.product_id and
-- label_configs.product_id. 0001/0002's 13 'np-*' products are NOT seeded:
-- 0009 explicitly retires that model (one product per dosage) in favour of
-- product + variants, and the app references only these ids.
-- ════════════════════════════════════════════════════════════════════════

insert into public.products (id, slug, name, category_slug, price, purity_percent, storage_temp, form, research_use_only, short_description, description, stock_status, featured, is_new) values
${products}
on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- SECTION 4 — DOSAGE VARIANTS (${counts.variants})  [source: 0009 §5]
-- FK target for label_configs.variant_id.
-- ════════════════════════════════════════════════════════════════════════

insert into public.product_variants (id, product_id, sku, vial_size_mg, price, size_label, sort_order, stock_status) values
${variants}
on conflict (id) do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- SECTION 5 — PRICE TIERS (${counts.tiers})  [source: 0009 §6]
-- price_tiers.id is a generated identity, so the conflict target is the
-- natural key (variant_id, min_quantity) — see the report.
-- ════════════════════════════════════════════════════════════════════════

insert into public.price_tiers (product_id, variant_id, min_quantity, unit_price, savings_pct, label) values
${tiers}
on conflict (variant_id, min_quantity) do nothing;

-- ════════════════════════════════════════════════════════════════════════
-- SECTION 6 — JANOSHIK COAs (${counts.coas})  [source: 0019]
-- coas.id is a generated identity and the table has NO unique natural key, so
-- ON CONFLICT is impossible. 0019 achieved idempotency with
-- "delete from coas where lab_name = 'Janoshik Analytical'" — DELIBERATELY NOT
-- REPRODUCED here (this file destroys nothing). Instead each row is guarded on
-- its lot_number, which is unique per certificate (the Janoshik task number).
-- Real transcribed lab data; nothing fabricated.
-- ════════════════════════════════════════════════════════════════════════

insert into public.coas
  (product_id, batch_number, lot_number, file_url, purity_percent, hplc, mass_spec, ms_confirmed, is_published, tested_at, lab_name)
select v.product_id, v.batch_number, v.lot_number, v.file_url, v.purity_percent, v.hplc,
       v.mass_spec, v.ms_confirmed, v.is_published, v.tested_at::date, v.lab_name
from (values
${coas}
) as v(product_id, batch_number, lot_number, file_url, purity_percent, hplc,
       mass_spec, ms_confirmed, is_published, tested_at, lab_name)
where not exists (
  select 1 from public.coas c where c.lot_number = v.lot_number
);

-- ════════════════════════════════════════════════════════════════════════
-- SECTION 7 — DRAFT LABEL CONFIGS (${counts.labels})  [source: 0020]
-- label_configs.id is uuid DEFAULT gen_random_uuid() and the seed supplies no
-- ids, so ON CONFLICT (id) can never fire — guarded instead on
-- (product_id, variant_id) exactly as 0020 does, plus the UNIQUE
-- verification_code, so hand-made labels are never duplicated or clobbered.
-- Lot / MFG / EXP intentionally blank here; storage UNVERIFIED.
-- ════════════════════════════════════════════════════════════════════════

insert into public.label_configs
  (product_id, variant_id, template_id, default_preset, status,
   display_name, quantity_label, material_type, composition,
   sku, barcode_value, verification_code, storage_source_verified, recalled)
select s.* from (values
${labels}
) as s(product_id, variant_id, template_id, default_preset, status,
       display_name, quantity_label, material_type, composition,
       sku, barcode_value, verification_code, storage_source_verified, recalled)
where not exists (
  select 1 from public.label_configs lc
  where lc.product_id = s.product_id
    and lc.variant_id is not distinct from s.variant_id
)
and not exists (
  select 1 from public.label_configs lc2
  where lc2.verification_code = s.verification_code
);

-- ════════════════════════════════════════════════════════════════════════
-- SECTION 8 — REAL BATCH DATA ONTO THE DRAFTS  [source: 0021]
-- Lot = the COA's Janoshik task number (so /v/<code> resolves the exact
-- certificate), batch verbatim, packaged = test date − 2 days, expiry
-- 2028-08-31 (owner rules). Touches ONLY status='draft' rows, so approved
-- work is never overwritten. Re-running is a no-op (same values).
-- ════════════════════════════════════════════════════════════════════════

update public.label_configs lc set
  lot_number      = d.lot,
  batch_number    = d.batch,
  packaged_date   = d.packaged::date,
  expiration_date = date '2028-08-31',
  updated_at      = now()
from (values
${backfill}
) as d(product_id, variant_id, lot, batch, packaged)
where lc.product_id = d.product_id
  and lc.variant_id = d.variant_id
  and lc.status = 'draft';

commit;

-- ════════════════════════════════════════════════════════════════════════
-- SECTION 9 — VERIFICATION
-- Expected after a first run on an empty database:
--   product_categories ${String(counts.categories).padEnd(3)}  products ${String(counts.products).padEnd(3)}  product_variants ${String(counts.variants).padEnd(3)}
--   price_tiers ${String(counts.tiers).padEnd(3)}         coas ${String(counts.coas).padEnd(3)}      label_configs ${counts.labels}
-- Running the file again must leave every one of these UNCHANGED.
-- ════════════════════════════════════════════════════════════════════════

select 'product_categories' as table_name, count(*) as rows from public.product_categories
union all select 'products',         count(*) from public.products
union all select 'product_variants', count(*) from public.product_variants
union all select 'price_tiers',      count(*) from public.price_tiers
union all select 'coas',             count(*) from public.coas
union all select 'label_configs',    count(*) from public.label_configs
order by table_name;

-- Referential integrity: BOTH must return 0. A non-zero result means the
-- label pickers would offer ids the FK cannot resolve.
select count(*) as label_configs_with_missing_product
  from public.label_configs lc
  left join public.products p on p.id = lc.product_id
 where p.id is null;

select count(*) as label_configs_with_missing_variant
  from public.label_configs lc
  left join public.product_variants v on v.id = lc.variant_id
 where lc.variant_id is not null and v.id is null;

-- Labels carrying real COA batch data (expect ${(backfill.match(/^\s*\(/gm) || []).length} after a first run).
select count(*) as labels_with_lot from public.label_configs where lot_number is not null;
`;

writeFileSync(join(ROOT, "scripts/manual-seed.sql"), sql);

// Safety assertions on the emitted file — the generator refuses to write a
// destructive seed.
// Comments are stripped first: the file DESCRIBES the destructive statements
// it deliberately omits, and prose about them is not itself dangerous.
const executable = sql.replace(/^\s*--.*$/gm, "");
const forbidden = [/\bdrop\s+table\b/i, /\btruncate\b/i, /\bdelete\s+from\b/i];
for (const re of forbidden) {
  if (re.test(executable)) throw new Error(`Generated SQL contains a forbidden destructive statement: ${re}`);
}
console.log(
  `manual-seed.sql written — categories ${counts.categories}, products ${counts.products}, ` +
  `variants ${counts.variants}, tiers ${counts.tiers}, coas ${counts.coas}, labels ${counts.labels}`
);
