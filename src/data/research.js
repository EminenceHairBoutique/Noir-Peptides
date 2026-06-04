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
