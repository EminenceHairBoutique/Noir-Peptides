// Test entry: re-exports the real component and its live config object so
// scripts/test-business-config.mjs can render and mutate them. Not shipped.
export { default as BusinessIdentity } from "../src/components/BusinessIdentity.jsx";
export { default as FulfillmentStatements } from "../src/components/FulfillmentStatements.jsx";
export { default as FreeShipProgress } from "../src/components/FreeShipProgress.jsx";
export { BUSINESS } from "../src/config/business.js";
export { FREE_SHIP_THRESHOLD } from "../src/config/checkout.js";
