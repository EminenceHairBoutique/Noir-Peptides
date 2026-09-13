/*
  scripts/test-admin-orders.mjs   (opt cycle 3 — scorecards 4.11 / 4.1, H-003)
  The Control Room must show the research-use attestation that authorized an
  order — without SQL. Executes the REAL api/admin/orders.js handler against
  the in-memory Supabase stub (auth stubbed to an admin) and proves:
    - the order detail carries the checkout-context attestation_audit row
      (version, legal name, statements, IP, UA, timestamp) for that order;
    - an order with no record returns attestation: null — never a placeholder;
    - a database whose attestation_audit lacks the 0015 order link (or the
      table) degrades to null instead of failing the order screen;
    - the list endpoint is unchanged; unknown orders still 404;
    - the Control Room wires the record into OrderDetail and renders the
      honest empty state.

  Run: node scripts/test-admin-orders.mjs   (wired into npm run test:unit)
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

const outfile = path.join(process.cwd(), `.admin-orders-test-${Date.now()}.mjs`);
await build({
  entryPoints: [path.join(process.cwd(), "scripts/_admin-entry.mjs")],
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  plugins: [{
    name: "stubs",
    setup(b) {
      b.onResolve({ filter: /supabaseServer\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-supabase.mjs") }));
      b.onResolve({ filter: /_utils\/auth\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-auth.mjs") }));
    },
  }],
});
const { ordersHandler, loadAttestation, ATTESTATION_COLUMNS, FIXTURES } = await import(`file://${outfile}`);
fs.unlinkSync(outfile);

function makeRes() {
  const r = { statusCode: null, payload: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = (p) => { try { r.payload = JSON.parse(p); } catch { r.payload = p; } return r; };
  return r;
}
const get = async (url) => { const res = makeRes(); await ordersHandler({ method: "GET", url, headers: {} }, res); return res; };

FIXTURES.orders = [
  { order_number: "NP-1001", email: "a@example.test", customer_name: "A. Researcher", amount_total: 12000, currency: "usd", status: "paid", payment_provider: "btcpay", items: [], shipping_address: {}, created_at: "2026-09-13T01:00:00Z" },
  { order_number: "NP-1002", email: "b@example.test", customer_name: "B. Researcher", amount_total: 5000, currency: "usd", status: "processing", payment_provider: "btcpay", items: [], shipping_address: {}, created_at: "2026-09-13T02:00:00Z" },
];
FIXTURES.attestation_audit = [
  // registration-time row (no order) — must never be picked for an order
  { id: 1, user_id: "u1", version: "2026-08-26", statements: ["s1"], legal_name: "A. Researcher", ip_address: "203.0.113.5", user_agent: "UA-reg", order_id: null, context: "registration", created_at: "2026-09-01T00:00:00Z" },
  // checkout-time row for NP-1001
  { id: 2, user_id: "u1", version: "2026-08-26", statements: ["I attest the materials are for in-vitro research.", "I am not purchasing for human or animal use."], legal_name: "A. Researcher", ip_address: "203.0.113.5", user_agent: "Mozilla/5.0 (X11; Linux x86_64) TestUA", order_id: "NP-1001", context: "checkout", created_at: "2026-09-13T01:00:05Z" },
];

console.log("Order detail with a record on file:");
let r = await get("/api/admin/orders?order=NP-1001");
ok(r.statusCode === 200, `GET ?order=NP-1001 → 200 (${r.statusCode})`);
ok(r.payload?.order?.order_number === "NP-1001", "order detail still returned");
const a = r.payload?.attestation;
ok(a && a.version === "2026-08-26", "attestation.version is the checkout row's version");
ok(a && a.legal_name === "A. Researcher", "attestation.legal_name present");
ok(a && Array.isArray(a.statements) && a.statements.length === 2, `attestation.statements is the attested list (${a?.statements?.length})`);
ok(a && a.ip_address === "203.0.113.5", "attestation.ip_address present");
ok(a && /TestUA/.test(a.user_agent || ""), "attestation.user_agent present (cycle-2 field)");
ok(a && a.context === "checkout", "the CHECKOUT-context row is the one returned, not the registration row");
ok(a && a.created_at === "2026-09-13T01:00:05Z", "attestation.created_at is the consent timestamp");
ok(!("user_id" in (a || {})), "user_id is not echoed to the client");

console.log("\nOrder with no record:");
r = await get("/api/admin/orders?order=NP-1002");
ok(r.statusCode === 200 && r.payload?.order?.order_number === "NP-1002", "order detail returned");
ok(r.payload?.attestation === null, "attestation is null (honest empty state), not a placeholder object");

console.log("\nUnknown order / list:");
r = await get("/api/admin/orders?order=NP-404");
ok(r.statusCode === 404, `unknown order → 404 (${r.statusCode})`);
r = await get("/api/admin/orders");
ok(r.statusCode === 200 && Array.isArray(r.payload?.orders) && r.payload.orders.length === 2, "list endpoint unchanged (2 orders)");
ok(!("attestation" in (r.payload || {})), "list does not carry attestation records");

console.log("\nDegradation:");
const saved = FIXTURES.attestation_audit;
delete FIXTURES.attestation_audit; // table absent → stub returns no rows
ok((await loadAttestation("NP-1001")) === null, "missing table → null (order screen still loads)");
FIXTURES.attestation_audit = saved;
ok(!/\b(id|user_id)\b/.test(ATTESTATION_COLUMNS), "the select never reads id / user_id (nothing to echo)");
ok(/version, legal_name, statements, ip_address, user_agent/.test(ATTESTATION_COLUMNS), "select names exactly the consent fields");

console.log("\nControl Room wiring:");
const ui = fs.readFileSync(path.join(process.cwd(), "src/pages/AdminHome.jsx"), "utf8");
ok(/setAttestation\(d\.attestation \|\| null\)/.test(ui), "OrderDetail stores the record from the detail response");
ok(/<AttestationRecord record=\{attestation\} \/>/.test(ui), "OrderDetail renders <AttestationRecord>");
ok(/No research-use attestation record is on file for this order\./.test(ui), "empty state is an explicit sentence, not a blank");
ok(/record\.user_agent/.test(ui) && /record\.ip_address/.test(ui) && /record\.statements/.test(ui), "record renders statements, IP and UA");

console.log(failures ? `\n${failures} assertion(s) failed` : "\nAll admin-orders assertions passed");
process.exit(failures ? 1 : 0);
