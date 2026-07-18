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
//   * Lot/expiry left blank render as ruled fill-in lines — never invented.
//
// Geometry: viewBox units = mm × 10 (full_wrap 72×30 mm → 720×300). The
// trailing wrap-overlap zone stays free of critical content. QR + barcode sit
// on solid white tiles (never on gradients/patterns) with quiet zones.
// Node-safety: no window/document; QR via qrcode.toString (works in Node).

import QRCode from "qrcode";
import { COMPOSITION_PENDING_PLACEHOLDER } from "../../../lib/labelConstants.js";
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

// Unique per-render id prefix so several inline SVGs never collide in one DOM.
let uidCounter = 0;

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

/* ── Fit + wrap helpers (estimate-based; factors deliberately conservative
      so estimates OVERSHOOT and text never spills its panel) ──────────────── */

const AVG = { display: 0.72, body: 0.56, mono: 0.62 };

function estWidth(str, size, avg) {
  return String(str || "").length * size * avg;
}

/** Largest size ≤ base at which str fits maxWidth. */
function sizeFor(str, maxWidth, base, avg) {
  const len = Math.max(1, String(str || "").length);
  return Math.min(base, maxWidth / (len * avg));
}

/** Word-wrap into lines that each fit maxWidth at the given size. */
function wrapLines(str, maxWidth, size, avg = AVG.body) {
  const words = String(str || "").trim().split(/\s+/).filter(Boolean);
  const maxChars = Math.max(4, Math.floor(maxWidth / (size * avg)));
  const lines = [];
  let cur = "";
  for (const w of words) {
    const cand = cur ? `${cur} ${w}` : w;
    if (cand.length > maxChars && cur) {
      lines.push(cur);
      cur = w;
    } else cur = cand;
  }
  if (cur) lines.push(cur);
  return lines;
}

function textBlock(x, y, lines, { size = 10, leading, font = FONT_BODY, weight = 400, fill, anchor = "start", spacing = 0, opacity = 1 } = {}) {
  const lh = leading || size * 1.35;
  let out = "";
  lines.forEach((l, i) => {
    out += text(x, y + i * lh, l, { size, font, weight, fill, anchor, spacing, opacity });
  });
  return { svg: out, height: lines.length ? (lines.length - 1) * lh : 0, leading: lh };
}

/**
 * Auto-fit a product name: single line when it stays large enough, otherwise
 * balanced two-line wrap. Returns {lines, size, leading}.
 */
function fitTitle(name, maxWidth, { base = 40, floor = 16, twoLineThreshold = 27 } = {}) {
  const s = String(name || "").trim();
  const one = sizeFor(s, maxWidth, base, AVG.display);
  const canSplit = /\s|\+/.test(s);
  if (one >= twoLineThreshold || !canSplit) {
    return { lines: [s], size: Math.max(one, floor), leading: 0 };
  }
  // Balanced split nearest the middle (split at spaces; keep "+" with left).
  const words = s.split(/\s+/);
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const size = Math.min(sizeFor(a, maxWidth, base, AVG.display), sizeFor(b, maxWidth, base, AVG.display));
    if (!best || size > best.size) best = { lines: [a, b], size };
  }
  if (best && best.size > one) {
    const size = Math.max(best.size, floor);
    return { lines: best.lines, size, leading: size * 1.16 };
  }
  return { lines: [s], size: Math.max(one, floor), leading: 0 };
}

/* ── Brand elements ─────────────────────────────────────────────────────── */

/** Gently arched brand name over an invisible arc path. */
function brandArc(t, uid, { cx, y, halfWidth = 92, rise = 20, size = 13, fill }) {
  const id = `np-arc-${uid}`;
  return (
    `<path id="${id}" d="M ${cx - halfWidth} ${y} Q ${cx} ${y - rise} ${cx + halfWidth} ${y}" fill="none"/>` +
    `<text font-family="${FONT_DISPLAY}" font-size="${size}" font-weight="700" fill="${fill}" letter-spacing="3.2">` +
    `<textPath href="#${id}" xlink:href="#${id}" startOffset="50%" text-anchor="middle">NOIR PEPTIDES</textPath></text>`
  );
}

function hexPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(cx + r * Math.sin(a)).toFixed(1)},${(cy - r * Math.cos(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

/** Hexagon "NP" monogram (geometric placeholder until an owner logo exists). */
function monogram(t, uid, { cx, cy, r = 15 }) {
  const m = t.monogram(uid);
  return (
    `<polygon points="${hexPoints(cx, cy, r)}" fill="${m.fill}" stroke="${m.stroke}" stroke-width="1.6"/>` +
    text(cx, cy + r * 0.32, "NP", { size: r * 0.72, font: FONT_DISPLAY, weight: 800, fill: m.fg, anchor: "middle", spacing: 0.5 })
  );
}

/* ── Machine-readable elements ──────────────────────────────────────────── */

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
  // the vertical tile. Scale length to tile height minus quiet zones.
  const quiet = h * 0.08;
  const len = h - quiet * 2;
  const scaleX = len / bars.totalModules;
  const barLen = w - 12;
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${t.tileBg}" stroke="${t.rule}" stroke-width="0.8"/>` +
    `<g transform="translate(${x + 6},${y + quiet + len}) rotate(-90) scale(${scaleX},${barLen / 10})">${bars.svg}</g>`
  );
}

/* ── Content blocks ─────────────────────────────────────────────────────── */

function warningsBlock(t, { x, y, width, size = 11.5, leading = 16, includeSecondary = true }) {
  const lines = ["FOR RESEARCH USE ONLY.", "NOT FOR HUMAN OR VETERINARY USE."];
  if (includeSecondary) lines.push("NOT FOR DIAGNOSTIC, THERAPEUTIC,", "OR HOUSEHOLD USE.");
  let out = `<line x1="${x}" y1="${y - 13}" x2="${x + width}" y2="${y - 13}" stroke="${t.warnRule}" stroke-width="1.2"/>`;
  lines.forEach((l, i) => {
    out += text(x, y + i * leading, l, { size, font: FONT_BODY, weight: 700, fill: t.warnFg, spacing: 0.3 });
  });
  const bottom = y + (lines.length - 1) * leading + 9;
  out += `<line x1="${x}" y1="${bottom}" x2="${x + width}" y2="${bottom}" stroke="${t.warnRule}" stroke-width="1.2"/>`;
  return { svg: out, bottom };
}

function sectionHeader(t, x, y, label) {
  return text(x, y, label, { size: 8.5, weight: 700, fill: t.fgMuted, spacing: 2 });
}

/* ── Panels ─────────────────────────────────────────────────────────────── */

// Center display panel (also the whole "front" preset).
function frontPanel(t, config, uid, { x, w, h, compact = false }) {
  const cx = x + w / 2;
  const brandFill = t.brandFill ? t.brandFill(uid) : t.fg;
  let out = "";

  // Arched brand + monogram.
  out += brandArc(t, uid, { cx, y: compact ? 40 : 44, halfWidth: compact ? 84 : 94, rise: compact ? 16 : 20, size: compact ? 12.5 : 13.5, fill: brandFill });
  if (!compact) out += monogram(t, uid, { cx, cy: 72, r: 14 });

  // Product name (auto-fit, up to two balanced lines).
  const fit = fitTitle(config.display_name, w - 28, { base: compact ? 32 : 38 });
  const nameTop = compact ? 96 : 118;
  let baseline = nameTop + fit.size * 0.36;
  fit.lines.forEach((l, i) => {
    out += text(cx, baseline + i * (fit.leading || 0), l, { size: fit.size, font: FONT_BODY, weight: 700, fill: t.fg, anchor: "middle", spacing: 0.4 });
  });
  const nameBottom = baseline + (fit.lines.length - 1) * (fit.leading || 0);

  // Quantity + material.
  const qtyY = nameBottom + (compact ? 30 : 34);
  out += text(cx, qtyY, config.quantity_label, { size: compact ? 22 : 25, font: FONT_BODY, weight: 600, fill: t.accent, anchor: "middle", spacing: 1 });
  out += text(cx, qtyY + (compact ? 20 : 23), (config.material_type || "RESEARCH MATERIAL").toUpperCase(), {
    size: 9,
    weight: 600,
    fill: t.fgMuted,
    anchor: "middle",
    spacing: 2,
  });

  // Primary RUO warning anchored to the bottom (front face carries it
  // independently of the info panel).
  const ruleHalf = w / 2 - 24;
  const warnRuleY = h - (compact ? 62 : 68);
  out += `<line x1="${cx - ruleHalf}" y1="${warnRuleY}" x2="${cx + ruleHalf}" y2="${warnRuleY}" stroke="${t.warnRule}" stroke-width="1.1"/>`;
  out += text(cx, warnRuleY + 19, "FOR RESEARCH USE ONLY", { size: 11.5, weight: 700, fill: t.warnFg, anchor: "middle", spacing: 1.2 });
  out += text(cx, warnRuleY + 35, "NOT FOR HUMAN OR VETERINARY USE", { size: 9.5, weight: 600, fill: t.warnFg, anchor: "middle", spacing: 0.6 });

  out += text(cx, h - 13, `CAT ${config.sku || "—"}`, { size: 9, font: FONT_MONO, weight: 500, fill: t.fgMuted, anchor: "middle", spacing: 1.2 });
  return out;
}

// Left panel: full warnings + storage + composition + microtext + site.
function infoPanel(t, config, { x, w, h }) {
  const pad = x + 4;
  const width = w - 8;
  let out = "";
  let y = 42;

  const wb = warningsBlock(t, { x: pad, y, width });
  out += wb.svg;
  y = wb.bottom + 26;

  // The section header names the field, so a leading "Storage:" is redundant.
  const ucfirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  const storageText = ucfirst(storageLineFor(config).replace(/^storage:\s*/i, ""));
  out += sectionHeader(t, pad, y, "STORAGE");
  const storage = textBlock(pad, y + 15, wrapLines(storageText, width, 10), { size: 10, fill: t.fg, leading: 13.5 });
  out += storage.svg;
  y += 15 + storage.height + 24;

  const isBlend = Array.isArray(config.composition) || /blend/i.test(config.material_type || "") || /blend/i.test(config.display_name || "");
  if (isBlend) {
    out += sectionHeader(t, pad, y, "COMPOSITION");
    const comp = Array.isArray(config.composition) ? config.composition.filter((c) => c?.name) : [];
    if (!comp.length || comp.some((c) => !c.quantity)) {
      const pending = ucfirst(COMPOSITION_PENDING_PLACEHOLDER.replace(/^composition:\s*/i, ""));
      const ph = textBlock(pad, y + 15, wrapLines(pending, width, 10), { size: 10, fill: t.fgMuted, leading: 13.5, opacity: 0.95 });
      out += ph.svg;
      y += 15 + ph.height + 24;
    } else {
      comp.slice(0, 4).forEach((c, i) => {
        out += text(pad, y + 15 + i * 14, `${c.name} — ${c.quantity}`, { size: 10.5, fill: t.fg });
      });
      y += 15 + comp.slice(0, 4).length * 14 + 12;
    }
  }
  if (config.net_contents) {
    out += text(pad, y, `Net contents: ${config.net_contents}`, { size: 10, fill: t.fg });
    y += 16;
  }

  // Reconstitution microtext, wrapped, pinned above the footer.
  if ((config.material_type || "").toLowerCase().includes("lyophilized")) {
    const microLines = wrapLines(RECONSTITUTION_NOTE, width, 7.6);
    const microTop = h - 34 - (microLines.length - 1) * 10;
    out += textBlock(pad, microTop, microLines, { size: 7.6, fill: t.fgMuted, leading: 10, opacity: 0.9 }).svg;
  }

  out += `<line x1="${pad}" y1="${h - 26}" x2="${pad + width}" y2="${h - 26}" stroke="${t.rule}" stroke-width="0.8"/>`;
  out += text(pad, h - 11, "noirpeptides.com", { size: 9.5, font: FONT_MONO, weight: 500, fill: t.fgMuted, spacing: 0.8 });
  return out;
}

// One labelled identification row; blank values render a fill-in rule so the
// printed label reads as a deliberate field, never a placeholder word.
function idRow(t, x, y, label, value, lineW) {
  let out = text(x, y, label, { size: 8, weight: 700, fill: t.fgMuted, spacing: 2 });
  if (value) {
    out += text(x, y + 17, value, { size: 12, font: FONT_MONO, weight: 600, fill: t.fg });
  } else {
    out += `<line x1="${x}" y1="${y + 19}" x2="${x + lineW}" y2="${y + 19}" stroke="${t.rule}" stroke-width="1"/>`;
  }
  return out;
}

// Right panel: LOT/EXP rows, QR (verification deep link), ladder barcode.
async function idPanel(t, config, uid, { x, w, h, siteUrl }) {
  let out = "";
  const colX = x + 8;
  const bcW = 50;
  const bcX = x + w - bcW - 2;
  const colW = bcX - colX - 14; // identification column width

  const expFull = expiryLine(config); // "EXP YYYY-MM" | "RETEST YYYY-MM" | ""
  const expLabel = expFull ? expFull.split(" ")[0] : "EXP";
  const expValue = expFull ? expFull.slice(expLabel.length + 1) : "";

  out += idRow(t, colX, 30, "LOT", config.lot_number || "", Math.min(colW, 104));
  out += idRow(t, colX, 74, expLabel, expValue, Math.min(colW, 104));
  if (config.packaged_date) {
    out += text(colX, 112, `PKG ${config.packaged_date}`, { size: 8.5, font: FONT_MONO, fill: t.fgMuted });
  }

  // QR on a solid white tile (quiet zone from the QR margin), bottom-aligned.
  const qrSize = 92;
  const tilePad = 5;
  const qrX = colX;
  const qrY = h - qrSize - 52;
  const code = config.verification_code || "";
  const url = code ? `${siteUrl}/v/${code}` : `${siteUrl}/verify-lot`;
  out += `<rect x="${qrX - tilePad}" y="${qrY - tilePad}" width="${qrSize + tilePad * 2}" height="${qrSize + tilePad * 2}" rx="4" fill="${t.tileBg}" stroke="${t.rule}" stroke-width="0.8"/>`;
  out += await qrSvg(url, { x: qrX, y: qrY, size: qrSize, dark: t.tileFg });
  out += text(qrX + qrSize / 2, h - 30, "SCAN TO VERIFY", { size: 8, weight: 700, fill: t.fgMuted, anchor: "middle", spacing: 1.6 });
  if (code) {
    out += text(qrX + qrSize / 2, h - 16, code, { size: 8, font: FONT_MONO, fill: t.fgMuted, anchor: "middle", spacing: 0.6 });
  }

  // Ladder barcode along the panel's right edge (human-readable beside it).
  const bc = barcodeLadder(config.barcode_value, t, { x: bcX, y: 24, w: bcW, h: h - 48 });
  out += bc;
  if (bc && config.barcode_value) {
    out += `<text x="${bcX - 7}" y="${h - 52}" font-family="${FONT_MONO}" font-size="8" font-weight="500" fill="${t.fgMuted}" text-anchor="start" transform="rotate(-90 ${bcX - 7} ${h - 52})">${esc(config.barcode_value)}</text>`;
  }
  return out;
}

/* ── Preset layouts ─────────────────────────────────────────────────────── */

async function layoutFullWrap(t, config, uid, geom, siteUrl) {
  const { W, H, overlapU } = geom;
  const usable = W - overlapU;
  const leftW = 224;
  const rightX = 478;
  let body = "";
  body += infoPanel(t, config, { x: 14, w: leftW - 22, h: H });
  body += `<line x1="${leftW}" y1="18" x2="${leftW}" y2="${H - 18}" stroke="${t.rule}" stroke-width="1"/>`;
  body += frontPanel(t, config, uid, { x: leftW, w: rightX - leftW, h: H });
  body += `<line x1="${rightX}" y1="18" x2="${rightX}" y2="${H - 18}" stroke="${t.rule}" stroke-width="1"/>`;
  body += await idPanel(t, config, uid, { x: rightX + 4, w: usable - rightX - 8, h: H, siteUrl });
  return body;
}

async function layoutPartial(t, config, uid, geom, siteUrl) {
  const { W, H } = geom;
  const split = Math.round(W * 0.6);
  let body = "";
  body += frontPanel(t, config, uid, { x: 0, w: split, h: H });
  body += `<line x1="${split}" y1="18" x2="${split}" y2="${H - 18}" stroke="${t.rule}" stroke-width="1"/>`;
  body += await idPanel(t, config, uid, { x: split + 4, w: W - split - 8, h: H, siteUrl });
  return body;
}

async function layoutFront(t, config, uid, geom, siteUrl) {
  const { W, H } = geom;
  let body = frontPanel(t, config, uid, { x: 0, w: W, h: H, compact: true });
  // Micro QR in the corner so even a front-only label verifies.
  const code = config.verification_code || "";
  if (code) {
    const s = 52;
    body += `<rect x="${W - s - 16}" y="10" width="${s + 8}" height="${s + 8}" rx="3" fill="${t.tileBg}" stroke="${t.rule}" stroke-width="0.8"/>`;
    body += await qrSvg(`${siteUrl}/v/${code}`, { x: W - s - 12, y: 14, size: s, dark: t.tileFg });
  }
  return body;
}

function layoutNeck(t, config, geom) {
  const { W, H, overlapU } = geom;
  const usable = W - overlapU;
  let body = "";
  body += `<line x1="0" y1="2" x2="${W}" y2="2" stroke="${t.rule}" stroke-width="1"/>`;
  body += `<line x1="0" y1="${H - 2}" x2="${W}" y2="${H - 2}" stroke="${t.rule}" stroke-width="1"/>`;
  body += text(14, H / 2 + 4.5, "NOIR PEPTIDES", { size: 12, font: FONT_DISPLAY, weight: 700, fill: t.fg, spacing: 2.4 });
  body += text(usable / 2 + 40, H / 2 + 4.5, "FOR RESEARCH USE ONLY — NOT FOR HUMAN OR VETERINARY USE", {
    size: 8.5,
    weight: 700,
    fill: t.warnFg,
    anchor: "middle",
    spacing: 0.4,
  });
  if (config.lot_number) {
    body += text(usable - 12, H / 2 + 4.5, config.lot_number, { size: 9.5, font: FONT_MONO, weight: 600, fill: t.fg, anchor: "end" });
  } else {
    body += `<line x1="${usable - 70}" y1="${H / 2 + 6}" x2="${usable - 12}" y2="${H / 2 + 6}" stroke="${t.rule}" stroke-width="1"/>`;
  }
  return body;
}

function layoutCap(t, config, uid, geom) {
  const { W, H } = geom;
  const cx = W / 2;
  let body = `<clipPath id="np-cap-${uid}"><circle cx="${cx}" cy="${H / 2}" r="${W / 2 - 2}"/></clipPath>`;
  body += `<g clip-path="url(#np-cap-${uid})">`;
  body += `<circle cx="${cx}" cy="${H / 2}" r="${W / 2 - 2}" fill="${t.panel}" stroke="${t.rule}" stroke-width="1.5"/>`;
  body += monogram(t, uid, { cx, cy: 52, r: 13 });
  body += text(cx, 84, "NOIR PEPTIDES", { size: 9, font: FONT_DISPLAY, weight: 700, fill: t.fgMuted, anchor: "middle", spacing: 1.6 });
  const size = sizeFor(config.display_name, W - 52, 21, AVG.body);
  body += text(cx, 116, config.display_name, { size: Math.max(size, 11), font: FONT_BODY, weight: 700, fill: t.fg, anchor: "middle" });
  body += text(cx, 140, config.quantity_label, { size: 16, weight: 600, fill: t.accent, anchor: "middle" });
  body += text(cx, 164, "RESEARCH USE ONLY", { size: 8, weight: 700, fill: t.warnFg, anchor: "middle", spacing: 1 });
  body += `</g>`;
  return body;
}

/* ── Entry point ────────────────────────────────────────────────────────── */

/**
 * Render a label config to an SVG string.
 * @param {import('./types.js').ProductLabelConfig} config
 * @param {{templateId?: string, presetId?: string, siteUrl?: string, showGuides?: boolean, withBleed?: boolean}} opts
 *   withBleed extends background + decoration past trim by the preset's bleed
 *   on every side (critical content stays inside trim) — used by print exports.
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
  const uid = `u${++uidCounter}`;

  const W = Math.round(preset.widthMm * 10);
  const H = Math.round(preset.heightMm * 10);
  const overlapU = Math.round(preset.overlapMm * 10);
  const geom = { W, H, overlapU };

  let body;
  switch (presetId) {
    case "full_wrap": body = await layoutFullWrap(t, config, uid, geom, siteUrl); break;
    case "partial": body = await layoutPartial(t, config, uid, geom, siteUrl); break;
    case "front": body = await layoutFront(t, config, uid, geom, siteUrl); break;
    case "neck": body = layoutNeck(t, config, geom); break;
    case "cap": body = layoutCap(t, config, uid, geom); break;
    default: body = await layoutFront(t, config, uid, geom, siteUrl);
  }

  const guides = opts.showGuides
    ? `<g fill="none" stroke-dasharray="6 5" opacity="0.6">` +
      `<rect x="${preset.safeMm * 10}" y="${preset.safeMm * 10}" width="${W - preset.safeMm * 20}" height="${H - preset.safeMm * 20}" stroke="#39c2ff" stroke-width="1"/>` +
      (overlapU ? `<line x1="${W - overlapU}" y1="0" x2="${W - overlapU}" y2="${H}" stroke="#ffb020" stroke-width="1.5"/>` : "") +
      `</g>`
    : "";

  // Print exports render bleed: background + decoration extend past trim on
  // every side; the body (critical content) stays at trim coordinates.
  const bleedU = opts.withBleed ? Math.round(preset.bleedMm * 10) : 0;
  const outerW = W + bleedU * 2;
  const outerH = H + bleedU * 2;

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${outerW} ${outerH}" width="${outerW}" height="${outerH}" role="img" aria-label="${esc(
      `${config.display_name} ${config.quantity_label} research label`
    )}">` +
    `<defs>${t.defs(outerW, outerH, uid)}</defs>` +
    `<rect x="0" y="0" width="${outerW}" height="${outerH}" fill="${t.bg}"/>` +
    (presetId !== "cap" ? t.decorate(outerW, outerH, uid) : "") +
    `<g transform="translate(${bleedU},${bleedU})">` +
    body +
    guides +
    `</g>` +
    `</svg>`
  );
}

// Internal exports for focused unit tests.
export const _internals = { fitTitle, wrapLines, sizeFor, estWidth };
