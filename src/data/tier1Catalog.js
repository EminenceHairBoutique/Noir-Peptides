// src/data/tier1Catalog.js
// ════════════════════════════════════════════════════════════════════════
// SINGLE SOURCE OF TRUTH for the Tier 1 catalog DATA.
//
// Consumed by:
//   - scripts/gen-tier1-seed.mjs      → supabase/migrations/0009_tier1_catalog.sql
//   - scripts/generate-static-seo.mjs → per-product / per-category prerendered
//                                        HTML, Product JSON-LD, and sitemap.xml
//
// The Supabase tables (seeded from 0009) remain the RUNTIME source of truth;
// this module mirrors the same data so the build can enumerate every product
// for indexability WITHOUT a live DB connection. Re-run `node
// scripts/gen-tier1-seed.mjs` after editing so the SQL seed stays in lockstep.
//
// COMPLIANCE: claim-safe / RUO only. Descriptors are molecule-class / origin
// only — no human-use, dosing, route-of-administration, or therapeutic
// language. CAS / sequence / MW are intentionally absent here (verified
// per-COA on the live record; never fabricated at build time).
// ════════════════════════════════════════════════════════════════════════

// Bundle ladder: qty {1,2,3,5,10} at {0,5,10,15,22}% off the 1-vial price,
// whole-dollar rounded (e.g. BPC-157 10 mg -> 64/61/58/54/50).
export const TIER_LADDER = [
  { q: 1, mult: 1.0, pct: 0 },
  { q: 2, mult: 0.95, pct: 5 },
  { q: 3, mult: 0.9, pct: 10 },
  { q: 5, mult: 0.85, pct: 15 },
  { q: 10, mult: 0.78, pct: 22 },
];

// The standard research-use suffix appended to every product long-description.
// (Kept identical to the string the SQL seed writes.)
export const RUO_SUFFIX =
  "Supplied as a lyophilized reference material for in-vitro laboratory research. For research use only — not for human or veterinary use.";

// Neutral, claim-safe category + product descriptors (molecule class / origin
// only). `desc` is the category description; `blurb` is the product one-liner.
export const categories = [
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

// SKU + variant-id derivations (kept identical to the SQL seed so the static
// catalog and the DB rows share the same ids).
export const skuFor = (pid, mg) =>
  `${pid.replace(/[^a-z0-9]/gi, "").toUpperCase()}-${mg}`;
export const variantId = (pid, mg) => `${pid}-${mg}mg`;

// Build the price tiers for a single (product, variant) base price.
export function tiersForPrice(price) {
  return TIER_LADDER.map((t) => ({
    min_quantity: t.q,
    unit_price: Math.round(price * t.mult),
    savings_pct: t.pct,
    label: t.q === 1 ? "Single vial" : `${t.q} vials`,
  }));
}

// Flatten the catalog into a list of fully-resolved products. Each product
// carries its category, a `from` price (the cheapest variant), and its
// variants (with computed sku / variant-id / price tiers). `slug` === `id`.
export function getAllProducts() {
  const list = [];
  for (const c of categories) {
    for (const p of c.products) {
      const variants = p.variants.map(([size_label, mg, price], i) => ({
        id: variantId(p.id, mg),
        sku: skuFor(p.id, mg),
        size_label,
        vial_size_mg: mg,
        price,
        sort_order: i,
        stock_status: "in_stock",
        tiers: tiersForPrice(price),
      }));
      const fromPrice = Math.min(...p.variants.map((v) => v[2]));
      list.push({
        id: p.id,
        slug: p.id,
        name: p.name,
        blurb: p.blurb,
        description: `${p.blurb} ${RUO_SUFFIX}`,
        category_slug: c.slug,
        category_name: c.name,
        price: fromPrice,
        fromPrice,
        stock_status: "in_stock",
        variants,
      });
    }
  }
  return list;
}

// Categories with a resolved product count, for category index pages.
export function getCategories() {
  return categories.map((c) => ({
    slug: c.slug,
    name: c.name,
    description: c.desc,
    sort: c.sort,
    count: c.products.length,
  }));
}

export function getProductsInCategory(slug) {
  return getAllProducts().filter((p) => p.category_slug === slug);
}
