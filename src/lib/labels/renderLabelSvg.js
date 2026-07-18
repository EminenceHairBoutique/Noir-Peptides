// src/lib/labels/renderLabelSvg.js
// Pure, Node-safe, ASYNC label layout engine. ONE layout — matched to the
// owner-approved reference mockup (2026-07-18) — with four template skins.
// Emits an SVG string used by: the studio's flat preview (inline DOM), the
// print/PNG/PDF export, and the 3D vial texture (via rasterize.js) — one
// source, zero drift between screen, print, and 3D.
//
// COMPLIANCE INVARIANTS (unit-tested):
//   * RUO warnings render on EVERY preset from lib/labelConstants (never from
//     row data, never omitted).
//   * Storage text renders ONLY when storage_source_verified; otherwise the
//     safe placeholder.
//   * Blend composition renders ONLY owner-entered quantities; otherwise the
//     "pending administrative input" placeholder. Nothing is invented.
//   * No dosing/administration language anywhere.
//   * Lot/MFG/EXP left blank render as ruled fill-in lines — never invented.
//
// Geometry: viewBox units = mm × 10 (full_wrap 72×30 mm → 720×300). The
// trailing wrap-overlap zone stays free of critical content. QR + barcode sit
// on solid white tiles (never on gradients/patterns) with quiet zones.
// Node-safety: no window/document; QR via qrcode.toString (works in Node).

import QRCode from "qrcode";
import { COMPOSITION_PENDING_PLACEHOLDER } from "../../../lib/labelConstants.js";
import { LABEL_PRESETS } from "./presets.js";
import { storageLineFor } from "./storage.js";
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
      so estimates OVERSHOOT and text never crosses a panel rule) ──────────── */

const AVG = { display: 0.66, body: 0.56, mono: 0.62 };

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
 * balanced two-line wrap (reference: "CJC-1295 +" / "Ipamorelin Blend").
 */
function fitTitle(name, maxWidth, { base = 34, floor = 15, twoLineThreshold = 25 } = {}) {
  const s = String(name || "").trim();
  const one = sizeFor(s, maxWidth, base, AVG.display);
  const canSplit = /\s/.test(s);
  if (one >= twoLineThreshold || !canSplit) {
    return { lines: [s], size: Math.max(one, floor), leading: 0 };
  }
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
    return { lines: best.lines, size, leading: size * 1.14 };
  }
  return { lines: [s], size: Math.max(one, floor), leading: 0 };
}

/* ── Brand + ornament elements (per the reference mockup) ───────────────── */

function hexPoints(cx, cy, r) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 180) * (60 * i - 30);
    pts.push(`${(cx + r * Math.sin(a)).toFixed(1)},${(cy - r * Math.cos(a)).toFixed(1)}`);
  }
  return pts.join(" ");
}

/** Hexagon "NP" monogram with flanking line ornaments. */
function monogramRow(t, uid, { cx, cy, r = 14, flank = true, flankLen = 52 }) {
  const m = t.monogram(uid);
  let out =
    `<polygon points="${hexPoints(cx, cy, r)}" fill="${m.fill}" stroke="${m.stroke}" stroke-width="1.6"/>` +
    text(cx, cy + r * 0.32, "NP", { size: r * 0.74, font: FONT_BODY, weight: 800, fill: m.fg, anchor: "middle", spacing: 0.5 });
  if (flank) {
    const gap = r + 14;
    for (const s of [-1, 1]) {
      const x1 = cx + s * gap;
      const x2 = cx + s * (gap + flankLen);
      out += `<line x1="${x1}" y1="${cy}" x2="${x2}" y2="${cy}" stroke="${t.rule}" stroke-width="1"/>`;
      out += `<rect x="${x1 + s * 4 - 3}" y="${cy - 3}" width="6" height="6" transform="rotate(45 ${x1 + s * 4} ${cy})" fill="${t.rule}"/>`;
    }
  }
  return out;
}

/** Faint ECG-style trace (bottom-right of the display panel). */
function waveform(t, { x, y, w }) {
  const seg = w / 10;
  const d =
    `M${x} ${y} h${seg * 2.4} l${seg * 0.35} -7 l${seg * 0.5} 14 l${seg * 0.35} -7 h${seg * 1.6} ` +
    `l${seg * 0.3} -4 l${seg * 0.4} 8 l${seg * 0.3} -4 h${seg * 3.7}`;
  return `<path d="${d}" fill="none" stroke="${t.fgMuted}" stroke-width="1" opacity="0.35"/>`;
}

/** Small line icons for the info sections (snowflake / molecule). */
function iconSnowflake(t, x, y, s = 11) {
  const c = s / 2;
  let out = "";
  for (const a of [0, 60, 120]) {
    out += `<line x1="${-c}" y1="0" x2="${c}" y2="0" transform="translate(${x + c},${y + c}) rotate(${a})" stroke="${t.accent}" stroke-width="1.2"/>`;
  }
  return `<g opacity="0.9">${out}</g>`;
}

function iconMolecule(t, x, y, s = 11) {
  const r = s / 5;
  const p = [
    [x + r, y + s - r],
    [x + s / 2, y + r],
    [x + s - r, y + s * 0.62],
  ];
  let out = `<path d="M${p[0][0]} ${p[0][1]} L${p[1][0]} ${p[1][1]} L${p[2][0]} ${p[2][1]}" fill="none" stroke="${t.accent}" stroke-width="1.1"/>`;
  for (const [px, py] of p) out += `<circle cx="${px}" cy="${py}" r="${r}" fill="${t.accent}"/>`;
  return `<g opacity="0.9">${out}</g>`;
}

/* ── Machine-readable elements ──────────────────────────────────────────── */

// Nested, namespace-safe QR: unwrap qrcode's root <svg> and re-embed.
// errorCorrectionLevel H so the small NP center mark never breaks scans.
async function qrSvg(value, { x, y, size, dark = "#0b0d12" }) {
  const raw = await QRCode.toString(String(value), {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 2, // quiet zone in modules
    color: { dark, light: "#ffffff" },
  });
  const vb = /viewBox="([^"]+)"/.exec(raw)?.[1] || "0 0 33 33";
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  let out = `<svg x="${x}" y="${y}" width="${size}" height="${size}" viewBox="${vb}">${inner}</svg>`;
  // Center NP mark (~20% coverage — well inside EC-H's 30% tolerance).
  const m = size * 0.2;
  out += `<rect x="${x + size / 2 - m / 2 - 1.5}" y="${y + size / 2 - m / 2 - 1.5}" width="${m + 3}" height="${m + 3}" rx="2" fill="#ffffff"/>`;
  out += `<rect x="${x + size / 2 - m / 2}" y="${y + size / 2 - m / 2}" width="${m}" height="${m}" rx="2" fill="${dark}"/>`;
  out += text(x + size / 2, y + size / 2 + m * 0.18, "NP", { size: m * 0.52, weight: 800, fill: "#ffffff", anchor: "middle" });
  return out;
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
  const quiet = h * 0.08;
  const len = h - quiet * 2;
  const scaleX = len / bars.totalModules;
  const barLen = w - 10;
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${t.tileBg}"/>` +
    `<g transform="translate(${x + 5},${y + quiet + len}) rotate(-90) scale(${scaleX},${barLen / 10})">${bars.svg}</g>`
  );
}

/* ── Shared display-panel pieces ────────────────────────────────────────── */

const fmtDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? `${m[2]}/${m[3]}/${m[1]}` : "";
};

/** CAT pill chip: [ CAT ] value — outlined, centered. */
function catChip(t, { cx, y, sku }) {
  const value = sku || "—";
  const valueW = estWidth(value, 10.5, AVG.mono);
  const catW = 34;
  const gap = 8;
  const padX = 12;
  const w = padX * 2 + catW + gap + valueW;
  const x = cx - w / 2;
  return (
    `<rect x="${x}" y="${y}" width="${w}" height="21" rx="10.5" fill="none" stroke="${t.rule}" stroke-width="1"/>` +
    `<rect x="${x + 5}" y="${y + 3.5}" width="${catW}" height="14" rx="7" fill="none" stroke="${t.rule}" stroke-width="0.8"/>` +
    text(x + 5 + catW / 2, y + 13.6, "CAT", { size: 7.5, weight: 700, fill: t.fgMuted, anchor: "middle", spacing: 1.2 }) +
    text(x + padX + catW + gap - 4, y + 14.6, value, { size: 10.5, font: FONT_MONO, weight: 600, fill: t.fg })
  );
}

/**
 * Center display panel per the reference: NOIR PEPTIDES → NP hexagon with
 * ornaments → product name → quantity on gradient band → material line →
 * CAT chip (+ RUO line when this panel must carry the warning itself).
 */
function displayPanel(t, config, uid, { x, w, h, compact = false, withWarning = false }) {
  const cx = x + w / 2;
  const brandFg = t.brandFg || t.fg;
  let out = "";

  out += text(cx, compact ? 32 : 40, "NOIR PEPTIDES", { size: compact ? 13 : 15.5, weight: 700, fill: brandFg, anchor: "middle", spacing: 6 });
  out += monogramRow(t, uid, { cx, cy: compact ? 60 : 72, r: compact ? 11 : 14, flankLen: compact ? 40 : 52 });

  // Name block (fixed band position; name centers in the zone above it).
  const bandY = compact ? h * 0.55 : 168;
  const bandH = compact ? 32 : 36;
  const nameTop = compact ? 78 : 96;
  const fit = fitTitle(config.display_name, w - 36, { base: compact ? 28 : 34 });
  const blockH = fit.size + (fit.lines.length - 1) * (fit.leading || 0);
  let baseline = nameTop + ((bandY - 8 - nameTop) - blockH) / 2 + fit.size * 0.82;
  fit.lines.forEach((l, i) => {
    out += text(cx, baseline + i * (fit.leading || 0), l, { size: fit.size, font: FONT_BODY, weight: 700, fill: t.fg, anchor: "middle", spacing: 0.3 });
  });

  // Quantity band (template gradient; text color from token).
  const bandW = Math.min(w - 44, compact ? 210 : 230);
  out += `<rect x="${cx - bandW / 2}" y="${bandY}" width="${bandW}" height="${bandH}" fill="url(#np-band-${uid})"/>`;
  out += text(cx, bandY + bandH / 2 + (compact ? 7.5 : 8.5), config.quantity_label, {
    size: compact ? 21 : 24,
    weight: 700,
    fill: t.bandFg,
    anchor: "middle",
    spacing: 0.5,
  });

  const lyoY = bandY + bandH + (compact ? 22 : 26);
  out += text(cx, lyoY, (config.material_type || "RESEARCH MATERIAL").toUpperCase(), {
    size: compact ? 8.5 : 9.5,
    weight: 600,
    fill: t.fgMuted,
    anchor: "middle",
    spacing: 3,
  });

  out += catChip(t, { cx, y: lyoY + (compact ? 10 : 14), sku: config.sku });

  // Presets without the info panel carry the primary RUO warning themselves.
  if (withWarning) {
    out += text(cx, h - 12, "FOR RESEARCH USE ONLY — NOT FOR HUMAN OR VETERINARY USE", {
      size: 8,
      weight: 700,
      fill: t.warnFg,
      anchor: "middle",
      spacing: 0.4,
    });
  }

  out += waveform(t, { x: cx + w * 0.06, y: h - (withWarning ? 34 : 16), w: w * 0.36 });
  return out;
}

/* ── Info panel (left): warnings / storage / composition / site ─────────── */

function infoPanel(t, config, { x, w, h }) {
  const pad = x;
  const width = w;
  const ucfirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
  let out = "";
  let y = 42;

  // RUO warnings (verbatim, from constants).
  const warnLines = ["FOR RESEARCH USE ONLY.", "NOT FOR HUMAN OR VETERINARY USE.", "NOT FOR DIAGNOSTIC, THERAPEUTIC,", "OR HOUSEHOLD USE."];
  warnLines.forEach((l, i) => {
    out += text(pad, y + i * 15.5, l, { size: 11, weight: 700, fill: t.warnFg, spacing: 0.2 });
  });
  y += 3 * 15.5 + 16;
  out += `<line x1="${pad}" y1="${y}" x2="${pad + width}" y2="${y}" stroke="${t.rule}" stroke-width="0.9"/>`;
  y += 20;

  // STORAGE (verified text or safe placeholder) + reconstitution note.
  out += iconSnowflake(t, pad, y - 9);
  out += text(pad + 18, y, "STORAGE", { size: 9, weight: 700, fill: t.fgMuted, spacing: 2 });
  y += 14;
  const storage = textBlock(pad, y, wrapLines(ucfirst(storageLineFor(config).replace(/^storage:\s*/i, "")), width, 9.5), {
    size: 9.5,
    fill: t.fg,
    leading: 12.5,
  });
  out += storage.svg;
  y += storage.height + 12.5;
  if ((config.material_type || "").toLowerCase().includes("lyophilized")) {
    const rec = textBlock(pad, y, wrapLines(RECONSTITUTION_NOTE, width, 8.6), { size: 8.6, fill: t.fgMuted, leading: 11.5 });
    out += rec.svg;
    y += rec.height + 11.5;
  }
  y += 4;
  out += `<line x1="${pad}" y1="${y}" x2="${pad + width}" y2="${y}" stroke="${t.rule}" stroke-width="0.9"/>`;
  y += 20;

  // COMPOSITION (blends only): owner-entered quantities or pending line.
  const isBlend = Array.isArray(config.composition) || /blend/i.test(config.material_type || "") || /blend/i.test(config.display_name || "");
  if (isBlend) {
    out += iconMolecule(t, pad, y - 9);
    out += text(pad + 18, y, "COMPOSITION", { size: 9, weight: 700, fill: t.fgMuted, spacing: 2 });
    y += 14;
    const comp = Array.isArray(config.composition) ? config.composition.filter((c) => c?.name) : [];
    if (!comp.length || comp.some((c) => !c.quantity)) {
      const ph = textBlock(pad, y, wrapLines(ucfirst(COMPOSITION_PENDING_PLACEHOLDER.replace(/^composition:\s*/i, "")), width, 9.5), {
        size: 9.5,
        fill: t.fgMuted,
        leading: 12.5,
      });
      out += ph.svg;
      y += ph.height + 12.5;
    } else {
      comp.slice(0, 4).forEach((c) => {
        out += text(pad, y, `${c.name} – ${c.quantity}`, { size: 9.5, fill: t.fg });
        y += 12.5;
      });
    }
  }
  if (config.net_contents && y < h - 40) {
    out += text(pad, y + 2, `Net contents: ${config.net_contents}`, { size: 9.5, fill: t.fg });
  }

  // Footer: NP mark + site (skipped only if content ran long).
  if (y < h - 30) {
    out += text(pad, h - 15, "NP", { size: 11, weight: 800, fill: t.fg, spacing: 0.5 });
    out += text(pad + 24, h - 15, "noirpeptides.com", { size: 10, font: FONT_MONO, weight: 500, fill: t.fgMuted, spacing: 0.8 });
  }
  return out;
}

/* ── Identification panel (right): LOT/MFG/EXP rows, QR, barcode ────────── */

function idRowRef(t, { x, w, y, label, value }) {
  let out = text(x, y, label, { size: 9, weight: 700, fill: t.fgMuted, spacing: 2 });
  if (value) {
    out += text(x + w, y, value, { size: 11.5, font: FONT_MONO, weight: 600, fill: t.fg, anchor: "end" });
  }
  out += `<line x1="${x}" y1="${y + 11}" x2="${x + w}" y2="${y + 11}" stroke="${t.rule}" stroke-width="1"/>`;
  return out;
}

async function idPanel(t, config, uid, { x, w, h, siteUrl }) {
  let out = "";
  const bcW = 34;
  const bcX = x + w - bcW;
  const colX = x;
  const colW = bcX - colX - 22;

  // LOT / MFG / EXP rows — right-aligned values over full-width rules; blank
  // values leave the rule as a deliberate fill-in field.
  const expValue = config.expiration_date ? fmtDate(config.expiration_date) : config.retest_date ? fmtDate(config.retest_date) : "";
  const expLabel = !config.expiration_date && config.retest_date ? "RETEST" : "EXP";
  out += idRowRef(t, { x: colX, w: colW, y: 42, label: "LOT", value: config.lot_number || "" });
  out += idRowRef(t, { x: colX, w: colW, y: 86, label: "MFG", value: fmtDate(config.packaged_date) });
  out += idRowRef(t, { x: colX, w: colW, y: 130, label: expLabel, value: expValue });

  // QR on a solid white tile with center NP mark; SCAN TO VERIFY caption.
  const qrSize = 88;
  const tilePad = 6;
  const qrX = colX + (colW - qrSize) / 2;
  const qrY = 152;
  const code = config.verification_code || "";
  const url = code ? `${siteUrl}/v/${code}` : `${siteUrl}/verify-lot`;
  out += `<rect x="${qrX - tilePad}" y="${qrY - tilePad}" width="${qrSize + tilePad * 2}" height="${qrSize + tilePad * 2}" rx="5" fill="${t.tileBg}"/>`;
  out += await qrSvg(url, { x: qrX, y: qrY, size: qrSize, dark: t.tileFg });
  out += text(colX + colW / 2, h - 26, "SCAN TO VERIFY", { size: 8.5, weight: 700, fill: t.accent, anchor: "middle", spacing: 1.6 });
  if (code) {
    out += text(colX + colW / 2, h - 13, code, { size: 8, font: FONT_MONO, weight: 500, fill: t.fg, anchor: "middle", spacing: 0.6 });
  }

  // Ladder barcode at the right edge; rotated human-readable beside it.
  const bc = barcodeLadder(config.barcode_value, t, { x: bcX, y: 34, w: bcW, h: h - 68 });
  out += bc;
  if (bc && config.barcode_value) {
    out += `<text x="${bcX - 6}" y="${h - 40}" font-family="${FONT_MONO}" font-size="8" font-weight="500" fill="${t.fgMuted}" text-anchor="start" transform="rotate(-90 ${bcX - 6} ${h - 40})">${esc(config.barcode_value)}</text>`;
  }
  return out;
}

/* ── Preset layouts ─────────────────────────────────────────────────────── */

function frame(t, uid, W, H) {
  const f = t.frame ? t.frame(uid) : t.rule;
  return `<rect x="6" y="6" width="${W - 12}" height="${H - 12}" rx="14" fill="none" stroke="${f}" stroke-width="1.6"/>`;
}

async function layoutFullWrap(t, config, uid, geom, siteUrl) {
  const { W, H, overlapU } = geom;
  const usable = W - overlapU;
  const div1 = 222;
  const div2 = 498;
  let body = frame(t, uid, usable, H);
  body += infoPanel(t, config, { x: 24, w: div1 - 44, h: H });
  body += `<line x1="${div1}" y1="22" x2="${div1}" y2="${H - 22}" stroke="${t.rule}" stroke-width="1"/>`;
  body += displayPanel(t, config, uid, { x: div1, w: div2 - div1, h: H });
  body += `<line x1="${div2}" y1="22" x2="${div2}" y2="${H - 22}" stroke="${t.rule}" stroke-width="1"/>`;
  body += await idPanel(t, config, uid, { x: div2 + 16, w: usable - div2 - 30, h: H, siteUrl });
  return body;
}

async function layoutPartial(t, config, uid, geom, siteUrl) {
  const { W, H } = geom;
  const split = Math.round(W * 0.6);
  let body = frame(t, uid, W, H);
  body += displayPanel(t, config, uid, { x: 0, w: split, h: H, withWarning: true });
  body += `<line x1="${split}" y1="22" x2="${split}" y2="${H - 22}" stroke="${t.rule}" stroke-width="1"/>`;
  body += await idPanel(t, config, uid, { x: split + 16, w: W - split - 30, h: H, siteUrl });
  return body;
}

function layoutFront(t, config, uid, geom) {
  const { W, H } = geom;
  let body = frame(t, uid, W, H);
  body += displayPanel(t, config, uid, { x: 0, w: W, h: H, compact: true, withWarning: true });
  return body;
}

function layoutNeck(t, config, geom) {
  const { W, H, overlapU } = geom;
  const usable = W - overlapU;
  let body = "";
  body += `<line x1="0" y1="2" x2="${W}" y2="2" stroke="${t.rule}" stroke-width="1"/>`;
  body += `<line x1="0" y1="${H - 2}" x2="${W}" y2="${H - 2}" stroke="${t.rule}" stroke-width="1"/>`;
  body += text(14, H / 2 + 4.5, "NOIR PEPTIDES", { size: 12, weight: 700, fill: t.fg, spacing: 2.6 });
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
  body += monogramRow(t, uid, { cx, cy: 52, r: 13, flank: false });
  body += text(cx, 84, "NOIR PEPTIDES", { size: 9, weight: 700, fill: t.brandFg || t.fgMuted, anchor: "middle", spacing: 1.8 });
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
    case "front": body = layoutFront(t, config, uid, geom); break;
    case "neck": body = layoutNeck(t, config, geom); break;
    case "cap": body = layoutCap(t, config, uid, geom); break;
    default: body = layoutFront(t, config, uid, geom);
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
