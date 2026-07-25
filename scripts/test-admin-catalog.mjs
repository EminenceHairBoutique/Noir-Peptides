// scripts/test-admin-catalog.mjs
// Contract tests for the Control Room catalog manager (Phase 7). The endpoint
// imports supabaseServer (env-dependent), so these are source-contract guards:
// server auth, column whitelists, restock gating, email compliance line, and
// the UI wiring must all fail this suite if a refactor silently drops them.
import { readFileSync } from "node:fs";

let passed = 0;
let failed = 0;
function check(name, cond) {
  if (cond) passed += 1;
  else { failed += 1; console.error(`  ✗ ${name}`); }
}

const api = readFileSync(new URL("../api/admin/catalog.js", import.meta.url), "utf8");
const ui = readFileSync(new URL("../src/pages/AdminHome.jsx", import.meta.url), "utf8");
const email = readFileSync(new URL("../lib/email.js", import.meta.url), "utf8");
const bisSql = readFileSync(new URL("../supabase/migrations/0012_back_in_stock.sql", import.meta.url), "utf8");

// ── Server contract ───────────────────────────────────────────────────────
check("endpoint is admin-gated", api.includes("requireAdmin(req, res)"));
check("stock enum matches DB usage", api.includes(`["in_stock", "low_stock", "out_of_stock"]`));
check("price is bounded", api.includes("n < 0 || n > 100000"));
check("featured/is_new are product-only booleans",
  api.includes(`kind === "product"`) && api.includes("featured must be boolean"));
check("descriptions are NOT writable (no description in update path)",
  !/fields\.description|out\.description/.test(api));
check("restock fires only on flip INTO in_stock",
  api.includes(`fields.stock_status === "in_stock" && existing.stock_status !== "in_stock"`));
check("restock notify is capped", api.includes("MAX_NOTIFY_PER_FLIP"));
check("subscribers marked notified after send",
  api.includes(`.update({ notified: true })`));
check("unconfigured Resend leaves subscribers queued (r === null path)",
  api.includes("r === null"));
check("changes are audit-logged", api.includes("audit_logs"));

// ── Email contract ────────────────────────────────────────────────────────
check("restock email exists + is config-gated",
  email.includes("sendBackInStockEmail") && email.includes("if (!resend || !to) return null"));
check("restock email carries the RUO line",
  /Back in stock[\s\S]*?For research use only\. Not for human or veterinary use\./.test(email));
check("restock email links the PDP route", email.includes("/product/${productSlug}"));

// ── Schema alignment ──────────────────────────────────────────────────────
check("subscriptions table has the notified flag the loop depends on",
  bisSql.includes("notified   boolean not null default false"));
check("partial index targets un-notified rows", bisSql.includes("where notified = false"));

// ── UI wiring ─────────────────────────────────────────────────────────────
check("Catalog tab registered", ui.includes(`{ id: "catalog", label: "Catalog", icon: Boxes }`));
check("CatalogManager rendered", ui.includes(`tab === "catalog" && <CatalogManager`));
check("UI PATCHes the admin endpoint", ui.includes(`adminSend("/api/admin/catalog", "PATCH"`));
check("UI surfaces the queued-not-sent state (Resend unconfigured)",
  ui.includes("RESEND_API_KEY"));

if (failed > 0) {
  console.error(`\nadmin-catalog: ${failed} FAILED, ${passed} passed`);
  process.exit(1);
}
console.log(`admin-catalog: all ${passed} assertions passed`);
