import { supabaseServer } from "../../lib/supabaseServer.js";
import { requireAdmin } from "../_utils/auth.js";
import { jsonResponse as json } from "../_utils/body.js";

async function safeFetchApplications() {
  // Try to include current profile tier/status if the FK relation exists.
  const joinedSelect =
    "id, created_at, status, email, user_id, full_name, phone, business_name, website_or_instagram, country, monthly_volume, interested_in, message, reviewed_by, reviewed_at, notes, partner_tier, profiles:profiles!partner_applications_user_id_fkey(id, email, account_tier, partner_status, partner_tier)";

  const { data, error } = await supabaseServer
    .from("partner_applications")
    .select(joinedSelect)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!error) return { data, error: null };

  // Fallback: table exists but the relation isn't available.
  const fallback = await supabaseServer
    .from("partner_applications")
    .select(
      "id, created_at, status, email, user_id, full_name, phone, business_name, website_or_instagram, country, monthly_volume, interested_in, message, reviewed_by, reviewed_at, notes, partner_tier"
    )
    .order("created_at", { ascending: false })
    .limit(200);

  return { data: fallback.data, error: fallback.error };
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const admin = await requireAdmin(req, res);
  if (!admin) return; // 401/403 already sent

  const { data, error } = await safeFetchApplications();
  if (error) {
    return json(res, 500, {
      error: "Could not fetch applications",
      details: String(error.message || error),
    });
  }

  return json(res, 200, { ok: true, applications: data || [] });
}
