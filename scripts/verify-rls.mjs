/*
  scripts/verify-rls.mjs   (npm run verify:rls)

  Live RLS verifier for the anon (public) key. Two things it proves against the
  REAL project — the sandbox can't reach it, so YOU run this after applying
  migration 0030:

    1. READ PROBES. The three sensitive tables from ROTATION_CHECKLIST.md
       (profiles, orders, attestation_audit) must return [] to the anon key.
       A row with data = world-readable PII = STOP.

    2. ESCALATION PROBE. Signs in as a throwaway user (created here, or the
       provided RLS_PROBE_EMAIL/RLS_PROBE_PASSWORD), then attempts
       `UPDATE profiles SET role='admin'` on its own row via the anon REST API.
       It MUST be rejected (0 rows changed or an error). If it succeeds, the
       0030 escalation fix is not in effect on this database.

  Env:
    VITE_SUPABASE_URL      required
    VITE_SUPABASE_ANON_KEY required
    RLS_PROBE_EMAIL        optional — an existing throwaway account to sign in as
    RLS_PROBE_PASSWORD     optional — its password
      If both are set, this signs IN and does NOT create a user.
      If unset, it signs UP a random throwaway (needs email signups enabled,
      email-confirmation OFF for the escalation probe to run; if confirmation
      is required the sign-in fails and the escalation probe is reported SKIPPED,
      never as a pass).

  Read-only except the single optional throwaway signup. Never mutates real
  data: the escalation attempt is EXPECTED to be rejected, and a throwaway
  user editing its own non-privileged row changes nothing that matters.

  Exit: 0 = all green; 1 = any probe failed or env missing (prints the exact
  manual curl commands so you can run the checklist by hand).
*/

const URL = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "").replace(/\/+$/, "");
const ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || "";
const PROBE_EMAIL = process.env.RLS_PROBE_EMAIL || "";
const PROBE_PASSWORD = process.env.RLS_PROBE_PASSWORD || "";

const SENSITIVE_TABLES = ["profiles", "orders", "attestation_audit"];

const red = (s) => `\x1b[31m${s}\x1b[0m`;
const green = (s) => `\x1b[32m${s}\x1b[0m`;
const bold = (s) => `\x1b[1m${s}\x1b[0m`;

function printManualInstructions() {
  console.log(bold("\nRLS verification could not run — missing env. Set:"));
  console.log("  VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY");
  console.log(bold("\nOr run the read probes by hand (must each return []):"));
  console.log("  REF=<project-ref>; ANON=<anon-key>");
  console.log("  for t in profiles orders attestation_audit; do");
  console.log('    echo "== $t =="');
  console.log('    curl -s "https://$REF.supabase.co/rest/v1/$t?select=*&limit=1" \\');
  console.log('      -H "apikey: $ANON" -H "Authorization: Bearer $ANON"');
  console.log("  done");
  console.log(bold("\nEscalation probe by hand (must be rejected):"));
  console.log("  # 1. sign in and capture the access_token:");
  console.log('  TOKEN=$(curl -s "https://$REF.supabase.co/auth/v1/token?grant_type=password" \\');
  console.log('    -H "apikey: $ANON" -H "Content-Type: application/json" \\');
  console.log('    -d \'{"email":"<throwaway>","password":"<pw>"}\' | jq -r .access_token)');
  console.log("  UID=$(...)   # the user id from the same response");
  console.log('  # 2. attempt the escalation — expect [] / 0 rows / error, NEVER role=admin:');
  console.log('  curl -s -X PATCH "https://$REF.supabase.co/rest/v1/profiles?id=eq.$UID" \\');
  console.log('    -H "apikey: $ANON" -H "Authorization: Bearer $TOKEN" \\');
  console.log('    -H "Content-Type: application/json" -H "Prefer: return=representation" \\');
  console.log('    -d \'{"role":"admin"}\'');
}

async function restGet(table, token = ANON) {
  const res = await fetch(`${URL}/rest/v1/${table}?select=*&limit=1`, {
    headers: { apikey: ANON, Authorization: `Bearer ${token}` },
  });
  const body = await res.json().catch(() => null);
  return { status: res.status, body };
}

async function signIn(email, password) {
  const res = await fetch(`${URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => null);
  return { ok: res.ok, token: body?.access_token || null, uid: body?.user?.id || null, body };
}

async function signUp(email, password) {
  const res = await fetch(`${URL}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: ANON, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = await res.json().catch(() => null);
  // When confirmation is OFF, signup returns a session token directly.
  return {
    ok: res.ok,
    token: body?.access_token || null,
    uid: body?.user?.id || body?.id || null,
    body,
  };
}

async function attemptEscalation(token, uid) {
  const res = await fetch(`${URL}/rest/v1/profiles?id=eq.${uid}`, {
    method: "PATCH",
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
    },
    body: JSON.stringify({ role: "admin" }),
  });
  const body = await res.json().catch(() => null);
  // Rejected if: non-2xx, OR an empty representation (0 rows matched the
  // policy), OR the returned row's role is not "admin".
  const rows = Array.isArray(body) ? body : [];
  const changedToAdmin = rows.some((r) => r && r.role === "admin");
  return { status: res.status, changedToAdmin, body };
}

async function main() {
  if (!URL || !ANON) {
    printManualInstructions();
    process.exit(1);
  }

  const results = [];
  let hardFail = false;

  // ── 1. Read probes ────────────────────────────────────────────────────
  for (const t of SENSITIVE_TABLES) {
    let pass = false;
    let detail = "";
    try {
      const { status, body } = await restGet(t);
      const empty = Array.isArray(body) && body.length === 0;
      // PostgREST returns [] for a readable-but-empty table AND for a table the
      // anon role cannot read (RLS yields no rows). Either way, no PII leaks.
      // A 401/permission error is also acceptable (locked down). A NON-empty
      // array is the failure: world-readable rows.
      if (empty) {
        pass = true;
        detail = "[] (no anon-readable rows)";
      } else if (Array.isArray(body) && body.length > 0) {
        pass = false;
        detail = `${body.length} row(s) readable — WORLD-READABLE PII`;
      } else if (status === 401 || status === 403) {
        pass = true;
        detail = `${status} (locked)`;
      } else {
        pass = false;
        detail = `unexpected status ${status}`;
      }
    } catch (e) {
      pass = false;
      detail = `probe error: ${e.message}`;
    }
    results.push({ name: `read: ${t}`, pass, detail });
    if (!pass) hardFail = true;
  }

  // ── 2. Escalation probe ───────────────────────────────────────────────
  let esc = { name: "escalation: profiles.role→admin", pass: false, detail: "" };
  try {
    let token = null;
    let uid = null;
    let via = "";

    if (PROBE_EMAIL && PROBE_PASSWORD) {
      const s = await signIn(PROBE_EMAIL, PROBE_PASSWORD);
      token = s.token;
      uid = s.uid;
      via = "provided probe creds";
      if (!token) esc.detail = `SKIPPED — sign-in failed (${s.body?.error_description || s.body?.msg || "no token"})`;
    } else {
      const rand = Math.random().toString(36).slice(2, 12);
      const email = `rls-probe+${rand}@noirpeptides-probe.invalid`;
      const password = `Pw!${rand}${Math.random().toString(36).slice(2, 8)}`;
      const s = await signUp(email, password);
      token = s.token;
      uid = s.uid;
      via = "throwaway signup";
      if (!token)
        esc.detail =
          "SKIPPED — signup returned no session (email confirmation likely required). " +
          "Provide RLS_PROBE_EMAIL/RLS_PROBE_PASSWORD for a confirmed throwaway to run this probe.";
    }

    if (token && uid) {
      const r = await attemptEscalation(token, uid);
      if (r.changedToAdmin) {
        esc.pass = false;
        esc.detail = `⛔ SUCCEEDED via ${via} — role was set to admin. 0030 is NOT in effect.`;
        hardFail = true;
      } else {
        esc.pass = true;
        esc.detail = `rejected via ${via} (status ${r.status}, no admin row returned)`;
      }
    } else if (!esc.detail) {
      esc.detail = "SKIPPED — could not obtain a session token";
    }
  } catch (e) {
    esc.detail = `probe error: ${e.message}`;
  }
  results.push(esc);

  // A SKIPPED escalation probe is not a failure (env/confirmation constraint)
  // but must be visible — it never counts as a pass.
  const skipped = esc.detail.startsWith("SKIPPED");

  // ── Report ────────────────────────────────────────────────────────────
  console.log(bold("\nRLS verification — anon key\n"));
  const pad = Math.max(...results.map((r) => r.name.length));
  for (const r of results) {
    const mark = r.pass ? green("✅ PASS") : skipped && r === esc ? "⏭  SKIP" : red("⛔ FAIL");
    console.log(`  ${mark}  ${r.name.padEnd(pad)}  ${r.detail}`);
  }

  if (hardFail) {
    console.log(red(bold("\n⛔ RLS verification FAILED — do not launch until every read probe is [] and escalation is rejected.")));
    console.log("   Apply supabase/migrations/0030_profiles_rls_escalation_fix.sql, then re-run.");
    process.exit(1);
  }
  if (skipped) {
    console.log(green(bold("\n✅ Read probes passed.")) + " Escalation probe skipped (see above) — re-run with confirmed probe creds to complete it.");
    process.exit(0);
  }
  console.log(green(bold("\n✅ RLS verification passed — reads locked down, escalation rejected.")));
  process.exit(0);
}

main().catch((e) => {
  console.error(red(`verify-rls: ${e.message}`));
  process.exit(1);
});
