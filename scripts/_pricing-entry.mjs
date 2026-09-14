// Bundle entry for scripts/test-server-pricing.mjs and
// scripts/test-pricing-coherence.mjs. Re-exports the real pricing / rewards /
// discount functions plus the stub's fixture tables (the stub is substituted
// for lib/supabaseServer.js by an esbuild resolve plugin).
export { priceLines, resolveVariantUnitPrice, resolveVariant, computeAdjustments } from "../lib/pricing.js";
export { validateLoyaltyRedemption, getLoyaltyBalance, POINT_VALUE_USD, REDEEM_INCREMENT } from "../lib/rewards.js";
export { validateDiscount } from "../lib/discounts.js";
export { FIXTURES, LOG } from "../lib/supabaseServer.js";
