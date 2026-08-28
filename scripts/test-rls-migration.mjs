/*
  scripts/test-rls-migration.mjs
  Static validation of the profiles RLS escalation-fix migration
  (supabase/migrations/0030_profiles_rls_escalation_fix.sql). No database —
  asserts the SQL text encodes the intended policy shape so a future edit
  can't silently weaken it. Style mirrors scripts/test-guardrail.mjs.

  Run: node scripts/test-rls-migration.mjs   (wired into npm run test:unit)
*/
import fs from "node:fs";
import path from "node:path";

const MIGRATION = path.join(process.cwd(), "supabase/migrations/0030_profiles_rls_escalation_fix.sql");
const rawSql = fs.readFileSync(MIGRATION, "utf8");
// Strip line comments so checks see executable SQL only — this migration's
// comments deliberately quote the anti-patterns they warn against (e.g. the
// no-op column-level revoke), which would otherwise trip the guards below.
const sql = rawSql.replace(/--[^\n]*/g, "");
// Collapse whitespace for robust substring checks (SQL spans many lines).
const flat = sql.replace(/\s+/g, " ").toLowerCase();

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};

console.log("RLS migration 0030 — static checks:");

// 1. The primary fix: UPDATE revoked from BOTH public roles.
ok(/revoke\s+update\s+on\s+public\.profiles\s+from\s+anon/i.test(sql), "revokes UPDATE from anon");
ok(
  /revoke\s+update\s+on\s+public\.profiles\s+from\s+authenticated/i.test(sql),
  "revokes UPDATE from authenticated"
);

// 2. Role-guarded so it applies on a vanilla Postgres too (CI fresh-PG16).
ok(flat.includes("pg_roles where rolname = 'anon'"), "revoke is guarded on anon role existence");
ok(
  flat.includes("pg_roles where rolname = 'authenticated'"),
  "revoke is guarded on authenticated role existence"
);

// 3. service_role / postgres must NOT be revoked (server paths keep working).
ok(!/revoke\s+update\s+on\s+public\.profiles\s+from\s+service_role/i.test(sql), "service_role UPDATE untouched");
ok(!/revoke[^;]*\bfrom\s+postgres\b/i.test(sql), "postgres UPDATE untouched");

// 4. Defence-in-depth policy re-created idempotently.
ok(
  /drop\s+policy\s+if\s+exists\s+"profiles_update_own"\s+on\s+public\.profiles/i.test(sql),
  "drops existing profiles_update_own first (idempotent)"
);
ok(
  /create\s+policy\s+"profiles_update_own"\s+on\s+public\.profiles\s+for\s+update/i.test(sql),
  "re-creates profiles_update_own UPDATE policy"
);

// 5. WITH CHECK must pin EVERY privilege-bearing column to its stored value.
//    This is the actual escalation fix — the row-only check that shipped is
//    the bug. Each column must appear as `<col> is not distinct from (select`.
for (const col of ["role", "account_tier", "partner_status", "loyalty_points", "attestation_completed_at"]) {
  const re = new RegExp(`${col}\\s+is not distinct from\\s*\\(\\s*select`, "i");
  ok(re.test(flat), `WITH CHECK pins ${col} to stored value`);
}

// 6. Guard against the known NO-OP regression (column-level revoke).
ok(!/revoke\s+update\s*\(\s*role\s*\)/i.test(sql), "does NOT use the no-op column-level REVOKE UPDATE (role)");

// 7. self-write still allowed (row ownership retained in USING and WITH CHECK).
ok(/using\s*\(\s*id\s*=\s*auth\.uid\(\)\s*\)/i.test(sql), "USING still scopes to own row (self-edit preserved)");

if (failures) {
  console.error(`\n${failures} RLS migration check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll RLS migration static checks passed.");
