/*
  scripts/gen-tier1-seed.mjs
  Generates supabase/migrations/0009_tier1_catalog.sql from the Tier 1 catalog.

  Source of truth: noir-peptides-tier1-catalog-pricing-payments.md (37 products,
  66 dosage variants). Bundle ladder qty {1,2,3,5,10} at {0,5,10,15,22}% off the
  1-vial price, whole-dollar rounded (BPC-157 10mg -> 64/61/58/54/50).

  Claim-safe / RUO: descriptors are neutral, molecule-class/origin only — no
  human-use, dosing, or therapeutic language. CAS/sequence/MW are left NULL
  (verified per-COA; never fabricated).

  Run: node scripts/gen-tier1-seed.mjs
*/
import fs from "node:fs";
import path from "node:path";

const TIERS = [
  { q: 1, mult: 1.0, pct: 0 },
  { q: 2, mult: 0.95, pct: 5 },
  { q: 3, mult: 0.9, pct: 10 },
  { q: 5, mult: 0.85, pct: 15 },
  { q: 10, mult: 0.78, pct: 22 },
];

// Neutral, claim-safe one-line descriptors (molecule class / origin only).
const categories = [
  {
    slug: "tissue-repair-research",
    name: "Tissue & Repair Research",
    desc: "Peptide reference materials used in controlled in-vitro tissue-model research.",
    sort: 1,
    products: [
      { id: "bpc-157", name: "BPC-157", blurb: "A synthetic 15–amino-acid peptide based on a gastric protein sequence, used as a reference material in in-vitro tissue-model research.", variants: [["5 mg", 5, 44], ["10 mg", 10, 64]] },
      { id: "tb-500", name: "TB-500 (Thymosin β4)", blurb: "A synthetic fragment of the Thymosin β4 protein, supplied as a research reference material for in-vitro studies.", variants: [["5 mg", 5, 48], ["10 mg", 10, 72]] },
      { id: "bpc-157-tb-500", name: "BPC-157 + TB-500 Blend", blurb: "A co-formulated blend of two tissue-model research peptides, supplied as a lyophilized reference material.", variants: [["10 mg (5/5)", 10, 79], ["20 mg (10/10)", 20, 119]] },
      { id: "kpv", name: "KPV", blurb: "A tripeptide (Lys-Pro-Val) studied as a reference material in laboratory models.", variants: [["5 mg", 5, 42], ["10 mg", 10, 60]] },
      { id: "mgf", name: "MGF", blurb: "Mechano-growth-factor peptide, supplied as a research reference material.", variants: [["2 mg", 2, 48]] },
      { id: "ara-290", name: "ARA-290", blurb: "A synthetic 11–amino-acid peptide used as a reference material in in-vitro research.", variants: [["10 mg", 10, 85]] },
    ],
  },
  {
    slug: "copper-peptides",
    name: "Copper Peptides",
    desc: "Copper-complex peptide reference materials for in-vitro research.",
    sort: 2,
    products: [
      { id: "ghk-cu", name: "GHK-Cu", blurb: "A copper-binding tripeptide (Gly-His-Lys) complex, supplied as a research reference material.", variants: [["50 mg", 50, 52], ["100 mg", 100, 72]] },
      { id: "ahk-cu", name: "AHK-Cu", blurb: "A copper-binding tripeptide complex (Ala-His-Lys), supplied as a research reference material.", variants: [["20 mg", 20, 48], ["60 mg", 60, 90]] },
    ],
  },
  {
    slug: "mitochondrial-metabolic-research",
    name: "Mitochondrial & Metabolic Research",
    desc: "Reference materials used in controlled in-vitro mitochondrial and metabolic-pathway research.",
    sort: 3,
    products: [
      { id: "epitalon", name: "Epitalon", blurb: "A synthetic tetrapeptide (Ala-Glu-Asp-Gly), supplied as a research reference material.", variants: [["10 mg", 10, 50], ["50 mg", 50, 130]] },
      { id: "mots-c", name: "MOTS-c", blurb: "A mitochondrial-derived peptide, supplied as a reference material for in-vitro research.", variants: [["10 mg", 10, 58], ["20 mg", 20, 98], ["40 mg", 40, 170]] },
      { id: "ss-31", name: "SS-31", blurb: "A synthetic tetrapeptide (also called elamipretide) used as a reference material in in-vitro research.", variants: [["10 mg", 10, 90], ["50 mg", 50, 190]] },
      { id: "nad-plus", name: "NAD+", blurb: "Nicotinamide adenine dinucleotide, a dinucleotide coenzyme supplied as a research reference material.", variants: [["500 mg", 500, 90], ["1000 mg", 1000, 150]] },
      { id: "5-amino-1mq", name: "5-Amino-1MQ", blurb: "A small-molecule research compound supplied as a reference material for in-vitro studies.", variants: [["5 mg", 5, 55], ["10 mg", 10, 85], ["50 mg", 50, 190]] },
      { id: "aod-9604", name: "AOD-9604", blurb: "A synthetic peptide fragment supplied as a research reference material.", variants: [["5 mg", 5, 42], ["10 mg", 10, 60]] },
      { id: "glutathione", name: "Glutathione", blurb: "A tripeptide (γ-Glu-Cys-Gly) supplied as a batch-documented research reference material.", variants: [["600 mg", 600, 48], ["1200 mg", 1200, 88]] },
    ],
  },
  {
    slug: "neuropeptide-research",
    name: "Neuropeptide Research",
    desc: "Neuropeptide reference materials used in controlled in-vitro research.",
    sort: 4,
    products: [
      { id: "semax", name: "Semax", blurb: "A synthetic heptapeptide supplied as a reference material for in-vitro neuropeptide research.", variants: [["5 mg", 5, 30], ["10 mg", 10, 46]] },
      { id: "selank", name: "Selank", blurb: "A synthetic heptapeptide supplied as a research reference material.", variants: [["5 mg", 5, 34], ["10 mg", 10, 50]] },
      { id: "selank-semax", name: "Selank + Semax Blend", blurb: "A co-formulated blend of two neuropeptide research materials.", variants: [["20 mg (10/10)", 20, 66]] },
      { id: "snap-8", name: "Snap-8", blurb: "A synthetic octapeptide supplied as a research reference material.", variants: [["10 mg", 10, 55]] },
      { id: "dsip", name: "DSIP", blurb: "Delta sleep-inducing peptide, a nonapeptide supplied as a research reference material.", variants: [["5 mg", 5, 40], ["10 mg", 10, 58]] },
      { id: "vip", name: "VIP", blurb: "Vasoactive intestinal peptide, supplied as a research reference material.", variants: [["5 mg", 5, 55], ["10 mg", 10, 85]] },
      { id: "p21", name: "P21", blurb: "A synthetic peptide supplied as a reference material for in-vitro research.", variants: [["5 mg", 5, 70]] },
    ],
  },
  {
    slug: "gh-secretagogue-research",
    name: "GH-Secretagogue Research",
    desc: "Growth-hormone-secretagogue reference materials used in controlled in-vitro signaling research.",
    sort: 5,
    products: [
      { id: "sermorelin", name: "Sermorelin", blurb: "A synthetic GHRH-analog peptide supplied as a research reference material.", variants: [["5 mg", 5, 48], ["10 mg", 10, 65]] },
      { id: "cjc-1295-no-dac", name: "CJC-1295 (no DAC)", blurb: "A synthetic GHRH-analog peptide (without DAC) supplied as a research reference material.", variants: [["5 mg", 5, 30], ["10 mg", 10, 48]] },
      { id: "cjc-1295-ipamorelin", name: "CJC-1295 + Ipamorelin Blend", blurb: "A co-formulated blend of two GH-secretagogue research peptides.", variants: [["10 mg (5/5)", 10, 66]] },
      { id: "ipamorelin", name: "Ipamorelin", blurb: "A synthetic pentapeptide supplied as a research reference material.", variants: [["5 mg", 5, 42], ["10 mg", 10, 58]] },
      { id: "ghrp-2", name: "GHRP-2", blurb: "A synthetic growth-hormone-releasing peptide supplied as a research reference material.", variants: [["5 mg", 5, 40], ["10 mg", 10, 58]] },
      { id: "ghrp-6", name: "GHRP-6", blurb: "A synthetic growth-hormone-releasing peptide supplied as a research reference material.", variants: [["5 mg", 5, 40], ["10 mg", 10, 58]] },
      { id: "hexarelin", name: "Hexarelin", blurb: "A synthetic hexapeptide supplied as a research reference material.", variants: [["2 mg", 2, 40], ["5 mg", 5, 58]] },
      { id: "tesamorelin", name: "Tesamorelin", blurb: "A synthetic GHRH-analog peptide supplied as a research reference material.", variants: [["5 mg", 5, 58], ["10 mg", 10, 80], ["20 mg", 20, 140]] },
      { id: "mk-677", name: "MK-677 (Ibutamoren)", blurb: "A non-peptide research compound supplied as a reference material for in-vitro studies.", variants: [["5 mg", 5, 50]] },
    ],
  },
  {
    slug: "immune-research",
    name: "Immune Research",
    desc: "Reference materials used in controlled in-vitro immunological research.",
    sort: 6,
    products: [
      { id: "thymosin-alpha-1", name: "Thymosin Alpha-1", blurb: "A synthetic 28–amino-acid peptide supplied as a batch-documented research reference material.", variants: [["5 mg", 5, 55], ["10 mg", 10, 90]] },
      { id: "thymalin", name: "Thymalin", blurb: "A thymic peptide preparation supplied as a research reference material.", variants: [["10 mg", 10, 60]] },
      { id: "ll-37", name: "LL-37", blurb: "A cathelicidin-derived peptide supplied as a research reference material.", variants: [["10 mg", 10, 170]] },
      { id: "kisspeptin-10", name: "Kisspeptin-10", blurb: "A decapeptide supplied as a reference material for in-vitro receptor-ligand research.", variants: [["5 mg", 5, 45], ["10 mg", 10, 65]] },
    ],
  },
  {
    slug: "peptide-blends",
    name: "Multi-Peptide Blends",
    desc: "Co-formulated multi-peptide reference materials for in-vitro research.",
    sort: 7,
    products: [
      { id: "glow", name: "GLOW Blend", blurb: "A co-formulated blend of GHK-Cu, BPC-157, and TB-500 research peptides.", variants: [["70 mg", 70, 105]] },
      { id: "klow", name: "KLOW Blend", blurb: "A co-formulated blend of GHK-Cu, BPC-157, TB-500, and KPV research peptides.", variants: [["80 mg", 80, 140]] },
    ],
  },
];

const q = (s) => (s === null || s === undefined ? "null" : `'${String(s).replace(/'/g, "''")}'`);
const skuFor = (pid, mg) => `${pid.replace(/[^a-z0-9]/gi, "").toUpperCase()}-${mg}`;
const variantId = (pid, mg) => `${pid}-${mg}mg`;

const out = [];
out.push(`-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — 0009: Tier 1 catalog (schema reconcile + seed)
-- GENERATED by scripts/gen-tier1-seed.mjs — do not hand-edit; re-run the script.
--
-- Idempotent / additive. Seeds 37 products / 66 dosage variants / 330 price
-- tiers to the REAL numeric-dollar columns. Bundle ladder qty {1,2,3,5,10} at
-- {0,5,10,15,22}% off the 1-vial price (whole-dollar rounded).
--
-- Claim-safe / RUO: neutral descriptors only; CAS/sequence/MW left NULL
-- (verified per-COA, never fabricated).
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. Schema reconcile (additive) ───────────────────────────────────────
-- price_tiers was keyed by product, which cannot price per-dosage ladders.
-- Add variant_id + savings_pct and re-key tiers per variant.
alter table public.product_variants add column if not exists size_label text;
alter table public.product_variants add column if not exists sort_order integer default 0;
alter table public.price_tiers add column if not exists variant_id text references public.product_variants (id) on delete cascade;
alter table public.price_tiers add column if not exists savings_pct integer;
alter table public.price_tiers drop constraint if exists price_tiers_product_id_min_quantity_key;
create unique index if not exists price_tiers_variant_qty_key on public.price_tiers (variant_id, min_quantity);
create index if not exists idx_price_tiers_variant on public.price_tiers (variant_id);
create index if not exists idx_variants_sort on public.product_variants (product_id, sort_order);

-- ── 2. Remove superseded placeholder products from 0001/0002 ──────────────
-- The original seed modeled each dosage as its own product (id like 'np-%').
-- The Tier 1 model is one product + dosage variants, so retire the old rows
-- (cascades to their variants/tiers; safe on a fresh DB with no orders).
delete from public.products where id like 'np-%';

-- ── 3. Categories (neutral, claim-safe) ──────────────────────────────────`);

out.push("insert into public.product_categories (slug, name, description, sort_order) values");
out.push(
  categories
    .map((c) => `  (${q(c.slug)}, ${q(c.name)}, ${q(c.desc)}, ${c.sort})`)
    .join(",\n") +
    "\non conflict (slug) do update set name = excluded.name, description = excluded.description, sort_order = excluded.sort_order;"
);
// Prune the superseded placeholder categories from 0001/0002 (no products
// reference them now) so the storefront shows exactly the Tier 1 set.
out.push(
  `delete from public.product_categories where slug not in (${categories
    .map((c) => q(c.slug))
    .join(", ")});`
);

// ── Products ──
out.push("\n-- ── 4. Products ──────────────────────────────────────────────────────────");
const productRows = [];
for (const c of categories) {
  for (const p of c.products) {
    const fromPrice = Math.min(...p.variants.map((v) => v[2]));
    const desc = `${p.blurb} Supplied as a lyophilized reference material for in-vitro laboratory research. For research use only — not for human or veterinary use.`;
    productRows.push(
      `  (${q(p.id)}, ${q(p.id)}, ${q(p.name)}, ${q(c.slug)}, ${fromPrice}, 99.0, ${q("-20°C")}, ${q("Lyophilized powder")}, true, ${q(p.blurb)}, ${q(desc)}, ${q("in_stock")}, ${c.sort <= 2 ? "true" : "false"}, true)`
    );
  }
}
out.push(
  "insert into public.products (id, slug, name, category_slug, price, purity_percent, storage_temp, form, research_use_only, short_description, description, stock_status, featured, is_new) values"
);
out.push(
  productRows.join(",\n") +
    `\non conflict (id) do update set
  name = excluded.name, category_slug = excluded.category_slug, price = excluded.price,
  purity_percent = excluded.purity_percent, storage_temp = excluded.storage_temp, form = excluded.form,
  research_use_only = true, short_description = excluded.short_description, description = excluded.description,
  stock_status = excluded.stock_status, featured = excluded.featured, updated_at = now();`
);

// ── Variants ──
out.push("\n-- ── 5. Dosage variants ───────────────────────────────────────────────────");
const variantRows = [];
const tierRows = [];
for (const c of categories) {
  for (const p of c.products) {
    p.variants.forEach((v, i) => {
      const [label, mg, price] = v;
      const vid = variantId(p.id, mg);
      variantRows.push(
        `  (${q(vid)}, ${q(p.id)}, ${q(skuFor(p.id, mg))}, ${mg}, ${price}, ${q(label)}, ${i}, ${q("in_stock")})`
      );
      for (const t of TIERS) {
        const unit = Math.round(price * t.mult);
        tierRows.push(
          `  (${q(p.id)}, ${q(vid)}, ${t.q}, ${unit}, ${t.pct}, ${q(t.q === 1 ? "Single vial" : `${t.q} vials`)})`
        );
      }
    });
  }
}
out.push(
  "insert into public.product_variants (id, product_id, sku, vial_size_mg, price, size_label, sort_order, stock_status) values"
);
out.push(
  variantRows.join(",\n") +
    `\non conflict (id) do update set
  product_id = excluded.product_id, sku = excluded.sku, vial_size_mg = excluded.vial_size_mg,
  price = excluded.price, size_label = excluded.size_label, sort_order = excluded.sort_order,
  stock_status = excluded.stock_status;`
);

// ── Price tiers ──
out.push("\n-- ── 6. Price tiers (per variant) ─────────────────────────────────────────");
out.push(
  "insert into public.price_tiers (product_id, variant_id, min_quantity, unit_price, savings_pct, label) values"
);
out.push(
  tierRows.join(",\n") +
    `\non conflict (variant_id, min_quantity) do update set
  unit_price = excluded.unit_price, savings_pct = excluded.savings_pct, label = excluded.label,
  product_id = excluded.product_id;`
);

out.push(
  `\n-- Summary: ${productRows.length} products, ${variantRows.length} variants, ${tierRows.length} price tiers.`
);

const sql = out.join("\n") + "\n";
const dest = path.join(process.cwd(), "supabase", "migrations", "0009_tier1_catalog.sql");
fs.writeFileSync(dest, sql);
console.log(
  `[seed] wrote ${dest}\n[seed] ${productRows.length} products, ${variantRows.length} variants, ${tierRows.length} tiers`
);
