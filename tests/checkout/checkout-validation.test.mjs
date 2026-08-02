// tests/checkout/checkout-validation.test.mjs
// Stage 3 + Stage 6 coverage for the two-step checkout, exercising the pure
// modules directly (no DOM): validation gating, attestation enforcement,
// free-shipping threshold math, and the billing-toggle disclosure logic.
import {
  validateContact, validateAddress, validateResearch, validateShippingMethod,
  validateAttestations, validateStep1, isStep1Valid,
} from "../../src/lib/checkoutValidation.js";
import { freeShipProgress, FREE_SHIP_THRESHOLD, SHIPPING_METHODS } from "../../src/config/checkout.js";
import { CHECKOUT_ATTESTATION_IDS } from "../../src/config/checkoutAttestations.js";

let passed = 0, failed = 0;
const check = (name, cond) => { if (cond) passed++; else { failed++; console.error(`  ✗ ${name}`); } };

// ── Contact ────────────────────────────────────────────────────────────────
check("contact requires first/last/email", Object.keys(validateContact({})).length === 3);
check("contact rejects bad email", !!validateContact({ firstName: "A", lastName: "B", email: "nope" }).email);
check("contact accepts valid", Object.keys(validateContact({ firstName: "A", lastName: "B", email: "a@b.co" })).length === 0);
check("phone optional but format-checked", !!validateContact({ firstName: "A", lastName: "B", email: "a@b.co", phone: "12" }).phone);

// ── Address (+ ZIP + state) ─────────────────────────────────────────────────
const goodAddr = { line1: "1 Lab Way", city: "Austin", state: "TX", zip: "78701" };
check("valid address passes", Object.keys(validateAddress(goodAddr)).length === 0);
check("missing line1/city/state/zip all flagged", Object.keys(validateAddress({})).length === 4);
check("bad ZIP rejected", !!validateAddress({ ...goodAddr, zip: "abc" }).zip);
check("ZIP+4 accepted", !validateAddress({ ...goodAddr, zip: "78701-1234" }).zip);
check("invalid state code rejected", !!validateAddress({ ...goodAddr, state: "ZZ" }).state);
check("billing prefix namespaces errors", !!validateAddress({}, "billing_").billing_line1);

// ── Research ────────────────────────────────────────────────────────────────
check("research requires both selects", Object.keys(validateResearch({})).length === 2);
check("research rejects off-list value", !!validateResearch({ entity: "Hospital", protocol: "In-vitro study" }).entity);
check("research valid passes", Object.keys(validateResearch({ entity: "Research Institution", protocol: "In-vitro study" })).length === 0);

// ── Shipping method ─────────────────────────────────────────────────────────
check("shipping method required", !!validateShippingMethod("").shippingMethod);
check("valid shipping id passes", Object.keys(validateShippingMethod(SHIPPING_METHODS[0].id)).length === 0);
check("bogus shipping id rejected", !!validateShippingMethod("teleport").shippingMethod);

// ── Attestations (Stage 4 client gate) ──────────────────────────────────────
check("no attestations → error", !!validateAttestations({}).attestations);
const partial = { [CHECKOUT_ATTESTATION_IDS[0]]: true, [CHECKOUT_ATTESTATION_IDS[1]]: true };
check("partial attestations → error (all 3 required)", !!validateAttestations(partial).attestations);
const allAtt = Object.fromEntries(CHECKOUT_ATTESTATION_IDS.map((id) => [id, true]));
check("all three attestations → valid", Object.keys(validateAttestations(allAtt)).length === 0);
check("there are exactly 3 certifications", CHECKOUT_ATTESTATION_IDS.length === 3);

// ── Free-shipping threshold math ────────────────────────────────────────────
check("below threshold: remaining correct", freeShipProgress(150).remaining === FREE_SHIP_THRESHOLD - 150);
check("below threshold: does not qualify", freeShipProgress(150).qualifies === false);
check("at threshold: qualifies, 0 remaining", freeShipProgress(FREE_SHIP_THRESHOLD).qualifies && freeShipProgress(FREE_SHIP_THRESHOLD).remaining === 0);
check("above threshold: qualifies", freeShipProgress(500).qualifies === true);
check("pct clamps 0..100", freeShipProgress(0).pct === 0 && freeShipProgress(9999).pct === 100);
check("negative subtotal safe", freeShipProgress(-50).remaining === FREE_SHIP_THRESHOLD);

// ── Whole-step gating + billing-toggle disclosure ───────────────────────────
const fullValid = {
  contact: { firstName: "A", lastName: "B", email: "a@b.co" },
  shipping: goodAddr,
  billingDifferent: false,
  billing: {},
  research: { entity: "Research Institution", protocol: "In-vitro study" },
  shippingMethod: SHIPPING_METHODS[0].id,
  attestations: allAtt,
};
check("complete step-1 is valid", isStep1Valid(fullValid));
check("billing not validated while toggle off (empty billing OK)", isStep1Valid(fullValid));
check("billing IS validated when toggle on", !isStep1Valid({ ...fullValid, billingDifferent: true, billing: {} }));
check("billing toggle on + valid billing passes", isStep1Valid({ ...fullValid, billingDifferent: true, billing: goodAddr }));
check("missing one attestation blocks step", !isStep1Valid({ ...fullValid, attestations: partial }));
check("missing shipping method blocks step", !isStep1Valid({ ...fullValid, shippingMethod: "" }));

if (failed) { console.error(`\ncheckout-validation: ${failed} FAILED, ${passed} passed`); process.exit(1); }
console.log(`checkout-validation: all ${passed} assertions passed`);
