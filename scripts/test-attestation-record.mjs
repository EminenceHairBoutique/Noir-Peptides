/*
  scripts/test-attestation-record.mjs   (opt cycle 2 — scorecard 4.1)
  Every order must persist the research-use attestation with version,
  statements, legal name, IP AND user agent (attestation_audit). The UA was
  captured at attestation time (profiles.attestation_user_agent, migration
  0003) but never copied onto the order record. Executes the real
  logCheckoutAttestation against a stubbed database.

  Run: node scripts/test-attestation-record.mjs   (wired into npm run test:unit)
*/
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

process.env.VITE_SUPABASE_URL ||= "https://placeholder.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "placeholder";
const outfile = path.join(process.cwd(), `.attestation-test-${Date.now()}.mjs`);
await build({
  entryPoints: [path.join(process.cwd(), "scripts/_attestation-entry.mjs")],
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  external: ["resend", "@anthropic-ai/sdk", "@supabase/supabase-js", "stripe"],
  plugins: [{ name: "stub-db", setup(b) { b.onResolve({ filter: /supabaseServer\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-supabase.mjs") })); } }],
});
const { logCheckoutAttestation, FIXTURES, LOG } = await import(`file://${outfile}`);

FIXTURES.profiles = [{
  id: "user-1",
  attestation_version: "2026-08-01",
  attestation_statements: ["research-use-only", "not-for-human-use"],
  attestation_legal_name: "A. Researcher",
  attestation_ip: "203.0.113.7",
  attestation_user_agent: "Mozilla/5.0 (X11; Linux x86_64) TestUA/1.0",
}];
FIXTURES.attestation_audit = [];

console.log("attestation record on an order:");
await logCheckoutAttestation({ userId: "user-1", orderNumber: "NP-1001", ip: "198.51.100.9" });
const row = (LOG.find((l) => l.table === "attestation_audit" && l.op === "insert") || {}).row;
ok(Boolean(row), "an attestation_audit row was written");
ok(row?.version === "2026-08-01", "version copied from the profile snapshot");
ok(Array.isArray(row?.statements) && row.statements.length === 2, "statements copied");
ok(row?.legal_name === "A. Researcher", "legal name copied");
ok(row?.ip_address === "198.51.100.9", "IP: the order's own IP wins over the attestation-time IP");
ok(row?.user_agent === "Mozilla/5.0 (X11; Linux x86_64) TestUA/1.0", "user agent: the attestation-time UA is persisted on the order (was missing before cycle 2)");
ok(row?.order_id === "NP-1001" && row?.context === "checkout", "order id + context recorded");

console.log("\nno attestation → no record (never fabricated):");
LOG.length = 0;
FIXTURES.profiles.push({ id: "user-2", attestation_version: null });
await logCheckoutAttestation({ userId: "user-2", orderNumber: "NP-1002", ip: "198.51.100.9" });
ok(!LOG.some((l) => l.table === "attestation_audit"), "a profile without an attestation writes nothing");

console.log("\nstatic:");
{
  const src = fs.readFileSync(path.join(process.cwd(), "lib/payments/fulfillment.js"), "utf8");
  ok(/attestation_user_agent/.test(src) && /user_agent: p\.attestation_user_agent \|\| null/.test(src), "fulfillment selects and writes the user agent");
  const mig = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/0022_attestation_columns_backfill.sql"), "utf8");
  ok(/add column if not exists user_agent text/.test(mig), "attestation_audit.user_agent exists in the migration chain (no schema change needed)");
}

fs.rmSync(outfile, { force: true });
if (failures) { console.error(`\n${failures} attestation-record check(s) FAILED`); process.exit(1); }
console.log("\nAll attestation-record checks passed.");
