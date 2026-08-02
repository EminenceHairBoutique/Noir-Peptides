// src/lib/siteUrl.js
// Canonical site origin for auth redirect links (password reset, email
// confirmation, OAuth). Env-driven so each Vercel environment (production /
// preview) can pin its own origin; falls back to the current origin, which is
// already per-deployment-correct in the browser. Never hardcode an origin.
export function siteOrigin() {
  const env = String(import.meta.env.VITE_SITE_URL || "").trim().replace(/\/+$/, "");
  if (env) return env;
  if (typeof window !== "undefined" && window.location?.origin) return window.location.origin;
  return "";
}
