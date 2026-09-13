/*
  scripts/live-probe.mjs   (opt cycle 9 — addendum B2; scorecards 4.1 / 4.2 / 4.6 / 4.12)
  The engine's eyes on the LIVE site, run from CI every 6 hours. Plain HTTP
  (no browser): fetches the key routes and asserts what production must
  hold — canonical host, the build's data presence (Hy-001), the security
  headers byte-equal to the builder, zero compliance-scanner hits beyond the
  reviewed negation allowlist, the sitemap, at least one rendered COA row,
  the payment-rails envelope, and a real 404. Writes evidence/live-probe.json.

    node scripts/live-probe.mjs <baseUrl> [outFile]        # the HTTP checks
    node scripts/live-probe.mjs --finalize [outFile]       # fold axe-live.json +
                                                           # lighthouse-live/ in, set the verdict
  env: CANONICAL_HOST (default: the base URL's host), LOCAL_SITEMAP_COUNT
  (from a local build; the live count must be ≥ it).
  Exit 1 when any check fails. Never writes anything to the site.
*/
import fs from "node:fs";
import path from "node:path";
import { scanCopy } from "../src/lib/complianceScan.js";
import { buildCsp } from "./csp.mjs";
import { renderedText, ACCEPTED } from "./_copy-scan.mjs";
import { parseSitemapPaths } from "./_sitemap-routes.mjs";
import { readJson, axeSummary, lighthouseMedians } from "./_evidence-fold.mjs";

const args = process.argv.slice(2);
const runUrl = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null;

// ── --finalize: fold the browser-based results in and set the verdict ──────
if (args[0] === "--finalize") {
  const out = args[1] || "evidence/live-probe.json";
  const rec = readJson(out) || { schema: 1, kind: "live", checks: [], generated_at: new Date().toISOString() };
  const dir = path.dirname(out);
  rec.axe = axeSummary(readJson(path.join(dir, "axe-live.json")));
  rec.lighthouse = lighthouseMedians(path.join(dir, "lighthouse-live"));
  const httpFail = rec.checks.filter((c) => c.pass === false).map((c) => c.id);
  rec.gates = { http: httpFail.length === 0, axe: rec.axe.pass, lighthouse: rec.lighthouse.pass };
  rec.failing = [...httpFail, ...(rec.axe.pass === false ? ["axe"] : []), ...(rec.lighthouse.pass === false ? ["lighthouse"] : [])];
  rec.missing = Object.entries(rec.gates).filter(([, v]) => v == null).map(([k]) => k);
  rec.verdict = rec.failing.length ? "red" : rec.missing.length ? "incomplete" : "green";
  rec.run_url = rec.run_url || runUrl;
  fs.writeFileSync(out, JSON.stringify(rec, null, 2) + "\n");
  console.log(`live probe: ${rec.verdict}${rec.failing.length ? ` — failing: ${rec.failing.join(", ")}` : ""}${rec.missing.length ? ` — missing: ${rec.missing.join(", ")}` : ""}`);
  for (const [route, v] of Object.entries(rec.lighthouse.routes || {})) console.log(`  lighthouse ${route}: LCP ${v.lcpMs} ms · CLS ${v.cls} · TBT ${v.tbtMs} ms · ${v.pass ? "pass" : "FAIL"}`);
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `verdict=${rec.verdict}\n`);
  process.exit(rec.verdict === "green" ? 0 : 1);
}

// ── The HTTP checks ────────────────────────────────────────────────────────
const base = (args[0] || process.env.PROD_URL || "https://noir-peptides.vercel.app").replace(/\/+$/, "");
const out = args[1] || "evidence/live-probe.json";
const canonicalHost = process.env.CANONICAL_HOST || new URL(base).host;
const localSitemapCount = Number(process.env.LOCAL_SITEMAP_COUNT || 0) || null;
const checks = [];
const check = (id, pass, value, expected, note) => { checks.push({ id, pass: !!pass, value, expected, ...(note ? { note } : {}) }); console.log(`  ${pass ? "✓" : "✗"} ${id}${pass ? "" : ` — got ${JSON.stringify(value)}, expected ${JSON.stringify(expected)}`}`); return !!pass; };

async function get(route, { json = false } = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 25000);
  try {
    const res = await fetch(base + route, { signal: ctl.signal, headers: { "user-agent": "noir-live-probe/1 (+opt cycle 9)" }, redirect: "follow" });
    const text = await res.text();
    let body = text;
    if (json) { try { body = JSON.parse(text); } catch { body = null; } }
    return { status: res.status, headers: Object.fromEntries([...res.headers.entries()]), url: res.url, body, text };
  } catch (e) {
    return { status: 0, headers: {}, url: base + route, body: null, text: "", error: String(e?.message || e) };
  } finally { clearTimeout(t); }
}
const canonicalOf = (html) => (html.match(/<link\s+rel="canonical"\s+href="([^"]+)"/i) || [])[1] || null;

console.log(`live probe → ${base} (canonical host ${canonicalHost})`);
const sitemap = await get("/sitemap.xml");
const livePaths = sitemap.status === 200 ? parseSitemapPaths(sitemap.text) : [];
const pdps = ["/product/bpc-157", ...livePaths.filter((p) => p.startsWith("/product/") && p !== "/product/bpc-157").slice(0, 2)];
const pages = ["/", "/shop", ...pdps, "/test-results", "/verify-lot"];

// Pages: 200, canonical host + path, scanner hits within the allowlist.
const html = {};
for (const route of pages) {
  const r = await get(route);
  html[route] = r;
  check(`status ${route}`, r.status === 200, r.status, 200, r.error);
  if (r.status !== 200) continue;
  const can = canonicalOf(r.text);
  let host = null, pathname = null;
  try { const u = new URL(can); host = u.host; pathname = u.pathname.replace(/\/+$/, "") || "/"; } catch { /* absent */ }
  check(`canonical ${route}`, host === canonicalHost && pathname === route, can, `https://${canonicalHost}${route}`);
  const got = scanCopy(renderedText(r.text)).findings.map((f) => `${f.category}:${f.term.toLowerCase()}`).sort();
  const want = (ACCEPTED[route] || []).slice().sort();
  check(`scanner ${route}`, JSON.stringify(got) === JSON.stringify(want), got, want, want.length ? "accepted negations only (H-006)" : "zero findings");
}

// Security headers on the document response.
{
  const h = html["/"].headers;
  const expectCsp = buildCsp({ analyticsEnabled: true, allowInlineScript: true, forHeader: true });
  check("header content-security-policy", h["content-security-policy"] === expectCsp, h["content-security-policy"] || null, expectCsp, "byte-equal to scripts/csp.mjs (header variant)");
  check("header strict-transport-security", /max-age=\d+/.test(h["strict-transport-security"] || ""), h["strict-transport-security"] || null, "max-age=…");
  check("header x-content-type-options", (h["x-content-type-options"] || "").toLowerCase() === "nosniff", h["x-content-type-options"] || null, "nosniff");
}

// Build metadata: the data-presence claim, executed (Hy-001).
{
  const r = await get("/prerender-meta.json", { json: true });
  check("status /prerender-meta.json", r.status === 200 && r.body && typeof r.body === "object", r.status, 200);
  check("build dbEnvPresent", r.body?.dbEnvPresent === true, r.body?.dbEnvPresent ?? null, true, "the production build fetched real rows");
  check("build coaRowCount ≥ 1", Number(r.body?.coaRowCount) >= 1, r.body?.coaRowCount ?? null, "≥ 1");
}

// Trust page carries at least one rendered certificate row.
{
  const t = html["/test-results"]?.text || "";
  const rows = (t.match(/<th scope="row">/g) || []).length;
  check("test-results COA rows ≥ 1", rows >= 1, rows, "≥ 1");
}

// Sitemap + robots.
{
  check("status /sitemap.xml", sitemap.status === 200, sitemap.status, 200);
  const hosts = new Set([...sitemap.text.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => { try { return new URL(m[1]).host; } catch { return "?"; } }));
  check("sitemap url count", localSitemapCount ? livePaths.length >= localSitemapCount : livePaths.length >= 60, livePaths.length, localSitemapCount ? `≥ ${localSitemapCount} (local build)` : "≥ 60");
  check("sitemap hosts", hosts.size === 1 && hosts.has(canonicalHost), [...hosts], [canonicalHost]);
  const robots = await get("/robots.txt");
  check("status /robots.txt", robots.status === 200, robots.status, 200);
  const sm = (robots.text.match(/^Sitemap:\s*(\S+)/m) || [])[1] || null;
  check("robots sitemap line", sm === `https://${canonicalHost}/sitemap.xml`, sm, `https://${canonicalHost}/sitemap.xml`);
}

// Payment rails: a JSON envelope, never a 5xx.
{
  const r = await get("/api/payment-rails", { json: true });
  check("rails envelope", r.status === 200 && Array.isArray(r.body?.rails) && typeof r.body?.unavailable === "boolean", { status: r.status, keys: r.body && typeof r.body === "object" ? Object.keys(r.body) : null }, { status: 200, keys: ["rails", "cryptoDiscountPct", "unavailable"] });
}

// Unknown paths are real 404s (opt cycle 8).
{
  const r = await get("/definitely-missing-route-9f3a");
  check("unknown path → 404", r.status === 404, r.status, 404);
}

const failing = checks.filter((c) => !c.pass).map((c) => c.id);
const record = { schema: 1, kind: "live", url: base, canonicalHost, generated_at: new Date().toISOString(), run_url: runUrl, checks, counts: { pass: checks.length - failing.length, fail: failing.length }, gates: { http: failing.length === 0 }, failing, verdict: failing.length ? "red" : "green" };
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, JSON.stringify(record, null, 2) + "\n");
// LHCI config for the browser-based pass against the same site.
fs.writeFileSync(path.join(path.dirname(out), "lighthouserc.live.json"), JSON.stringify({ ci: {
  collect: { url: ["/", "/shop", "/product/bpc-157", "/test-results"].map((r) => base + r), numberOfRuns: 3, settings: { chromeFlags: "--no-sandbox --headless=new" } },
  assert: { assertions: { "largest-contentful-paint": ["error", { maxNumericValue: 2500, aggregationMethod: "median" }], "cumulative-layout-shift": ["error", { maxNumericValue: 0.1, aggregationMethod: "median" }], "total-blocking-time": ["error", { maxNumericValue: 200, aggregationMethod: "median" }] } },
  upload: { target: "filesystem", outputDir: path.join(path.dirname(out), "lighthouse-live"), reportFilenamePattern: "%%PATHNAME%%-%%DATETIME%%.%%EXTENSION%%" },
} }, null, 2));
console.log(`\n${record.counts.pass}/${checks.length} checks pass → ${out}${failing.length ? `\nfailing: ${failing.join(", ")}` : ""}`);
process.exit(failing.length ? 1 : 0);
