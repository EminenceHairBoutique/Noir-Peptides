// Test entry: re-exports the real component and its live config object so
// scripts/test-business-config.mjs can render and mutate them. Not shipped.
export { default as BusinessIdentity } from "../src/components/BusinessIdentity.jsx";
export { BUSINESS } from "../src/config/business.js";
