// src/lib/labels/lots.js
// Lot-number + date-label helpers. Pure + Node-safe.
//
// APPROVED lot format (owner, 2026-07-19 — matches the EXACT-master artwork
// and sample-label.json): NP[YYMM]-[BATCH]  e.g. NP2607-001. The batch
// resets per month; the product is identified by CAT/SKU + barcode, not the
// lot. The legacy long format (NP-CODE-YYMM-BBB) is still ACCEPTED by the
// validator for rows created before the change, but no longer generated.

const LOT_RE = /^NP\d{4}-\d{3}$/;
const LEGACY_LOT_RE = /^NP-[A-Z0-9]{2,12}-\d{4}-\d{3}$/;

/** Compact uppercase product code (mirrors skuFor()'s sanitization). */
export function productCode(productId) {
  return String(productId || "")
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 12);
}

/**
 * Build a lot number in the approved compact format. yymm must be provided
 * by the caller (comes from the packaging date the admin enters — never
 * auto-stamped, so a lot always reflects real batch data).
 */
export function buildLotNumber({ yymm, batch = 1 }) {
  const b = String(batch).padStart(3, "0");
  if (!/^\d{4}$/.test(String(yymm))) throw new Error("lots: yymm must be 4 digits (YYMM)");
  return `NP${yymm}-${b}`;
}

export function validateLotFormat(lot) {
  const v = String(lot || "").trim().toUpperCase();
  return LOT_RE.test(v) || LEGACY_LOT_RE.test(v);
}

/** "EXP 2028-07" / "RETEST 2028-07" from a YYYY-MM-DD date string. */
export function dateLabel(kind, isoDate) {
  const m = /^(\d{4})-(\d{2})/.exec(String(isoDate || ""));
  if (!m) return "";
  const prefix = kind === "retest" ? "RETEST" : "EXP";
  return `${prefix} ${m[1]}-${m[2]}`;
}

/** Pick the right dated line for a config: retest wins only when set alone. */
export function expiryLine(config) {
  if (config?.expiration_date) return dateLabel("exp", config.expiration_date);
  if (config?.retest_date) return dateLabel("retest", config.retest_date);
  return "";
}
