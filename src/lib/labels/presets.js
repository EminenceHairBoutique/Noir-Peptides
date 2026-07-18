// src/lib/labels/presets.js
// Physical label presets for a standard 10 mL serum vial (Ø ≈ 24.5 mm,
// height ≈ 54 mm, circumference ≈ 76.97 mm). All dimensions in mm; helpers
// convert to inches and 300-DPI pixels. FINAL die sizes must be confirmed with
// the chosen printer/stock (documented in docs/LABEL_PRINT_SPECS.md) — these
// are industry-standard starting presets, configurable, not hard assumptions.
//
// bleedMm   : artwork extends this far past trim on every side
// safeMm    : keep critical content this far inside trim
// overlapMm : trailing wrap zone that may sit under the leading edge — keep it
//             free of critical content (background only)

export const VIAL_10ML = {
  diameterMm: 24.5,
  heightMm: 54,
  circumferenceMm: +(Math.PI * 24.5).toFixed(2), // 76.97
  capDiameterMm: 20,
};

export const LABEL_PRESETS = {
  full_wrap: {
    id: "full_wrap",
    name: "Full wrap (10 mL)",
    widthMm: 72,
    heightMm: 30,
    bleedMm: 2,
    safeMm: 2,
    overlapMm: 4,
    description: "Wraps ~93% of the vial circumference; seam at the back.",
  },
  partial: {
    id: "partial",
    name: "Partial wrap (10 mL)",
    widthMm: 50,
    heightMm: 30,
    bleedMm: 2,
    safeMm: 2,
    overlapMm: 0,
    description: "Partial wrap leaving a clear glass window.",
  },
  front: {
    id: "front",
    name: "Front display",
    widthMm: 38,
    heightMm: 28,
    bleedMm: 2,
    safeMm: 2,
    overlapMm: 0,
    description: "Front-facing display panel only.",
  },
  neck: {
    id: "neck",
    name: "Neck / tamper band",
    widthMm: 60,
    heightMm: 8,
    bleedMm: 1,
    safeMm: 1,
    overlapMm: 6,
    description: "Optional tamper-evident neck band.",
  },
  cap: {
    id: "cap",
    name: "Cap sticker",
    widthMm: 20,
    heightMm: 20,
    bleedMm: 1,
    safeMm: 1.5,
    overlapMm: 0,
    circle: true,
    description: "Ø20 mm circular cap sticker.",
  },
};

export const MM_PER_INCH = 25.4;

export function mmToInches(mm) {
  return +(mm / MM_PER_INCH).toFixed(3);
}

/** Pixel dimensions at a given DPI (print export default 300). */
export function mmToPx(mm, dpi = 300) {
  return Math.round((mm / MM_PER_INCH) * dpi);
}

/** Aspect ratio (h/w) used to size web textures to the preset. */
export function presetAspect(preset) {
  return preset.heightMm / preset.widthMm;
}

/** Arc the full-wrap label covers on the vial, in radians (for the 3D cylinder). */
export function wrapArcRadians(preset, vial = VIAL_10ML) {
  const frac = Math.min(1, preset.widthMm / vial.circumferenceMm);
  return 2 * Math.PI * frac;
}
