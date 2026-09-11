// src/config/features.js
// Client feature flags (Sept-11 T6). Resolved once from the build-time env.
//
//   VITE_FEATURE_CALCULATOR  → /calculator (otherwise renders the 404 page)
//   VITE_FEATURE_AI_PUBLIC   → /assistant  (otherwise renders the 404 page)
//
// Both default OFF. The server mirror (api/_utils/features.js) gates the AI
// endpoints themselves from FEATURE_AI_PUBLIC, so a client flag alone cannot
// expose an endpoint — it only decides whether the page is routed.
import { clientFeatures } from "../../lib/featureFlags.js";

export const FEATURES = clientFeatures(import.meta.env || {});
