// src/lib/labels/renderLabelSvg.js
// Pure, Node-safe, ASYNC label layout engine. One layout, four template skins.
// Emits an SVG string used by: the studio's flat preview (inline DOM), the
// print/PNG export, and the 3D vial texture (via rasterize.js) — one source,
// zero drift between screen, print, and 3D.
//
// COMPLIANCE INVARIANTS (unit-tested):
//   * RUO warnings render on EVERY preset from lib/labelConstants (never from
//     row data, never omitted).
//   * Storage text renders ONLY when storage_source_verified; otherwise the
//     safe placeholder.
//   * Blend composition renders ONLY owner-entered quantities; otherwise the
//     "pending administrative input" placeholder. Nothing is invented.
//   * No dosing/administration language anywhere.
//
// Geometry: viewBox units = mm × 10 (full_wrap 72×30 mm → 720×300). The
// trailing wrap-overlap zone stays free of critical content. QR + barcode sit
// on solid white tiles (never on gradients/patterns) with quiet zones.
// Node-safety: no window/document; QR via qrcode.toString (works in Node).

import QRCode from "qrcode";
import {
  RUO_PRIMARY_WARNING,
  RUO_SECONDARY_WARNING,
  COMPOSITION_PENDING_PLACEHOLDER,
} from "../../../lib/labelConstants.js";
import { LABEL_PRESETS } from "./presets.js";
import { storageLineFor } from "./storage.js";
import { expiryLine } from "./lots.js";
import { code128Svg } from "./code128.js";
import noirClinicalCore from "./templates/noirClinicalCore.js";
import spectralBiotech from "./templates/spectralBiotech.js";
import cryogenicWhite from "./templates/cryogenicWhite.js";
import neuralGrid from "./templates/neuralGrid.js";
import { RECONSTITUTION_NOTE } from "./storage.js";

export const TEMPLATES = {
  "noir-clinical-core": noirClinicalCore,
  "spectral-biotech": spectralBiotech,
  "cryogenic-white": cryogenicWhite,
  "neural-grid": neuralGrid,
};

const FONT_DISPLAY = "'Syne','DM Sans',sans-serif";
const FONT_BODY = "'DM Sans',sans-serif";
const FONT_MONO = "'IBM Plex Mono',monospace";

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

function text(x, y, str, { size = 12, font = FONT_BODY, weight = 400, fill, anchor = "start", spacing = 0, opacity = 1 } = {}) {
  const ls = spacing ? ` letter-spacing="${spacing}"` : "";
  const op = opacity !== 1 ? ` opacity="${opacity}"` : "";
  return `<text x="${x}" y="${y}" font-family="${font}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${ls}${op}>${esc(str)}</text>`;
}

// Rough width estimate (units) for auto-fitting the compound name.
function fitSize(str, maxWidth, baseSize, { floor = 20, avg = 0.62 } = {}) {
  const s = String(str || "");
  let size = baseSize;
  while (size > floor && s.length * size * avg > maxWidth) size -= 2;
  return size;
}

// Nested, namespace-safe QR: unwrap qrcode's root <svg> and re-embed.
async function qrSvg(value, { x, y, size, dark = "#0b0d12" }) {
  const raw = await QRCode.toString(String(value), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2, // quiet zone in modules
    color: { dark, light: "#ffffff" },
  });
  const vb = /viewBox="([^"]+)"/.exec(raw)?.[1] || "0 0 33 33";
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  return `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${vb}">${inner}</svg>`;
}

// Ladder-orientation Code 128 on a solid tile (bars run circumferentially →
// tolerant of vial curvature). Returns "" when no value.
function barcodeLadder(value, t, { x, y, w, h }) {
  if (!value) return "";
  let bars;
  try {
    bars = code128Svg(value, { height: 10, moduleWidth: 1, color: t.tileFg });
  } catch {
    return "";
  }
  // Bars drawn horizontally over [0..totalModules]×[0..10]; rotate 90° into
  // the vertical tile. Scale length to tile height minus quiet zones (10%).
  const quiet = h * 0.08;
  const len = h - quiet * 2;
  const scaleX = len / bars.totalModules;
  const barLen = w - 12;
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${t.tileBg}"/>` +
    `<g transform="translate(${x + 6},${y + quiet + len}) rotate(-90) scale(${scaleX},${barLen / 10})">${bars.svg}</g>`
  );
}

function warningsBlock(t, { x, y, width, size = 12.5, leading = 16.5, includeSecondary = true }) {
  const lines = ["FOR RESEARCH USE ONLY.", "NOT FOR HUMAN OR VETERINARY USE."];
  if (includeSecondary) lines.push("NOT FOR DIAGNOSTIC, THERAPEUTIC,", "OR HOUSEHOLD USE.");
  let out = `<line x1="${x}" y1="${y - 12}" x2="${x + width}" y2="${y - 12}" stroke="${t.warnRule}" stroke-width="1.2"/>`;
  lines.forEach((l, i) => {
    out += text(x, y + i * leading, l, { size, font: FONT_BODY, weight: 600, fill: t.warnFg, spacing: 0.4 });
  });
  out += `<line x1="${x}" y1="${y + lines.length * leading - 6}" x2="${x + width}" y2="${y + lines.length * leading - 6}" stroke="${t.warnRule}" stroke-width="1.2"/>`;
  return out;
}

function compositionBlock(t, config, { x, y, width }) {
  const comp = Array.isArray(config.composition) ? config.composition.filter((c) => c?.name) : [];
  let out = text(x, y, "COMPOSITION", { size: 10, weight: 600, fill: t.fgMuted, spacing: 1.6 });
  if (!comp.length || comp.some((c) => !c.quantity)) {
    out += text(x, y + 16, COMPOSITION_PENDING_PLACEHOLDER, { size: 10.5, fill: t.fgMuted, opacity: 0.9 });
    return { svg: out, height: 32 };
  }
  comp.slice(0, 4).forEach((c, i) => {
    out += text(x, y + 16 + i * 14.5, `${c.name} — ${c.quantity}`, { size: 11, fill: t.fg });
    void width;
  });
  return { svg: out, height: 16 + comp.slice(0, 4).length * 14.5 };
}

/* ── Panels ──────────────────────────────────────────────────────────────── */

// Center display panel (also the whole "front" preset).
function frontPanel(t, config, { x, w, h, compact = false }) {
  const cx = x + w / 2;
  let out = "";
  out += text(cx, 34, "NOIR · PEPTIDES", { size: 17, font: FONT_DISPLAY, weight: 700, fill: t.fg, anchor: "middle", spacing: 4 });
  out += `<line x1="${cx - 66}" y1="46" x2="${cx + 66}" y2="46" stroke="${t.rule}" stroke-width="1"/>`;

  const nameSize = fitSize(config.display_name, w - 30, compact ? 40 : 46);
  const nameY = compact ? 96 : 112;
  out += text(cx, nameY, config.display_name, { size: nameSize, font: FONT_DISPLAY, weight: 800, fill: t.fg, anchor: "middle", spacing: 1 });
  out += text(cx, nameY + (compact ? 34 : 40), config.quantity_label, { size: compact ? 26 : 30, font: FONT_BODY, weight: 600, fill: t.accent, anchor: "middle", spacing: 1.5 });

  const matY = nameY + (compact ? 60 : 70);
  out += text(cx, matY, (config.material_type || "RESEARCH MATERIAL").toUpperCase(), { size: 10.5, weight: 600, fill: t.fgMuted, anchor: "middle", spacing: 2.2 });

  // Compact primary RUO warning (front face must carry it independently).
  const warnY = h - (compact ? 42 : 52);
  out += `<line x1="${cx - (w / 2 - 22)}" y1="${warnY - 14}" x2="${cx + (w / 2 - 22)}" y2="${warnY - 14}" stroke="${t.warnRule}" stroke-width="1.1"/>`;
  out += text(cx, warnY, "FOR RESEARCH USE ONLY", { size: 12, weight: 700, fill: t.warnFg, anchor: "middle", spacing: 1.2 });
  out += text(cx, warnY + 15.5, "NOT FOR HUMAN OR VETERINARY USE", { size: 10.5, weight: 600, fill: t.warnFg, anchor: "middle", spacing: 0.8 });

  out += text(cx, h - 12, `CAT ${config.sku || "—"}`, { size: 9.5, font: FONT_MONO, weight: 500, fill: t.fgMuted, anchor: "middle", spacing: 1 });

  // Family accent chip (one subtle differentiator; name stays dominant).
  out += `<rect x="${cx - 14}" y="${matY + 8}" width="28" height="3" rx="1.5" fill="${t.accent}"/>`;
  return out;
}

// Left panel: full warnings + storage + composition/net contents + site.
function infoPanel(t, config, { x, w, h }) {
  let out = "";
  let y = 34;
  out += warningsBlock(t, { x: x + 4, y, width: w - 14 });
  y += 4 * 16.5 + 12;

  out += text(x + 4, y, "STORAGE", { size: 10, weight: 600, fill: t.fgMuted, spacing: 1.6 });
  out += text(x + 4, y + 15, storageLineFor(config), { size: 10.5, fill: t.fg });
  y += 34;

  const isBlend = Array.isArray(config.composition) || /blend/i.test(config.material_type || "") || /blend/i.test(config.display_name || "");
  if (isBlend) {
    const cb = compositionBlock(t, config, { x: x + 4, y, width: w - 14 });
    out += cb.svg;
    y += cb.height + 10;
  }
  if (config.net_contents) {
    out += text(x + 4, y, `Net contents: ${config.net_contents}`, { size: 10.5, fill: t.fg });
    y += 16;
  }
  if ((config.material_type || "").toLowerCase().includes("lyophilized")) {
    out += text(x + 4, Math.min(y + 4, h - 34), RECONSTITUTION_NOTE, { size: 8.2, fill: t.fgMuted, opacity: 0.9 });
  }
  out += text(x + 4, h - 12, "noirpeptides.com", { size: 10, font: FONT_MONO, weight: 500, fill: t.fgMuted, spacing: 0.8 });
  return out;
}

// Right panel: LOT/EXP block, QR (verification deep link), ladder barcode.
async function idPanel(t, config, { x, w, h, siteUrl }) {
  let out = "";
  const lot = config.lot_number || "LOT PENDING";
  const exp = expiryLine(config) || "DATE PENDING";
  out += text(x + 6, 30, "LOT", { size: 9, weight: 600, fill: t.fgMuted, spacing: 1.6 });
  out += text(x + 6, 46, lot, { size: 12.5, font: FONT_MONO, weight: 600, fill: t.fg });
  out += text(x + 6, 68, exp, { size: 12, font: FONT_MONO, weight: 600, fill: t.fg });
  if (config.packaged_date) {
    out += text(x + 6, 86, `PKG ${config.packaged_date}`, { size: 9.5, font: FONT_MONO, fill: t.fgMuted });
  }

  // QR on a solid white tile, quiet zone included by the QR margin.
  const qrSize = 96;
  const qrX = x + 6;
  const qrY = h - qrSize - 44;
  const code = config.verification_code || "";
  const url = code ? `${siteUrl}/v/${code}` : `${siteUrl}/verify-lot`;
  out += `<rect x="${qrX - 4}" y="${qrY - 4}" width="${qrSize + 8}" height="${qrSize + 8}" rx="4" fill="${t.tileBg}"/>`;
  out += await qrSvg(url, { x: qrX, y: qrY, size: qrSize, dark: t.tileFg });
  out += text(qrX + qrSize / 2, h - 28, "SCAN TO VERIFY", { size: 8.5, weight: 600, fill: t.fgMuted, anchor: "middle", spacing: 1.4 });
  if (code) {
    out += text(qrX + qrSize / 2, h - 14, code, { size: 8.5, font: FONT_MONO, fill: t.fgMuted, anchor: "middle", spacing: 0.6 });
  }

  // Ladder barcode along the panel's right edge (human-readable beside it).
  const bcX = x + w - 62;
  const bc = barcodeLadder(config.barcode_value, t, { x: bcX, y: 22, w: 54, h: h - 60 });
  out += bc;
  if (bc && config.barcode_value) {
    out += `<text x="${bcX - 6}" y="${h - 44}" font-family="${FONT_MONO}" font-size="8.5" font-weight="500" fill="${t.fgMuted}" text-anchor="start" transform="rotate(-90 ${bcX - 6} ${h - 44})">${esc(config.barcode_value)}</text>`;
  }
  return out;
}

/* ── Preset layouts ─────────────────────────────────────────────────────── */

async function layoutFullWrap(t, config, geom, siteUrl) {
  const { W, H, overlapU } = geom;
  const leftW = 235;
  const rightX = 485;
  let body = "";
  body += infoPanel(t, config, { x: 16, w: leftW - 24, h: H });
  body += `<line x1="${leftW}" y1="16" x2="${leftW}" y2="${H - 16}" stroke="${t.rule}" stroke-width="1"/>`;
  body += frontPanel(t, config, { x: leftW, w: rightX - leftW, h: H });
  body += `<line x1="${rightX}" y1="16" x2="${rightX}" y2="${H - 16}" stroke="${t.rule}" stroke-width="1"/>`;
  body += await idPanel(t, config, { x: rightX + 6, w: W - overlapU - rightX - 12, h: H, siteUrl });
  return body;
}

async function layoutPartial(t, config, geom, siteUrl) {
  const { W, H } = geom;
  const split = Math.round(W * 0.6);
  let body = "";
  body += frontPanel(t, config, { x: 0, w: split, h: H });
  body += `<line x1="${split}" y1="16" x2="${split}" y2="${H - 16}" stroke="${t.rule}" stroke-width="1"/>`;
  body += await idPanel(t, config, { x: split + 6, w: W - split - 12, h: H, siteUrl });
  return body;
}

async function layoutFront(t, config, geom, siteUrl) {
  const { W, H } = geom;
  let body = frontPanel(t, config, { x: 0, w: W, h: H, compact: true });
  // Micro QR in the corner so even a front-only label verifies.
  const code = config.verification_code || "";
  if (code) {
    const s = 54;
    body += `<rect x="${W - s - 12}" y="10" width="${s + 8}" height="${s + 8}" rx="3" fill="${t.tileBg}"/>`;
    body += await qrSvg(`${siteUrl}/v/${code}`, { x: W - s - 8, y: 14, size: s, dark: t.tileFg });
  }
  return body;
}

function layoutNeck(t, config, geom) {
  const { W, H } = geom;
  let body = "";
  body += text(14, H / 2 + 5, "NOIR · PEPTIDES", { size: 13, font: FONT_DISPLAY, weight: 700, fill: t.fg, spacing: 2.4 });
  body += text(W / 2, H / 2 + 5, RUO_PRIMARY_WARNING, { size: 9.5, weight: 600, fill: t.warnFg, anchor: "middle", spacing: 0.6 });
  body += text(W - 14, H / 2 + 5, config.lot_number || "LOT PENDING", { size: 10, font: FONT_MONO, weight: 600, fill: t.fg, anchor: "end" });
  return body;
}

function layoutCap(t, config, geom) {
  const { W, H } = geom;
  const cx = W / 2;
  let body = `<clipPath id="np-cap"><circle cx="${cx}" cy="${H / 2}" r="${W / 2 - 2}"/></clipPath>`;
  body += `<g clip-path="url(#np-cap)">`;
  body += `<circle cx="${cx}" cy="${H / 2}" r="${W / 2 - 2}" fill="${t.panel}" stroke="${t.rule}" stroke-width="1.5"/>`;
  body += text(cx, 62, "NOIR", { size: 15, font: FONT_DISPLAY, weight: 700, fill: t.fgMuted, anchor: "middle", spacing: 2.5 });
  const nameSize = fitSize(config.display_name, W - 46, 26, { floor: 13 });
  body += text(cx, 102, config.display_name, { size: nameSize, font: FONT_DISPLAY, weight: 800, fill: t.fg, anchor: "middle" });
  body += text(cx, 130, config.quantity_label, { size: 18, weight: 600, fill: t.accent, anchor: "middle" });
  body += text(cx, 158, "RESEARCH USE ONLY", { size: 8.5, weight: 700, fill: t.warnFg, anchor: "middle", spacing: 1 });
  body += `</g>`;
  return body;
}

/* ── Entry point ────────────────────────────────────────────────────────── */

/**
 * Render a label config to an SVG string.
 * @param {import('./types.js').ProductLabelConfig} config
 * @param {{templateId?: string, presetId?: string, siteUrl?: string, showGuides?: boolean}} opts
 * @returns {Promise<string>}
 */
export async function renderLabelSvg(config, opts = {}) {
  const templateId = opts.templateId || config.template_id || "noir-clinical-core";
  const presetId = opts.presetId || config.default_preset || "full_wrap";
  const t = TEMPLATES[templateId];
  if (!t) throw new Error(`renderLabelSvg: unknown template "${templateId}"`);
  const preset = LABEL_PRESETS[presetId];
  if (!preset) throw new Error(`renderLabelSvg: unknown preset "${presetId}"`);
  const siteUrl = (opts.siteUrl || "https://www.noirpeptides.com").replace(/\/+$/, "");

  const W = Math.round(preset.widthMm * 10);
  const H = Math.round(preset.heightMm * 10);
  const overlapU = Math.round(preset.overlapMm * 10);
  const geom = { W, H, overlapU };

  let body;
  switch (presetId) {
    case "full_wrap": body = await layoutFullWrap(t, config, geom, siteUrl); break;
    case "partial": body = await layoutPartial(t, config, geom, siteUrl); break;
    case "front": body = await layoutFront(t, config, geom, siteUrl); break;
    case "neck": body = layoutNeck(t, config, geom); break;
    case "cap": body = layoutCap(t, config, geom); break;
    default: body = await layoutFront(t, config, geom, siteUrl);
  }

  const guides = opts.showGuides
    ? `<g fill="none" stroke-dasharray="6 5" opacity="0.6">` +
      `<rect x="${preset.safeMm * 10}" y="${preset.safeMm * 10}" width="${W - preset.safeMm * 20}" height="${H - preset.safeMm * 20}" stroke="#39c2ff" stroke-width="1"/>` +
      (overlapU ? `<line x1="${W - overlapU}" y1="0" x2="${W - overlapU}" y2="${H}" stroke="#ffb020" stroke-width="1.5"/>` : "") +
      `</g>`
    : "";

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(
      `${config.display_name} ${config.quantity_label} research label`
    )}">` +
    `<defs>${t.defs(W, H)}</defs>` +
    `<rect x="0" y="0" width="${W}" height="${H}" fill="${t.bg}"/>` +
    (presetId !== "cap" ? t.decorate(W, H) : "") +
    body +
    guides +
    `</svg>`
  );
}
