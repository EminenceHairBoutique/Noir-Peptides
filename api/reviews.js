// api/reviews.js
// Create a claim-safe product review. Reviews may describe quality, packaging,
// COA, shipping, and service — NEVER human/animal results, efficacy, dosing, or
// therapeutic outcomes. Screening is enforced server-side; writes use the
// service role. Reading is done client-side via RLS (published reviews).

import { supabaseServer } from "../lib/supabaseServer.js";
import { requireUser } from "./_utils/auth.js";
import { checkRateLimit } from "./_utils/rateLimit.js";
import { readJsonBody, jsonResponse as json } from "./_utils/body.js";
import { validateBody } from "./_utils/validate.js";

const ASPECTS = ["quality", "packaging", "coa", "shipping", "service"];

// High-signal terms suggesting a human/animal-use or efficacy claim. If matched,
// the review is rejected with guidance (keeps the surface claim-safe / RUO).
const DISALLOWED = [
  /\b(i|we|my|me)\b[^.?!]{0,40}\b(took|inject|injected|dosed|used it|ran|cycled|administered)\b/i,
  /\b(felt|feeling|results?|gains?|recovery|healed|weight\s*loss|fat\s*loss|libido|energy|sleep better|skin)\b/i,
  /\bmg\s*\/\s*kg\b|\b(dose|dosage|dosing|inject|subcutaneous|intramuscular)\b/i,
  /\b(cured|treated|treats|healed|works for my)\b/i,
];

function violatesClaimSafety(text) {
  const t = String(text || "");
  return DISALLOWED.some((re) => re.test(t));
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const allowed = await checkRateLimit(req, res, {
    endpoint: "reviews",
    max: 5,
    windowMs: 60_000,
  });
  if (!allowed) return;

  const user = await requireUser(req, res);
  if (!user) return; // 401 already sent

  const body = await readJsonBody(req);
  if (!body) return json(res, 400, { error: "Invalid JSON" });

  const { ok, errors, value } = validateBody(body, {
    productId: { type: "string", required: true, max: 64 },
    rating: { type: "number", required: true, min: 1, max: 5 },
    aspect: { type: "string", enum: ASPECTS },
    title: { type: "string", max: 120 },
    body: { type: "string", max: 2000 },
  });
  if (!ok) return json(res, 400, { error: "Invalid request", details: errors });

  // Claim-safe screening of free text.
  if (violatesClaimSafety(`${value.title || ""} ${value.body || ""}`)) {
    return json(res, 400, {
      error:
        "Reviews can describe quality, packaging, COA, and shipping only — not human/animal use, results, dosing, or therapeutic claims.",
    });
  }

  // Confirm the product exists.
  const { data: product } = await supabaseServer
    .from("products")
    .select("id")
    .eq("id", value.productId)
    .maybeSingle();
  if (!product) return json(res, 404, { error: "Unknown product" });

  // Verified purchase: has this user ordered this product? (best-effort)
  let verified = false;
  try {
    const { data: orders } = await supabaseServer
      .from("orders")
      .select("items")
      .eq("user_id", user.id)
      .limit(50);
    verified = (orders || []).some((o) =>
      JSON.stringify(o.items || "").includes(value.productId)
    );
  } catch {
    verified = false;
  }

  const { error } = await supabaseServer.from("product_reviews").upsert(
    {
      product_id: value.productId,
      user_id: user.id,
      rating: Math.round(value.rating),
      aspect: value.aspect || null,
      title: value.title ? String(value.title).slice(0, 120) : null,
      body: value.body ? String(value.body).slice(0, 2000) : null,
      verified_purchase: verified,
      status: "published",
    },
    { onConflict: "product_id,user_id" }
  );
  if (error) return json(res, 500, { error: "Could not save review" });

  return json(res, 200, { ok: true, verified });
}
