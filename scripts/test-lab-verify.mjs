/*
  scripts/test-lab-verify.mjs
  Task 1 (two-factor COA verification): the outbound lab-lookup URL builder,
  purity-operator formatting, panel grouping, and the RLS/migration statics.

  The URL builder is security-relevant — the template is owner-entered data
  rendered as an outbound trust link — so malformed, non-https, and
  placeholder-less templates must all produce NO link rather than a broken one.

  Run: node scripts/test-lab-verify.mjs   (wired into npm run test:unit)
*/
import { readFileSync } from "node:fs";
import {
  labVerifyUrl,
  isTwoFactorVerifiable,
  formatPurity,
  groupTestPanel,
  PANEL_TIERS,
} from "../src/lib/labVerify.js";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

const lab = { name: "Example Lab", public_lookup_url_template: "https://lab.example/verify?code={code}" };

console.log("Two-factor lab lookup URL:");
ok(labVerifyUrl(lab, "ABC123") === "https://lab.example/verify?code=ABC123", "builds the lab URL from template + code");
ok(labVerifyUrl(lab, "a b/c") === "https://lab.example/verify?code=a%20b%2Fc", "lookup code is URL-encoded");
ok(isTwoFactorVerifiable({ lab_lookup_code: "ABC123" }, lab) === true, "isTwoFactorVerifiable true when both halves exist");

console.log("\nNo link rather than a broken one:");
ok(labVerifyUrl(lab, "") === null, "no lookup code → null");
ok(labVerifyUrl(lab, null) === null, "null lookup code → null");
ok(labVerifyUrl(null, "ABC123") === null, "no lab → null");
ok(labVerifyUrl({ public_lookup_url_template: "" }, "ABC123") === null, "empty template → null");
ok(
  labVerifyUrl({ public_lookup_url_template: "https://lab.example/verify" }, "ABC") === null,
  "template without the {code} placeholder → null (would not resolve a lot)"
);
ok(
  labVerifyUrl({ public_lookup_url_template: "http://lab.example/verify?code={code}" }, "ABC") === null,
  "http template REJECTED — a verification claim must not be downgradeable"
);
ok(
  labVerifyUrl({ public_lookup_url_template: "javascript:alert(1)?{code}" }, "ABC") === null,
  "javascript: scheme rejected"
);
ok(
  labVerifyUrl({ public_lookup_url_template: "not a url {code}" }, "ABC") === null,
  "unparseable template rejected"
);
ok(isTwoFactorVerifiable({ lab_lookup_code: null }, lab) === false, "no code → not two-factor verifiable");

console.log("\nPurity claim fidelity (purity_operator):");
ok(formatPurity({ purity_percent: 99.2 }) === "99.2%", "exact purity renders plainly");
ok(formatPurity({ purity_percent: 99, purity_operator: ">=" }) === ">= 99%", "'>=' operator preserved — not shown as exact");
ok(formatPurity({ purity_percent: 98, purity_operator: ">" }) === "> 98%", "'>' operator preserved");
ok(formatPurity({ purity_percent: 99, purity_operator: "=" }) === "99%", "'=' operator is not rendered redundantly");
ok(formatPurity({ purity_percent: null, hplc: "99.1%" }) === "99.1%", "falls back to the recorded hplc string");
ok(formatPurity({}) === null, "no purity data → null (caller omits the field)");

console.log("\nAnalytical panel grouping:");
const tests = [
  { id: 1, panel_category: "contamination", test_name: "Bioburden", sort_order: 2 },
  { id: 2, panel_category: "identity_potency", test_name: "Mass confirmation", sort_order: 1 },
  { id: 3, panel_category: "contamination", test_name: "Endotoxin", sort_order: 1 },
];
const grouped = groupTestPanel(tests);
ok(grouped.length === 2, "only NON-EMPTY tiers are returned (2 of 3 here)");
ok(grouped[0].key === "identity_potency", "tiers come back in canonical display order");
ok(grouped[1].tests[0].test_name === "Endotoxin", "tests sorted by sort_order within a tier");
ok(groupTestPanel([]).length === 0, "empty panel → nothing renders");
ok(groupTestPanel(null).length === 0, "null panel tolerated");
ok(
  grouped.reduce((n, t) => n + t.tests.length, 0) === tests.length,
  "displayed analysis count is derived from actual rows, never hardcoded"
);
ok(PANEL_TIERS.length === 3, "three canonical panel tiers");

console.log("\nMigration 0032 (static):");
const mig = readFileSync(new URL("../supabase/migrations/0032_labs_batch_tests_two_factor.sql", import.meta.url), "utf8");
const exec = mig.replace(/--[^\n]*/g, "");
ok(/create table if not exists public\.labs/.test(exec), "labs table created idempotently");
ok(/create table if not exists public\.batch_tests/.test(exec), "batch_tests table created idempotently");
ok(/alter table public\.coas add column if not exists lab_lookup_code/.test(exec), "coas gains lab_lookup_code");
ok(/alter table public\.coas add column if not exists net_peptide_content_mg/.test(exec), "coas gains net_peptide_content_mg");
ok(!/drop column|drop table|truncate|delete from/i.test(exec), "migration is STRICTLY ADDITIVE — no drop/truncate/delete");
ok(!/insert into/i.test(exec), "migration seeds NO data (labs and panels are owner-entered)");
ok(/enable row level security/.test(exec), "RLS enabled on the new tables");
ok(/labs_public_read/.test(exec) && /batch_tests_public_read/.test(exec), "public read policies present");
ok(
  /c\.is_published is not false/.test(exec),
  "batch_tests are readable only for PUBLISHED certificates (follows the 0014 pattern)"
);
ok(!/grant (insert|update|delete)/i.test(exec), "no write grant to public roles — writes stay service-role");
ok(/create unique index if not exists uq_coas_product_lot/.test(exec), "lot number unique per product");
ok(/idx_coas_lot_number/.test(exec), "lot lookup index for the QR path");

console.log("\nWiring (source guards):");
const verifyApi = readFileSync(new URL("../api/verify.js", import.meta.url), "utf8");
ok(/labs \(/.test(verifyApi), "QR verification API joins the lab record");
ok(/batch_tests/.test(verifyApi), "QR verification API returns the analytical panel");
const coaLib = readFileSync(new URL("../src/lib/coas.js", import.meta.url), "utf8");
ok(/labs \(/.test(coaLib), "public COA data layer joins labs (no N+1)");
ok(/getBatchTests/.test(coaLib), "public COA data layer exposes the panel fetch");

if (failures) {
  console.error(`\n${failures} lab-verify check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll lab-verify checks passed.");
