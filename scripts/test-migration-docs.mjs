/*
  scripts/test-migration-docs.mjs   (opt cycle 12 — scorecard 4.11 / 4.3 / 4.13)
  The migration-doc convention, enforced for EVERY migration (it was asserted
  for 0036 alone, which is how 0038 fell out of the Owner Sprint's D2 row):
    - every supabase/migrations/NNNN_*.sql (non-PROPOSED) has a `| NNNN |` row in docs/SCHEMA.md;
    - every NNNN ≥ 0032 has a docs/MIGRATIONS_*.md whose name carries it (0035 is a known exception:
      its apply note lives in RUNBOOK §6);
    - the highest NNNN appears in RUNBOOK §6's D2 row and in api/admin/owner-sprint.js's D2 title;
    - the Owner Sprint probe list and db:verify's feature list both name every NNNN from 0031 up.
  Run: node scripts/test-migration-docs.mjs   (in npm run test:unit)
*/
import fs from "node:fs";
import path from "node:path";

let failures = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { failures++; console.error(`  ✗ ${m}`); } };
const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");
const KNOWN_WITHOUT_DOC = new Set(["0035"]);

const files = fs.readdirSync("supabase/migrations").filter((f) => /^\d{4}_.*\.sql$/.test(f) && !/PROPOSED/i.test(f)).sort();
const ids = files.map((f) => f.slice(0, 4));
const highest = ids[ids.length - 1];
const schema = read("docs/SCHEMA.md");
const docs = fs.readdirSync("docs").filter((f) => /^MIGRATIONS_.*\.md$/.test(f));
const hasDoc = (id) => docs.some((d) => d.includes(id));

console.log(`Migrations on disk: ${ids.length} (highest ${highest}):`);
{
  const noRow = ids.filter((id) => !new RegExp(`^\\| ${id} \\|`, "m").test(schema));
  ok(noRow.length === 0, `every migration has a docs/SCHEMA.md row (missing: ${JSON.stringify(noRow)})`);
  const noDoc = ids.filter((id) => Number(id) >= 32 && !KNOWN_WITHOUT_DOC.has(id) && !hasDoc(id));
  ok(noDoc.length === 0, `every migration ≥ 0032 has a docs/MIGRATIONS_*.md (missing: ${JSON.stringify(noDoc)})`);
  const runbook = read("docs/RUNBOOK.md");
  ok(new RegExp(`\\| D2 \\| Migrations 0031–${highest} applied`).test(runbook), `RUNBOOK §6 D2 row names the highest migration (${highest})`);
  const sprint = read("api/admin/owner-sprint.js");
  ok(new RegExp(`title: "Apply 0031–${highest}, decide 0027"`).test(sprint), `Owner Sprint D2 title names the highest migration (${highest})`);
  const probed = ids.filter((id) => Number(id) >= 31);
  const unprobed = probed.filter((id) => !new RegExp(`\\["${id}",`).test(sprint));
  ok(unprobed.length === 0, `the Owner Sprint probes every migration from 0031 (missing: ${JSON.stringify(unprobed)})`);
  const dbv = read("scripts/db-verify.mjs");
  const unlisted = probed.filter((id) => !new RegExp(`"${id}"`).test(dbv));
  ok(unlisted.length === 0, `db:verify's feature-presence list names every migration from 0031 (missing: ${JSON.stringify(unlisted)})`);
  const checklist = read("docs/LAUNCH_CHECKLIST.md");
  ok(new RegExp(`0030–${highest}`).test(checklist), `docs/LAUNCH_CHECKLIST.md names the range up to ${highest}`);
}

if (failures) { console.error(`\n${failures} migration-doc check(s) FAILED`); process.exit(1); }
console.log("\nAll migration-doc checks passed.");
