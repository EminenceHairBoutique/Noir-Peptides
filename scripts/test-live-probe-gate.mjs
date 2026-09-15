/*
  scripts/test-live-probe-gate.mjs   (opt cycle 12 follow-up — scorecard 4.12)
  The live probe's CI verdict, executed at both poles (H-018). The workflow
  runs the probe and the publish/gate step in separate jobs, so the gate reads
  the RECORD the publish job downloaded — `node scripts/live-probe.mjs --gate`
  — never a step outcome from the other job. This proves the gate:
    green record   → exit 0 (a green run is reachable — the defect this fixes
                     made every run red, whatever production did)
    red            → exit 1, naming the failing checks, host config apart
    incomplete     → exit 1 (a half-finished probe is not a pass)
    missing / junk → exit 1 (unproven is not green)
  Run: node scripts/test-live-probe-gate.mjs   (wired into npm run test:unit)
*/
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

let failures = 0;
const ok = (cond, msg) => { if (cond) console.log(`  ✓ ${msg}`); else { failures++; console.error(`  ✗ ${msg}`); } };

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "probe-gate-"));
const write = (name, rec) => { const f = path.join(dir, name); fs.writeFileSync(f, typeof rec === "string" ? rec : JSON.stringify(rec, null, 2)); return f; };
const gate = (file) => {
  const r = spawnSync(process.execPath, ["scripts/live-probe.mjs", "--gate", file], { encoding: "utf8" });
  return { code: r.status, out: r.stdout || "", err: r.stderr || "" };
};

// The shape scripts/live-probe.mjs --finalize writes (live/latest.json).
const record = (over = {}) => ({
  schema: 1, kind: "live", url: "https://example.invalid", generated_at: "2026-09-14T21:54:01.832Z",
  checks: [
    { id: "status /", pass: true },
    { id: "canonical /", pass: false, group: "host-config" },
    { id: "sitemap hosts", pass: false, group: "host-config" },
    { id: "rails available", pass: false },
  ],
  counts: { pass: 26, fail: 11 },
  gates: { http: false, axe: true, lighthouse: false },
  failing: ["canonical /", "sitemap hosts", "rails available", "lighthouse"],
  missing: [],
  verdict: "red",
  ...over,
});

console.log("A green record is the only thing that passes:");
{
  const g = gate(write("green.json", record({ verdict: "green", failing: [], missing: [], counts: { pass: 37, fail: 0 }, gates: { http: true, axe: true, lighthouse: true } })));
  ok(g.code === 0, `green → exit 0 (${g.code}) — a green live probe is reachable`);
  ok(/live probe: green/.test(g.out), `green → the one-line summary says green (${g.out.trim()})`);
  ok(!/::error::/.test(g.err), "green → no error annotation");
}

console.log("\nEverything else fails, and says why:");
{
  const r = gate(write("red.json", record()));
  ok(r.code === 1, `red → exit 1 (${r.code})`);
  ok(/rails available/.test(r.out) && /lighthouse/.test(r.out), "red → the summary names the failing checks");
  ok(/host config: 2 check\(s\)/.test(r.out) && /PROD_URL \/ CANONICAL_HOST/.test(r.out), `red → host-config reds counted apart, with the variables to set (${r.out.trim()})`);
  ok(/::error::Live probe is not green \(red\)/.test(r.err), "red → an ::error:: annotation GitHub surfaces on the run");

  const inc = gate(write("incomplete.json", record({ verdict: "incomplete", failing: [], missing: ["lighthouse"], gates: { http: true, axe: true, lighthouse: null } })));
  ok(inc.code === 1 && /missing: lighthouse/.test(inc.out), `incomplete → exit 1, names what is missing (${inc.code})`);

  const gone = gate(path.join(dir, "no-such-record.json"));
  ok(gone.code === 1 && /UNPROVEN/.test(gone.err), `a missing record → exit 1, "unproven is not green" (${gone.code})`);

  const junk = gate(write("junk.json", "{ not json"));
  ok(junk.code === 1, `unreadable JSON → exit 1 (${junk.code})`);

  const noVerdict = gate(write("noverdict.json", { schema: 1, kind: "live", checks: [] }));
  ok(noVerdict.code === 1, `a record with no verdict → exit 1 (${noVerdict.code})`);

  // Only the exact string "green" passes: no truthiness, no prefix match.
  const nearly = gate(write("nearly.json", record({ verdict: "greenish", failing: [] })));
  ok(nearly.code === 1, `a verdict that merely starts with "green" → exit 1 (${nearly.code})`);

  // The probe writes a record after the HTTP phase and folds axe + Lighthouse
  // in later. A run that died in between leaves an HTTP-only record that can
  // say "green" while two thirds of the probe never ran.
  const unfolded = gate(write("unfolded.json", { schema: 1, kind: "live", checks: [{ id: "status /", pass: true }], counts: { pass: 21, fail: 0 }, gates: { http: true }, failing: [], verdict: "green" }));
  ok(unfolded.code === 1 && /never finalised/.test(unfolded.err), `an HTTP-only record claiming green → exit 1, "unproven is not green" (${unfolded.code})`);

  const badChecks = gate(write("badchecks.json", record({ checks: { "status /": true } })));
  ok(badChecks.code === 1 && !/TypeError/.test(badChecks.err), `a record whose checks is not an array → exit 1, no crash (${badChecks.code})`);
}

console.log("\nThe workflow runs this gate, not a cross-job step outcome:");
{
  const yml = fs.readFileSync(".github/workflows/live-probe.yml", "utf8");
  const publish = yml.slice(yml.indexOf("\n  publish:"));
  ok(/run: node scripts\/live-probe\.mjs --gate evidence\/live-probe\.json/.test(publish), "the publish job's last step runs the gate on the downloaded record");
  // Catches the `${{ steps.x.outcome }}` spelling too, and ignores comments.
  const code = publish.split("\n").filter((l) => !/^\s*#/.test(l)).join("\n");
  ok(!/steps\.[A-Za-z0-9_-]+\./.test(code), "no step in the publish job reads a steps.<id> expression at all (in any spelling)");
}

fs.rmSync(dir, { recursive: true, force: true });
if (failures) { console.error(`\n${failures} live-probe-gate check(s) FAILED`); process.exit(1); }
console.log("\nAll live-probe-gate checks passed.");
