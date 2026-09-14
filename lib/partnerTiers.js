// lib/partnerTiers.js — the partner tiers the owner can assign on approval
// (opt cycle 12). A label on the account for the owner's records and the
// Control Room; pricing stays identity-blind (lib/pricing.js never reads a
// tier — turning partner pricing on is an ask-before change). Shared by the
// admin endpoint (validation) and the Control Room (the select).
export const PARTNER_TIERS = ["wholesale", "institutional"];
export const DEFAULT_PARTNER_TIER = "wholesale";
