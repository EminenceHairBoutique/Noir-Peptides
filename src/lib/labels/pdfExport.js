// src/lib/labels/pdfExport.js
// BROWSER-ONLY. Print-ready PDF export (Checkpoint 2): one page per label with
// bleed artwork, trim/crop marks, and a slug line for the printer. pdf-lib is
// imported dynamically so it never enters the initial bundle (vendor-pdf
// chunk, loaded only when an admin clicks "PDF" in the studio).
//
// The artwork is the SAME renderLabelSvg output as screen/PNG/3D (rendered
// withBleed and rasterized at print DPI with embedded brand fonts) — the
// print file can never drift from the approved preview.

import { renderLabelSvg } from "./renderLabelSvg.js";
import { LABEL_PRESETS } from "./presets.js";
import { rasterizeLabelSvg } from "./rasterize.js";

const MM_TO_PT = 72 / 25.4;
const MARK_LEN_MM = 4; // crop mark length
const MARK_GAP_MM = 1; // gap between bleed edge and mark start
const SLUG_MM = 12; // margin around the bleed box (marks + slug line)

/**
 * Build a print-ready PDF for one label config/preset.
 * @param {import('./types.js').ProductLabelConfig} config
 * @param {{templateId?: string, presetId?: string, siteUrl?: string, dpi?: number}} opts
 * @returns {Promise<Blob>}
 */
export async function labelPdfBlob(config, opts = {}) {
  const { PDFDocument, StandardFonts, rgb, cmyk } = await import("pdf-lib");
  const presetId = opts.presetId || config.default_preset || "full_wrap";
  const preset = LABEL_PRESETS[presetId];
  if (!preset) throw new Error(`labelPdfBlob: unknown preset "${presetId}"`);
  const dpi = opts.dpi || 300;

  // Rasterize the bleed artwork at print resolution.
  const svg = await renderLabelSvg(config, { ...opts, presetId, withBleed: true, showGuides: false });
  const bleedW = preset.widthMm + preset.bleedMm * 2;
  const bleedH = preset.heightMm + preset.bleedMm * 2;
  const px = Math.round((bleedW / 25.4) * dpi);
  const canvas = await rasterizeLabelSvg(svg, px);
  const pngBytes = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? b.arrayBuffer().then(resolve, reject) : reject(new Error("PDF export: rasterization failed"))),
      "image/png"
    )
  );

  const doc = await PDFDocument.create();
  doc.setTitle(`Noir Peptides label — ${config.display_name || ""} ${config.quantity_label || ""} (${preset.name})`.trim());
  doc.setCreator("Noir Peptides Label Studio");

  const pageW = (bleedW + SLUG_MM * 2) * MM_TO_PT;
  const pageH = (bleedH + SLUG_MM * 2) * MM_TO_PT;
  const page = doc.addPage([pageW, pageH]);

  const png = await doc.embedPng(pngBytes);
  const artX = SLUG_MM * MM_TO_PT;
  const artY = SLUG_MM * MM_TO_PT;
  page.drawImage(png, { x: artX, y: artY, width: bleedW * MM_TO_PT, height: bleedH * MM_TO_PT });

  // Crop marks at the TRIM corners (registration black), outside the bleed.
  const black = cmyk ? cmyk(0, 0, 0, 1) : rgb(0, 0, 0);
  const t = {
    x0: (SLUG_MM + preset.bleedMm) * MM_TO_PT,
    y0: (SLUG_MM + preset.bleedMm) * MM_TO_PT,
    x1: (SLUG_MM + preset.bleedMm + preset.widthMm) * MM_TO_PT,
    y1: (SLUG_MM + preset.bleedMm + preset.heightMm) * MM_TO_PT,
  };
  const gap = (preset.bleedMm + MARK_GAP_MM) * MM_TO_PT;
  const len = MARK_LEN_MM * MM_TO_PT;
  const line = (x1, y1, x2, y2) =>
    page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: 0.5, color: black });
  for (const [cx, cy, sx, sy] of [
    [t.x0, t.y0, -1, -1],
    [t.x1, t.y0, 1, -1],
    [t.x0, t.y1, -1, 1],
    [t.x1, t.y1, 1, 1],
  ]) {
    line(cx + sx * gap, cy, cx + sx * (gap + len), cy); // horizontal mark
    line(cx, cy + sy * gap, cx, cy + sy * (gap + len)); // vertical mark
  }

  // Slug line: everything the printer needs to identify the file.
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const stamp = new Date().toISOString().slice(0, 10);
  const slug = [
    `NOIR PEPTIDES — ${config.display_name || ""} ${config.quantity_label || ""}`.trim(),
    `${preset.name}: trim ${preset.widthMm}×${preset.heightMm} mm · bleed ${preset.bleedMm} mm` +
      (preset.overlapMm ? ` · wrap overlap ${preset.overlapMm} mm (trailing)` : ""),
    `SKU ${config.sku || "—"} · template ${opts.templateId || config.template_id || "noir-clinical-core"} · ${dpi} DPI · ${stamp}`,
  ].join("   |   ");
  page.drawText(slug, { x: artX, y: 4 * MM_TO_PT, size: 6, font, color: black });

  const bytes = await doc.save();
  return new Blob([bytes], { type: "application/pdf" });
}
