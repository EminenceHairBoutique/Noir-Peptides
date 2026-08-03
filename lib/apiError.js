// lib/apiError.js
// Sanitized API error responses with correlation IDs (audit P0.3).
//
// THE LEAK THIS CLOSES: endpoints returned provider/database internals straight
// to the browser —
//     res.status(500).json({ error: err?.message || "Stripe error" })
// A Stripe or Postgres message can disclose table names, column names,
// constraint names, account identifiers, key prefixes, and internal
// configuration. That is free reconnaissance for an attacker and meaningless
// noise for a customer.
//
// THE RULE: customers get a stable, human message + an error code + a request
// id. The full detail goes to the server log under that same id, so support can
// correlate a customer's screenshot to the exact failure without ever putting
// internals on the wire.

import crypto from "node:crypto";

export function newRequestId() {
  return crypto.randomBytes(8).toString("hex");
}

// Values that must never reach a log line, let alone a response.
const SECRET_PATTERNS = [
  /sk_live_[A-Za-z0-9]+/g,
  /sk_test_[A-Za-z0-9]+/g,
  /whsec_[A-Za-z0-9]+/g,
  // JWTs. Segment minimums are deliberately short: the `eyJ` prefix (base64 of
  // `{"`) is already a strong signal, and a stricter length let short tokens
  // through — caught by tests/audit/p0-payment-security.test.mjs.
  /eyJ[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]{4,}\.[A-Za-z0-9_-]+/g,
  /Bearer\s+[A-Za-z0-9._-]+/gi,
];

export function scrubSecrets(text) {
  let out = String(text ?? "");
  for (const re of SECRET_PATTERNS) out = out.replace(re, "[redacted]");
  return out;
}

/**
 * Log the real failure server-side and return a safe response.
 *
 * @param {object} res
 * @param {object} opts
 * @param {number} opts.status        HTTP status (default 500)
 * @param {string} opts.code          stable machine code, e.g. "checkout_failed"
 * @param {string} opts.message       customer-safe message
 * @param {unknown} opts.error        the real error (logged, never returned)
 * @param {string} [opts.context]     where it happened, for the log line
 * @param {object} [opts.meta]        extra NON-SENSITIVE log fields
 * @returns {string} the request id
 */
export function failSafely(res, { status = 500, code, message, error, context, meta }) {
  const requestId = newRequestId();
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error ?? "");
  console.error(
    `[${requestId}] ${context || code || "api_error"}: ${scrubSecrets(detail)}`,
    meta ? scrubSecrets(JSON.stringify(meta)) : ""
  );
  if (error instanceof Error && error.stack) {
    console.error(`[${requestId}] stack: ${scrubSecrets(error.stack)}`);
  }
  if (!res.headersSent) {
    res.status(status).json({ error: message, code, requestId });
  }
  return requestId;
}
