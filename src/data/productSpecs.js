// src/data/productSpecs.js   (opt cycle 11 — scorecard 4.4)
// Dry technical specifications per product: sequence, molecular weight, CAS.
// EVERY value here is a TRANSCRIPTION of the source named in `source`;
// nothing is derived or invented. The only source so far is the repository's
// own 0001 seed — self-authored, not confirmed against a supplier certificate
// or the CAS registry — so these are "transcribed", never "verified" (Owner
// Sprint D5b asks the owner to confirm them). A product with no entry renders no spec
// row (the panel omits what it does not know), and the Owner Sprint counts
// the gap. The first source is the retired 0001 seed (12 products) — values
// that carried annotations or a parent-protein reference were NOT copied
// (TB-500's trio, the CJC-1295 CAS, the three non-peptide "sequences") and
// are listed for the owner to verify in the cycle-11 log.
// Shape: { sequence?, molecularWeight?, cas?, source }. Editable per product
// in the Control Room (Catalog → Specs) once migration 0038 is applied.

export const PRODUCT_SPECS = {
  "bpc-157":          { sequence: "GEPPPGKPADDAGLV", molecularWeight: "1419.53 g/mol", cas: "137525-51-0", source: "0001 seed" },
  "cjc-1295-no-dac":  { sequence: "Tyr-D-Ala-Asp-Ala-Ile-Phe-Thr-Gln-Ser-Tyr-Arg-Lys-Val-Leu-Ala-Gln-Leu-Ser-Ala-Arg-Lys-Leu-Leu-Gln-Asp-Ile-Leu-Ser-Arg-NH2", molecularWeight: "3367.97 g/mol", source: "0001 seed (CAS not copied: ambiguous between DAC / no-DAC)" },
  "ipamorelin":       { sequence: "Aib-His-D-2-Nal-D-Phe-Lys-NH2", molecularWeight: "711.85 g/mol", cas: "170851-70-4", source: "0001 seed" },
  "semax":            { sequence: "MEHFPGP", molecularWeight: "813.92 g/mol", cas: "80714-61-0", source: "0001 seed" },
  "selank":           { sequence: "TKPRPGP", molecularWeight: "751.91 g/mol", cas: "129954-34-3", source: "0001 seed" },
  "nad-plus":         { molecularWeight: "663.43 g/mol", cas: "53-84-9", source: "0001 seed (not a peptide: no sequence)" },
  "mots-c":           { sequence: "MRWQEMGYIFYPRKLR", molecularWeight: "2174.62 g/mol", cas: "1627580-64-6", source: "0001 seed" },
  "ghk-cu":           { molecularWeight: "403.93 g/mol", cas: "89030-95-5", source: "0001 seed (copper complex: sequence not copied)" },
  "epitalon":         { sequence: "AEDG", molecularWeight: "390.35 g/mol", cas: "307297-39-8", source: "0001 seed" },
  "thymosin-alpha-1": { sequence: "Ac-SDAAVDTSSEITTKDLKEKKEVVEEAEN", molecularWeight: "3108.30 g/mol", cas: "62304-98-7", source: "0001 seed" },
  "glutathione":      { molecularWeight: "307.32 g/mol", cas: "70-18-8", source: "0001 seed (tripeptide written as γ-ECG in the source: sequence not copied)" },
};

/** Column values for a product id, or nulls. */
export function specColumnsFor(id) {
  const s = PRODUCT_SPECS[id] || {};
  return {
    peptide_sequence: s.sequence ?? null,
    molecular_weight: s.molecularWeight ?? null,
    cas_number: s.cas ?? null,
  };
}
