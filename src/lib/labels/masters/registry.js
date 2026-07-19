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

  // ── Rolled out 2026-07-19 after Core Black approval, from the owner's
  //    production-resolution Noir_Peptides_SVG_Templates package ───────────
  "spectral-biotech": {
    masterId: "spectral",
    displayName: "Spectral",
    file: `${MASTERS_BASE_PATH}/spectral.svg`,
    sha256: "301aef8dadf3012640e6c72626ee0cf66969213188678a02bad9141715ae6e86",
    viewBox: [1817, 866],
    physical: { widthMm: 72 },
    fields: {
      productName: {
        box: { x: 605, y: 288, w: 615, h: 192 },
        patch: { type: "sample", src: { x: 605, y: 262, w: 615, h: 20 } },
        cx: 910,
        baselines: { one: 404, two: [360, 448] },
        font: { size: 80, min: 40, weight: 700, color: "#f4f6fa", spacing: 1 },
      },
      quantity: {
        box: { x: 588, y: 483, w: 672, h: 86 },
        patch: { type: "mirrorPair", srcSide: "left", src: { x: 592, y: 483, w: 110, h: 86 } },
        cx: 912,
        baseline: 545,
        font: { size: 56, min: 28, weight: 700, color: "#14161a", spacing: 1 },
      },
      catalog: {
        box: { x: 800, y: 682, w: 344, h: 40 },
        patch: { type: "solid", color: "#0a0b0e" },
        x: 810,
        baseline: 712,
        font: { size: 29, min: 18, weight: 600, color: "#eef1f6", spacing: 3, mono: true },
      },
      storage: {
        box: { x: 152, y: 310, w: 356, h: 200 },
        patch: { type: "tile", src: { x: 152, y: 662, w: 356, h: 70 } },
        x: 155,
        firstBaseline: 338,
        leading: 32,
        maxLines: 6,
        font: { size: 24, min: 19, weight: 400, color: "#ccd3de", spacing: 0.2 },
      },
      composition: {
        box: { x: 152, y: 592, w: 356, h: 70 },
        patch: { type: "sample", src: { x: 152, y: 662, w: 356, h: 70 } },
        x: 155,
        firstBaseline: 616,
        leading: 34,
        maxLines: 2,
        font: { size: 24, min: 19, weight: 400, color: "#e2e7ef", spacing: 0.2 },
      },
      lot: {
        box: { x: 1428, y: 102, w: 156, h: 42 },
        patch: { type: "sample", src: { x: 1428, y: 341, w: 156, h: 42 } },
        x: 1432,
        baseline: 128,
        font: { size: 28, min: 20, weight: 500, color: "#eef1f6", spacing: 1 },
      },
      mfgDate: {
        box: { x: 1428, y: 189, w: 156, h: 42 },
        patch: { type: "sample", src: { x: 1428, y: 341, w: 156, h: 42 } },
        x: 1432,
        baseline: 215,
        font: { size: 28, min: 20, weight: 500, color: "#eef1f6", spacing: 1 },
      },
      expDate: {
        box: { x: 1428, y: 276, w: 156, h: 42 },
        patch: { type: "sample", src: { x: 1428, y: 341, w: 156, h: 42 } },
        x: 1432,
        baseline: 302,
        font: { size: 28, min: 20, weight: 500, color: "#eef1f6", spacing: 1 },
      },
      qr: {
        patch: { type: "solid", color: "#ffffff", box: { x: 1320, y: 392, w: 262, h: 262 } },
        box: { x: 1327, y: 399, w: 248, h: 248 },
        npMark: true,
      },
      barcode: {
        patch: { type: "solid", color: "#ffffff", box: { x: 1634, y: 96, w: 98, h: 652 } },
        box: { x: 1639, y: 106, w: 88, h: 632 },
      },
      barcodeText: {
        box: { x: 1740, y: 370, w: 42, h: 162 },
        patch: { type: "solid", color: "#0a0b0e" },
        cx: 1759,
        cy: 448,
        font: { size: 24, min: 16, weight: 500, color: "#e8ecf3", spacing: 2 },
      },
    },
  },
  "cryogenic-white": {
    masterId: "cryogenic",
    displayName: "Cryogenic",
    file: `${MASTERS_BASE_PATH}/cryogenic.svg`,
    sha256: "4c9bad89883b227668a996eef78d5c81899ce30fc5b1e33ba4afdcdbcc4973cb",
    viewBox: [1536, 510],
    physical: { widthMm: 72 },
    fields: {
      productName: {
        box: { x: 455, y: 158, w: 625, h: 140 },
        patch: { type: "sample", src: { x: 455, y: 143, w: 625, h: 13 } },
        cx: 768,
        baselines: { one: 242, two: [212, 272] },
        font: { size: 54, min: 28, weight: 700, color: "#131c2c", spacing: 0.6 },
      },
      quantity: {
        box: { x: 502, y: 296, w: 534, h: 54 },
        patch: { type: "mirrorPair", srcSide: "right", src: { x: 912, y: 296, w: 120, h: 54 } },
        cx: 768,
        baseline: 331,
        font: { size: 34, min: 18, weight: 700, color: "#ffffff", spacing: 0.6 },
      },
      catalog: {
        box: { x: 663, y: 418, w: 250, h: 22 },
        patch: { type: "solid", color: "#ffffff" },
        x: 668,
        baseline: 435,
        font: { size: 19, min: 12, weight: 600, color: "#16233f", spacing: 2, mono: true },
      },
      storage: {
        box: { x: 120, y: 202, w: 264, h: 138 },
        patch: { type: "sample", src: { x: 120, y: 20, w: 264, h: 24 } },
        x: 123,
        firstBaseline: 218,
        leading: 21,
        maxLines: 6,
        font: { size: 17.5, min: 14, weight: 400, color: "#33415c", spacing: 0.1 },
      },
      composition: {
        box: { x: 120, y: 386, w: 264, h: 44 },
        patch: { type: "sample", src: { x: 120, y: 20, w: 264, h: 24 } },
        x: 123,
        firstBaseline: 400,
        leading: 21,
        maxLines: 2,
        font: { size: 17.5, min: 14, weight: 400, color: "#2b3a55", spacing: 0.1 },
      },
      lot: {
        box: { x: 1190, y: 48, w: 118, h: 26 },
        patch: { type: "sample", src: { x: 1190, y: 185, w: 118, h: 18 } },
        x: 1194,
        baseline: 68,
        font: { size: 19, min: 13, weight: 500, color: "#21304a", spacing: 0.6 },
      },
      mfgDate: {
        box: { x: 1190, y: 96, w: 118, h: 26 },
        patch: { type: "sample", src: { x: 1190, y: 185, w: 118, h: 18 } },
        x: 1194,
        baseline: 116,
        font: { size: 19, min: 13, weight: 500, color: "#21304a", spacing: 0.6 },
      },
      expDate: {
        box: { x: 1190, y: 145, w: 118, h: 26 },
        patch: { type: "sample", src: { x: 1190, y: 185, w: 118, h: 18 } },
        x: 1194,
        baseline: 165,
        font: { size: 19, min: 13, weight: 500, color: "#21304a", spacing: 0.6 },
      },
      qr: {
        patch: { type: "solid", color: "#ffffff", box: { x: 1110, y: 205, w: 190, h: 190 } },
        box: { x: 1114, y: 209, w: 182, h: 182 },
        npMark: true,
      },
      barcode: {
        patch: { type: "solid", color: "#ffffff", box: { x: 1366, y: 42, w: 94, h: 432 } },
        box: { x: 1372, y: 52, w: 82, h: 412 },
      },
      barcodeText: {
        box: { x: 1468, y: 150, w: 42, h: 212 },
        patch: { type: "sample", src: { x: 1468, y: 380, w: 42, h: 80 } },
        cx: 1490,
        cy: 255,
        font: { size: 19, min: 13, weight: 500, color: "#25344e", spacing: 1.4 },
      },
    },
  },
  "neural-grid": {
    masterId: "neural-grid",
    displayName: "Neural Grid",
    file: `${MASTERS_BASE_PATH}/neural-grid.svg`,
    sha256: "24fbc34378d66ea6bb22beeef183caac05e32fa74c7208c33ce3cb922631125b",
    viewBox: [1825, 862],
    physical: { widthMm: 72 },
    fields: {
      productName: {
        box: { x: 588, y: 253, w: 648, h: 208 },
        patch: { type: "sample", src: { x: 588, y: 246, w: 648, h: 12 } },
        cx: 910,
        baselines: { one: 385, two: [330, 432] },
        font: { size: 86, min: 42, weight: 700, color: "#f2f5fa", spacing: 1 },
      },
      quantity: {
        box: { x: 652, y: 477, w: 528, h: 86 },
        patch: { type: "mirrorPair", srcSide: "left", src: { x: 654, y: 477, w: 66, h: 86 } },
        cx: 912,
        baseline: 540,
        font: { size: 58, min: 30, weight: 700, color: "#10151c", spacing: 1 },
      },
      catalog: {
        box: { x: 800, y: 688, w: 348, h: 42 },
        patch: { type: "solid", color: "#05080e" },
        x: 810,
        baseline: 720,
        font: { size: 29, min: 18, weight: 600, color: "#e8eef6", spacing: 3, mono: true },
      },
      storage: {
        box: { x: 150, y: 308, w: 360, h: 190 },
        patch: { type: "sample", src: { x: 150, y: 658, w: 360, h: 38 } },
        x: 155,
        firstBaseline: 334,
        leading: 30,
        maxLines: 6,
        font: { size: 24, min: 19, weight: 400, color: "#c6cfdd", spacing: 0.2 },
      },
      composition: {
        box: { x: 150, y: 580, w: 360, h: 72 },
        patch: { type: "sample", src: { x: 150, y: 658, w: 360, h: 38 } },
        x: 155,
        firstBaseline: 604,
        leading: 36,
        maxLines: 2,
        font: { size: 25, min: 19, weight: 400, color: "#e2e8f2", spacing: 0.2 },
      },
      lot: {
        box: { x: 1420, y: 82, w: 152, h: 38 },
        patch: { type: "sample", src: { x: 1420, y: 316, w: 152, h: 36 } },
        x: 1424,
        baseline: 108,
        font: { size: 28, min: 20, weight: 500, color: "#e8eef6", spacing: 1 },
      },
      mfgDate: {
        box: { x: 1420, y: 168, w: 152, h: 38 },
        patch: { type: "sample", src: { x: 1420, y: 316, w: 152, h: 36 } },
        x: 1424,
        baseline: 194,
        font: { size: 28, min: 20, weight: 500, color: "#e8eef6", spacing: 1 },
      },
      expDate: {
        box: { x: 1420, y: 255, w: 152, h: 38 },
        patch: { type: "sample", src: { x: 1420, y: 316, w: 152, h: 36 } },
        x: 1424,
        baseline: 281,
        font: { size: 28, min: 20, weight: 500, color: "#e8eef6", spacing: 1 },
      },
      qr: {
        patch: { type: "solid", color: "#ffffff", box: { x: 1316, y: 358, w: 254, h: 284 } },
        box: { x: 1322, y: 379, w: 242, h: 242 },
        npMark: true,
      },
      barcode: {
        patch: { type: "solid", color: "#ffffff", box: { x: 1629, y: 82, w: 103, h: 668 } },
        box: { x: 1634, y: 94, w: 93, h: 646 },
      },
      barcodeText: {
        box: { x: 1740, y: 330, w: 46, h: 200 },
        patch: { type: "solid", color: "#05080e" },
        cx: 1763,
        cy: 430,
        font: { size: 24, min: 16, weight: 500, color: "#e8eef6", spacing: 2 },
      },
    },
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
