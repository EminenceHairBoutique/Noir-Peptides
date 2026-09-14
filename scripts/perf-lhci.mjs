/*
  scripts/perf-lhci.mjs   (opt cycle 10 — scorecard 4.7; H-013 measurement lane)
  Runs Lighthouse CI exactly as the Evidence workflow does (lighthouserc.json:
  serve-dist on :4181, mobile simulation, 3 runs per route) and keeps the
  reports under evidence/lhci-<label>/ with a medians.json, so two builds can
  be compared through the SAME delivery path and gate that scores the card.

    node scripts/perf-lhci.mjs <label> [--runs 5] [--urls /shop,/product/bpc-157]  # collect + upload + medians
    node scripts/perf-lhci.mjs --compare <a> <b>  # medians side by side (b − a)

  Never asserts; the gate is lighthouserc.json in CI.
*/
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { lighthouseMedians } from "./_evidence-fold.mjs";

const args = process.argv.slice(2);
const LHCI = ["--yes", "@lhci/cli@0.14.0"];
const fmt = (v) => `LCP ${String(v.lcpMs).padStart(4)} ms · TBT ${String(v.tbtMs).padStart(3)} ms · CLS ${v.cls} · perf ${v.perf}${v.pass ? "" : " · over budget"}`;

if (args[0] === "--compare") {
  const [a, b] = [args[1], args[2]].map((l) => JSON.parse(fs.readFileSync(path.join("evidence", `lhci-${l}`, "medians.json"), "utf8")));
  console.log(`${args[1]} → ${args[2]} (median of ${a.runs} vs ${b.runs} runs)`);
  for (const route of Object.keys(a.routes)) {
    const x = a.routes[route], y = b.routes[route] || {};
    const d = (k) => (Number.isFinite(y[k]) ? `${y[k] - x[k] >= 0 ? "+" : ""}${k === "cls" ? (y[k] - x[k]).toFixed(3) : Math.round(y[k] - x[k])}` : "?");
    console.log(`  ${route.padEnd(20)} LCP ${x.lcpMs} → ${y.lcpMs} (${d("lcpMs")} ms) · TBT ${x.tbtMs} → ${y.tbtMs} (${d("tbtMs")} ms) · CLS ${x.cls} → ${y.cls}`);
  }
  process.exit(0);
}

const runsIdx = args.indexOf("--runs");
const runs = runsIdx >= 0 ? Number(args[runsIdx + 1]) || 3 : 3;
// Opt cycle 12: `--urls /a,/b` narrows a lever run to the routes it targets
// (same server, same config, same gate); no flag = every gated URL.
const urlsIdx = args.indexOf("--urls");
const urls = urlsIdx >= 0 ? String(args[urlsIdx + 1] || "").split(",").map((u) => u.trim()).filter(Boolean) : [];
const label = args[0];
if (!label || !/^[\w.-]+$/.test(label)) { console.error("usage: node scripts/perf-lhci.mjs <label> | --compare <a> <b>"); process.exit(2); }
if (!fs.existsSync("dist/index.html")) { console.error("dist/ missing — build first"); process.exit(1); }
const outDir = path.join("evidence", `lhci-${label}`);
fs.rmSync(".lighthouseci", { recursive: true, force: true });
fs.rmSync(outDir, { recursive: true, force: true });
const env = { ...process.env, CHROME_PATH: process.env.CHROME_PATH || process.env.PLAYWRIGHT_CHROMIUM_PATH || "/opt/pw-browsers/chromium-1194/chrome-linux/chrome" };
const run = (a) => { const r = spawnSync("npx", [...LHCI, ...a], { stdio: ["ignore", "pipe", "pipe"], encoding: "utf8", env }); if (r.status !== 0) { console.error(r.stdout, r.stderr); process.exit(r.status ?? 1); } return r.stdout; };
const t0 = Date.now();
run(["collect", "--config=lighthouserc.json", `--collect.numberOfRuns=${runs}`, ...urls.map((u) => `--collect.url=http://localhost:4181${u.startsWith("/") ? u : `/${u}`}`)]);
run(["upload", "--config=lighthouserc.json", `--upload.outputDir=${outDir}`]);
const m = lighthouseMedians(outDir);
const runsSeen = Object.values(m.routes)[0]?.runs ?? 0;
fs.writeFileSync(path.join(outDir, "medians.json"), JSON.stringify({ label, generated_at: new Date().toISOString(), runs: runsSeen, seconds: Math.round((Date.now() - t0) / 1000), ...m }, null, 2) + "\n");
console.log(`lhci-${label}: ${runsSeen} runs/route in ${Math.round((Date.now() - t0) / 1000)} s`);
for (const [route, v] of Object.entries(m.routes)) console.log(`  ${route.padEnd(20)} ${fmt(v)}`);
