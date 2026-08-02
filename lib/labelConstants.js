// lib/labelConstants.js
// SINGLE SOURCE for label-system enums, required RUO wording, the writable
// column whitelist, and publishing rules. Lives at the repo root so BOTH the
// serverless API (api/admin/labels.js, api/verify.js) and the client
// (src/lib/labels/*, Label Studio) import the same values — no drift.
//
// COMPLIANCE: the RUO warnings are constants, not per-row data. Every rendered
// label pulls them from here, so the wording cannot be edited away or drift.

export const LABEL_TEMPLATE_IDS = [
  "noir-clinical-core",
  "spectral-biotech",
  "cryogenic-white",
  "neural-grid",
];

export const LABEL_PRESET_IDS = ["full_wrap", "partial", "front", "neck", "cap"];

export const LABEL_STATUSES = [
  "draft",
  "in_review",
  "changes_requested",
  "approved",
  "production_ready",
  "archived",
];

// Allowed status transitions (from -> [to]). Admin UI + API both enforce.
export const STATUS_TRANSITIONS = {
  draft: ["in_review", "archived"],
  in_review: ["changes_requested", "approved", "archived"],
  changes_requested: ["in_review", "archived"],
  approved: ["production_ready", "changes_requested", "archived"],
  production_ready: ["changes_requested", "archived"],
  archived: ["draft"],
};

// Publishing rule: only these statuses may render anywhere outside the
// admin Label Studio (customer surfaces, verification page).
export function canRenderOutsideStudio(status) {
  return status === "approved" || status === "production_ready";
}

// Whether a label row may be shown on customer-facing surfaces (PDP vial):
// publishable status, not recalled, and not past its expiration/retest date.
// Used by the public /api/product-label endpoint.
export function isLabelPubliclyRenderable(row, nowMs = Date.now()) {
  if (!row || row.recalled) return false;
  if (!canRenderOutsideStudio(row.status)) return false;
  const ref = row.expiration_date || row.retest_date;
  if (ref && new Date(`${ref}T23:59:59Z`).getTime() < nowMs) return false;
  return true;
}

// Required RUO wording — rendered verbatim on every label.
export const RUO_PRIMARY_WARNING =
  "FOR RESEARCH USE ONLY. NOT FOR HUMAN OR VETERINARY USE.";
export const RUO_SECONDARY_WARNING =
  "NOT FOR DIAGNOSTIC, THERAPEUTIC, OR HOUSEHOLD USE.";

// Safe placeholders when owner-verified data is absent (never fabricate).
export const STORAGE_UNVERIFIED_PLACEHOLDER =
  "Storage: refer to accompanying batch documentation.";
export const COMPOSITION_PENDING_PLACEHOLDER =
  "Composition: pending administrative input.";

// Columns an admin may write via api/admin/labels.js (column-whitelist write
// pattern, same as api/admin/coa.js). Everything else is server-managed.
export const LABEL_WRITABLE_COLUMNS = [
  "product_id",
  "variant_id",
  "template_id",
  "default_preset",
  "accent_family",
  "display_name",
  "quantity_label",
  "material_type",
  "composition",
  "net_contents",
  "fill_note",
  "sku",
  "lot_number",
  "batch_number",
  "packaged_date",
  "expiration_date",
  "retest_date",
  "barcode_value",
  "storage_short",
  "storage_full",
  "storage_source_verified",
  "manufacturer",
  "distributed_by",
  "country_of_origin",
  "recalled",
  "revision_notes",
];

// Verification states surfaced by /api/verify (never fabricated lab data).
export const VERIFY_STATES = [
  "verified",
  "not_found",
  "expired",
  "recalled",
  "administrative_hold",
  "unavailable",
];
