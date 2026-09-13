// src/data/pageCopy.js
// SINGLE SOURCE OF TRUTH for the static, user-visible copy on the
// informational pages whose text previously lived only inside JSX.
//
// Imported by BOTH the page components and the build-time prerenderer
// (scripts/generate-static-seo.mjs), so the crawlable <main> body and the
// hydrated React page can never drift. Same pattern as tier1Catalog.js
// feeding the SQL seed and the prerenderer.
//
// COMPLIANCE (load-bearing — do not soften):
//  - No human-use, dosing, therapeutic, or benefit language may be added here.
//  - The ABOUT "Research-Only Integrity" pillar and the CONTACT no-guidance
//    paragraph are explicit negative compliance statements.
//  - Nothing here may be fabricated. Values that depend on owner-entered data
//    (phone, address, guarantee) live in src/config/business.js and are
//    null-by-default; they are deliberately NOT represented in this file and
//    are never prerendered.

// ── / (home hero) ─────────────────────────────────────────────────────────
// The hero posture sentence was duplicated as two literals (PublicLanding.jsx
// and the prerenderer) and had already drifted once in wording. One source now.
//
// "Purchasing requires…" not "Access requires…": the catalog, certificates and
// education pages are public and crawlable by design (migration 0013); only
// PURCHASE sits behind the account + attestation wall. The old sentence
// overstated the wall and contradicted the indexable storefront.
export const HOME_COPY = {
  intro: "A research-grade peptide reference catalog for qualified purchasers.",
  posture: "Purchasing requires an account and a completed research-use attestation.",
};

// ── /about ────────────────────────────────────────────────────────────────
export const ABOUT_COPY = {
  overline: "About",
  // Rendered in the page across a <br /> + <span>; flattened for the
  // prerendered <h1> and for the document outline.
  heading: "WE EXIST FOR RESEARCHERS.",
  headingLines: ["WE EXIST FOR", "RESEARCHERS."],
  intro:
    "Noir Peptides was built for researchers who need reliable, batch-documented peptide reference materials without the noise of consumer wellness marketing.",
  standardOverline: "Our Standard",
  standard:
    "Every Noir Peptides product page is designed around clarity: product identity, batch documentation, storage requirements, purity data, and research-use restrictions. We do not position our products as drugs, supplements, treatments, or wellness products.",
  // Icons stay in the component (they are presentational); only the text is
  // shared, so the prerenderer never needs to import lucide-react.
  pillars: [
    {
      title: "Purity",
      body: "Products are positioned around analytical transparency and batch-level documentation. Where available, Certificates of Analysis provide research-facing information such as identity, purity, and related analytical data.",
    },
    {
      title: "Traceability",
      body: "Batch numbers, storage conditions, product metadata, and available COA documentation are displayed clearly so qualified purchasers can review the material before ordering.",
    },
    {
      title: "Research-Only Integrity",
      body: "Noir Peptides does not provide human-use guidance, dosing information, administration instructions, treatment protocols, or therapeutic claims. Our products are supplied exclusively for laboratory research use.",
    },
  ],
  ctaHeading: "EXPLORE THE CATALOG",
  ctaLinks: [
    { href: "/shop", label: "Research Catalog" },
    { href: "/coa-policy", label: "COA Policy" },
  ],
};

// ── /contact ──────────────────────────────────────────────────────────────
// The contact FORM is interactive and is deliberately NOT represented here —
// it is never prerendered.
export const CONTACT_COPY = {
  heading: "CONTACT NOIR PEPTIDES",
  intro:
    "For order support, documentation requests, batch inquiries, or qualified research supply questions, contact our team.",
  noGuidance:
    "Before contacting us, please note: Noir Peptides does not provide dosing, administration, injection, ingestion, reconstitution-ratio, treatment, clinical, or human/veterinary-use guidance.",
  lists: [
    {
      heading: "For order issues, include:",
      items: [
        "Order number",
        "Email used at checkout",
        "Photos if reporting damage, missing items, or incorrect items",
        "Brief description of the issue",
      ],
    },
    {
      heading: "For COA requests, include:",
      items: ["Product name", "Batch number if available", "Order number if applicable"],
    },
  ],
};

// ── /partners (opt cycle 11, 4.14b) ───────────────────────────────────────
// Wholesale / institutional supply request. Logistics and eligibility copy
// only: what an account is, what to include, what we will not provide. The
// form posts to the existing POST /api/partners/apply; review is by hand in
// the Control Room. Never a product benefit, never a use case.
export const PARTNERS_COPY = {
  heading: "WHOLESALE & INSTITUTIONAL SUPPLY",
  intro:
    "Recurring reference-material supply for laboratories, contract research organisations, and academic groups. Volume pricing is quoted per account after review.",
  eligibility:
    "Applications are reviewed individually. An approved account certifies institutional research use, accepts the Research-Use Agreement, and completes the same purchaser attestation as every other account. Every shipment carries the same batch documentation as the retail catalog.",
  noGuidance:
    "Noir Peptides provides no dosing, administration, or usage guidance to any account, institutional accounts included.",
  lists: [
    {
      heading: "What to include:",
      items: [
        "Institution or business name and country",
        "Expected monthly volume",
        "Materials of interest",
        "Documentation needs (per-batch COA, SDS, custom labelling)",
      ],
    },
    {
      heading: "What happens next:",
      items: [
        "We review the application and reply by email",
        "Approved accounts receive their volume tier and ordering instructions",
        "Orders ship with the same batch documentation as every retail order",
      ],
    },
  ],
  formNote: "Reviewed by hand. We reply by email to qualified applicants.",
};

// ── /deals and /test-results ──────────────────────────────────────────────
// Both pages are DB-driven. ONLY the static explanatory shell is shared here.
// The prerenderer emits this shell plus navigation links and NEVER any row
// data — no synthetic offers, no synthetic COA rows, ever. Live rows render
// after hydration from Supabase.
export const DEALS_SHELL = {
  overline: "Deals",
  heading: "OFFERS & BUNDLE PRICING",
  intro:
    "Promotional codes and volume pricing for qualified researchers. All materials are supplied for laboratory research use only.",
  sectionHeading: "VOLUME BUNDLE PRICING",
};

export const TEST_RESULTS_SHELL = {
  overline: "Transparency",
  heading: "Test Results & Certificates of Analysis",
  intro:
    "Every batch is documented with third-party analytical testing — identity by mass spectrometry and purity by HPLC. Browse published certificates below, or verify the exact lot printed on your vial.",
};

// One source for the catalog page's intro: React (src/pages/Shop.jsx) and the
// prerendered shell (scripts/generate-static-seo.mjs) must render the same
// sentence — the shell paragraph is the page's largest first paint.
export const SHOP_COPY = {
  intro: "Batch-documented peptide reference materials for qualified laboratory research.",
};
