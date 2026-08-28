/*
  scripts/test-cas.mjs
  W1 (trust surface): CAS validator + ingest guards + the null-CAS render path.
  Style mirrors scripts/test-guardrail.mjs.

  Run: node scripts/test-cas.mjs   (wired into npm run test:unit)
*/
import { readFileSync } from "node:fs";
import { isValidCas, normalizeCas } from "../lib/cas.js";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

console.log("CAS validator — known-valid registry numbers:");
// Real, public CAS registry numbers with correct check digits.
for (const cas of ["7732-18-5", "50-00-0", "58-08-2", "64-17-5", "7647-14-5"]) {
  ok(isValidCas(cas), `${cas} validates`);
}

console.log("\nCAS validator — malformed / bad checksum (must reject):");
ok(!isValidCas("7732-18-4"), "bad check digit rejected (7732-18-4)");
ok(!isValidCas("50-00-1"), "bad check digit rejected (50-00-1)");
ok(!isValidCas("1-23-4"), "body too short (1 digit) rejected");
ok(!isValidCas("12345678-12-3"), "body too long (8 digits) rejected");
ok(!isValidCas("7732-1-5"), "middle group must be 2 digits");
ok(!isValidCas("7732-18-55"), "check group must be 1 digit");
ok(!isValidCas("7732185"), "missing hyphens rejected");
ok(!isValidCas("77a2-18-5"), "letters rejected");
ok(!isValidCas(""), "empty rejected");
ok(!isValidCas(null), "null rejected");

console.log("\nCAS normalization:");
ok(normalizeCas("  7732-18-5  ") === "7732-18-5", "whitespace trimmed");
ok(normalizeCas("7732‐18‐5") === "7732-18-5", "unicode hyphens unified");
ok(normalizeCas("7732 - 18 - 5") === "7732-18-5", "internal whitespace collapsed");
ok(isValidCas("7732–18–5"), "en-dash form validates after normalization");

console.log("\nIngest guards (source):");
const ingest = readFileSync(new URL("../api/admin/coa.js", import.meta.url), "utf8");
ok(/isValidCas/.test(ingest), "admin COA ingest validates CAS");
ok(/__error/.test(ingest) && /400/.test(ingest), "malformed CAS is REJECTED with 400, not silently stored");
ok(!/product\.cas|catalog.*cas/i.test(ingest), "ingest never auto-copies a product-level CAS onto certificates");
const coaLib = readFileSync(new URL("../src/lib/coas.js", import.meta.url), "utf8");
ok(/cas_number/.test(coaLib), "public COA data layer selects cas_number");

console.log("\nMigration (static):");
const mig = readFileSync(new URL("../supabase/migrations/0031_coa_cas_number.sql", import.meta.url), "utf8");
ok(/add column if not exists cas_number text/.test(mig), "0031 adds nullable cas_number idempotently");
ok(!/not null/.test(mig.replace(/--[^\n]*/g, "").match(/cas_number text[^;]*/)?.[0] || ""), "cas_number is nullable");
ok(/create index if not exists/.test(mig), "search index present");
ok(!/insert into|update .* set cas/i.test(mig.replace(/--[^\n]*/g, "")), "migration populates NO data");

if (failures) {
  console.error(`\n${failures} CAS check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll CAS checks passed.");
