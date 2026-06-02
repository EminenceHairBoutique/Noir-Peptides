/* eslint-env node */
import { supabaseServer } from "../../lib/supabaseServer.js";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

function getBearerToken(req) {
  const auth = req.headers?.authorization || req.headers?.Authorization;
  if (!auth) return null;
  const tokenMatch = String(auth).match(/^Bearer\s+(.+)$/i);
  return tokenMatch ? tokenMatch[1] : null;
}

function adminEmailAllowlist() {
  const raw = process.env.ADMIN_EMAILS || process.env.VITE_ADMIN_EMAILS || "";
  return raw
    .split(",")
    .map((emailAddress) => emailAddress.trim().toLowerCase())
    .filter(Boolean);
}

async function getUserFromReq(req) {
  const token = getBearerToken(req);
  if (!token) return null;

  try {
    const { data, error } = await supabaseServer.auth.getUser(token);
    if (error) return null;
    return data?.user || null;
  } catch {
    return null;
  }
}

async function safeFetchApplications() {
  // Try to include current profile tier/status if FK exists.
  const joinedSelect =
    "id, created_at, status, email, user_id, full_name, phone, business_name, website_or_instagram, country, monthly_volume, interested_in, message, reviewed_by, reviewed_at, notes, partner_tier, profiles:profiles!partner_applications_user_id_fkey(id, email, account_tier, partner_status, partner_tier)";

  let { data, error } = await supabaseServer
    .from("partner_applications")
    .select(joinedSelect)
    .order("created_at", { ascending: false })
    .limit(200);

  if (!error) return { data, error: null };

  // Fallback: table exists but relation isn't available yet.
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

  const user = await getUserFromReq(req);
  if (!user) return json(res, 401, { error: "Unauthorized" });

  const allow = adminEmailAllowlist();
  const email = String(user.email || "").toLowerCase();
  if (!allow.length || !allow.includes(email)) {
    return json(res, 403, { error: "Forbidden" });
  }

  const { data, error } = await safeFetchApplications();
  if (error) {
    return json(res, 500, {
      error: "Could not fetch applications",
      details: String(error.message || error),
    });
  }

  return json(res, 200, { ok: true, applications: data || [] });
}
