// src/lib/labels/masters/registry.js
// Template registry for the EXACT-fidelity label masters (owner-supplied ZIP
// packages, 2026-07-19). Each master SVG embeds the approved artwork as a
// lossless raster inside a locked MASTER_ARTWORK group — the engine NEVER
// redraws or alters it; product data is applied only as a deterministic
// VARIABLE_DATA overlay (see renderMasterLabel.js and
// docs/labels/master-packages/NOIR_LABEL_ENGINE_SPEC.md).
//
// Registry keys are the EXISTING DB template ids (label_configs.template_id
// CHECK constraint, migration 0018) — the package ids map onto them:
//   core-black → noir-clinical-core     spectral   → spectral-biotech
//   cryogenic  → cryogenic-white        neural-grid → neural-grid
//
// `fields` (the per-template field-layout map) exists ONLY for templates whose
// rollout is approved. Per FABLE_5_IMPLEMENTATION_PROMPT.md the Core Black
// prototype ships first and everything else STOPS for approval.

export const MASTERS_BASE_PATH = "/labels/masters";

export const TEMPLATE_MASTERS = {
  "noir-clinical-core": {
    masterId: "core-black",
    displayName: "Core Black",
    file: `${MASTERS_BASE_PATH}/core-black.svg`,
    // sha256 of the verbatim uploaded package file (immutability-tested).
    sha256: "978e1969e43a57a24287d03b1215b210f3b2ada83b8667b4509a12462faf0823",
    viewBox: [1198, 398],
    physical: { widthMm: 72 }, // heightMm derives from the master aspect
    // Field-layout map. Coordinates are master pixels (viewBox units),
    // measured from the approved artwork with a calibration grid.
    // patch: area erased with background sampled from / matched to the master
    // box:   bounding box replacement text must stay inside (overflow rejects)
    fields: {
      productName: {
        // Two approved baselines (the master's own two-line sample); a
        // one-line name uses the optical center between them.
        box: { x: 398, y: 128, w: 444, h: 116 },
        // Sample the clean center-panel band between the hexagon tip and the
        // name's cap line so the panel's own texture fills the patch.
        patch: { type: "sample", src: { x: 398, y: 127, w: 444, h: 12 } },
        cx: 620,
        baselines: { one: 200, two: [172, 218] },
        font: { size: 34, min: 22, weight: 700, color: "#f2f4f6", spacing: 0.5 },
      },
      quantity: {
        // Re-texture the strip's full interior from its clean right segment
        // (rounded end caps stay original) — seamless for every quantity.
        box: { x: 406, y: 245, w: 428, h: 48 },
        patch: { type: "sample", src: { x: 727, y: 246, w: 80, h: 46 } },
        cx: 620,
        baseline: 281,
        font: { size: 34, min: 22, weight: 700, color: "#17181a", spacing: 0.5 },
      },
      catalog: {
        box: { x: 562, y: 334, w: 186, h: 24 },
        patch: { type: "solid", color: "#0a0c0f" },
        x: 568,
        baseline: 351,
        font: { size: 14.5, min: 10, weight: 600, color: "#dfe5ea", spacing: 1.6, mono: true },
      },
      storage: {
        box: { x: 74, y: 152, w: 232, h: 112 },
        patch: { type: "solid", color: "#0b0d10" },
        x: 76,
        firstBaseline: 167,
        leading: 16.5,
        maxLines: 6,
        font: { size: 13.5, min: 11, weight: 400, color: "#c9cfd8", spacing: 0.1 },
      },
      composition: {
        box: { x: 74, y: 298, w: 232, h: 42 },
        patch: { type: "solid", color: "#0b0d10" },
        x: 76,
        firstBaseline: 312,
        leading: 19,
        maxLines: 2,
        font: { size: 14, min: 11, weight: 400, color: "#dfe5ea", spacing: 0.1 },
      },
      lot: {
        box: { x: 950, y: 40, w: 106, h: 26 },
        patch: { type: "solid", color: "#0a0c0f" },
        x: 956,
        baseline: 59,
        font: { size: 16.5, min: 12, weight: 500, color: "#e8ebef", spacing: 0.6 },
      },
      mfgDate: {
        box: { x: 950, y: 88, w: 106, h: 26 },
        patch: { type: "solid", color: "#0a0c0f" },
        x: 956,
        baseline: 107,
        font: { size: 16.5, min: 12, weight: 500, color: "#e8ebef", spacing: 0.6 },
      },
      expDate: {
        box: { x: 950, y: 136, w: 106, h: 26 },
        patch: { type: "solid", color: "#0a0c0f" },
        x: 956,
        baseline: 155,
        font: { size: 16.5, min: 12, weight: 500, color: "#e8ebef", spacing: 0.6 },
      },
      qr: {
        // Inner module area of the immutable white tile (tile + SCAN TO
        // VERIFY caption stay untouched).
        patch: { type: "solid", color: "#ffffff", box: { x: 899, y: 196, w: 146, h: 142 } },
        box: { x: 902, y: 198, w: 140, h: 140 },
        npMark: true,
      },
      barcode: {
        // Inner bar area of the immutable white tile (ladder orientation).
        patch: { type: "solid", color: "#ffffff", box: { x: 1088, y: 42, w: 57, h: 318 } },
        box: { x: 1091, y: 50, w: 51, h: 302 },
      },
      barcodeText: {
        // Vertical human-readable value beside the barcode tile.
        box: { x: 1150, y: 120, w: 30, h: 170 },
        patch: { type: "solid", color: "#0a0c0f" },
        cx: 1164,
        cy: 205,
        font: { size: 15, min: 11, weight: 500, color: "#d6dbe2", spacing: 1 },
      },
    },
  },

  // ── Registered but NOT rolled out (awaiting approval per the starter
  //    package; see blockers in docs/LABEL_MASTER_ENGINE.md) ───────────────
  "spectral-biotech": {
    masterId: "spectral",
    displayName: "Spectral",
    file: `${MASTERS_BASE_PATH}/spectral.svg`,
    sha256: "65fcf8e3cf611badd2c9034e30bf7d96d3944e098a76dde65ed6d4dbf8d86fea",
    viewBox: [313, 206],
    physical: { widthMm: 72 },
    fields: null,
    blocker: "Master is a 313×206 thumbnail card with a baked-in caption — production-resolution artwork required before rollout.",
  },
  "cryogenic-white": {
    masterId: "cryogenic",
    displayName: "Cryogenic",
    file: `${MASTERS_BASE_PATH}/cryogenic.svg`,
    sha256: "47b39b016ab9ae23dd4e1b3addff8ab93352462b122f441e7b8a68d4a20258c8",
    viewBox: [313, 206],
    physical: { widthMm: 72 },
    fields: null,
    blocker: "Master is a 313×206 thumbnail card with a baked-in caption — production-resolution artwork required before rollout.",
  },
  "neural-grid": {
    masterId: "neural-grid",
    displayName: "Neural Grid",
    file: `${MASTERS_BASE_PATH}/neural-grid.svg`,
    sha256: "3e5c6769d9f29b089aa84db5d7a45a346a6017007c317026754a1eba759f72ee",
    viewBox: [1825, 862],
    physical: { widthMm: 72 },
    fields: null,
    blocker: "High-res master registered; field map pending Core Black prototype approval.",
  },
};

/** Master entry for a template id, or null. */
export function masterFor(templateId) {
  return TEMPLATE_MASTERS[templateId] || null;
}

/** True when the template renders via the EXACT-master overlay engine. */
export function hasMasterRollout(templateId) {
  const m = TEMPLATE_MASTERS[templateId];
  return Boolean(m && m.fields);
}
