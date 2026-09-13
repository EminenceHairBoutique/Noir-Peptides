/*
  scripts/evidence-summary.mjs   (opt cycle 9 — addendum B1)
  Folds one evidence run into a compact, dated evidence/summary.json the
  sandbox engine can score from (B4 / H-014): screenshot matrix, axe, the
  Lighthouse medians, the link-depth and rendered-hygiene crawls. Runs the
  two crawls itself so the record is complete even when an earlier CI step
  failed. Always exits 0 — the individual gates own their exit codes; this
  file records their verdicts.

  Usage: node scripts/evidence-summary.mjs [evidenceDir]
*/
import fs from "node:fs";
import path from "node:path";
import { spawnSync, execSync } from "node:child_process";

const dir = process.argv[2] || "evidence";
const read = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null; };
const BUDGET = { lcp: 2500, cls: 0.1, tbt: 200 };

function git(cmd) { try { return execSync(`git ${cmd}`, { encoding: "utf8" }).trim(); } catch { return null; } }
const sha = process.env.GITHUB_SHA || git("rev-parse HEAD");
const ref = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || git("branch --show-current");
const runUrl = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null;

// ── Screens ────────────────────────────────────────────────────────────────
const screens = read(path.join(dir, "screens.json"));
const screensOut = screens
  ? { views: screens.views, routes: screens.routes, widths: screens.widths, failing: screens.failing, overflow: screens.overflow, consoleErrors: screens.consoleErrors, skipped: screens.skipped, seconds: screens.seconds, pass: screens.failing.length === 0 }
  : { pass: null, note: "screens.json missing" };

// ── axe (the sweep's JSON: one record per violated rule per view) ──────────
const axe = read(path.join(dir, "axe.json"));
let axeOut = { pass: null, note: "axe.json missing" };
if (Array.isArray(axe)) {
  const byImpact = {};
  for (const r of axe) byImpact[r.impact] = (byImpact[r.impact] || 0) + r.count;
  const blocking = axe.filter((r) => r.impact === "critical" || r.impact === "serious");
  axeOut = {
    views: new Set(axe.map((r) => `${r.route}@${r.width}`)).size || undefined,
    findings: axe.length, byImpact,
    seriousOrCritical: blocking.reduce((n, r) => n + r.count, 0),
    blockingRules: [...new Set(blocking.map((r) => `${r.id} (${r.route}@${r.width})`))].slice(0, 20),
    pass: blocking.length === 0,
  };
}

// ── Lighthouse (LHCI filesystem upload: manifest.json + one LHR per run) ───
function lighthouse(subdir) {
  const manifest = read(path.join(dir, subdir, "manifest.json"));
  if (!Array.isArray(manifest)) return { pass: null, note: `${subdir}/manifest.json missing` };
  const byUrl = {};
  for (const m of manifest) {
    const lhr = read(path.isAbsolute(m.jsonPath) ? m.jsonPath : path.join(dir, subdir, path.basename(m.jsonPath)));
    if (!lhr) continue;
    const route = new URL(m.url).pathname;
    const a = lhr.audits || {};
    (byUrl[route] ||= { runs: 0, lcp: [], cls: [], tbt: [], perf: [] });
    byUrl[route].runs++;
    byUrl[route].lcp.push(a["largest-contentful-paint"]?.numericValue ?? NaN);
    byUrl[route].cls.push(a["cumulative-layout-shift"]?.numericValue ?? NaN);
    byUrl[route].tbt.push(a["total-blocking-time"]?.numericValue ?? NaN);
    byUrl[route].perf.push(lhr.categories?.performance?.score ?? NaN);
  }
  const routes = {};
  let allPass = true;
  for (const [route, v] of Object.entries(byUrl)) {
    const lcp = median(v.lcp), cls = median(v.cls), tbt = median(v.tbt), perf = median(v.perf);
    const pass = lcp <= BUDGET.lcp && cls <= BUDGET.cls && tbt <= BUDGET.tbt;
    if (!pass) allPass = false;
    routes[route] = { runs: v.runs, lcpMs: Math.round(lcp), cls: Number(cls.toFixed(3)), tbtMs: Math.round(tbt), perf: Number((perf * 100).toFixed(0)), pass };
  }
  return { budget: BUDGET, aggregation: "median", routes, pass: Object.keys(routes).length ? allPass : null };
}
const lh = lighthouse("lighthouse");

// ── Crawls (run here so the record is complete) ────────────────────────────
function crawl(script) {
  const r = spawnSync("node", [script], { encoding: "utf8" });
  const lines = `${r.stdout || ""}${r.stderr || ""}`.trim().split("\n");
  return { exit: r.status, pass: r.status === 0, tail: lines.slice(-3) };
}
const links = crawl("scripts/test-link-depth.mjs");
const hygiene = crawl("scripts/test-dist-hygiene.mjs");

const buildMeta = read(path.join("dist", "prerender-meta.json"));
const gates = { screens: screensOut.pass, axe: axeOut.pass, lighthouse: lh.pass, links: links.pass, hygiene: hygiene.pass };
const failing = Object.entries(gates).filter(([, v]) => v === false).map(([k]) => k);
const missing = Object.entries(gates).filter(([, v]) => v == null).map(([k]) => k);
const summary = {
  schema: 1, kind: "ci",
  sha, ref, run_url: runUrl, generated_at: new Date().toISOString(),
  build: { mode: "e2e", dbEnvPresent: buildMeta?.dbEnvPresent ?? null, note: buildMeta && !buildMeta.dbEnvPresent ? "CI build has no DB env: the trust pages are the documented shells; the live probe is the source for those" : undefined },
  gates, verdict: failing.length ? "red" : missing.length ? "incomplete" : "green", failing, missing,
  screens: screensOut, axe: axeOut, lighthouse: lh, links, hygiene,
};
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, "summary.json"), JSON.stringify(summary, null, 2) + "\n");
console.log(`evidence/summary.json: ${summary.verdict}${failing.length ? ` (failing: ${failing.join(", ")})` : ""}${missing.length ? ` (missing: ${missing.join(", ")})` : ""}`);
for (const [route, v] of Object.entries(lh.routes || {})) console.log(`  lighthouse ${route}: LCP ${v.lcpMs} ms · CLS ${v.cls} · TBT ${v.tbtMs} ms · perf ${v.perf} · ${v.pass ? "pass" : "FAIL"} (median of ${v.runs})`);
