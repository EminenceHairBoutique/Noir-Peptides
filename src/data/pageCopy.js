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
