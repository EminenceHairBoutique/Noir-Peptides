// src/lib/labels/verificationCode.js
// Cryptographically secure, non-sequential verification codes for label QR
// deep links (/v/:code). Crockford base32 (no I, L, O, U) so codes are
// unambiguous when read aloud or typed from a vial. Node-safe (crypto is
// available in both Node and modern browsers via globalThis.crypto).
//
// 13 chars of base32 = 65 bits of entropy — non-enumerable, and the DB column
// is UNIQUE with an insert-retry loop as a belt-and-braces collision guard.

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const VERIFICATION_CODE_LENGTH = 13;

function randomBytes(n) {
  // Browser + Node 19+ both expose webcrypto on globalThis.
  const arr = new Uint8Array(n);
  globalThis.crypto.getRandomValues(arr);
  return arr;
}

/** Generate one uppercase Crockford-base32 verification code. */
export function generateVerificationCode(length = VERIFICATION_CODE_LENGTH) {
  const bytes = randomBytes(length);
  let out = "";
  for (let i = 0; i < length; i++) {
    out += CROCKFORD[bytes[i] % 32];
  }
  return out;
}

/** Canonicalize user/scanner input: uppercase, strip separators, map ambiguous glyphs. */
export function normalizeVerificationCode(input) {
  return String(input || "")
    .toUpperCase()
    .replace(/[\s-]/g, "")
    .replace(/O/g, "0")
    .replace(/[IL]/g, "1");
}

export function isValidVerificationCode(code) {
  const c = String(code || "");
  return c.length === VERIFICATION_CODE_LENGTH && [...c].every((ch) => CROCKFORD.includes(ch));
}
