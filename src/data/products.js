// src/data/products.js
// Noir Peptides — Research-Grade Peptide Reference Material Catalog
// ──────────────────────────────────────────────────────────────────────
//
// COMPLIANCE: All copy in this file is written for lawful laboratory
// research-use positioning only. No human-use, dosing, route-of-
// administration, therapeutic, or disease-treatment language is permitted
// here. Product copy describes materials and analytical documentation only.
//
// Product Schema:
//   id, slug, name, subtitle, category_slug, price, compare_at_price,
//   image_url, gallery, images, vial_size_mg, purity_percent,
//   peptide_sequence, molecular_weight, form, storage_temp, cas_number,
//   batch_number, coa_url, research_use_only, stock_status,
//   short_description, description, specs, featured, isNew
// ═══════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════
// RESEARCH CATEGORIES
// ═══════════════════════════════════════════════════════════════════════
export const categories = [
  {
    slug: "tissue-research",
    name: "Tissue Research",
    label: "Tissue Research",
    description:
      "Peptide reference materials used in controlled laboratory research related to tissue-model pathways.",
  },
  {
    slug: "gh-axis-research",
    name: "GH-Axis Research",
    label: "GH-Axis Research",
    description:
      "Research materials studied in relation to growth-hormone-axis signaling models.",
  },
  {
    slug: "neurochemical-research",
    name: "Neurochemical Research",
    label: "Neurochemical Research",
    description:
      "Peptide materials used in laboratory models related to neurochemical signaling.",
  },
  {
    slug: "metabolic-pathway-research",
    name: "Metabolic Pathway Research",
    label: "Metabolic Pathway Research",
    description:
      "Research compounds studied in controlled models of metabolic signaling.",
  },
  {
    slug: "cellular-aging-research",
    name: "Cellular Aging Research",
    label: "Cellular Aging Research",
    description:
      "Materials used in laboratory models involving cellular maintenance and aging-related pathways.",
  },
  {
    slug: "receptor-signaling-research",
    name: "Receptor Signaling Research",
    label: "Receptor Signaling Research",
    description:
      "Reference materials studied in controlled laboratory models involving receptor signaling.",
  },
  {
    slug: "reference-materials",
    name: "Reference Materials",
    label: "Reference Materials",
    description:
      "Batch-documented peptide materials for qualified research use.",
  },
];

// Safe research-only description template.
const desc = (name) =>
  `${name} is a lyophilized peptide reference material supplied for in vitro ` +
  `laboratory research. Each batch is documented with available analytical ` +
  `information, including purity, molecular weight, storage requirements, and ` +
  `batch-specific documentation where available.`;

// ═══════════════════════════════════════════════════════════════════════
// PRODUCT CATALOG
// ═══════════════════════════════════════════════════════════════════════
export const products = [
  {
    id: "np-bpc157-5mg",
    slug: "bpc-157-5mg",
    name: "BPC-157 5mg",
    subtitle: "Tissue-model research peptide",
    category_slug: "tissue-research",
    price: 49,
    compare_at_price: null,
    vial_size_mg: 5,
    purity_percent: 99.0,
    peptide_sequence: "GEPPPGKPADDAGLV",
    molecular_weight: "1419.53 g/mol",
    form: "Lyophilized powder",
    storage_temp: "-20°C",
    cas_number: "137525-51-0",
    batch_number: "NP-B157-0260",
    coa_url: null,
    research_use_only: true,
    stock_status: "in_stock",
    images: [],
    short_description:
      "Lyophilized pentadecapeptide reference material for in vitro tissue-model research.",
    description: desc("BPC-157 5mg"),
    featured: true,
    isNew: true,
  },
  {
    id: "np-tb500-5mg",
    slug: "tb-500-5mg",
    name: "TB-500 5mg",
    subtitle: "Thymosin β4 fragment — tissue-model research",
    category_slug: "tissue-research",
    price: 54,
    vial_size_mg: 5,
    purity_percent: 98.5,
    peptide_sequence: "Ac-SDKPDMAEIEKFDKSKLKKTETQ (Tβ4 1–24)",
    molecular_weight: "4963.49 g/mol (Tβ4)",
    form: "Lyophilized powder",
    storage_temp: "-20°C",
    cas_number: "77591-33-4",
    batch_number: "NP-TB5-0260",
    coa_url: null,
    research_use_only: true,
    stock_status: "in_stock",
    images: [],
    short_description:
      "Lyophilized Thymosin β4-derived reference material for in vitro tissue-pathway research.",
    description: desc("TB-500 5mg"),
    featured: true,
    isNew: true,
  },
  {
    id: "np-cjc1295-2mg",
    slug: "cjc-1295-2mg",
    name: "CJC-1295 2mg",
    subtitle: "GH-axis signaling research peptide",
    category_slug: "gh-axis-research",
    price: 39,
    vial_size_mg: 2,
    purity_percent: 98.0,
    peptide_sequence:
      "Tyr-D-Ala-Asp-Ala-Ile-Phe-Thr-Gln-Ser-Tyr-Arg-Lys-Val-Leu-Ala-Gln-Leu-Ser-Ala-Arg-Lys-Leu-Leu-Gln-Asp-Ile-Leu-Ser-Arg-NH2",
    molecular_weight: "3367.97 g/mol",
    form: "Lyophilized powder",
    storage_temp: "-20°C",
    cas_number: "863288-34-0",
    batch_number: "NP-CJC-0260",
    coa_url: null,
    research_use_only: true,
    stock_status: "in_stock",
    images: [],
    short_description:
      "Lyophilized GHRH-analog reference material for in vitro GH-axis signaling research.",
    description: desc("CJC-1295 2mg"),
    featured: true,
    isNew: true,
  },
  {
    id: "np-ipamorelin-5mg",
    slug: "ipamorelin-5mg",
    name: "Ipamorelin 5mg",
    subtitle: "GH-axis signaling research peptide",
    category_slug: "gh-axis-research",
    price: 44,
    vial_size_mg: 5,
    purity_percent: 99.0,
    peptide_sequence: "Aib-His-D-2-Nal-D-Phe-Lys-NH2",
    molecular_weight: "711.85 g/mol",
    form: "Lyophilized powder",
    storage_temp: "-20°C",
    cas_number: "170851-70-4",
    batch_number: "NP-IPA-0260",
    coa_url: null,
    research_use_only: true,
    stock_status: "in_stock",
    images: [],
    short_description:
      "Lyophilized pentapeptide reference material for in vitro GH-axis signaling research.",
    description: desc("Ipamorelin 5mg"),
    featured: false,
    isNew: false,
  },
  {
    id: "np-semax-5mg",
    slug: "semax-5mg",
    name: "Semax 5mg",
    subtitle: "Neurochemical signaling research peptide",
    category_slug: "neurochemical-research",
    price: 47,
    vial_size_mg: 5,
    purity_percent: 99.0,
    peptide_sequence: "MEHFPGP",
    molecular_weight: "813.92 g/mol",
    form: "Lyophilized powder",
    storage_temp: "-20°C",
    cas_number: "80714-61-0",
    batch_number: "NP-SMX-0260",
    coa_url: null,
    research_use_only: true,
    stock_status: "in_stock",
    images: [],
    short_description:
      "Lyophilized heptapeptide reference material for in vitro neurochemical-signaling research.",
    description: desc("Semax 5mg"),
    featured: false,
    isNew: true,
  },
  {
    id: "np-selank-5mg",
    slug: "selank-5mg",
    name: "Selank 5mg",
    subtitle: "Neurochemical signaling research peptide",
    category_slug: "neurochemical-research",
    price: 47,
    vial_size_mg: 5,
    purity_percent: 98.5,
    peptide_sequence: "TKPRPGP",
    molecular_weight: "751.91 g/mol",
    form: "Lyophilized powder",
    storage_temp: "-20°C",
    cas_number: "129954-34-3",
    batch_number: "NP-SEL-0260",
    coa_url: null,
    research_use_only: true,
    stock_status: "low_stock",
    images: [],
    short_description:
      "Lyophilized heptapeptide reference material for in vitro neurochemical-signaling research.",
    description: desc("Selank 5mg"),
    featured: false,
    isNew: false,
  },
  {
    id: "np-nad-500mg",
    slug: "nad-500mg",
    name: "NAD+ 500mg",
    subtitle: "Coenzyme — metabolic pathway research",
    category_slug: "metabolic-pathway-research",
    price: 64,
    vial_size_mg: 500,
    purity_percent: 99.0,
    peptide_sequence: "N/A (dinucleotide coenzyme)",
    molecular_weight: "663.43 g/mol",
    form: "Lyophilized powder",
    storage_temp: "-20°C",
    cas_number: "53-84-9",
    batch_number: "NP-NAD-0260",
    coa_url: null,
    research_use_only: true,
    stock_status: "in_stock",
    images: [],
    short_description:
      "Lyophilized coenzyme reference material for in vitro metabolic-pathway research.",
    description: desc("NAD+ 500mg"),
    featured: true,
    isNew: false,
  },
  {
    id: "np-motsc-10mg",
    slug: "mots-c-10mg",
    name: "MOTS-c 10mg",
    subtitle: "Mitochondrial-derived peptide — metabolic pathway research",
    category_slug: "metabolic-pathway-research",
    price: 58,
    vial_size_mg: 10,
    purity_percent: 98.5,
    peptide_sequence: "MRWQEMGYIFYPRKLR",
    molecular_weight: "2174.62 g/mol",
    form: "Lyophilized powder",
    storage_temp: "-20°C",
    cas_number: "1627580-64-6",
    batch_number: "NP-MTS-0260",
    coa_url: null,
    research_use_only: true,
    stock_status: "in_stock",
    images: [],
    short_description:
      "Lyophilized mitochondrial-derived peptide reference material for in vitro metabolic-pathway research.",
    description: desc("MOTS-c 10mg"),
    featured: false,
    isNew: true,
  },
  {
    id: "np-ghkcu-50mg",
    slug: "ghk-cu-50mg",
    name: "GHK-Cu 50mg",
    subtitle: "Copper tripeptide — cellular-maintenance research",
    category_slug: "cellular-aging-research",
    price: 42,
    vial_size_mg: 50,
    purity_percent: 99.0,
    peptide_sequence: "GHK · Cu(II)",
    molecular_weight: "403.93 g/mol",
    form: "Lyophilized powder",
    storage_temp: "-20°C",
    cas_number: "89030-95-5",
    batch_number: "NP-GHK-0260",
    coa_url: null,
    research_use_only: true,
    stock_status: "in_stock",
    images: [],
    short_description:
      "Lyophilized copper-tripeptide reference material for in vitro cellular-maintenance research.",
    description: desc("GHK-Cu 50mg"),
    featured: true,
    isNew: false,
  },
  {
    id: "np-epithalon-10mg",
    slug: "epithalon-10mg",
    name: "Epithalon 10mg",
    subtitle: "Tetrapeptide — cellular aging research",
    category_slug: "cellular-aging-research",
    price: 46,
    vial_size_mg: 10,
    purity_percent: 99.0,
    peptide_sequence: "AEDG",
    molecular_weight: "390.35 g/mol",
    form: "Lyophilized powder",
    storage_temp: "-20°C",
    cas_number: "307297-39-8",
    batch_number: "NP-EPI-0260",
    coa_url: null,
    research_use_only: true,
    stock_status: "in_stock",
    images: [],
    short_description:
      "Lyophilized tetrapeptide reference material for in vitro cellular-aging research.",
    description: desc("Epithalon 10mg"),
    featured: false,
    isNew: false,
  },
  {
    id: "np-kisspeptin10-5mg",
    slug: "kisspeptin-10-5mg",
    name: "Kisspeptin-10 5mg",
    subtitle: "Receptor-ligand research peptide",
    category_slug: "receptor-signaling-research",
    price: 52,
    vial_size_mg: 5,
    purity_percent: 98.0,
    peptide_sequence: "YNWNSFGLRF-NH2",
    molecular_weight: "1302.49 g/mol",
    form: "Lyophilized powder",
    storage_temp: "-20°C",
    cas_number: "374675-21-5",
    batch_number: "NP-KP10-0260",
    coa_url: null,
    research_use_only: true,
    stock_status: "in_stock",
    images: [],
    short_description:
      "Lyophilized decapeptide reference material for in vitro receptor-signaling research.",
    description: desc("Kisspeptin-10 5mg"),
    featured: false,
    isNew: true,
  },
  {
    id: "np-thymosin-a1-5mg",
    slug: "thymosin-alpha-1-5mg",
    name: "Thymosin Alpha-1 5mg",
    subtitle: "Batch-documented reference peptide",
    category_slug: "reference-materials",
    price: 56,
    vial_size_mg: 5,
    purity_percent: 98.0,
    peptide_sequence: "Ac-SDAAVDTSSEITTKDLKEKKEVVEEAEN",
    molecular_weight: "3108.30 g/mol",
    form: "Lyophilized powder",
    storage_temp: "-20°C",
    cas_number: "62304-98-7",
    batch_number: "NP-TA1-0260",
    coa_url: null,
    research_use_only: true,
    stock_status: "in_stock",
    images: [],
    short_description:
      "Lyophilized 28-residue peptide supplied as a batch-documented reference material.",
    description: desc("Thymosin Alpha-1 5mg"),
    featured: false,
    isNew: false,
  },
  {
    id: "np-glutathione-600mg",
    slug: "glutathione-600mg",
    name: "Glutathione 600mg",
    subtitle: "Tripeptide — batch-documented reference material",
    category_slug: "reference-materials",
    price: 38,
    vial_size_mg: 600,
    purity_percent: 99.0,
    peptide_sequence: "γ-ECG (γ-Glu-Cys-Gly)",
    molecular_weight: "307.32 g/mol",
    form: "Lyophilized powder",
    storage_temp: "-20°C",
    cas_number: "70-18-8",
    batch_number: "NP-GSH-0260",
    coa_url: null,
    research_use_only: true,
    stock_status: "in_stock",
    images: [],
    short_description:
      "Lyophilized tripeptide supplied as a batch-documented reference material.",
    description: desc("Glutathione 600mg"),
    featured: false,
    isNew: false,
  },
];

// ═══════════════════════════════════════════════════════════════════════
// PENDING COMPLIANCE REVIEW — NOT MERGED INTO `products`
// ───────────────────────────────────────────────────────────────────────
// GLP-1 analogs (Semaglutide, Tirzepatide, Retatrutide, Cagrilintide,
// Mazdutide, and similar) are intentionally NOT seeded. They require an
// explicit regulatory + payment-processing plan confirmed by the business
// owner and legal review before being enabled. Keep disabled until then.
export const PENDING_COMPLIANCE_REVIEW = [];

// Collections are not used in the research catalog model. Kept as an empty
// export for backward-compatible imports only.
export const collections = [];

// ═══════════════════════════════════════════════════════════════════════
// HELPER EXPORTS
// ═══════════════════════════════════════════════════════════════════════
export const getProductBySlug = (slug) =>
  products.find((p) => p.slug === slug || p.id === slug);

export const getProductsByCategory = (categorySlug) =>
  products.filter((p) => p.category_slug === categorySlug);

export const getAvailableProducts = () =>
  products.filter((p) => p.stock_status !== "out_of_stock");

export const getFeaturedProducts = () =>
  products.filter((p) => p.featured && p.stock_status !== "out_of_stock");

export const getNewArrivals = () =>
  products.filter((p) => p.isNew && p.stock_status !== "out_of_stock");

// Back-compat shims (collections/drops removed in research model)
export const getLimitedProducts = () => getFeaturedProducts();
export const getProductsByCollection = () => [];
export const getProductsByDrop = () => [];
