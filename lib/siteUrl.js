// lib/siteUrl.js — the ONE place the production origin is written (opt cycle 12).
// Read by the client (src/components/SEO.jsx), the prerenderer
// (scripts/generate-static-seo.mjs) and the live probe (scripts/live-probe.mjs),
// so a canonical, an Open Graph URL and the probe's expectation cannot drift.
export const PRODUCTION_SITE_URL = "https://www.noirpeptides.com";
export const PRODUCTION_HOST = new URL(PRODUCTION_SITE_URL).host;
export const isLocalHost = (host) => /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(:\d+)?$/i.test(String(host || ""));
