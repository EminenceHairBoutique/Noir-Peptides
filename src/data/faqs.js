// src/data/faqs.js
// SINGLE SOURCE OF TRUTH for the FAQ Q&A pairs.
//
// Imported by BOTH the /faqs page component (src/pages/Faqs.jsx) and the
// build-time prerenderer (scripts/generate-static-seo.mjs), which uses it for
// the crawlable <main> body AND the FAQPage JSON-LD. One copy, no drift —
// the same pattern tier1Catalog.js uses to feed the SQL seed and the
// prerenderer.
//
// COMPLIANCE: this copy is claim-safe and load-bearing. Several answers are
// explicit NEGATIVE compliance statements (no dosing, not for human use, not
// drugs/supplements). Do not soften, trim, or "improve" them.

// Rendered in the page across a <br />; flattened for the prerendered <h1>
// and for the document outline. Both forms come from the same source.
export const FAQ_HEADING_LINES = ["FREQUENTLY ASKED", "QUESTIONS"];
export const FAQ_HEADING = FAQ_HEADING_LINES.join(" ");

export const FAQ_INTRO =
  "Answers to common questions about Noir Peptides, research-use restrictions, batch documentation, storage, shipping, and purchaser responsibilities.";

export const FAQS = [
  {
    q: "What are research peptides?",
    a: "Research peptides are peptide reference materials supplied for controlled laboratory research. Noir Peptides products are not sold for human consumption, veterinary use, diagnostic use, therapeutic use, or any in vivo application.",
  },
  {
    q: "Are Noir Peptides products for human use?",
    a: "No. All Noir Peptides products are sold exclusively for laboratory research use by qualified purchasers. They are not intended for human consumption, veterinary use, diagnostic use, therapeutic use, or clinical use.",
  },
  {
    q: "Are these products drugs or dietary supplements?",
    a: "No. Noir Peptides products are not drugs, dietary supplements, cosmetics, medical devices, or approved pharmaceutical products. They are research materials only.",
  },
  {
    q: "Can Noir Peptides provide dosing, administration, or reconstitution instructions?",
    a: "No. Noir Peptides does not provide dosing, administration, injection, ingestion, topical-use, reconstitution-ratio, cycle, stacking, or human/veterinary-use guidance. Purchasers are responsible for following their institution's laboratory procedures and applicable regulations.",
  },
  {
    q: "What is a Certificate of Analysis?",
    a: "A Certificate of Analysis, or COA, is a document that may provide batch-specific analytical information such as product identity, purity, and testing details. A COA is provided for research documentation only and does not indicate approval for human or veterinary use.",
  },
  {
    q: "How should products be stored?",
    a: "Storage requirements vary by product and batch. Product pages may list storage information such as “store frozen,” “protect from light,” or other handling notes. Purchasers are responsible for reviewing product-specific storage information and following appropriate laboratory handling procedures.",
  },
  {
    q: "Who may purchase from Noir Peptides?",
    a: "Purchasers must be qualified to acquire and handle laboratory research materials. By placing an order, the purchaser confirms that products will be used only for lawful laboratory research and not for human or veterinary use.",
  },
  {
    q: "Do you ship cold-chain?",
    a: "Some products may be shipped with insulated packaging or cold packs when appropriate. Packaging is designed to support product integrity during normal transit but does not guarantee a specific temperature upon delivery.",
  },
  {
    q: "Do you offer bulk or wholesale orders?",
    a: "Qualified purchasers may contact Noir Peptides for research supply inquiries, bulk availability, or batch documentation requests.",
  },
  {
    q: "Can I return research materials?",
    a: "Due to chain-of-custody, product-integrity, and temperature-sensitivity concerns, all sales are final once shipped. Please review our Shipping & Refunds Policy for details.",
  },
];
