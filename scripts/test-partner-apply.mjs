/*
  scripts/test-partner-apply.mjs   (opt cycle 11 — scorecard 4.14b; rewritten cycle 12 — 4.2)
  Executes the REAL POST /api/partners/apply handler with Supabase, auth and
  the rate limiter stubbed, and the REAL requirePartner guard with Supabase
  stubbed. Contract (opt cycle 12):
    - honeypot → 200, nothing written; bad email / short name → 400; a field
      over its cap → 400; GET → 405;
    - a new application is INSERTED (never a blind upsert on email) with the
      documented column mapping; 200 even with no email transport;
    - a failed store is a 502 envelope, never "received";
    - an existing application: an approved/rejected row is never touched; a
      row owned by another account is never touched (and its existence is not
      revealed — same 200); the owning account, or the account whose email
      matches an anonymous row, refreshes free-text fields only (status,
      review, tier untouched) and binds user_id;
    - the profile flips to partner_pending only for a NEW row by a signed-in
      account that is not already approved;
    - requirePartner rejects partner_pending / pending and admits approved.
  Plus wiring checks: the page posts { payload } with the same field names.

  Run: node scripts/test-partner-apply.mjs   (in npm run test:unit)
*/
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";

let failures = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { failures++; console.error(`  ✗ ${m}`); } };
const read = (rel) => fs.readFileSync(path.join(process.cwd(), rel), "utf8");

process.env.VITE_SUPABASE_URL ||= "https://placeholder.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "placeholder";
delete process.env.RESEND_API_KEY;

async function bundle(entrySource, { stubAuth }) {
  const outfile = path.join(process.cwd(), `.partner-apply-${Date.now()}-${Math.random().toString(36).slice(2, 6)}.mjs`);
  const entry = path.join(process.cwd(), `scripts/_partner-apply-entry-${Math.random().toString(36).slice(2, 6)}.tmp.mjs`);
  fs.writeFileSync(entry, entrySource);
  try {
    await build({
      entryPoints: [entry], bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
      plugins: [{ name: "stubs", setup(b) {
        b.onResolve({ filter: /supabaseServer\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_pricing-stub-supabase.mjs") }));
        if (stubAuth) b.onResolve({ filter: /_utils\/auth\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-auth.mjs") }));
        b.onResolve({ filter: /_utils\/rateLimit\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_stub-rate-limit.mjs") }));
      } }],
    });
    return await import(`file://${outfile}`);
  } finally {
    fs.rmSync(entry, { force: true });
    fs.rmSync(outfile, { force: true });
  }
}
const { handler, FIXTURES, LOG, FAIL } = await bundle(
  'export { default as handler } from "../api/partners/apply.js";\nexport { FIXTURES, LOG, FAIL } from "../lib/supabaseServer.js";\n',
  { stubAuth: true }
);

function makeRes() {
  const r = { statusCode: null, payload: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.status = (c) => { r.statusCode = c; return r; };
  r.json = (p) => { r.payload = p; return r; };
  r.send = (p) => { r.payload = p; return r; };
  r.end = (p) => { if (p != null) { try { r.payload = JSON.parse(p); } catch { r.payload = p; } } return r; };
  return r;
}
async function post(payload, user = null) {
  globalThis.__STUB_USER = user;
  const res = makeRes();
  const w = console.warn; const e = console.error; console.warn = () => {}; console.error = () => {};
  try { await handler({ method: "POST", headers: { "content-type": "application/json" }, body: { payload } }, res); }
  finally { console.warn = w; console.error = e; globalThis.__STUB_USER = null; }
  return res;
}
const reset = (apps = [], profiles = []) => { FIXTURES.partner_applications = apps; FIXTURES.profiles = profiles; LOG.length = 0; FAIL.nextInsert = false; FAIL.nextUpdate = false; };
const APP = {
  fullName: "Ada Example", email: "Ada@Lab.Example", businessName: "Example Institute", country: "United States",
  monthlyVolume: "25–100 vials / month", interestedIn: "BPC-157, GHK-Cu", websiteOrInstagram: "https://lab.example",
  message: "Per-batch COA and SDS with every shipment.", website: "",
};
const writes = () => LOG.filter((l) => l.table === "partner_applications");
const profileWrites = () => LOG.filter((l) => l.table === "profiles");

console.log("POST /api/partners/apply — validation:");
{
  reset();
  let r = await post({ ...APP, website: "http://bot.example" });
  ok(r.statusCode === 200 && r.payload?.ok === true && LOG.length === 0, "honeypot filled → 200 ok, nothing written");
  reset(); r = await post({ ...APP, email: "not-an-email" });
  ok(r.statusCode === 400 && /invalid/i.test(r.payload?.error || "") && LOG.length === 0, "bad email → 400, nothing written");
  reset(); r = await post({ ...APP, fullName: "A" });
  ok(r.statusCode === 400, "a one-character name → 400");
  reset(); r = await post({ ...APP, message: "x".repeat(2001) });
  ok(r.statusCode === 400 && /message/.test(JSON.stringify(r.payload)) && LOG.length === 0, "message over 2000 chars → 400 (caps on every free-text field)");
  const res = makeRes(); await handler({ method: "GET", headers: {} }, res);
  ok(res.statusCode === 405, "GET → 405");
}

console.log("\nNew application (anonymous):");
{
  reset();
  const r = await post(APP);
  ok(r.statusCode === 200 && r.payload?.ok === true, "valid application → 200 ok even with RESEND_API_KEY unset (email is best-effort)");
  const ins = writes().find((l) => l.op === "insert");
  ok(Boolean(ins) && !LOG.some((l) => l.op === "upsert"), "one row INSERTED (no upsert on email)");
  const row = ins?.row || {};
  ok(row.email === "ada@lab.example", "email is lower-cased");
  ok(row.full_name === APP.fullName && row.business_name === APP.businessName && row.country === APP.country, "full_name / business_name / country mapped");
  ok(row.monthly_volume === APP.monthlyVolume && row.interested_in === APP.interestedIn && row.website_or_instagram === APP.websiteOrInstagram && row.message === APP.message, "monthly_volume / interested_in / website_or_instagram / message mapped");
  ok(row.status === "pending" && row.user_id === null, "status pending; anonymous applicant has no user_id");
  ok(profileWrites().length === 0, "no profile write for an anonymous applicant");
}

console.log("\nA failed store is an error, never \"received\":");
{
  reset(); FAIL.nextInsert = true;
  const r = await post(APP);
  ok(r.statusCode === 502 && typeof r.payload?.error === "string" && r.payload.ok !== true, `insert failure → 502 envelope (got ${r.statusCode})`);
  ok(!/stub insert failure/.test(JSON.stringify(r.payload)), "the database error text never reaches the client");
}

console.log("\nExisting applications (no blind upsert):");
{
  const approved = { id: "app-1", email: "ada@lab.example", user_id: "user-ada", status: "approved", partner_tier: "wholesale", message: "original" };
  reset([{ ...approved }]);
  let r = await post({ ...APP, message: "overwrite attempt" });
  ok(r.statusCode === 200 && r.payload?.ok === true, "anonymous POST for an approved applicant's email → same 200 (existence not revealed)");
  ok(writes().length === 0 && FIXTURES.partner_applications[0].message === "original" && FIXTURES.partner_applications[0].status === "approved", "…and the approved row is untouched (no demotion, no overwrite)");

  const pendingOther = { id: "app-2", email: "ada@lab.example", user_id: "user-ada", status: "pending", message: "original" };
  reset([{ ...pendingOther }]);
  r = await post({ ...APP, message: "overwrite attempt" }, { id: "user-attacker", email: "attacker@evil.example" });
  ok(r.statusCode === 200 && FIXTURES.partner_applications[0].message === "original" && FIXTURES.partner_applications[0].user_id === "user-ada" && !writes().some((l) => l.op === "update"), "a signed-in caller cannot touch a row bound to another account: their own email is used, the victim's row is untouched (at most a new row for their own email)");
  reset([{ ...pendingOther }]);
  r = await post({ ...APP, message: "overwrite attempt" });
  ok(r.statusCode === 200 && writes().length === 0 && FIXTURES.partner_applications[0].message === "original", "an anonymous caller cannot refresh a row bound to an account");

  reset([{ ...pendingOther }], [{ id: "user-ada", partner_status: "pending" }]);
  r = await post({ ...APP, message: "updated details" }, { id: "user-ada", email: "Ada@Lab.Example" });
  const upd = writes().find((l) => l.op === "update");
  ok(r.statusCode === 200 && Boolean(upd) && !writes().some((l) => l.op === "insert"), "the owning account refreshes its pending application (update, not a second row)");
  ok(FIXTURES.partner_applications[0].message === "updated details" && FIXTURES.partner_applications[0].status === "pending" && !("status" in (upd?.patch || {})) && !("partner_tier" in (upd?.patch || {})), "…free-text only: status / review / tier are not in the patch");
  ok(profileWrites().length === 0, "…and a resubmission never rewrites the profile");

  const anon = { id: "app-3", email: "ada@lab.example", user_id: null, status: "pending", message: "anon" };
  reset([{ ...anon }], [{ id: "user-ada", partner_status: "none" }]);
  r = await post({ ...APP, message: "claimed" }, { id: "user-ada", email: "ada@lab.example" });
  ok(r.statusCode === 200 && FIXTURES.partner_applications[0].user_id === "user-ada" && FIXTURES.partner_applications[0].message === "claimed", "the account whose email matches an anonymous pending row claims it (user_id bound)");

  reset([{ ...anon }]);
  r = await post({ ...APP, message: "claimed" }, { id: "user-other", email: "someone-else@lab.example" });
  ok(r.statusCode === 200 && FIXTURES.partner_applications[0].user_id === null && FIXTURES.partner_applications[0].message === "anon" && !writes().some((l) => l.op === "update"), "a different account cannot claim it (its own email does not match; the anonymous row keeps user_id null)");
}

console.log("\nProfile flips only for a NEW application, never for an approved partner:");
{
  reset([], [{ id: "user-new", partner_status: "none", account_tier: "customer" }]);
  let r = await post(APP, { id: "user-new", email: "new@lab.example" });
  ok(r.statusCode === 200 && profileWrites().length === 1 && profileWrites()[0].patch.account_tier === "partner_pending", "new application by a signed-in account → profile partner_pending");
  reset([], [{ id: "user-vip", partner_status: "approved", account_tier: "partner" }]);
  r = await post(APP, { id: "user-vip", email: "vip@lab.example" });
  ok(r.statusCode === 200 && profileWrites().length === 0 && FIXTURES.profiles[0].account_tier === "partner", "an approved partner who applies again keeps the partner tier (no demotion)");
}

console.log("\nrequirePartner (real guard, Supabase stubbed):");
{
  const { requirePartner } = await bundle('export { requirePartner } from "../api/_utils/auth.js";\n', { stubAuth: false });
  // getUserFromReq inside the real auth module needs supabaseServer.auth.getUser — stub it on the shared stub object.
  const { supabaseServer } = await bundle('export { supabaseServer, FIXTURES } from "../lib/supabaseServer.js";\n', { stubAuth: false });
  void supabaseServer;
  const guardWith = async (profile) => {
    FIXTURES.profiles = [{ id: "u1", ...profile }];
    // The real getUserFromReq calls supabaseServer.auth.getUser(token); provide it through the stub module's object.
    const mod = await bundle('import { supabaseServer } from "../lib/supabaseServer.js"; supabaseServer.auth = { getUser: async () => ({ data: { user: { id: "u1", email: "u1@x.test" } }, error: null }) }; export { requirePartner } from "../api/_utils/auth.js"; export { FIXTURES } from "../lib/supabaseServer.js";\n', { stubAuth: false });
    mod.FIXTURES.profiles = [{ id: "u1", ...profile }];
    const res = makeRes();
    const out = await mod.requirePartner({ headers: { authorization: "Bearer t" } }, res);
    return { out, status: res.statusCode };
  };
  let g = await guardWith({ account_tier: "partner_pending", partner_status: "pending" });
  ok(g.out === null && g.status === 403, "partner_pending / pending → 403 (a self-service application never grants the guard)");
  g = await guardWith({ account_tier: "partner", partner_status: "approved" });
  ok(g.out && g.out.id === "u1", "partner / approved → passes");
  g = await guardWith({ account_tier: "customer", partner_status: "rejected" });
  ok(g.out === null && g.status === 403, "customer / rejected → 403");
  void requirePartner;
}

console.log("\nWiring:");
{
  const email = read("lib/email.js");
  ok(/partner_application:\s*"Wholesale \/ Institutional Supply Application"/.test(email), "lib/email.js subject map names partner_application");
  const page = read("src/pages/Partners.jsx");
  ok(/fetch\("\/api\/partners\/apply"/.test(page) && /JSON\.stringify\(\{ payload: form \}\)/.test(page), "the page posts { payload } to /api/partners/apply");
  const api = read("api/partners/apply.js");
  for (const f of ["fullName", "email", "businessName", "country", "monthlyVolume", "interestedIn", "websiteOrInstagram", "message", "website"]) {
    ok(new RegExp(`\\b${f}:`).test(page) && (f === "email" || f === "website" || new RegExp(`\\b${f}\\b`).test(api)), `page state carries ${f} and the endpoint knows it`);
  }
  ok(!/onConflict: "email"/.test(api) && !/\.upsert\(/.test(api), "no upsert on email anywhere in the endpoint");
  ok(!/startsWith\("partner_"\)/.test(read("api/_utils/auth.js")), "requirePartner no longer prefix-matches partner_*");
  ok(/aria-hidden="true"/.test(page) && /tabIndex=\{-1\}/.test(page) && /successRef\.current\?\.focus\(\)/.test(page), "honeypot hidden from AT; the success heading takes focus");
  ok(/<Route path="\/partners"/.test(read("src/App.jsx")), "App.jsx routes /partners (public)");
  ok(/to="\/partners"/.test(read("src/components/Footer.jsx")), "the footer links /partners");
  ok(/scrubSecrets\(/.test(api) && !/console\.(warn|error)\([^)]*,\s*(upsertErr|insErr|updErr|profErr|e)\)/.test(api), "log lines carry scrubbed messages, never whole error objects");
}

if (failures) { console.error(`\n${failures} partner-apply check(s) FAILED`); process.exit(1); }
console.log("\nAll partner-apply checks passed.");
