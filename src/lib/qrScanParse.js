// src/lib/qrScanParse.js
// Turn whatever a QR decoder returns into a verification code, or null.
//
// Label QRs encode `${siteUrl}/v/${code}` (renderLabelSvg.js), but the scanner
// must also accept a bare code (hand-made labels, older stock) and URLs from
// any host the site has lived on (www.noirpeptides.com, vercel previews) —
// the path shape and the code alphabet are the trust boundary here, not the
// origin, because the code is only ever *looked up* server-side via
// /api/verify. Never treat scanned content as a navigation target beyond the
// extracted code.
import {
  normalizeVerificationCode,
  isValidVerificationCode,
} from "./labels/verificationCode.js";

/**
 * @param {string} raw - decoded QR text
 * @returns {string|null} canonical verification code, or null if this is not
 *   a Noir Peptides verification QR
 */
export function parseScannedCode(raw) {
  const text = String(raw || "").trim();
  if (!text) return null;

  let candidate = text;

  // Full URL (https://host/v/<code>) or a bare "/v/<code>" path.
  const asPath = (() => {
    try {
      return new URL(text).pathname;
    } catch {
      return text.startsWith("/") ? text : null;
    }
  })();
  if (asPath) {
    const m = asPath.match(/^\/v\/([^/?#]+)\/?$/);
    if (!m) return null; // a URL/path that is not a /v/ deep link is not ours
    candidate = decodeURIComponent(m[1]);
  }

  const code = normalizeVerificationCode(candidate);
  return isValidVerificationCode(code) ? code : null;
}
