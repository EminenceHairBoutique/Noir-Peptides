/*
  scripts/evidence-latest.mjs   (opt cycle 9 — addendum B4)
  The sandbox engine's fallback reader. Fetches the orphan `evidence` branch
  and prints the newest CI summary and live-probe record with their date and
  age, so a cycle that cannot reach CI or production still scores from dated
  evidence instead of `?` (H-014). Exits 0 always; absence is reported, not
  thrown.

  Usage: node scripts/evidence-latest.mjs [--json] [--remote origin]
*/
import { execFileSync } from "node:child_process";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const remote = args.includes("--remote") ? args[args.indexOf("--remote") + 1] : "origin";
const BRANCH = process.env.EVIDENCE_BRANCH || "evidence";
const git = (...a) => execFileSync("git", a, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
const tryGit = (...a) => { try { return git(...a); } catch { return null; } };

const fetched = tryGit("fetch", "--quiet", remote, `${BRANCH}:refs/remotes/${remote}/${BRANCH}`) !== null;
const tip = tryGit("rev-parse", "--short", `refs/remotes/${remote}/${BRANCH}`);
const out = { branch: `${remote}/${BRANCH}`, fetched, tip, ci: null, live: null };

function readLatest(kind) {
  const raw = tryGit("show", `refs/remotes/${remote}/${BRANCH}:${kind}/latest.json`);
  if (!raw) return null;
  try {
    const j = JSON.parse(raw);
    const at = j.generated_at ? new Date(j.generated_at) : null;
    const ageH = at ? Math.round((Date.now() - at.getTime()) / 36e5) : null;
    return { ...j, _ageHours: ageH, _stale: ageH == null || ageH > 24 * 7 };
  } catch { return { _error: "unparseable" }; }
}
out.ci = readLatest("ci");
out.live = readLatest("live");

if (asJson) { console.log(JSON.stringify(out, null, 2)); process.exit(0); }
console.log(`evidence branch ${out.branch}: ${tip ? `tip ${tip}` : fetched ? "absent" : "not fetchable (no remote access?)"}`);
for (const kind of ["ci", "live"]) {
  const r = out[kind];
  if (!r) { console.log(`  ${kind}/latest.json: none — score from local evidence only and say so`); continue; }
  if (r._error) { console.log(`  ${kind}/latest.json: ${r._error}`); continue; }
  const head = kind === "ci" ? `sha ${String(r.sha || "").slice(0, 7)} ref ${r.ref || "?"}` : `url ${r.url || "?"}`;
  console.log(`  ${kind}/latest.json: ${r.verdict || "?"} · ${r.generated_at || "undated"} (${r._ageHours ?? "?"} h old${r._stale ? " — STALE, >7 d: cite the date, score SUSPECTED" : ""}) · ${head}${r.run_url ? ` · ${r.run_url}` : ""}`);
  if (r.failing?.length) console.log(`    failing: ${r.failing.join(", ")}`);
  if (r.missing?.length) console.log(`    missing: ${r.missing.join(", ")}`);
  if (r.lighthouse?.routes) for (const [route, v] of Object.entries(r.lighthouse.routes)) console.log(`    lighthouse ${route}: LCP ${v.lcpMs} ms · CLS ${v.cls} · TBT ${v.tbtMs} ms · ${v.pass ? "pass" : "FAIL"}`);
  if (r.checks) { const bad = r.checks.filter((c) => c.pass === false); console.log(`    checks: ${r.checks.length - bad.length}/${r.checks.length} pass${bad.length ? ` — failing: ${bad.map((c) => c.id).join(", ")}` : ""}`); }
}
