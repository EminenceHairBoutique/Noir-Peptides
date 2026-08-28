/*
  scripts/db-verify.mjs   (npm run db:verify)

  Live-vs-static reconcile verifier. Schema drift is this project's documented
  house failure mode (products=0 while the storefront rendered 44 static items;
  migrations hand-pasted with no ledger). This compares the live Supabase row
  counts against the static source of truth and checks the migration ledger,
  then prints a ✅ in-sync / ⛔ drift report with the exact RUNBOOK §1 commands
  to fix each gap.

  STRICTLY READ-ONLY. It issues count queries and one ledger read. It never
  inserts, updates, deletes, or DDLs anything.

  Env:
    SUPABASE_URL              required (or VITE_SUPABASE_URL)
    SUPABASE_SERVICE_ROLE_KEY required (service role — bypasses RLS so counts
                              are the true table totals, not the anon view)

  No creds → prints setup instructions and exits 0 (nothing to verify, not a
  failure). Drift → exits 1. In sync → exits 0.
*/
import { deriveExpectedCounts } from "./expected-counts.mjs";
import { readdir } from "node:fs/promises";
import path from "node:path";

const URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const yellow = (s) => `\x1b[33m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

function printSetup() {
  console.log(bold("\ndb:verify — Supabase service-role credentials not set.\n"));
  console.log("Read-only; safe to run any time. Needs SUPABASE_URL (or");
  console.log("VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.");
  console.log(bold("\nEasiest (any OS — npm run db:verify reads .env automatically):"));
  console.log("  1. Copy .env.example to .env  (it is gitignored)");
  console.log("  2. Fill in VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY");
  console.log("  3. npm run db:verify");
  console.log(bold("\nOr set them for one shell session:"));
  console.log("  PowerShell:  $env:SUPABASE_URL=\"https://<project-ref>.supabase.co\"");
  console.log("               $env:SUPABASE_SERVICE_ROLE_KEY=\"<service-role-key>\"");
  console.log("  bash/zsh:    export SUPABASE_URL=https://<project-ref>.supabase.co");
  console.log("               export SUPABASE_SERVICE_ROLE_KEY=<service-role-key>");
  console.log(red("\n  The service-role key is server-only — never commit it."));
  console.log("\nThe service-role key bypasses RLS so counts are true table totals.");
  console.log("Find it: Supabase dashboard → Settings → API → service_role secret.");
}

// Exact-count via PostgREST: HEAD with Prefer: count=exact returns the total in
// the Content-Range header (e.g. "0-24/44"); no rows transferred.
async function tableCount(table) {
  const res = await fetch(`${URL}/rest/v1/${table}?select=*`, {
    method: "HEAD",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: "count=exact", Range: "0-0" },
  });
  if (res.status === 404) return { ok: false, missing: true, count: null };
  const cr = res.headers.get("content-range") || "";
  const total = cr.includes("/") ? Number(cr.split("/")[1]) : NaN;
  if (!res.ok && !Number.isFinite(total)) return { ok: false, count: null, status: res.status };
  return { ok: true, count: Number.isFinite(total) ? total : 0 };
}

async function publishedCoaCount() {
  const res = await fetch(`${URL}/rest/v1/coas?select=*&is_published=eq.true`, {
    method: "HEAD",
    headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, Prefer: "count=exact", Range: "0-0" },
  });
  if (res.status === 404) return { ok: false, missing: true, count: null };
  const cr = res.headers.get("content-range") || "";
  const total = cr.includes("/") ? Number(cr.split("/")[1]) : NaN;
  return { ok: res.ok || Number.isFinite(total), count: Number.isFinite(total) ? total : 0 };
}

// Reads the Supabase migration ledger, if present. The live DB has historically
// been hand-pasted (no ledger), so absence is itself a reported finding, not a
// crash.
async function ledgerVersions() {
  // The ledger lives in the supabase_migrations schema; PostgREST exposes it
  // only if that schema is in the API search path. Try both common shapes.
  for (const tbl of ["schema_migrations", "supabase_migrations.schema_migrations"]) {
    try {
      const res = await fetch(`${URL}/rest/v1/${encodeURIComponent(tbl)}?select=version`, {
        headers: { apikey: KEY, Authorization: `Bearer ${KEY}`, "Accept-Profile": "supabase_migrations" },
      });
      if (res.ok) {
        const rows = await res.json().catch(() => []);
        if (Array.isArray(rows)) return { available: true, versions: rows.map((r) => String(r.version)) };
      }
    } catch {
      /* try next shape */
    }
  }
  return { available: false, versions: [] };
}

async function migrationFilenames() {
  const dir = path.join(process.cwd(), "supabase/migrations");
  const files = (await readdir(dir)).filter((f) => f.endsWith(".sql") && !/PROPOSED/i.test(f));
  return files.sort();
}

async function main() {
  if (!URL || !KEY) {
    printSetup();
    process.exit(0); // no-creds is not a failure
  }

  const expected = deriveExpectedCounts();
  const rows = [];
  let drift = false;

  console.log(bold("\ndb:verify — live Supabase vs. static catalog\n"));

  // ── Exact-count tables (catalog is the source of truth) ────────────────
  for (const [table, exp] of Object.entries(expected)) {
    const r = await tableCount(table);
    if (r.missing) {
      rows.push({ table, exp, got: "MISSING", pass: false });
      drift = true;
    } else if (!r.ok) {
      rows.push({ table, exp, got: `err(${r.status || "?"})`, pass: false });
      drift = true;
    } else {
      const pass = r.count === exp;
      rows.push({ table, exp, got: r.count, pass });
      if (!pass) drift = true;
    }
  }

  // ── Published COAs: presence check (not catalog-derived) ───────────────
  const coa = await publishedCoaCount();
  if (coa.missing) {
    rows.push({ table: "coas (published)", exp: "≥1", got: "MISSING", pass: false });
    drift = true;
  } else {
    // 0 published COAs is a soft finding — the trust surface is empty — but not
    // treated as hard drift since COA entry is an owner task. Flagged yellow.
    rows.push({ table: "coas (published)", exp: "≥1 (owner-entered)", got: coa.count, pass: coa.count >= 1, soft: coa.count === 0 });
  }

  const pad = Math.max(...rows.map((r) => r.table.length));
  for (const r of rows) {
    const mark = r.pass ? green("✅") : r.soft ? yellow("⚠️ ") : red("⛔");
    console.log(`  ${mark}  ${r.table.padEnd(pad)}  expected ${String(r.exp).padStart(4)}   live ${String(r.got).padStart(6)}`);
  }

  // ── Migration ledger ───────────────────────────────────────────────────
  console.log(bold("\nMigration ledger\n"));
  const ledger = await ledgerVersions();
  const files = await migrationFilenames();
  if (!ledger.available) {
    console.log(`  ${yellow("⚠️ ")} supabase_migrations.schema_migrations not readable via the API.`);
    console.log("     This DB was hand-applied (RUNBOOK §1) — no CLI ledger. Not drift by");
    console.log("     itself; use the RUNBOOK §1 feature-existence check as the source of truth.");
  } else {
    const present = new Set(ledger.versions);
    const missing = files.filter((f) => {
      const prefix = f.slice(0, 4);
      return !present.has(f) && !present.has(prefix) && ![...present].some((v) => f.startsWith(v));
    });
    if (missing.length === 0) {
      console.log(`  ${green("✅")}  ledger tracks all ${files.length} migrations`);
    } else {
      drift = true;
      console.log(`  ${red("⛔")}  ledger is missing ${missing.length} migration(s):`);
      for (const m of missing) console.log(`       - ${m}`);
    }
  }

  // ── Verdict + fix commands ─────────────────────────────────────────────
  if (drift) {
    console.log(red(bold("\n⛔ DRIFT DETECTED.")) + " Reconcile before launch:");
    console.log("  1. Open the Supabase SQL editor.");
    console.log("  2. Run the RUNBOOK §1 feature-existence check (paste the query in docs/RUNBOOK.md §1).");
    console.log("  3. For any count below expected: re-run scripts/manual-seed.sql (additive, ON CONFLICT DO NOTHING — never truncates).");
    console.log("  4. For MISSING tables / ledger gaps: apply the corresponding migration in supabase/migrations/ in order.");
    console.log("  5. Re-run npm run db:verify until every row is ✅.");
    process.exit(1);
  }
  const softCoa = rows.find((r) => r.soft);
  if (softCoa) {
    console.log(green(bold("\n✅ Catalog in sync.")) + yellow(" Note: 0 published COAs — enter per-batch COAs (owner task) to populate the trust surface."));
    process.exit(0);
  }
  console.log(green(bold("\n✅ In sync — live counts match the static catalog and the ledger is complete.")));
  process.exit(0);
}

main().catch((e) => {
  console.error(red(`db:verify: ${e.message}`));
  process.exit(1);
});
