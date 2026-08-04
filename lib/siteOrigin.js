// lib/siteOrigin.js
// SERVER-ONLY canonical origin resolution (audit P0.2).
//
// THE VULNERABILITY THIS CLOSES: the payment endpoints previously built their
// redirect origin from request-controlled headers:
//     req.headers.origin || `https://${req.headers["x-forwarded-host"] || req.headers.host}`
// An attacker who can set Origin/Host/X-Forwarded-Host (trivial with curl, and
// reachable through some proxy chains) could make Stripe's success_url,
// cancel_url, BTCPay's redirectURL, and product image URLs point at a host they
// control — turning a legitimate payment into a redirect to a phishing page
// that looks like the post-purchase flow.
//
// THE RULE: the origin used for anything a customer is sent to, or that a
// payment provider fetches, must come from server-side configuration — never
// from the request. Requests may only SELECT from an explicit allowlist
// (so Vercel preview deployments keep working), never introduce a new host.

const strip = (u) => String(u || "").trim().replace(/\/+$/, "");

/** Origins the deployment is allowed to redirect to, most-canonical first. */
function allowlist() {
  const out = [];
  const push = (v) => {
    const s = strip(v);
    if (s && /^https?:\/\/[^\s/]+$/i.test(s) && !out.includes(s)) out.push(s);
  };

  // 1. Explicit canonical production URL (what you want in prod).
  push(process.env.SITE_URL);
  push(process.env.VITE_SITE_URL);

  // 2. Platform-provided deployment host. Set BY Vercel, not by the requester,
  //    so preview deployments redirect to themselves rather than to prod.
  if (process.env.VERCEL_URL) push(`https://${process.env.VERCEL_URL}`);

  // 3. Operator-managed extras (comma-separated), e.g. an apex+www pair.
  for (const extra of String(process.env.ALLOWED_ORIGINS || "").split(",")) push(extra);

  // 4. Local development only.
  if (process.env.NODE_ENV !== "production") {
    push("http://localhost:5173");
    push("http://localhost:3000");
  }
  return out;
}

/** The single canonical origin for this deployment (first allowlist entry). */
export function canonicalOrigin() {
  return allowlist()[0] || "";
}

/**
 * Resolve the origin to use for a request's redirects.
 * A request-supplied Origin is honored ONLY if it is already allowlisted;
 * anything else — including a forged Host — silently falls back to canonical.
 * @param {object} req
 * @returns {string} an origin with no trailing slash, or "" if unconfigured
 */
export function resolveOrigin(req) {
  const allowed = allowlist();
  if (!allowed.length) return "";
  const requested = strip(req?.headers?.origin);
  if (requested && allowed.includes(requested)) return requested;
  return allowed[0];
}

/** True when this deployment has no configured canonical origin. */
export function originUnconfigured() {
  return allowlist().length === 0;
}

/**
 * Build an absolute URL for a site-relative path using the trusted origin.
 * Absolute inputs are returned only when their origin is allowlisted.
 */
export function absoluteUrl(req, pathOrUrl) {
  const origin = resolveOrigin(req);
  const v = String(pathOrUrl || "");
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) {
    try {
      const u = new URL(v);
      return allowlist().includes(strip(u.origin)) ? v : null;
    } catch {
      return null;
    }
  }
  if (!origin) return null;
  return `${origin}${v.startsWith("/") ? "" : "/"}${v}`;
}
