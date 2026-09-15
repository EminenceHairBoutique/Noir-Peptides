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
    node scripts/live-probe.mjs --gate [recordFile]        # exit 0 only when the
                                                           # RECORD says green (the CI gate)
  env: CANONICAL_HOST (default: the site's configured production host,
  lib/siteUrl.js — every build canonicalises to it wherever it is served),
  LOCAL_SITEMAP_COUNT (fallback floor when dist/prerender-meta.json is absent;
  with it, the floor is this build's static routes + the live build's
  batch-permalink count, so an unpublished certificate is never a red).
  Exit 1 when any check fails. Never writes anything to the site.
*/
import fs from "node:fs";
import path from "node:path";
import { scanCopy } from "../src/lib/complianceScan.js";
import { buildCsp } from "./csp.mjs";
import { scanText, ACCEPTED } from "./_copy-scan.mjs";
import { parseSitemapPaths } from "./_sitemap-routes.mjs";
import { readJson, axeSummary, lighthouseMedians } from "./_evidence-fold.mjs";
import { PRODUCTION_HOST } from "../lib/siteUrl.js";
import { getAllProducts } from "../src/data/tier1Catalog.js";

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

// ── --gate: the published RECORD is the verdict (opt cycle 12 follow-up) ───
// The workflow runs the probe and the publish/gate step in two jobs, so the
// gate cannot read the probe step's outcome: a `steps.<id>` reference never
// crosses a job boundary — it reads as the empty string, and the gate that
// used one could never pass (four runs reported red before anyone noticed,
// because the site happened to be red too). The record the job just published
// is the one source of truth both a human and this gate read.
if (args[0] === "--gate") {
  const file = args[1] || "evidence/live-probe.json";
  const rec = readJson(file);
  if (!rec || typeof rec.verdict !== "string") {
    console.error(`::error::Live probe: no readable record at ${file} — the probe produced none, so production is UNPROVEN (not green).`);
    process.exit(1);
  }
  // A record the finalize step never folded (the probe died after the HTTP
  // phase) can read `verdict: "green"` from the HTTP checks alone, with axe
  // and Lighthouse never run. Unproven is not green: the three gate keys must
  // all be present, which only --finalize writes.
  const gates = rec.gates && typeof rec.gates === "object" ? rec.gates : {};
  const unfolded = ["http", "axe", "lighthouse"].filter((k) => !(k in gates));
  if (unfolded.length) {
    console.error(`::error::Live probe: the record at ${file} was never finalised (no ${unfolded.join(", ")} gate) — the probe did not finish, so production is UNPROVEN (not green).`);
    process.exit(1);
  }
  const hostIds = new Set((Array.isArray(rec.checks) ? rec.checks : []).filter((c) => c && c.group === "host-config").map((c) => c.id));
  const failing = Array.isArray(rec.failing) ? rec.failing : [];
  const hostFail = failing.filter((id) => hostIds.has(id));
  const rest = failing.filter((id) => !hostIds.has(id));
  const pass = rec.counts && Number.isFinite(rec.counts.pass) ? rec.counts.pass : null;
  const total = pass != null && Number.isFinite(rec.counts.fail) ? pass + rec.counts.fail : null;
  const missing = Array.isArray(rec.missing) ? rec.missing : [];
  console.log(
    `live probe: ${rec.verdict}` +
      (total != null ? ` (${pass}/${total} checks)` : "") +
      (rest.length ? ` — failing: ${rest.join(", ")}` : "") +
      (hostFail.length ? ` — host config: ${hostFail.length} check(s), set PROD_URL / CANONICAL_HOST` : "") +
      (missing.length ? ` — missing: ${missing.join(", ")}` : "")
  );
  if (rec.verdict === "green") process.exit(0);
  console.error(`::error::Live probe is not green (${rec.verdict}) — see live/latest.json on the evidence branch and the "Live probe failing" issue.`);
  process.exit(1);
}

// ── The HTTP checks ────────────────────────────────────────────────────────
const base = (args[0] || process.env.PROD_URL || "https://noir-peptides.vercel.app").replace(/\/+$/, "");
const out = args[1] || "evidence/live-probe.json";
// Opt cycle 12: the expected canonical host is the site's configured
// production host unless the owner sets CANONICAL_HOST — the probed URL's
// host was never right (a Vercel deployment URL is not the canonical).
const canonicalHost = process.env.CANONICAL_HOST || PRODUCTION_HOST;
const localSitemapCount = Number(process.env.LOCAL_SITEMAP_COUNT || 0) || null;
const localMeta = readJson(path.join(process.cwd(), "dist/prerender-meta.json"));
const checks = [];
const check = (id, pass, value, expected, note, group) => { checks.push({ id, pass: !!pass, value, expected, ...(note ? { note } : {}), ...(group ? { group } : {}) }); console.log(`  ${pass ? "✓" : "✗"} ${id}${pass ? "" : ` — got ${JSON.stringify(value)}, expected ${JSON.stringify(expected)}`}`); return !!pass; };
const HOST = "host-config"; // checks that read red until PROD_URL / CANONICAL_HOST match the real domain

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
  check(`canonical ${route}`, host === canonicalHost && pathname === route, can, `https://${canonicalHost}${route}`, undefined, HOST);
  // Opt cycle 12: the same text the dist gate scans (the RUO disclaimer constant removed).
  const got = scanCopy(scanText(r.text)).findings.map((f) => `${f.category}:${f.term.toLowerCase()}`).sort();
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
let liveMeta = null;
{
  const r = await get("/prerender-meta.json", { json: true });
  liveMeta = r.body && typeof r.body === "object" ? r.body : null;
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
  // Floor (opt cycle 12): this checkout's static routes + the LIVE build's
  // batch-permalink count. Static routes never shrink without a code change;
  // permalinks follow the owner's publish/unpublish decisions and are read
  // from the live build itself, so a legitimate unpublish is never a red.
  const staticRoutes = localMeta && Number.isFinite(Number(localMeta.sitemapUrlCount)) && Number.isFinite(Number(localMeta.permalinkProductCount))
    ? Number(localMeta.sitemapUrlCount) - Number(localMeta.permalinkProductCount) : null;
  const livePermalinks = Number.isFinite(Number(liveMeta?.permalinkProductCount)) ? Number(liveMeta.permalinkProductCount) : null;
  const floor = staticRoutes != null && livePermalinks != null ? staticRoutes + livePermalinks : (localSitemapCount || 60);
  check("sitemap url count", livePaths.length >= floor, livePaths.length, `≥ ${floor}${staticRoutes != null && livePermalinks != null ? ` (static ${staticRoutes} + live permalinks ${livePermalinks})` : localSitemapCount ? " (local build)" : ""}`);
  check("sitemap hosts", hosts.size === 1 && hosts.has(canonicalHost), [...hosts], [canonicalHost], undefined, HOST);
  // Soft-launch posture (opt cycle 12): nothing of a category the live build
  // hid may be in the live sitemap.
  const hidden = new Set(Array.isArray(liveMeta?.hiddenCategories) ? liveMeta.hiddenCategories : []);
  const bySlug = new Map(getAllProducts().map((p) => [p.slug, p.category_slug]));
  const leaked = livePaths.filter((p) => { const cat = p.match(/^\/shop\/([^/]+)$/); if (cat) return hidden.has(cat[1]); const prod = p.match(/^\/product\/([^/]+)$/); return Boolean(prod && hidden.has(bySlug.get(prod[1]))); });
  check("sitemap honours hidden categories", leaked.length === 0, leaked, [], `${hidden.size} hidden in the live build`);
  const robots = await get("/robots.txt");
  check("status /robots.txt", robots.status === 200, robots.status, 200);
  const sm = (robots.text.match(/^Sitemap:\s*(\S+)/m) || [])[1] || null;
  check("robots sitemap line", sm === `https://${canonicalHost}/sitemap.xml`, sm, `https://${canonicalHost}/sitemap.xml`, undefined, HOST);
}

// Payment rails: a JSON envelope, never a 5xx.
{
  const r = await get("/api/payment-rails", { json: true });
  check("rails envelope", r.status === 200 && Array.isArray(r.body?.rails) && typeof r.body?.unavailable === "boolean", { status: r.status, keys: r.body && typeof r.body === "object" ? Object.keys(r.body) : null }, { status: 200, keys: ["rails", "cryptoDiscountPct", "unavailable"] });
  // Opt cycle 12 (4.5): an envelope with NO payable rail is the maintenance
  // state a rotated key or a dropped env produces — the probe must say so.
  check("rails available", r.body?.unavailable === false && Array.isArray(r.body?.rails) && r.body.rails.length >= 1, Array.isArray(r.body?.rails) ? r.body.rails.map((x) => x.id) : null, "≥ 1 payable rail", "a live checkout needs at least one rail the server can charge");
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
  collect: { url: ["/", "/shop", "/product/bpc-157", "/test-results", "/shop/tissue-repair-research", "/test-results/bpc-157", "/partners"].map((r) => base + r), numberOfRuns: 3, settings: { chromeFlags: "--no-sandbox --headless=new" } },
  assert: { assertions: { "largest-contentful-paint": ["error", { maxNumericValue: 2500, aggregationMethod: "median" }], "cumulative-layout-shift": ["error", { maxNumericValue: 0.1, aggregationMethod: "median" }], "total-blocking-time": ["error", { maxNumericValue: 200, aggregationMethod: "median" }] } },
  upload: { target: "filesystem", outputDir: path.join(path.dirname(out), "lighthouse-live"), reportFilenamePattern: "%%PATHNAME%%-%%DATETIME%%.%%EXTENSION%%" },
} }, null, 2));
console.log(`\n${record.counts.pass}/${checks.length} checks pass → ${out}${failing.length ? `\nfailing: ${failing.join(", ")}` : ""}`);
process.exit(failing.length ? 1 : 0);
