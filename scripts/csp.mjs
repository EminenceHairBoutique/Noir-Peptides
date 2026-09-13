/*
  scripts/csp.mjs   (Sept-11 T8)
  ONE builder for the Content-Security-Policy, so the static header in
  vercel.json and the build-time <meta> policy are derived from the same
  source and cannot drift (scripts/test-csp.mjs asserts they agree).

  Two knobs:
    analyticsEnabled   — GA4 / Meta Pixel origins are allowed only when an
                         analytics ID is configured at build time. With none,
                         *.google-analytics.com, *.googletagmanager.com,
                         *.analytics.google.com, connect.facebook.net,
                         *.facebook.net, *.facebook.com, www.facebook.com and
                         graph.facebook.com are removed from script-src,
                         img-src and connect-src.
    allowInlineScript  — 'unsafe-inline' in script-src. The analytics
                         bootstrap (TrackingScripts.jsx) injects an inline
                         script, so it is required when analytics is on.
                         With analytics off it is dropped ONLY when the build
                         has verified no inline executable <script> remains in
                         any prerendered HTML (scripts/emit-csp.mjs).

  cdn.jsdelivr.net was in connect-src and nothing in the codebase loads from it
  (verified: no reference outside the old header itself) — removed.
*/

// Origins that exist purely for analytics/marketing pixels.
export const ANALYTICS = {
  script: ["*.google-analytics.com", "*.googletagmanager.com", "connect.facebook.net", "*.facebook.net"],
  img: ["*.google-analytics.com", "www.facebook.com"],
  connect: ["*.google-analytics.com", "*.analytics.google.com", "*.googletagmanager.com", "*.facebook.com", "graph.facebook.com"],
};

/** True when either analytics ID is configured at build time. */
export function analyticsEnabled(env = process.env) {
  return Boolean(String(env.VITE_GA_MEASUREMENT_ID || "").trim() || String(env.VITE_META_PIXEL_ID || "").trim());
}

/**
 * @param {{analyticsEnabled:boolean, allowInlineScript:boolean, forHeader?:boolean}} o
 *   forHeader: include frame-ancestors (ignored inside a <meta> policy, so the
 *   meta variant omits it — the header still carries it).
 */
export function buildCsp({ analyticsEnabled: a, allowInlineScript, forHeader = false }) {
  const scriptSrc = ["'self'", ...(allowInlineScript ? ["'unsafe-inline'"] : []), "*.stripe.com", "js.stripe.com", ...(a ? ANALYTICS.script : [])];
  const imgSrc = ["'self'", "data:", "blob:", "*.supabase.co", ...(a ? ANALYTICS.img : [])];
  const connectSrc = ["'self'", "*.supabase.co", "wss://*.supabase.co", "*.stripe.com", ...(a ? ANALYTICS.connect : [])];
  const directives = [
    ["default-src", ["'self'"]],
    ["script-src", scriptSrc],
    // Fonts are self-hosted (opt cycle 2); no Google Fonts origin (cycle 9, C3).
    ["style-src", ["'self'", "'unsafe-inline'"]],
    ["font-src", ["'self'", "data:"]],
    ["img-src", imgSrc],
    ["frame-src", ["js.stripe.com", "*.stripe.com"]],
    ["connect-src", connectSrc],
    ["worker-src", ["'self'", "blob:"]],
    ["object-src", ["'none'"]],
    ["base-uri", ["'self'"]],
    ...(forHeader ? [["frame-ancestors", ["'none'"]]] : []),
    ["form-action", ["'self'"]],
    ["upgrade-insecure-requests", []],
  ];
  return directives.map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k)).join("; ") + ";";
}

/**
 * Inline EXECUTABLE scripts in an HTML document: <script> with no src and a
 * JavaScript (or absent) type. Data blocks (application/ld+json, JSON) are not
 * executed and do not need 'unsafe-inline'.
 * @returns {string[]} the opening tags found
 */
export function scanInlineScripts(html) {
  const out = [];
  for (const m of String(html || "").matchAll(/<script\b([^>]*)>/gi)) {
    const attrs = m[1] || "";
    if (/\bsrc\s*=/i.test(attrs)) continue;
    const type = (attrs.match(/\btype\s*=\s*["']?([^"'\s>]+)/i) || [])[1];
    if (!type || /^(module|text\/javascript|application\/javascript|importmap)$/i.test(type)) out.push(m[0]);
  }
  return out;
}

/** Inject a CSP <meta> right after the charset meta (fallback: after <head>). */
export function injectCspMeta(html, policy) {
  const tag = `<meta http-equiv="Content-Security-Policy" content="${policy.replace(/"/g, "&quot;")}" />`;
  if (html.includes('http-equiv="Content-Security-Policy"')) return html; // idempotent
  const charset = html.match(/<meta\s+charset=["']?utf-8["']?\s*\/?>/i);
  if (charset) return html.replace(charset[0], `${charset[0]}\n    ${tag}`);
  return html.replace(/<head>/i, `<head>\n    ${tag}`);
}
