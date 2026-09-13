/*
  scripts/test-seed-sync.mjs   (opt cycle 1 — scorecard 4.3, H-005)
  Two sources of truth exist for the catalog: src/data/tier1Catalog.js (what
  the prerenderer and the static fallback render) and
  supabase/migrations/0009_tier1_catalog.sql (what seeds the database).
  scripts/gen-tier1-seed.mjs regenerates the latter from the former — but
  nothing checked that the committed seed still matches the catalog.

  This regenerates the seed into memory and asserts it is BYTE-IDENTICAL to
  the committed file. The generator writes the file as a side effect, so the
  committed bytes are saved first and restored afterwards; the working tree is
  never left modified by this test.

  Run: node scripts/test-seed-sync.mjs   (wired into npm run test:unit)
*/
import { readFileSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import path from "node:path";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

const SEED = path.join(process.cwd(), "supabase", "migrations", "0009_tier1_catalog.sql");
const committed = readFileSync(SEED, "utf8");
let regenerated = null;
try {
  execFileSync(process.execPath, ["scripts/gen-tier1-seed.mjs"], { cwd: process.cwd(), stdio: ["ignore", "ignore", "pipe"] });
  regenerated = readFileSync(SEED, "utf8");
} finally {
  writeFileSync(SEED, committed, "utf8"); // never leave the tree modified
}

console.log("Catalog ↔ seed:");
ok(regenerated !== null, "gen-tier1-seed.mjs ran");
ok(regenerated === committed, "regenerating 0009 from tier1Catalog is byte-identical to the committed seed (no drift)");
if (regenerated !== null && regenerated !== committed) {
  const a = committed.split("\n"), b = regenerated.split("\n");
  const i = a.findIndex((line, idx) => line !== b[idx]);
  console.error(`    first difference at line ${i + 1}:\n      committed:   ${JSON.stringify(a[i])}\n      regenerated: ${JSON.stringify(b[i])}`);
}
ok(readFileSync(SEED, "utf8") === committed, "working tree restored (seed file unchanged after the test)");
ok(/on conflict \(slug\) do update set name = excluded\.name, description = excluded\.description/.test(committed), "category seed is on-conflict-UPDATE: re-running propagates copy changes to the DB (H-005 note)");

if (failures) {
  console.error(`\n${failures} seed-sync check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll seed-sync checks passed.");
