/* eslint-env node */
import { sendConciergeRequestEmail } from "../../lib/email.js";
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

async function parseJsonBody(req) {
  const rawBody = req.body;
  if (rawBody && typeof rawBody === "object") return rawBody;
  if (typeof rawBody === "string") {
    try {
      return JSON.parse(rawBody);
    } catch {
      return null;
    }
  }

  // Vercel/Node fallback: read the request stream
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  if (!chunks.length) return null;

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return null;
  }
}

async function getUserFromReq(req) {
  const token = getBearerToken(req);
  if (!token) return { token: null, user: null };

  try {
    const { data, error } = await supabaseServer.auth.getUser(token);
    if (error) return { token, user: null };
    return { token, user: data?.user || null };
  } catch {
    return { token, user: null };
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const body = await parseJsonBody(req);
  if (!body) return json(res, 400, { error: "Invalid JSON" });

  const payload = body.payload || {};

  // Basic honeypot: bots fill this field.
  if (payload.website && String(payload.website).trim() !== "") {
    return json(res, 200, { ok: true });
  }

  const { user } = await getUserFromReq(req);

  const email = String(payload.email || user?.email || "").trim().toLowerCase();
  if (!email) return json(res, 400, { error: "Email is required" });

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
    // Store in DB (if the table exists). Safe: service role bypasses RLS.
    const { error: upsertErr } = await supabaseServer
      .from("partner_applications")
      .upsert(row, { onConflict: "email" });

    if (upsertErr) {
      // If the SQL migration isn't run yet, this will fail.
      console.warn("Partner apply: DB upsert failed", upsertErr);
    }

    // Mark profile as pending (if logged in + columns exist).
    if (user?.id) {
      const { error: profErr } = await supabaseServer
        .from("profiles")
        .update({ partner_status: "pending", account_tier: "partner_pending" })
        .eq("id", user.id);

      if (profErr) {
        console.warn("Partner apply: profile update failed", profErr);
      }
    }

    // Email concierge
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
