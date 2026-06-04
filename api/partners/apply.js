import { sendConciergeRequestEmail } from "../../lib/email.js";
import { supabaseServer } from "../../lib/supabaseServer.js";
import { getUserFromReq } from "../_utils/auth.js";
import { readJsonBody, jsonResponse as json } from "../_utils/body.js";
import { validateBody } from "../_utils/validate.js";
import { checkRateLimit } from "../_utils/rateLimit.js";

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const allowed = await checkRateLimit(req, res, {
    endpoint: "partner-apply",
    max: 5,
    windowMs: 60_000,
  });
  if (!allowed) return;

  const body = await readJsonBody(req);
  if (!body) return json(res, 400, { error: "Invalid JSON" });

  const payload = body.payload || {};

  // Honeypot: bots fill this hidden field.
  if (payload.website && String(payload.website).trim() !== "") {
    return json(res, 200, { ok: true });
  }

  // Identity is optional here (public application form) but used when present.
  const user = await getUserFromReq(req);

  const email = String(payload.email || user?.email || "").trim().toLowerCase();
  const { ok, errors } = validateBody(
    { email, fullName: payload.fullName },
    {
      email: { type: "string", required: true, email: true, max: 320 },
      fullName: { type: "string", required: true, min: 2, max: 200 },
    }
  );
  if (!ok) return json(res, 400, { error: "Invalid request", details: errors });

  const row = {
    user_id: user?.id || null,
    email,
    full_name: payload.fullName || null,
    phone: payload.phone || null,
    business_name: payload.businessName || null,
    website_or_instagram: payload.websiteOrInstagram || null,
    country: payload.country || null,
    monthly_volume: payload.monthlyVolume || null,
    interested_in: payload.interestedIn || null,
    message: payload.message || null,
    status: "pending",
  };

  try {
    const { error: upsertErr } = await supabaseServer
      .from("partner_applications")
      .upsert(row, { onConflict: "email" });
    if (upsertErr) console.warn("Partner apply: DB upsert failed", upsertErr);

    if (user?.id) {
      const { error: profErr } = await supabaseServer
        .from("profiles")
        .update({ partner_status: "pending", account_tier: "partner_pending" })
        .eq("id", user.id);
      if (profErr) console.warn("Partner apply: profile update failed", profErr);
    }

    await sendConciergeRequestEmail({
      type: "partner_application",
      payload: {
        ...payload,
        accountId: user?.id || null,
        accountEmail: user?.email || null,
      },
    });

    return json(res, 200, { ok: true });
  } catch (e) {
    console.error("Partner apply: unhandled error", e);
    return json(res, 500, { error: "Server error" });
  }
}
