/*
  scripts/_evidence-fold.mjs   (opt cycle 9 — shared by evidence-summary.mjs and live-probe.mjs)
  Folds the axe sweep's JSON and an LHCI filesystem upload into the compact
  shapes the evidence records carry.
*/
import fs from "node:fs";
import path from "node:path";

export const BUDGET = { lcp: 2500, cls: 0.1, tbt: 200 };
export const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
export const median = (xs) => { const s = [...xs].filter((x) => Number.isFinite(x)).sort((a, b) => a - b); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : NaN; };

/** The a11y sweep's report (one record per violated rule per view) → counts. */
export function axeSummary(report) {
  if (!Array.isArray(report)) return { pass: null, note: "axe report missing" };
  const byImpact = {};
  for (const r of report) byImpact[r.impact] = (byImpact[r.impact] || 0) + r.count;
  const blocking = report.filter((r) => r.impact === "critical" || r.impact === "serious");
  return {
    findings: report.length, byImpact,
    seriousOrCritical: blocking.reduce((n, r) => n + r.count, 0),
    blockingRules: [...new Set(blocking.map((r) => `${r.id} (${r.route}@${r.width})`))].slice(0, 20),
    pass: blocking.length === 0,
  };
}

/** LHCI `upload.target: filesystem` output dir → per-route medians against the budgets. */
export function lighthouseMedians(dir) {
  const manifest = readJson(path.join(dir, "manifest.json"));
  if (!Array.isArray(manifest)) return { pass: null, note: `${dir}/manifest.json missing` };
  const byUrl = {};
  for (const m of manifest) {
    const lhr = readJson(path.isAbsolute(m.jsonPath) ? m.jsonPath : path.join(dir, path.basename(m.jsonPath)));
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
    routes[route] = { runs: v.runs, lcpMs: Math.round(lcp), cls: Number(cls.toFixed(3)), tbtMs: Math.round(tbt), perf: Math.round(perf * 100), pass };
  }
  return { budget: BUDGET, aggregation: "median", routes, pass: Object.keys(routes).length ? allPass : null };
}
