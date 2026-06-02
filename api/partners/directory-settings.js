/* eslint-env node */
/**
 * api/partners/directory-settings.js
 * Allow an approved partner to read/update their own directory settings.
 * Uses service-role to bypass RLS while still verifying identity server-side.
 */
import { requirePartner } from "../_utils/auth.js";
import { supabaseServer } from "../../lib/supabaseServer.js";

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
}

async function parseJsonBody(req) {
  const rawBody = req.body;
  if (rawBody && typeof rawBody === "object") return rawBody;
  if (typeof rawBody === "string") {
    try { return JSON.parse(rawBody); } catch { return null; }
  }
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return null;
  try { return JSON.parse(Buffer.concat(chunks).toString("utf8")); } catch { return null; }
}

export default async function handler(req, res) {
  // GET: return current directory settings for the partner
  if (req.method === "GET") {
    const partner = await requirePartner(req, res);
    if (!partner) return;

    const { data, error } = await supabaseServer
      .from("partner_applications")
      .select("city, booking_url, specialties, avatar_url, directory_opt_in")
      .eq("user_id", partner.id)
      .maybeSingle();

    if (error) return json(res, 500, { error: "DB error" });
    return json(res, 200, { settings: data || {} });
  }

  // PATCH: update directory settings
  if (req.method === "PATCH") {
    const partner = await requirePartner(req, res);
    if (!partner) return;

    const body = await parseJsonBody(req);
    if (!body) return json(res, 400, { error: "Invalid JSON" });

    // Only allow safe fields
    const allowed = ["city", "booking_url", "specialties", "avatar_url", "directory_opt_in"];
    const patch = {};
    for (const key of allowed) {
      if (key in body) {
        patch[key] = body[key];
      }
    }

    if (!Object.keys(patch).length) return json(res, 400, { error: "No valid fields" });

    // booking_url validation
    if (patch.booking_url !== undefined && patch.booking_url) {
      try {
        new URL(patch.booking_url);
      } catch {
        return json(res, 400, { error: "Invalid booking_url" });
      }
    }

    // specialties must be array
    if (patch.specialties !== undefined && !Array.isArray(patch.specialties)) {
      patch.specialties = String(patch.specialties).split(",").map((s) => s.trim()).filter(Boolean);
    }

    const { error } = await supabaseServer
      .from("partner_applications")
      .update(patch)
      .eq("user_id", partner.id);

    if (error) return json(res, 500, { error: "DB error: " + error.message });
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: "Method not allowed" });
}
