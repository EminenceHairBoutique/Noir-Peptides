// api/_utils/features.js
// Server mirror of the launch feature flags (Sept-11 T6).
//
//   FEATURE_AI_PUBLIC → the public AI endpoints (research-assistant,
//   literature-summarizer, concierge, semantic-search). Unset/false → each
//   returns 404 with the sanitized error envelope, exactly as if the route
//   did not exist. The admin tools (coa-analyzer, compliance-scan) are NOT
//   behind this flag.
//
// Default OFF. Read per request (not at import) so a test can flip env.
import { serverFeatures } from "../../lib/featureFlags.js";
import { failSafely } from "../../lib/apiError.js";

export function features() {
  return serverFeatures(process.env);
}

/**
 * Gate a handler on a server flag. Returns true when the feature is on;
 * otherwise sends the 404 envelope and returns false (caller must `return`).
 * @param {object} res
 * @param {"aiPublic"} name
 */
export function gateFeature(res, name) {
  if (features()[name]) return true;
  failSafely(res, {
    status: 404,
    code: "not_found",
    message: "Not found.",
    error: new Error(`feature disabled: ${name}`),
    context: "feature_gate",
  });
  return false;
}
