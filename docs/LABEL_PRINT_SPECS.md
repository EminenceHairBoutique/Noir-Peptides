# Label Print Specifications — 10 mL Research Vial

_Working presets for a standard 10 mL serum vial (Ø ≈ 24.5 mm × 54 mm tall,
circumference ≈ 76.97 mm, crimp cap Ø ≈ 20 mm). **Final die sizes must be
confirmed against the actual vials and the printer's stock/die list before the
first production run** — presets are configurable in
`src/lib/labels/presets.js`._

## Die presets

| Preset | Size (mm) | Size (in) | 300-DPI px | Bleed | Safe | Overlap |
|---|---|---|---|---|---|---|
| Full wrap | 72 × 30 | 2.835 × 1.181 | 850 × 354 | 2 mm | 2 mm | 4 mm (trailing) |
| Partial wrap | 50 × 30 | 1.969 × 1.181 | 591 × 354 | 2 mm | 2 mm | — |
| Front display | 38 × 28 | 1.496 × 1.102 | 449 × 331 | 2 mm | 2 mm | — |
| Neck / tamper band | 60 × 8 | 2.362 × 0.315 | 709 × 94 | 1 mm | 1 mm | 6 mm |
| Cap sticker | Ø 20 | Ø 0.787 | Ø 236 | 1 mm | 1.5 mm | — |

- Full wrap covers ~93.5 % of the circumference; the ~5.5 mm gap + 4 mm overlap zone sit at the **back seam**. Keep the overlap zone free of critical content (background only).
- The engine's guides view (Label Studio → "Guides") draws the safe area (cyan dash) and overlap boundary (amber).

## Machine-readable elements
- **Barcode:** Code 128 subset B, **ladder orientation** (bars run around the circumference — curvature-tolerant). Quiet zone ≥ 10 modules each end (engine reserves 8 % of tile height per side). At 26 mm usable ladder length the module floor (~0.19 mm / 7.5 mil) supports **≤ ~11 encoded characters** — encode the SKU (default); the studio warns beyond 11 chars. Human-readable value prints beside the bars. **No fabricated UPC/GS1** — internal identifiers only.
- **QR:** error correction M, 2-module quiet zone, on a solid white tile ≥ 10 × 10 mm print size, never over gradients/holographic areas. Encodes `https://<domain>/v/<verification-code>`.
- Verify scannability from a printed, vial-applied sample before a production run (QA checklist).

## Color & substrate
- Masters are SVG (sRGB). For CMYK production: rich black C40 M30 Y30 K100 for large fields; body text ≤ 2 pt reversed type avoided (minimum text on-label 4 pt ≈ 1.4 mm cap height; engine minimums respect this).
- Substrates: matte white BOPP (Noir Clinical Core / Neural Grid), gloss or soft-touch laminate optional; **Spectral Biotech** holographic strip prints as a foil/cold-foil or holographic-laminate SPOT layer — the SVG gradient band marks the spot area; everything else prints on a **white underprint** when using metallic/holo/clear stock. Codes, warnings, lot/exp always sit on opaque high-contrast fields.
- 300-DPI PNG export from the studio; SVG master preserves editable text (never rasterize text before handoff).
- **Print-ready PDF** export (studio → PDF): bleed-extended artwork, crop marks at trim corners,
  slug line with die/SKU/template/DPI/date. One label per page at true physical size.
- **Spectral Helix (Holographic)** prints on holographic-laminate or cold-foil stock: the iridescent
  ground/helix/brand-gradient areas are the SPOT layer; body type, warnings, and code tiles print
  over a white underprint (opaque high-contrast fields).

## Anti-counterfeit (implemented / optional)
Serialized non-sequential QR codes (65-bit), per-label verification page with recalled/hold states, label-version identifiers, fine hairline rules (microtext-ready), optional tamper neck band preset. Optional future: UV spot layer. No claims of absolute counterfeit prevention; no regulatory emblems.
