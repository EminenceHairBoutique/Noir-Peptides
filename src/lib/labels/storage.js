// src/lib/labels/storage.js
// Controlled storage-wording system. Approved phrasings only; a temperature
// range renders ONLY when the admin marks the condition source-verified
// (per-product supplier/stability documentation). Otherwise the label carries
// a safe placeholder and the studio flags the product for review — storage
// conditions are never invented.
import { STORAGE_UNVERIFIED_PLACEHOLDER } from "../../../lib/labelConstants.js";

// Approved reusable phrasings the admin can pick from (or write a custom
// verified one). These are templates, not claims — nothing renders until the
// admin selects and verifies one for the specific product.
export const STORAGE_PRESETS = [
  {
    id: "refrigerated-light",
    shortLabelText: "Store 2–8 °C. Protect from light.",
    fullStorageText: "Store protected from light at 2 °C to 8 °C.",
  },
  {
    id: "cool-dry",
    shortLabelText: "Store cool and dry. Protect from light.",
    fullStorageText: "Store in a cool, dry environment protected from direct light.",
  },
  {
    id: "controlled-room",
    shortLabelText: "Store 20–25 °C. Protect from moisture and light.",
    fullStorageText:
      "Store at controlled room temperature, 20 °C to 25 °C, protected from moisture and light.",
  },
  {
    id: "frozen",
    shortLabelText: "Keep frozen ≤ −20 °C. Protect from light.",
    fullStorageText: "Keep frozen at or below −20 °C and protect from light.",
  },
];

export const RECONSTITUTION_NOTE =
  "After reconstitution: storage conditions must be determined by the validated research protocol.";

/**
 * The storage line a label actually renders. Verified text only; otherwise
 * the safe placeholder.
 */
export function storageLineFor(config, { full = false } = {}) {
  if (config?.storage_source_verified) {
    const text = full ? config.storage_full || config.storage_short : config.storage_short || config.storage_full;
    if (text && String(text).trim()) return String(text).trim();
  }
  return STORAGE_UNVERIFIED_PLACEHOLDER;
}

/** Studio review flag: true when the label needs owner-verified storage data. */
export function needsStorageReview(config) {
  return !config?.storage_source_verified;
}
