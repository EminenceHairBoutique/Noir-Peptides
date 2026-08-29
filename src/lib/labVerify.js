// src/lib/labVerify.js
// Builds the SECOND FACTOR of certificate verification: a deep link into the
// issuing laboratory's OWN public record for a given lot.
//
// Third-party vendor-audit sites rate a certificate highest when its lot
// resolves on the lab's public lookup and the returned client name matches
// the vendor. A self-hosted PDF is the first factor; this link is the second.
//
// SAFETY: the template comes from the database (owner-entered), so it is
// treated as untrusted input. A link is produced ONLY when the template is an
// absolute https URL containing the literal {code} placeholder and a lookup
// code exists. Anything else yields null and the UI renders nothing — never a
// dead or half-built link.

const PLACEHOLDER = "{code}";

/**
 * @param {{public_lookup_url_template?: string|null}|null} lab
 * @param {string|null|undefined} lookupCode  coas.lab_lookup_code
 * @returns {string|null} absolute https URL, or null when not verifiable
 */
export function labVerifyUrl(lab, lookupCode) {
  const template = String(lab?.public_lookup_url_template || "").trim();
  const code = String(lookupCode || "").trim();
  if (!template || !code) return null;
  if (!template.includes(PLACEHOLDER)) return null;

  // Substitute first, then parse — so a malformed result is rejected whole.
  const candidate = template.split(PLACEHOLDER).join(encodeURIComponent(code));
  let url;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  // https only: this is an outbound trust link; http would be downgraded and
  // is not acceptable for a verification claim.
  if (url.protocol !== "https:") return null;
  return url.toString();
}

/**
 * True when a certificate can be verified at the lab — i.e. it names a lab
 * AND that lab publishes a lookup AND this lot carries a code for it.
 */
export function isTwoFactorVerifiable(coa, lab) {
  return Boolean(labVerifyUrl(lab, coa?.lab_lookup_code));
}

/**
 * Display string for a purity claim, honouring the stored operator so a
 * ">= 99%" certificate is never rendered as an exact "99%".
 * Returns null when there is no purity figure — callers omit the field.
 */
export function formatPurity(coa) {
  if (coa?.purity_percent == null || !Number.isFinite(Number(coa.purity_percent))) {
    return coa?.hplc || null;
  }
  const op = coa.purity_operator && coa.purity_operator !== "=" ? `${coa.purity_operator} ` : "";
  return `${op}${coa.purity_percent}%`;
}

/** Panel tiers, in display order. Labels are descriptive, not claims. */
export const PANEL_TIERS = [
  { key: "identity_potency", label: "Identity & potency" },
  { key: "contamination", label: "Contamination control" },
  { key: "integrity_stability", label: "Physical integrity & stability" },
];

/**
 * Group batch_tests rows into the three display tiers.
 * @returns {Array<{key: string, label: string, tests: object[]}>} only
 *   non-empty tiers, so an absent panel renders nothing at all.
 */
export function groupTestPanel(tests) {
  const rows = Array.isArray(tests) ? tests : [];
  return PANEL_TIERS.map((tier) => ({
    ...tier,
    tests: rows
      .filter((t) => t && t.panel_category === tier.key)
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0)),
  })).filter((tier) => tier.tests.length > 0);
}
