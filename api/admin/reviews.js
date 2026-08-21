// api/admin/reviews.js
// Admin review moderation. GET lists reviews; PATCH toggles status
// (published | hidden). Reviews default to 'published' (migration 0011), so
// moderation is hide/unhide. Server-enforced admin.
import { requireAdmin } from "../_utils/auth.js";
import { supabaseServer } from "../../lib/supabaseServer.js";
import { readJsonBody, jsonResponse as json } from "../_utils/body.js";
import { failSafely } from "../../lib/apiError.js";

const COLS = "id, product_id, rating, aspect, title, body, verified_purchase, status, created_at";

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === "GET") {
    const { data, error } = await supabaseServer
      .from("product_reviews")
      .select(COLS)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return json(res, 500, { error: "Could not load reviews" });
    return json(res, 200, { reviews: data || [] });
  }

  if (req.method === "PATCH") {
    const body = await readJsonBody(req);
    if (!body?.id) return json(res, 400, { error: "id is required" });
    const status = body.status === "hidden" ? "hidden" : "published";
    const { data, error } = await supabaseServer
      .from("product_reviews")
      .update({ status })
      .eq("id", body.id)
      .select("id, status")
      .maybeSingle();
    if (error) return failSafely(res, { status: 500, code: "review_update_failed", message: "Could not update the review. Please try again.", error, context: "admin/reviews:update" });
    return json(res, 200, { review: data });
  }

  return json(res, 405, { error: "Method not allowed" });
}
