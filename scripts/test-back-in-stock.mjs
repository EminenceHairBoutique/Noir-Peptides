/*
  scripts/test-back-in-stock.mjs   (opt cycle 11 — scorecard 4.14c)
  EXECUTES the restock path through the real PATCH /api/admin/catalog handler
  (scripts/test-admin-catalog.mjs proves the same rules by source grep; this
  runs them): notices go out only on a flip INTO in_stock, a variant flip
  reaches the variant's subscribers plus product-level ones and never a
  sibling variant's, a product flip reaches product-level subscribers only,
  `notified` flips exactly once per subscriber (a second flip re-sends
  nothing), the per-flip cap holds, an unconfigured transport leaves every
  row queued (notified stays false) and the stock update still succeeds, a
  failing transport skips that subscriber without failing the update, and
  the audit log records the outcome.

  Run: node scripts/test-back-in-stock.mjs   (in npm run test:unit)
*/
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";

let failures = 0;
const ok = (c, m) => { if (c) console.log(`  ✓ ${m}`); else { failures++; console.error(`  ✗ ${m}`); } };

process.env.VITE_SUPABASE_URL ||= "https://placeholder.supabase.co";
process.env.SUPABASE_SERVICE_ROLE_KEY ||= "placeholder";
delete process.env.VERCEL_DEPLOY_HOOK_URL;

const outfile = path.join(process.cwd(), `.restock-test-${Date.now()}.mjs`);
await build({
  entryPoints: [path.join(process.cwd(), "scripts/_restock-entry.mjs")],
  bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
  plugins: [{ name: "stubs", setup(b) {
    b.onResolve({ filter: /supabaseServer\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-supabase.mjs") }));
    b.onResolve({ filter: /_utils\/auth\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_admin-stub-auth.mjs") }));
    b.onResolve({ filter: /_utils\/rateLimit\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_stub-rate-limit.mjs") }));
    b.onResolve({ filter: /lib\/email\.js$/ }, () => ({ path: path.join(process.cwd(), "scripts/_stub-email.mjs") }));
  } }],
});
const { catalogHandler, FIXTURES, LOG, EMAIL } = await import(`file://${outfile}`);
fs.rmSync(outfile, { force: true });

function makeRes() {
  const r = { statusCode: null, payload: null, headers: {} };
  r.setHeader = (k, v) => { r.headers[k] = v; };
  r.end = (p) => { try { r.payload = JSON.parse(p); } catch { r.payload = p; } return r; };
  return r;
}
async function patch(body) {
  const res = makeRes();
  await catalogHandler({ method: "PATCH", headers: { "content-type": "application/json" }, body }, res);
  return res;
}
const P1 = { id: "p1", slug: "bpc-157", name: "BPC-157", stock_status: "out_of_stock", is_bundle: false };
const P2 = { id: "p2", slug: "ghk-cu", name: "GHK-Cu", stock_status: "out_of_stock", is_bundle: false };
function seed({ configured = true, subs } = {}) {
  FIXTURES.products = [{ ...P1 }, { ...P2 }];
  FIXTURES.product_variants = [
    { id: "v1", product_id: "p1", sku: "NP-BPC-5", size_label: "5 mg", stock_status: "out_of_stock", inventory_count: null, low_stock_threshold: 0 },
    { id: "v2", product_id: "p1", sku: "NP-BPC-10", size_label: "10 mg", stock_status: "out_of_stock", inventory_count: null, low_stock_threshold: 0 },
  ];
  FIXTURES.back_in_stock_subscriptions = subs || [
    { id: "s-prod", email: "prod@example.test", product_id: "p1", variant_id: null, notified: false },
    { id: "s-v1", email: "v1@example.test", product_id: "p1", variant_id: "v1", notified: false },
    { id: "s-v2", email: "v2@example.test", product_id: "p1", variant_id: "v2", notified: false },
    { id: "s-done", email: "done@example.test", product_id: "p1", variant_id: "v1", notified: true },
    { id: "s-other", email: "other@example.test", product_id: "p2", variant_id: null, notified: false },
  ];
  FIXTURES.audit_logs = [];
  LOG.length = 0;
  EMAIL.configured = configured; EMAIL.sent = []; EMAIL.failNext = 0;
}
const sub = (id) => FIXTURES.back_in_stock_subscriptions.find((s) => s.id === id);
const sentTo = () => EMAIL.sent.map((s) => s.to).sort();

console.log("Restock notices — executed through PATCH /api/admin/catalog:");
{
  seed();
  let r = await patch({ kind: "variant", id: "v1", stock_status: "in_stock" });
  ok(r.statusCode === 200 && r.payload.variant?.stock_status === "in_stock", "variant v1 flips out_of_stock → in_stock (200)");
  ok(sentTo().join() === ["prod@example.test", "v1@example.test"].join(), `variant flip reaches v1's subscriber + the product-level one, not v2's or another product's (sent: ${sentTo().join(", ")})`);
  ok(r.payload.restock?.notified === 2 && r.payload.restock?.queued === 0, "response reports notified 2 / queued 0");
  ok(sub("s-v1").notified === true && sub("s-prod").notified === true && sub("s-v2").notified === false && sub("s-other").notified === false, "notified flips for exactly the two reached rows");
  ok(EMAIL.sent.every((s) => s.productName === "BPC-157" && s.productSlug === "bpc-157") && EMAIL.sent.find((s) => s.to === "v1@example.test").sizeLabel === "5 mg", "each notice carries the product name, slug and (variant) size label");
  ok(FIXTURES.audit_logs.some((a) => a.action === "catalog.restock_notify"), "the restock outcome is audit-logged");

  // Same flip again: already in stock → not a flip.
  EMAIL.sent = [];
  r = await patch({ kind: "variant", id: "v1", stock_status: "in_stock" });
  ok(r.statusCode === 200 && r.payload.restock === null && EMAIL.sent.length === 0, "in_stock → in_stock is not a flip: nothing sent, restock null");

  // Flip out and back in: the already-notified rows stay silent (one notice per request).
  await patch({ kind: "variant", id: "v1", stock_status: "out_of_stock" });
  EMAIL.sent = [];
  r = await patch({ kind: "variant", id: "v1", stock_status: "in_stock" });
  ok(EMAIL.sent.length === 0 && r.payload.restock?.notified === 0, "a second flip re-sends nothing — notified is one-shot per subscription");

  // Product-level flip reaches product-level subscribers only.
  seed();
  r = await patch({ kind: "product", id: "p1", stock_status: "in_stock" });
  ok(r.statusCode === 200 && sentTo().join() === "prod@example.test", `product flip reaches product-level subscribers only (sent: ${sentTo().join(", ")})`);
  ok(sub("s-v1").notified === false && sub("s-v2").notified === false, "variant-specific requests wait for THEIR variant");

  // Flip to low_stock is not a restock.
  seed();
  r = await patch({ kind: "variant", id: "v1", stock_status: "low_stock" });
  ok(r.statusCode === 200 && EMAIL.sent.length === 0 && r.payload.restock === null, "out_of_stock → low_stock sends nothing");
}

console.log("\nTransport states:");
{
  seed({ configured: false });
  const r = await patch({ kind: "variant", id: "v1", stock_status: "in_stock" });
  ok(r.statusCode === 200 && r.payload.variant?.stock_status === "in_stock", "RESEND unconfigured: the stock update still succeeds");
  ok(r.payload.restock?.notified === 0 && r.payload.restock?.queued === 2, "…and both matching rows are reported queued");
  ok(sub("s-v1").notified === false && sub("s-prod").notified === false, "…with notified left false so a later configured flip can reach them");

  seed(); EMAIL.failNext = 1;
  const r2 = await patch({ kind: "variant", id: "v1", stock_status: "in_stock" });
  ok(r2.statusCode === 200 && r2.payload.restock?.notified === 1 && r2.payload.restock?.queued === 1, "one transport failure skips that subscriber and the update still succeeds (notified 1 / queued 1)");
  const flipped = FIXTURES.back_in_stock_subscriptions.filter((s) => s.notified && s.id !== "s-done").length;
  ok(flipped === 1, "only the delivered row is marked notified");
}

console.log("\nCap:");
{
  const many = Array.from({ length: 250 }, (_, i) => ({ id: `m${i}`, email: `m${i}@example.test`, product_id: "p1", variant_id: null, notified: false }));
  seed({ subs: many });
  const r = await patch({ kind: "product", id: "p1", stock_status: "in_stock" });
  ok(r.statusCode === 200 && EMAIL.sent.length === 200 && r.payload.restock?.notified === 200, `a flip notifies at most MAX_NOTIFY_PER_FLIP (200) subscribers (sent ${EMAIL.sent.length})`);
  ok(FIXTURES.back_in_stock_subscriptions.filter((s) => !s.notified).length === 50, "the remaining 50 stay queued for the next flip");
}

if (failures) { console.error(`\n${failures} back-in-stock check(s) FAILED`); process.exit(1); }
console.log("\nAll back-in-stock checks passed.");
