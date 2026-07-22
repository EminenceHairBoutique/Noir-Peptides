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
    // Replaced 2026-07-22 with the owner's 1536x768 package (viewBox 1774x887).
    sha256: "95dd7f7199c6d6a9d293edf870c8a4da3be7bc294bd7d63d91c53c686e575648",
    viewBox: [1774, 887],
    physical: { widthMm: 72 }, // heightMm derives from the master aspect
    fields: {
      productName: {
        box: { x: 550, y: 300, w: 704, h: 185 },
        patch: { type: "sample", src: { x: 550, y: 293, w: 704, h: 14 } },
        cx: 902,
        baselines: { one: 415, two: [375, 455] },
        font: { size: 84, min: 42, weight: 700, color: "#f2f4f6", spacing: 1 },
      },
      quantity: {
        box: { x: 548, y: 488, w: 710, h: 76 },
        patch: { type: "mirrorPair", srcSide: "left", src: { x: 548, y: 488, w: 140, h: 76 } },
        cx: 902,
        baseline: 543,
        font: { size: 58, min: 30, weight: 700, color: "#15171a", spacing: 1 },
      },
      catalog: {
        box: { x: 805, y: 662, w: 285, h: 38 },
        patch: { type: "solid", color: "#0a0c10" },
        x: 815,
        baseline: 688,
        font: { size: 29, min: 18, weight: 600, color: "#dfe5ea", spacing: 3, mono: true },
      },
      storage: {
        box: { x: 142, y: 330, w: 360, h: 172 },
        patch: { type: "sample", src: { x: 142, y: 504, w: 360, h: 16 } },
        x: 145,
        firstBaseline: 351,
        leading: 28,
        maxLines: 6,
        font: { size: 24, min: 19, weight: 400, color: "#c9cfd8", spacing: 0.2 },
      },
      composition: {
        box: { x: 142, y: 575, w: 360, h: 92 },
        patch: { type: "sample", src: { x: 142, y: 504, w: 360, h: 16 } },
        x: 145,
        firstBaseline: 599,
        leading: 29,
        maxLines: 2,
        font: { size: 24, min: 19, rowMin: 16, weight: 400, color: "#dfe5ea", spacing: 0.2 },
      },
      lot: {
        box: { x: 1415, y: 142, w: 150, h: 28 },
        patch: { type: "sample", src: { x: 1415, y: 368, w: 150, h: 18 } },
        x: 1420,
        baseline: 163,
        font: { size: 29, min: 20, weight: 500, color: "#e8ebef", spacing: 1 },
      },
      mfgDate: {
        box: { x: 1415, y: 223, w: 150, h: 28 },
        patch: { type: "sample", src: { x: 1415, y: 368, w: 150, h: 18 } },
        x: 1420,
        baseline: 244,
        font: { size: 29, min: 20, weight: 500, color: "#e8ebef", spacing: 1 },
      },
      expDate: {
        box: { x: 1415, y: 305, w: 150, h: 28 },
        patch: { type: "sample", src: { x: 1415, y: 368, w: 150, h: 18 } },
        x: 1420,
        baseline: 326,
        font: { size: 29, min: 20, weight: 500, color: "#e8ebef", spacing: 1 },
      },
      qr: {
        patch: { type: "solid", color: "#ffffff", box: { x: 1323, y: 400, w: 228, h: 232 } },
        box: { x: 1329, y: 406, w: 216, h: 216 },
        npMark: true,
      },
      barcode: {
        patch: { type: "solid", color: "#ffffff", box: { x: 1609, y: 132, w: 85, h: 562 } },
        box: { x: 1613, y: 142, w: 77, h: 542 },
      },
      barcodeText: {
        box: { x: 1697, y: 340, w: 44, h: 180 },
        patch: { type: "sample", src: { x: 1697, y: 530, w: 44, h: 170 } },
        cx: 1719,
        cy: 425,
        font: { size: 28, min: 18, weight: 500, color: "#d6dbe2", spacing: 2 },
      },
      legalLine: {
        cx: 902,
        baseline: 726,
        maxW: 560,
        font: { size: 16, min: 11, weight: 500, color: "#9aa4b2", spacing: 0.5 },
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
        box: { x: 152, y: 592, w: 356, h: 108 },
        patch: { type: "sample", src: { x: 152, y: 662, w: 356, h: 70 } },
        x: 155,
        firstBaseline: 616,
        leading: 34,
        maxLines: 2,
        font: { size: 24, min: 19, rowMin: 16, weight: 400, color: "#e2e7ef", spacing: 0.2 },
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
      legalLine: {
        cx: 910,
        baseline: 756,
        maxW: 610,
        font: { size: 17, min: 12, weight: 500, color: "#a8b0bf", spacing: 0.6 },
      },
    },
  },
  "cryogenic-white": {
    masterId: "cryogenic",
    displayName: "Cryogenic",
    file: `${MASTERS_BASE_PATH}/cryogenic.svg`,
    // Replaced 2026-07-22 with the owner's 1536x768 package (viewBox 1774x887).
    sha256: "987d0e3710f9f03db394ca2590285fb11459e5f384188211313ca6a22e7e7bfc",
    viewBox: [1774, 887],
    physical: { widthMm: 72 },
    fields: {
      productName: {
        box: { x: 540, y: 255, w: 710, h: 200 },
        patch: { type: "sample", src: { x: 540, y: 250, w: 710, h: 10 } },
        cx: 895,
        baselines: { one: 372, two: [330, 415] },
        font: { size: 84, min: 42, weight: 700, color: "#131c2c", spacing: 1 },
      },
      quantity: {
        // Solid blue band interior (the dotted halftone ends stay original).
        box: { x: 585, y: 470, w: 600, h: 90 },
        patch: { type: "mirrorPair", srcSide: "left", src: { x: 588, y: 470, w: 100, h: 90 } },
        cx: 885,
        baseline: 530,
        font: { size: 62, min: 30, weight: 700, color: "#ffffff", spacing: 1 },
      },
      catalog: {
        box: { x: 775, y: 697, w: 330, h: 36 },
        patch: { type: "solid", color: "#ffffff" },
        x: 795,
        baseline: 726,
        font: { size: 29, min: 18, weight: 600, color: "#16233f", spacing: 3, mono: true },
      },
      storage: {
        box: { x: 155, y: 288, w: 360, h: 192 },
        patch: { type: "sample", src: { x: 155, y: 662, w: 360, h: 66 } },
        x: 158,
        firstBaseline: 310,
        leading: 30.5,
        maxLines: 6,
        font: { size: 24, min: 19, weight: 400, color: "#33415c", spacing: 0.2 },
      },
      composition: {
        box: { x: 155, y: 588, w: 360, h: 100 },
        patch: { type: "sample", src: { x: 155, y: 662, w: 360, h: 66 } },
        x: 158,
        firstBaseline: 611,
        leading: 30,
        maxLines: 2,
        font: { size: 24, min: 19, rowMin: 16, weight: 400, color: "#2b3a55", spacing: 0.2 },
      },
      lot: {
        box: { x: 1380, y: 82, w: 155, h: 38 },
        patch: { type: "sample", src: { x: 1380, y: 315, w: 155, h: 36 } },
        x: 1385,
        baseline: 110,
        font: { size: 29, min: 20, weight: 500, color: "#21304a", spacing: 1 },
      },
      mfgDate: {
        box: { x: 1380, y: 162, w: 155, h: 38 },
        patch: { type: "sample", src: { x: 1380, y: 315, w: 155, h: 36 } },
        x: 1385,
        baseline: 190,
        font: { size: 29, min: 20, weight: 500, color: "#21304a", spacing: 1 },
      },
      expDate: {
        box: { x: 1380, y: 247, w: 155, h: 38 },
        patch: { type: "sample", src: { x: 1380, y: 315, w: 155, h: 36 } },
        x: 1385,
        baseline: 275,
        font: { size: 29, min: 20, weight: 500, color: "#21304a", spacing: 1 },
      },
      qr: {
        patch: { type: "solid", color: "#ffffff", box: { x: 1278, y: 391, w: 250, h: 266 } },
        box: { x: 1283, y: 398, w: 240, h: 240 },
        npMark: true,
      },
      barcode: {
        patch: { type: "solid", color: "#ffffff", box: { x: 1576, y: 80, w: 112, h: 686 } },
        box: { x: 1584, y: 130, w: 96, h: 590 },
      },
      barcodeText: {
        box: { x: 1698, y: 340, w: 46, h: 190 },
        patch: { type: "sample", src: { x: 1698, y: 545, w: 46, h: 180 } },
        cx: 1721,
        cy: 430,
        font: { size: 28, min: 18, weight: 500, color: "#25344e", spacing: 2 },
      },
      legalLine: {
        // Between the CAT chip and the telemetry row.
        cx: 895,
        baseline: 775,
        maxW: 600,
        font: { size: 16, min: 11, weight: 500, color: "#57657f", spacing: 0.5 },
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
        box: { x: 150, y: 580, w: 360, h: 108 },
        patch: { type: "sample", src: { x: 150, y: 658, w: 360, h: 38 } },
        x: 155,
        firstBaseline: 604,
        leading: 36,
        maxLines: 2,
        font: { size: 25, min: 19, rowMin: 16, weight: 400, color: "#e2e8f2", spacing: 0.2 },
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
      legalLine: {
        cx: 910,
        baseline: 768,
        maxW: 620,
        font: { size: 17, min: 12, weight: 500, color: "#93a0b4", spacing: 0.6 },
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
