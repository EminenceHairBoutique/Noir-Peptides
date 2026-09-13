// lib/labelCopyRules.js   (opt cycle 5 — scorecard 4.1)
// The one place that says what may NOT appear on a printed label. Used by the
// build gate (scripts/test-label-copy.mjs, which renders real labels) and by
// api/admin/labels.js at create/patch time, so text an admin types is held to
// the same rule as the engine's fixed copy — before it can be approved.
//
// A label may state what the material IS and how to STORE it. It may never
// read as preparing it for use: a liquid volume, a solvent, a route of
// administration, a dose, a schedule, a reconstitution instruction. On top of
// that, the compliance scanner's categories apply — a finding is accepted only
// when it sits inside a negation (the RUO warnings do: "NOT FOR … THERAPEUTIC").
import { scanCopy } from "../src/lib/complianceScan.js";

export const LABEL_USE_PATTERNS = [
  [/\b\d+(?:\.\d+)?\s?m[lL]\b/, "a liquid volume"],
  [/\bbacteriostatic|\bBAC\b|sterile water|saline|solvent|diluent/i, "a solvent"],
  [/\binject|syringe|needle|subcutaneous|intramuscular|intravenous|\boral\b|nasal|topical|sublingual/i, "a route of administration"],
  [/\bdos(?:e|es|age|ing)\b|\bmg\/kg\b|\bmcg\b|µg\/kg/i, "a dose"],
  [/\bdaily\b|\bweekly\b|per day|twice a|every \d+ (?:hours|days)|\bcycle\b/i, "a schedule"],
  [/\breconstitute\s+(?:with|in|using)\b/i, "a reconstitution instruction"],
];

export const NEGATION = /\b(not|never|no|nor|without)\b/i;

/** Free-text label fields that render on a label (the rest are ids, dates, flags). */
export const LABEL_TEXT_FIELDS = [
  "display_name", "quantity_label", "material_type", "composition", "net_contents", "fill_note",
  "storage_short", "storage_full", "manufacturer", "distributed_by", "country_of_origin", "revision_notes",
];

/**
 * Check a single text for use language. Returns [] when clean, else one
 * entry per problem: { reason, match } for a pattern hit, { reason:
 * "compliance", category, term } for a scanner finding outside a negation.
 */
export function checkLabelText(text) {
  const s = String(text || "");
  if (!s.trim()) return [];
  const out = [];
  for (const [re, reason] of LABEL_USE_PATTERNS) {
    const m = s.match(re);
    if (m) out.push({ reason, match: m[0] });
  }
  const r = scanCopy(s);
  for (const f of r.findings) {
    const win = s.slice(Math.max(0, f.index - 80), f.index + f.term.length + 20);
    if (!NEGATION.test(win)) out.push({ reason: "compliance", category: f.category, term: f.term });
  }
  return out;
}

/** Check every text field of a label config. Returns [] or [{ field, ...problem }]. */
export function checkLabelFields(fields = {}) {
  const out = [];
  for (const field of LABEL_TEXT_FIELDS) {
    if (fields[field] === undefined || fields[field] === null) continue;
    for (const p of checkLabelText(fields[field])) out.push({ field, ...p });
  }
  return out;
}
