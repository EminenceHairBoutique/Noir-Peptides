/*
  scripts/test-secret-scrubber.mjs   (opt cycle 2 — scorecard 4.2)
  The scrubber in lib/apiError.js must cover every key SHAPE this deployment
  configures, because failSafely logs the real error text and an SDK error
  can quote the key it was called with. Cycle-2 gap: Anthropic (sk-ant-…) and
  Resend (re_…) had no pattern.

  Run: node scripts/test-secret-scrubber.mjs   (wired into npm run test:unit)
*/
import { scrubSecrets } from "../lib/apiError.js";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};
const gone = (text, secret) => !scrubSecrets(text).includes(secret) && scrubSecrets(text).includes("[redacted]");

// Synthetic shapes only — no real credentials.
const ANT = "sk-ant-api03-" + "Ab1".repeat(20);
const RE = "re_" + "Xy9z".repeat(6);
console.log("new shapes:");
ok(gone(`Anthropic error: invalid x-api-key ${ANT}`, ANT), "Anthropic sk-ant-… key redacted");
ok(gone(`Resend: 401 for key ${RE}`, RE), "Resend re_… key redacted");
ok(gone(`{"apiKey":"${ANT}"}`, ANT), "sk-ant-… inside JSON redacted");
console.log("\nexisting shapes still covered:");
ok(gone("sk_live_" + "a1B2".repeat(6), "sk_live_"), "Stripe live key");
ok(gone("sk_test_" + "a1B2".repeat(6), "sk_test_"), "Stripe test key");
ok(gone("whsec_" + "Zz9".repeat(8), "whsec_"), "Stripe webhook secret");
ok(gone("Authorization: Bearer abc.def.ghi", "abc.def.ghi"), "Bearer token");
ok(gone("eyJhbGciOi.eyJzdWIiOi.SflKxw", "eyJhbGciOi"), "JWT");
console.log("\nno false positives on ordinary text:");
for (const t of ["order re_confirmed by re_", "task sk-ant", "re_12", "the reason is unclear", "sk-ant-"]) {
  ok(scrubSecrets(t) === t, `"${t}" untouched`);
}
ok(scrubSecrets(null) === "" && scrubSecrets(undefined) === "", "null/undefined → empty string");

if (failures) { console.error(`\n${failures} secret-scrubber check(s) FAILED`); process.exit(1); }
console.log("\nAll secret-scrubber checks passed.");
