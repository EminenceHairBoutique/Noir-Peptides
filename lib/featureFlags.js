// lib/featureFlags.js
// Launch-sensitive surfaces are OFF unless an environment variable turns them
// on (Sept-11 T6). One parser, imported by both the client config
// (src/config/features.js, reading import.meta.env) and the server mirror
// (api/_utils/features.js, reading process.env), so "on" means the same
// thing everywhere.
//
// DEFAULT IS OFF. No code path, .env.example line, or doc may set a flag on;
// scripts/test-feature-flags.mjs asserts that.

/** "1", "true", "on", "yes" (any case, trimmed) → true. Everything else → false. */
export function parseFlag(value) {
  return /^(1|true|on|yes)$/i.test(String(value ?? "").trim());
}

/** Client-side flags, from the VITE_-prefixed variables the bundle can see. */
export function clientFeatures(env = {}) {
  return Object.freeze({
    calculator: parseFlag(env.VITE_FEATURE_CALCULATOR),
    aiPublic: parseFlag(env.VITE_FEATURE_AI_PUBLIC),
    // Opt cycle 11 (4.14d): saved-cart return nudge, client-only v1. Reads the
    // persisted cart (np_cart) through CartContext; never the tab-scoped
    // checkout draft. A server-sent reminder needs a write-capable scheduled
    // workflow and is escalated, not built.
    cartRecovery: parseFlag(env.VITE_FEATURE_CART_RECOVERY),
  });
}

/** Server-side flags, from server-only variables. */
export function serverFeatures(env = {}) {
  return Object.freeze({
    aiPublic: parseFlag(env.FEATURE_AI_PUBLIC),
  });
}
