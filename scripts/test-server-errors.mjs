/*
  scripts/test-server-errors.mjs   (opt c6 — scorecard 4.12)
  Every API failure that goes through failSafely() must land in the server
  error ledger (migration 0035) — scrubbed, detached, never able to fail the
  request — and the Control Room must be able to list and resolve it.
  Executes the REAL failSafely and the REAL api/admin/server-errors.js
  handler against the in-memory stub.

  Run: node scripts/test-server-errors.mjs   (wired into npm run test:unit)
*/
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else { failures++; console.error(`  ✗ ${msg}`); }
};
process.env.VITE_SUPABASE_URL ||= "https://placeholder.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY ||= "placeholder";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "placeholder";

const outfile = path.join(process.cwd(), `.server-errors-test-${Date.now()}.mjs`);
await build({
  entryPoints: [path.join(process.cwd(), "scripts/_admin-entry.mjs")],
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  plugins: [{ name: "stubs", setup(b) {
    b.onResolve({ filter: /supabaseServer\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-supabase.mjs") }));
    b.onResolve({ filter: /_utils\/auth\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-auth.mjs") }));
    b.onResolve({ filter: /_utils\/rateLimit\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_stub-rate-limit.mjs") }));
  } }],
});
const { failSafely, recordServerError, serverErrorsHandler, FIXTURES, LOG } = await import(`file://${outfile}`);
fs.unlinkSync(outfile);
FIXTURES.server_errors = [];
const quiet = async (fn) => { const e = console.error, w = console.warn; console.error = () => {}; console.warn = () => {}; try { return await fn(); } finally { console.error = e; console.warn = w; } };
function expressRes() { const r = { statusCode: null, payload: null, headersSent: false }; r.status = (c) => { r.statusCode = c; return r; }; r.json = (p) => { r.payload = p; r.headersSent = true; return r; }; return r; }

console.log("failSafely → ledger:");
const res = expressRes();
const id = await quiet(() => failSafely(res, { status: 502, code: "btcpay_down", message: "Payment is temporarily unavailable.", error: new Error("connect ECONNREFUSED; key " + ["sk", "live", "x".repeat(26)].join("_") + " used"), context: "btcpay:create-invoice" }));
await new Promise((r) => setTimeout(r, 20)); // the insert is detached
ok(res.statusCode === 502 && res.payload?.error === "Payment is temporarily unavailable." && res.payload?.requestId === id, "the client envelope is unchanged (status, safe message, request id)");
const ins = LOG.filter((l) => l.table === "server_errors");
ok(ins.length === 1, `exactly one ledger insert (${ins.length})`);
const row = ins[0]?.row || {};
ok(row.request_id === id && row.code === "btcpay_down" && row.context === "btcpay:create-invoice" && row.status === 502, `row carries request id, code, context, status (${JSON.stringify({ code: row.code, ctx: row.context, status: row.status })})`);
// The key shape is assembled at runtime so the file itself never carries one
// (GitHub push protection blocks even a fake literal).
ok(/ECONNREFUSED/.test(row.message) && !/sk_live_x/.test(row.message) && /\[redacted\]/.test(row.message), "message is the scrubbed detail — the key shape is redacted");
ok(!("stack" in row) && !("body" in row), "no stack, no body in the ledger row");

console.log("\nDetached and harmless:");
const before = LOG.length;
const p = recordServerError({ requestId: "req_x", code: "c", context: "ctx", status: 500, detail: "x".repeat(5000) });
ok(p && typeof p.then === "function", "recordServerError returns a promise and never throws");
await quiet(() => p);
ok(LOG.length === before + 1 && LOG.at(-1).row.message.length === 1000, "message capped at 1000 chars");

console.log("\nAdmin endpoint:");
function makeRes() { const r = { statusCode: null, payload: null, headers: {} }; r.setHeader = (k, v) => { r.headers[k] = v; }; r.end = (p) => { try { r.payload = JSON.parse(p); } catch { r.payload = p; } return r; }; return r; }
const call = async (method, body) => { const r = makeRes(); await serverErrorsHandler({ method, url: "/api/admin/server-errors", headers: {}, body }, r); return r; };
let r = await call("GET");
ok(r.statusCode === 200 && Array.isArray(r.payload?.errors) && r.payload.errors.length === 2, `GET lists the ledger (${r.payload?.errors?.length})`);
ok(r.payload.errors.every((e) => "request_id" in e && "message" in e), "rows expose request id + message");
const first = FIXTURES.server_errors[0];
r = await call("PATCH", { id: first.id, resolved: true });
ok(r.statusCode === 200 && FIXTURES.server_errors[0].resolved === true, "PATCH resolves a row");
r = await call("PATCH", { id: "x" });
ok(r.statusCode === 400, "PATCH validates its body");
r = await call("DELETE");
ok(r.statusCode === 405, "other methods → 405");

console.log("\nControl Room + migration:");
const ui = fs.readFileSync(path.join(process.cwd(), "src/pages/AdminHome.jsx"), "utf8");
ok(/function ServerErrors\(\)/.test(ui) && /<ClientErrors \/><ServerErrors \/>/.test(ui), "the Errors tab mounts both panels");
ok(/Apply migration 0035/.test(ui), "a pre-0035 database gets an explicit sentence, not a broken tab");
const sql = fs.readFileSync(path.join(process.cwd(), "supabase/migrations/0035_server_errors.sql"), "utf8");
ok(/create table if not exists public\.server_errors/.test(sql) && /enable row level security/.test(sql) && /server_errors_admin_read/.test(sql), "0035 is additive, RLS on, admin read only");
ok(!/for (insert|update|delete)/i.test(sql), "0035 creates no client insert/update/delete policy");

console.log(failures ? `\n${failures} assertion(s) failed` : "\nAll server-error ledger assertions passed");
process.exit(failures ? 1 : 0);
