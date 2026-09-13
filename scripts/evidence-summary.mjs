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
import { readJson as read, axeSummary, lighthouseMedians } from "./_evidence-fold.mjs";

function git(cmd) { try { return execSync(`git ${cmd}`, { encoding: "utf8" }).trim(); } catch { return null; } }
const sha = process.env.GITHUB_SHA || git("rev-parse HEAD");
const ref = process.env.GITHUB_HEAD_REF || process.env.GITHUB_REF_NAME || git("branch --show-current");
const runUrl = process.env.GITHUB_RUN_ID ? `${process.env.GITHUB_SERVER_URL || "https://github.com"}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : null;

// ── Screens ────────────────────────────────────────────────────────────────
const screens = read(path.join(dir, "screens.json"));
const screensOut = screens
  ? { views: screens.views, routes: screens.routes, widths: screens.widths, failing: screens.failing, overflow: screens.overflow, consoleErrors: screens.consoleErrors, skipped: screens.skipped, seconds: screens.seconds, pass: screens.failing.length === 0 }
  : { pass: null, note: "screens.json missing" };

// ── axe (the sweep's JSON) and Lighthouse (LHCI filesystem upload) ────────
const axeOut = axeSummary(read(path.join(dir, "axe.json")));
const lh = lighthouseMedians(path.join(dir, "lighthouse"));

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
