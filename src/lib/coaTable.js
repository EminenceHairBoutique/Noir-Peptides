// src/lib/coaTable.js
// Pure, shared cell/label derivations for every certificate table surface:
// <BatchHistoryTable>, <CoaCard>, and the build-time prerenderer. One
// implementation so the crawlable HTML and the hydrated table can never say
// different things about the same row.
//
// HONESTY RULES (Sept-11 T3):
//  - A certificate link is labelled by what the asset IS, derived from its
//    extension. An image is never called "PDF". An unrecognised extension gets
//    the neutral "Certificate" — we never assert a format we cannot see.
//  - A row with no purity figure but a confirmed mass-spec identity says so
//    ("Identity panel only") instead of leaving a blank that reads as missing
//    data. A row with neither stays blank: that IS the honest state.
import { formatPurity } from "./labVerify.js";

export const IDENTITY_ONLY_LABEL = "Identity panel only";

/**
 * Human label for a certificate asset, from its extension (or data: MIME).
 * @returns {"PDF"|"Certificate image"|"Certificate"|null} null for no URL
 */
export function certificateLabel(url) {
  const u = String(url || "").trim();
  if (!u) return null;
  if (/^data:application\/pdf/i.test(u)) return "PDF";
  if (/^data:image\//i.test(u)) return "Certificate image";
  // Strip query/hash so "cert.pdf?download=1" still resolves by extension.
  const clean = u.split(/[?#]/)[0].toLowerCase();
  if (clean.endsWith(".pdf")) return "PDF";
  if (/\.(jpe?g|png|webp)$/.test(clean)) return "Certificate image";
  return "Certificate";
}

/**
 * What the purity cell should show for a row.
 * @returns {{kind:"value",text:string}|{kind:"chip",text:string}|{kind:"empty"}}
 */
export function purityCell(row) {
  const text = formatPurity(row);
  if (text) return { kind: "value", text };
  if (row?.ms_confirmed === true) return { kind: "chip", text: IDENTITY_ONLY_LABEL };
  return { kind: "empty" };
}
