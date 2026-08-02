// src/lib/labels/masters/renderMasterLabel.js
// Deterministic EXACT-master overlay renderer (Noir Label Engine v1 spec).
//
// The approved artwork is IMMUTABLE: the master SVG's embedded raster is
// emitted byte-for-byte unchanged. Product data is applied ONLY as a
// VARIABLE_DATA overlay: each dynamic field first covers the master's baked
// sample value with a background patch (solid match or a region sampled from
// the master itself), then draws the replacement value at the approved
// coordinates with the approved size/color/alignment. Text that cannot fit
// its bounding box — even at the field's minimum font size — REJECTS the
// render (no element is ever moved to compensate).
//
// Same output feeds studio preview, PNG/PDF export, and the 3D vial texture.
// Node-safe: master files load via fs in Node, fetch in the browser.

import QRCode from "qrcode";
import { code128Svg } from "../code128.js";
import { storageLineFor } from "../storage.js";
import { COMPOSITION_PENDING_PLACEHOLDER } from "../../../../lib/labelConstants.js";
import { masterFor } from "./registry.js";

const FONT_BODY = "'DM Sans',sans-serif";
const FONT_MONO = "'IBM Plex Mono',monospace";

// Conservative width factors so estimates overshoot (never overflow).
const AVG_BODY = 0.6;
const AVG_MONO = 0.64;

const esc = (s) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

/* ── Master loading (memoized; browser fetch / Node fs) ─────────────────── */

const masterCache = new Map();

async function loadMasterSvg(entry) {
  if (masterCache.has(entry.masterId)) return masterCache.get(entry.masterId);
  let svgText;
  if (typeof window === "undefined") {
    const { readFileSync } = await import(/* @vite-ignore */ "node:fs");
    const path = await import(/* @vite-ignore */ "node:path");
    svgText = readFileSync(path.join(globalThis.process.cwd(), "public", entry.file), "utf8");
  } else {
    const res = await fetch(entry.file);
    if (!res.ok) throw new Error(`Master artwork failed to load: ${entry.file}`);
    svgText = await res.text();
  }
  const href = /(?:xlink:)?href="(data:image\/png;base64,[^"]+)"/.exec(svgText)?.[1];
  if (!href) throw new Error(`Master artwork has no embedded raster: ${entry.file}`);
  const parsed = { dataUri: href };
  masterCache.set(entry.masterId, parsed);
  return parsed;
}

/* ── Field helpers ──────────────────────────────────────────────────────── */

class OverflowError extends Error {
  constructor(field, value) {
    super(`Label field "${field}" cannot fit "${value}" — shorten the value (nothing on the approved artwork may move).`);
    this.name = "LabelOverflowError";
    this.field = field;
  }
}

function fitOrReject(field, value, maxWidth, font, avg = AVG_BODY) {
  const len = Math.max(1, String(value || "").length);
  let size = font.size;
  while (len * size * avg > maxWidth && size > font.min) size -= 0.5;
  if (len * size * avg > maxWidth) throw new OverflowError(field, value);
  return size;
}

let patchCounter = 0;

function patchSvg(patch, box, dataUri, vb) {
  const b = patch.box || box;
  const sampleSvg = (x, y, w, h, s) =>
    `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${s.x} ${s.y} ${s.w} ${s.h}" preserveAspectRatio="none">` +
    `<image x="0" y="0" width="${vb[0]}" height="${vb[1]}" href="${dataUri}"/>` +
    `</svg>`;

  if (patch.type === "sample") {
    // Re-draw a clean region of the master, stretched to cover the target
    // area — the artwork itself supplies the background texture.
    return sampleSvg(b.x, b.y, b.w, b.h, patch.src);
  }
  if (patch.type === "tile") {
    // Repeat a clean same-width band at natural scale (keeps pattern pitch;
    // pattern x anchored to the source keeps vertical grid lines aligned).
    const s = patch.src;
    const id = `np-patch-${++patchCounter}`;
    return (
      `<pattern id="${id}" patternUnits="userSpaceOnUse" x="${s.x}" y="${b.y}" width="${s.w}" height="${s.h}">` +
      sampleSvg(0, 0, s.w, s.h, s) +
      `</pattern>` +
      `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="url(#${id})"/>`
    );
  }
  if (patch.type === "mirrorPair") {
    // Symmetric gradient reconstruction (metallic/gradient strips): one clean
    // end-segment of the strip fills one half naturally and the other half
    // mirrored, meeting seamlessly at the center.
    const s = patch.src;
    const mid = b.x + b.w / 2;
    const half = b.w / 2;
    const natural = (x) => sampleSvg(x, b.y, half, b.h, s);
    const mirrored = (x) => `<g transform="translate(${2 * x + half},0) scale(-1,1)">${natural(x)}</g>`;
    return patch.srcSide === "left"
      ? natural(b.x) + mirrored(mid)
      : mirrored(b.x) + natural(mid);
  }
  return `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${patch.color}"/>`;
}

function textEl(x, y, str, font, anchor = "start", sizeOverride) {
  const family = font.mono ? FONT_MONO : FONT_BODY;
  const ls = font.spacing ? ` letter-spacing="${font.spacing}"` : "";
  return `<text x="${x}" y="${y}" font-family="${family}" font-size="${sizeOverride || font.size}" font-weight="${font.weight}" fill="${font.color}" text-anchor="${anchor}"${ls}>${esc(str)}</text>`;
}

const fmtDate = (iso) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(iso || ""));
  return m ? `${m[2]}/${m[3]}/${m[1]}` : "";
};

/** Balanced two-line split (approved format), honoring explicit overrides. */
function splitName(config) {
  if (config.display_name_line1 || config.display_name_line2) {
    return [config.display_name_line1 || "", config.display_name_line2 || ""].filter(Boolean);
  }
  const s = String(config.display_name || "").trim();
  const words = s.split(/\s+/);
  if (words.length < 2) return [s];
  let best = null;
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(" ");
    const b = words.slice(i).join(" ");
    const span = Math.max(a.length, b.length);
    if (!best || span < best.span) best = { lines: [a, b], span };
  }
  return best.lines;
}

async function qrOverlay(f, url) {
  const raw = await QRCode.toString(String(url), {
    type: "svg",
    errorCorrectionLevel: "H",
    margin: 0, // the immutable white tile provides the quiet zone
    color: { dark: "#101215", light: "#ffffff" },
  });
  const vb = /viewBox="([^"]+)"/.exec(raw)?.[1] || "0 0 33 33";
  const inner = raw.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
  const { x, y, w, h } = f.box;
  let out = `<svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${vb}">${inner}</svg>`;
  if (f.npMark) {
    const m = w * 0.24;
    out += `<rect x="${x + w / 2 - m / 2 - 3}" y="${y + h / 2 - m / 2 - 3}" width="${m + 6}" height="${m + 6}" rx="5" fill="#ffffff"/>`;
    out += `<rect x="${x + w / 2 - m / 2}" y="${y + h / 2 - m / 2}" width="${m}" height="${m}" rx="5" fill="#101215"/>`;
    out += `<text x="${x + w / 2}" y="${y + h / 2 + m * 0.17}" font-family="${FONT_BODY}" font-size="${m * 0.46}" font-weight="800" fill="#ffffff" text-anchor="middle">NP</text>`;
  }
  return out;
}

function barcodeOverlay(f, value) {
  if (!value) return "";
  const bars = code128Svg(value, { height: 10, moduleWidth: 1, color: "#101215" });
  const { x, y, w, h } = f.box;
  const quiet = h * 0.06;
  const len = h - quiet * 2;
  const scaleX = len / bars.totalModules;
  return `<g transform="translate(${x},${y + quiet + len}) rotate(-90) scale(${scaleX},${w / 10})">${bars.svg}</g>`;
}

/* ── Entry point ────────────────────────────────────────────────────────── */

/**
 * Render a label config over an EXACT master. Throws LabelOverflowError when
 * a value cannot fit its approved bounding box.
 * @param {import('../types.js').ProductLabelConfig} config
 * @param {{templateId: string, siteUrl?: string}} opts
 * @returns {Promise<string>} SVG string
 */
export async function renderMasterLabel(config, opts) {
  const entry = masterFor(opts.templateId);
  if (!entry || !entry.fields) throw new Error(`No rolled-out master for template "${opts.templateId}"`);
  const { dataUri } = await loadMasterSvg(entry);
  const [W, H] = entry.viewBox;
  const F = entry.fields;
  const siteUrl = (opts.siteUrl || "https://www.noirpeptides.com").replace(/\/+$/, "");
  const ucfirst = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);

  let v = ""; // VARIABLE_DATA overlay

  // Product name — one line if it fits at full size, else approved two-line.
  {
    const f = F.productName;
    v += patchSvg(f.patch, f.box, dataUri, entry.viewBox);
    const maxW = f.box.w - 8;
    const one = String(config.display_name || "").trim();
    const oneSize = (() => {
      try {
        return fitOrReject("productName", one, maxW, f.font);
      } catch {
        return null;
      }
    })();
    if (oneSize === f.font.size || !/\s/.test(one)) {
      if (oneSize == null) throw new OverflowError("productName", one);
      v += textEl(f.cx, f.baselines.one, one, f.font, "middle", oneSize);
    } else {
      const lines = splitName(config);
      if (lines.length === 1) {
        v += textEl(f.cx, f.baselines.one, lines[0], f.font, "middle", oneSize);
      } else {
        const size = Math.min(
          fitOrReject("productName", lines[0], maxW, f.font),
          fitOrReject("productName", lines[1], maxW, f.font)
        );
        v += textEl(f.cx, f.baselines.two[0], lines[0], f.font, "middle", size);
        v += textEl(f.cx, f.baselines.two[1], lines[1], f.font, "middle", size);
      }
    }
  }

  // Quantity on the metallic strip.
  {
    const f = F.quantity;
    v += patchSvg(f.patch, f.box, dataUri, entry.viewBox);
    const size = fitOrReject("quantity", config.quantity_label, f.box.w - 10, f.font);
    v += textEl(f.cx, f.baseline, config.quantity_label, f.font, "middle", size);
  }

  // Catalog number inside the immutable CAT chip.
  {
    const f = F.catalog;
    v += patchSvg(f.patch, f.box, dataUri, entry.viewBox);
    const value = config.sku || "";
    if (value) {
      const size = fitOrReject("catalog", value, f.box.w - 10, f.font, AVG_MONO);
      v += textEl(f.x, f.baseline, value, f.font, "start", size);
    }
  }

  // Storage — verified text or the safe placeholder, wrapped to the box.
  {
    const f = F.storage;
    v += patchSvg(f.patch, f.box, dataUri, entry.viewBox);
    const line = ucfirst(storageLineFor(config).replace(/^storage:\s*/i, ""));
    v += wrappedBlock("storage", line, f);
  }

  // Composition — owner-entered rows or the pending placeholder.
  {
    const f = F.composition;
    v += patchSvg(f.patch, f.box, dataUri, entry.viewBox);
    const comp = Array.isArray(config.composition) ? config.composition.filter((c) => c?.name) : [];
    if (comp.length && comp.every((c) => c.quantity)) {
      // Up to 4 components ALWAYS all render — never silent truncation. At
      // the approved row count (≤ maxLines) metrics match the master
      // exactly; 3–4 rows compress leading/size inside the patched area.
      const MAX_COMPONENTS = 4;
      if (comp.length > MAX_COMPONENTS) throw new OverflowError("composition", `${comp.length} components (max ${MAX_COMPONENTS})`);
      const rows = comp.map((c) => `${c.name} – ${c.quantity}`);
      let leading = f.leading;
      let rowSize = f.font.size;
      let firstBaseline = f.firstBaseline;
      if (rows.length > f.maxLines) {
        leading = (f.box.h - 6) / rows.length;
        rowSize = Math.min(f.font.size, leading * 0.78);
        firstBaseline = f.box.y + leading * 0.9;
        const floor = f.font.rowMin ?? 9;
        if (rowSize < floor) throw new OverflowError("composition", rows.join("; "));
      }
      rows.forEach((row, i) => {
        const size = fitOrReject("composition", row, f.box.w, { ...f.font, size: rowSize });
        v += textEl(f.x, firstBaseline + i * leading, row, f.font, "start", size);
      });
    } else {
      v += wrappedBlock("composition", ucfirst(COMPOSITION_PENDING_PLACEHOLDER.replace(/^composition:\s*/i, "")), f);
    }
  }

  // Owner-supplied legal line (manufacturer / distributed by / origin) —
  // renders centered in the clean band under the CAT chip only when the
  // owner filled the fields; nothing renders (and nothing is patched)
  // otherwise. Verbatim owner text with neutral labels.
  {
    const parts = [
      config.manufacturer && `Manufactured by ${config.manufacturer}`,
      config.distributed_by && `Distributed by ${config.distributed_by}`,
      config.country_of_origin && `Origin: ${config.country_of_origin}`,
    ].filter(Boolean);
    const f = F.legalLine;
    if (parts.length && f) {
      const line = parts.join("  ·  ");
      const size = fitOrReject("legalLine", line, f.maxW, f.font);
      v += textEl(f.cx, f.baseline, line, f.font, "middle", size);
    }
  }

  // LOT / MFG / EXP values (blank ⇒ patched clean; the master's underline
  // rules remain as fill-in fields).
  for (const [key, value] of [
    ["lot", config.lot_number || ""],
    ["mfgDate", fmtDate(config.packaged_date)],
    ["expDate", config.expiration_date ? fmtDate(config.expiration_date) : fmtDate(config.retest_date)],
  ]) {
    const f = F[key];
    v += patchSvg(f.patch, f.box, dataUri, entry.viewBox);
    if (value) {
      const size = fitOrReject(key, value, f.box.w - 4, f.font);
      v += textEl(f.x, f.baseline, value, f.font, "start", size);
    }
  }

  // Real QR (verification deep link) + real Code 128 ladder barcode.
  {
    const code = config.verification_code || "";
    const url = code ? `${siteUrl}/v/${code}` : `${siteUrl}/verify-lot`;
    v += patchSvg(F.qr.patch, F.qr.box, dataUri, entry.viewBox);
    v += await qrOverlay(F.qr, url);

    v += patchSvg(F.barcode.patch, F.barcode.box, dataUri, entry.viewBox);
    v += barcodeOverlay(F.barcode, config.barcode_value || "");

    const f = F.barcodeText;
    v += patchSvg(f.patch, f.box, dataUri, entry.viewBox);
    const value = config.barcode_value || "";
    if (value) {
      const size = fitOrReject("barcodeText", value, f.box.h - 6, f.font, AVG_MONO);
      v += `<text x="${f.cx}" y="${f.cy}" font-family="${FONT_BODY}" font-size="${size}" font-weight="${f.font.weight}" fill="${f.font.color}" letter-spacing="${f.font.spacing}" text-anchor="middle" transform="rotate(-90 ${f.cx} ${f.cy})">${esc(value)}</text>`;
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(
      `${config.display_name} ${config.quantity_label} research label`
    )}">` +
    `<g id="MASTER_ARTWORK" data-locked="true"><image x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none" href="${dataUri}"/></g>` +
    `<g id="VARIABLE_DATA">${v}</g>` +
    `</svg>`
  );

  function wrappedBlock(fieldName, str, f) {
    const words = String(str || "").split(/\s+/).filter(Boolean);
    const maxChars = Math.max(4, Math.floor(f.box.w / (f.font.size * AVG_BODY)));
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
    if (lines.length > f.maxLines) throw new OverflowError(fieldName, str);
    return lines.map((l, i) => textEl(f.x, f.firstBaseline + i * f.leading, l, f.font)).join("");
  }
}

export { OverflowError as LabelOverflowError };
