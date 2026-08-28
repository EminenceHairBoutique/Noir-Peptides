// lib/cas.js
// CAS Registry Number validation + normalization. Shared by the admin COA
// ingest (api/admin/coa.js) and the /test-results CAS search.
//
// A CAS number is NNNNNNN-NN-N: 2–7 digits, 2 digits, 1 check digit. The
// check digit is the standard CAS checksum: number the body digits from the
// RIGHT starting at 1, multiply each by its position, sum, mod 10.
//   e.g. 7732-18-5 (water): 8·1 + 1·2 + 2·3 + 3·4 + 7·5 + 7·6 = 105 → 5 ✓
//
// COMPLIANCE: this module validates identifiers only. It never supplies,
// suggests, or defaults a CAS value — those are owner-entered per certificate.

const CAS_SHAPE = /^(\d{2,7})-(\d{2})-(\d)$/;

/**
 * Normalize user/scanner input toward canonical CAS form: trim, collapse
 * internal whitespace, unify unicode dashes to ASCII hyphen. Returns the
 * normalized string (which may still be invalid — validate separately).
 */
export function normalizeCas(input) {
  return String(input ?? "")
    .trim()
    .replace(/\s+/g, "")
    .replace(/[‐-―−]/g, "-");
}

/**
 * True iff `input` (after normalization) is a well-formed CAS number with a
 * correct check digit.
 */
export function isValidCas(input) {
  const m = CAS_SHAPE.exec(normalizeCas(input));
  if (!m) return false;
  const body = m[1] + m[2]; // digits before the check digit
  const check = Number(m[3]);
  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    // position 1 = rightmost body digit
    sum += Number(body[body.length - 1 - i]) * (i + 1);
  }
  return sum % 10 === check;
}
