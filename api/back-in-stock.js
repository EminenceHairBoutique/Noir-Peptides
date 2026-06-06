// api/back-in-stock.js
// Capture a back-in-stock / preorder notify request. No auth required (lead
// capture); rate-limited; written via the service role. Claim-safe.
import { supabaseServer } from "../lib/supabaseServer.js";
import { checkRateLimit } from "./_utils/rateLimit.js";
import { readJsonBody, jsonResponse as json } from "./_utils/body.js";
import { getUserFromReq } from "./_utils/auth.js";
import { validateBody } from "./_utils/validate.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const allowed = await checkRateLimit(req, res, {
    endpoint: "back-in-stock",
    max: 5,
    windowMs: 60_000,
  });
  if (!allowed) return;

  const body = await readJsonBody(req);
  if (!body) return json(res, 400, { error: "Invalid JSON" });

  if (body.website) return json(res, 200, { ok: true }); // honeypot

  const { ok, errors, value } = validateBody(body, {
    email: { type: "string", required: true, email: true, max: 320 },
    variantId: { type: "string", max: 64 },
    productId: { type: "string", max: 64 },
  });
  if (!ok) return json(res, 400, { error: "Invalid request", details: errors });

  const user = await getUserFromReq(req); // optional

  try {
    await supabaseServer.from("back_in_stock_subscriptions").upsert(
      {
        email: value.email.trim().toLowerCase(),
        variant_id: value.variantId || null,
        product_id: value.productId || null,
        user_id: user?.id || null,
        notified: false,
      },
      { onConflict: "email,variant_id" }
    );
    return json(res, 200, { ok: true });
  } catch {
    return json(res, 500, { error: "Could not save your request." });
  }
}
