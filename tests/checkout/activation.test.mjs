// tests/checkout/activation.test.mjs
// Guards the ACTIVATION wiring: the /checkout route points at the two-step
// flow, complianceId is threaded through BOTH payment rails into fulfillment,
// the compliance record is linked to the order without ever being able to fail
// a paid order, and the endpoint degrades gracefully when the
// order_attestations table hasn't been created yet.
import { readFileSync } from "node:fs";

let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) passed++; else { failed++; console.error(`  ✗ ${name}`); } };
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

const app = read("../../src/App.jsx");
const stripe = read("../../api/create-checkout-session.js");
const btcpay = read("../../api/btcpay/create-invoice.js");
const fulfillment = read("../../lib/payments/fulfillment.js");
const compliance = read("../../api/checkout-compliance.js");
const twoStep = read("../../src/pages/CheckoutTwoStep.jsx");
const pdp = read("../../src/pages/ProductDetail.jsx");

// ── Route activation ───────────────────────────────────────────────────────
check("/checkout renders the two-step flow", app.includes('lazy(() => import("./pages/CheckoutTwoStep"))'));
check("route still auth-walled (auth wall kept per owner decision)",
  /path="\/checkout"[\s\S]{0,120}RequireAuth/.test(app));
check("legacy single-step kept as a rollback target", app.includes("rollback target"));

// ── complianceId threading: client → rails → fulfillment ───────────────────
check("client sends complianceId to the payment rail", twoStep.includes("complianceId: complianceId || undefined"));
check("stripe rail accepts complianceId", stripe.includes("complianceId,"));
check("stripe rail forwards it in session metadata", stripe.includes("compliance_id: complianceId"));
check("btcpay rail accepts complianceId", btcpay.includes("complianceId,"));
check("btcpay rail forwards it in invoice metadata", btcpay.includes("compliance_id: complianceId"));
check("fulfillment links the record from consent metadata",
  fulfillment.includes("linkComplianceRecord({ complianceId: consent.compliance_id"));

// ── Linking must never break a paid order ──────────────────────────────────
check("link is best-effort (try/catch, warn only)",
  /async function linkComplianceRecord[\s\S]*?catch \(e\)[\s\S]*?console\.warn/.test(fulfillment));
check("link no-ops on a missing/invalid id (legacy orders unaffected)",
  fulfillment.includes("if (!Number.isInteger(id) || id <= 0) return;"));
check("link writes BOTH directions (order_id + orders.compliance_id)",
  fulfillment.includes('.from("order_attestations")') && fulfillment.includes('.from("orders")') &&
  fulfillment.includes("compliance_id: id"));

// ── Graceful degradation when the SQL hasn't been run ──────────────────────
check("detects missing table (42P01 / PGRST205)",
  compliance.includes('code === "42P01"') && compliance.includes('code === "PGRST205"'));
check("falls back to the existing attestation_audit table",
  compliance.includes('.from("attestation_audit")'));
check("fallback still records research entity + protocol (nothing lost)",
  compliance.includes('id: "research_entity"') && compliance.includes('id: "research_protocol"'));
check("fallback still captures server IP + user agent",
  /attestation_audit[\s\S]{0,600}ip_address: ip[\s\S]{0,120}user_agent: ua/.test(compliance));
check("fallback logs the actionable remediation",
  compliance.includes("Run scripts/proposed-order-attestations.sql"));
check("raw Postgres errors never reach the user",
  compliance.includes("Could not save your research-use certification"));

// ── Single source of truth for the free-ship threshold ─────────────────────
check("PDP imports the shared threshold (no local redefinition)",
  pdp.includes('import { FREE_SHIP_THRESHOLD } from "../config/checkout"') &&
  !/const FREE_SHIP_THRESHOLD\s*=/.test(pdp));

if (failed) { console.error(`\ncheckout-activation: ${failed} FAILED, ${passed} passed`); process.exit(1); }
console.log(`checkout-activation: all ${passed} assertions passed`);
