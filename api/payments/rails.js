// api/payments/rails.js
// Public GET endpoint: which payment rails are configured/live right now. The
// checkout UI calls this and renders only the available rails (defaulting to
// crypto when no card processor is active), so adding/swapping a processor never
// requires a checkout-UI change. Returns no secrets.
import { availableRails } from "../../lib/payments/providers.js";
import { jsonResponse as json } from "../_utils/body.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  const rails = availableRails();
  return json(res, 200, {
    rails,
    // Default rail: the primary (crypto) if live, else the first available.
    default: rails.find((r) => r.primary)?.id || rails[0]?.id || null,
  });
}
