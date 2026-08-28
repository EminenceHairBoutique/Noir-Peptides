// src/data/research.js
// PUBLIC, indexable education / research-reference content. This is the ONLY
// SEO surface compatible with the auth wall: no prices, no buy buttons, no
// gated catalog data — purely educational articles that funnel to registration.
//
// COMPLIANCE: claim-safe. No human-use, dosing, administration, therapeutic, or
// disease-treatment language. Topics describe analytical methods and how
// materials are studied in the laboratory, framed as "the literature describes."

export const researchArticles = [
  {
    slug: "understanding-certificates-of-analysis",
    title: "Understanding a Certificate of Analysis (COA)",
    summary:
      "What a Certificate of Analysis documents for a research material, and how to read purity, identity, and batch information.",
    readingTime: "5 min",
    sections: [
      {
        heading: "What a COA is",
        body: "A Certificate of Analysis (COA) is a batch-specific document that reports the analytical testing performed on a research material as supplied. It is a transparency record — it describes what was measured, not how a material may be used. For laboratory research use only; not for human or veterinary use.",
      },
      {
        heading: "Identity and purity",
        body: "Identity confirms that the material is the compound named on the label, typically via mass spectrometry (observed mass compared to the theoretical mass). Purity is most often reported as an HPLC area percentage — the proportion of the chromatographic signal attributable to the main peak. A higher purity percentage indicates fewer detected impurities in that analysis.",
      },
      {
        heading: "Batch and storage metadata",
        body: "A COA ties results to a specific batch or lot number so findings are reconstructable. It also records the physical form (for example, lyophilized powder) and the labeled storage condition. Handling and storage follow the researcher's institutional standard operating procedures.",
      },
    ],
    relatedCompounds: ["BPC-157", "TB-500", "Thymosin Alpha-1"],
  },
  {
    slug: "how-peptides-are-studied-in-the-laboratory",
    title: "How Peptides Are Studied in the Laboratory",
    summary:
      "An overview of in-vitro and preclinical research models used to study peptide reference materials.",
    readingTime: "6 min",
    sections: [
      {
        heading: "In-vitro models",
        body: "Much early-stage peptide research is conducted in vitro — in cell cultures or biochemical assays outside a living organism. These models let researchers observe interactions with receptors, enzymes, or signaling pathways under controlled conditions. Results are descriptive of the model system, not of human outcomes.",
      },
      {
        heading: "Preclinical literature",
        body: "Beyond in-vitro work, the published preclinical literature includes animal studies. When summarizing such literature it is important to distinguish in-vitro from in-vivo (animal) work and to treat findings as what the literature reports, not as established human effects.",
      },
      {
        heading: "Reference materials and reproducibility",
        body: "Reproducible research depends on well-characterized reference materials: documented identity, purity, molecular weight, and batch traceability. That documentation is what allows one laboratory's findings to be compared against another's.",
      },
    ],
    relatedCompounds: ["CJC-1295", "Ipamorelin", "MOTS-c"],
  },
  {
    slug: "reading-hplc-purity-data",
    title: "Reading HPLC Purity Data",
    summary:
      "How high-performance liquid chromatography reports purity, and what an area percentage does and does not tell you.",
    readingTime: "4 min",
    sections: [
      {
        heading: "What HPLC measures",
        body: "High-performance liquid chromatography (HPLC) separates the components of a sample as they pass through a column, producing a chromatogram of peaks. The main peak corresponds to the target compound; smaller peaks correspond to detected impurities or related substances.",
      },
      {
        heading: "Area percentage",
        body: "Purity is commonly expressed as the area of the main peak divided by the total area of all peaks, as a percentage. A 99% area purity means the main peak accounts for 99% of the detected chromatographic signal under those conditions. It is a method-dependent figure, not an absolute statement about every possible impurity.",
      },
      {
        heading: "Pairing methods",
        body: "Because no single method sees everything, identity is usually confirmed by mass spectrometry alongside HPLC purity. Together they give a fuller analytical picture of a batch.",
      },
    ],
    relatedCompounds: ["Semax", "Selank", "Epithalon"],
  },
];

export const getResearchArticle = (slug) =>
  researchArticles.find((a) => a.slug === slug) || null;

// ════════════════════════════════════════════════════════════════════════
// DRAFTS — NOT PUBLISHED. Owner review required before publishing.
//
// These are deliberately kept in a SEPARATE export rather than flagged inside
// `researchArticles`. Six places consume `researchArticles` (the /research
// index, the article page and its "other articles" list, the Researcher
// Console, the IndexNow ping, and the static prerenderer); a boolean flag
// would have to be honored correctly in every one of them or a draft leaks
// into the sitemap. Keeping drafts out of that array makes leaking impossible
// — nothing renders, prerenders, sitemaps, or pings them.
//
// TO PUBLISH: after owner (and, per LAUNCH_CHECKLIST §0, attorney) review,
// move an entry into `researchArticles` above. It then picks up its route,
// prerendered body, Article JSON-LD, and sitemap entry automatically.
//
// COMPLIANCE: analytical-chemistry / laboratory-methodology only. No human or
// veterinary use, no dosing, administration, reconstitution ratios, or
// benefit/effect language. Both entries pass `npm run test:compliance`.
// ════════════════════════════════════════════════════════════════════════
export const researchDrafts = [
  {
    slug: "how-mass-spectrometry-confirms-identity",
    title: "How Mass Spectrometry Confirms Peptide Identity",
    summary:
      "What a mass spectrum measures, why observed mass is compared against theoretical mass, and what identity confirmation does and does not establish.",
    readingTime: "4 min",
    sections: [
      {
        heading: "What the instrument measures",
        body: "A mass spectrometer ionizes a sample and separates the resulting ions by their mass-to-charge ratio. The output is a spectrum of intensity against mass-to-charge, in which the peaks correspond to ionized species present in the sample. For a peptide, the species of interest is the intact molecule, often observed in several charge states.",
      },
      {
        heading: "Observed mass against theoretical mass",
        body: "A peptide's theoretical monoisotopic mass can be calculated from its amino-acid sequence. Identity confirmation compares the mass observed in the spectrum against that calculated value, within the mass accuracy of the instrument. Agreement within that tolerance is consistent with the material being the compound named on the label.",
      },
      {
        heading: "Charge states and isotope patterns",
        body: "Electrospray ionization commonly produces multiply charged ions, so one compound may appear at several mass-to-charge values. Each is deconvoluted back to the same neutral mass. The isotope pattern around a peak reflects the natural abundance of carbon-13 and other isotopes, and its spacing is itself diagnostic of the charge state.",
      },
      {
        heading: "What identity confirmation does not establish",
        body: "A mass match indicates that a species of the expected mass is present. It is not a purity measurement, and it does not distinguish between isomers or sequence variants of identical mass. That is why identity by mass spectrometry is reported alongside a separate purity figure, typically an HPLC area percentage, rather than in place of one.",
      },
    ],
    relatedCompounds: [],
  },
  {
    slug: "lyophilization-and-reference-materials",
    title: "Lyophilization and What It Means for a Reference Material",
    summary:
      "How freeze-drying works, why peptide reference materials are commonly supplied as a lyophilized powder, and what the physical form does and does not tell a laboratory.",
    readingTime: "4 min",
    sections: [
      {
        heading: "What lyophilization is",
        body: "Lyophilization, or freeze-drying, removes solvent from a frozen sample by sublimation under reduced pressure: the frozen solvent passes directly from solid to vapour without an intervening liquid phase. What remains is a dry cake or powder of the non-volatile components.",
      },
      {
        heading: "Why reference materials are supplied dry",
        body: "Removing water removes the medium in which most degradation chemistry occurs. A dry solid is also lighter and less sensitive to temperature excursions in transit than a solution, which is why analytical reference materials are frequently distributed in a lyophilized form.",
      },
      {
        heading: "What the physical form does not tell you",
        body: "Appearance is not an analytical result. A uniform cake does not establish identity, purity, or mass, and a collapsed or uneven cake is not by itself evidence of a defect. Those questions are answered by the batch's documented testing — identity by mass spectrometry and purity by chromatography — not by inspection.",
      },
      {
        heading: "Documentation is what makes a batch comparable",
        body: "The value of a reference material to a laboratory lies in its documentation: a batch or lot number, the analytical results recorded for that batch, and the labeled storage condition. That record is what allows measurements made in one laboratory to be compared against another's. Handling follows the receiving laboratory's own standard operating procedures.",
      },
    ],
    relatedCompounds: [],
  },
];
