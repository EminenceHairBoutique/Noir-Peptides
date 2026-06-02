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
  if (!token) return null;

  try {
    const { data, error } = await supabaseServer.auth.getUser(token);
    if (error) return null;
    return data?.user || null;
  } catch {
    return null;
  }
}

async function ensureProfileRow(userId, email) {
  if (!userId) return;
  // Upsert is safe with service role.
  await supabaseServer
    .from("profiles")
    .upsert({ id: userId, email: email || null }, { onConflict: "id" });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const user = await getUserFromReq(req);
  if (!user) return json(res, 401, { error: "Unauthorized" });

  const allow = adminEmailAllowlist();
  const email = String(user.email || "").toLowerCase();
  if (!allow.length || !allow.includes(email)) {
    return json(res, 403, { error: "Forbidden" });
  }

  const body = await parseJsonBody(req);
  if (!body) return json(res, 400, { error: "Invalid JSON" });

  const applicationId = body.applicationId || body.id;
  const action = String(body.action || "").toLowerCase();
  const partnerTier = body.partnerTier || "wholesale";

  if (!applicationId) return json(res, 400, { error: "applicationId is required" });
  if (!['approve','approved','reject','rejected','pending'].includes(action)) {
    return json(res, 400, { error: "Invalid action" });
  }

  // Fetch application
  const { data: app, error: appErr } = await supabaseServer
    .from("partner_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (appErr || !app) {
    return json(res, 404, { error: "Application not found" });
  }

  let targetUserId = app.user_id;
  const targetEmail = String(app.email || "").trim().toLowerCase();

  // If user_id missing but email exists, attempt lookup.
  if (!targetUserId && targetEmail) {
    try {
      const { data } = await supabaseServer.auth.admin.getUserByEmail(targetEmail);
      targetUserId = data?.user?.id || null;
    } catch (e) {
      console.warn("Admin approve: getUserByEmail failed", e);
    }
  }

  const nextStatus = action.startsWith("approve") ? "approved" : action.startsWith("reject") ? "rejected" : "pending";

  try {
    // Update application row
    const { error: updAppErr } = await supabaseServer
      .from("partner_applications")
      .update({
        status: nextStatus,
        reviewed_by: user.id,
        reviewed_at: new Date().toISOString(),
        partner_tier: nextStatus === "approved" ? partnerTier : null,
      })
      .eq("id", applicationId);

    if (updAppErr) {
      return json(res, 500, { error: "Failed to update application", details: String(updAppErr.message || updAppErr) });
    }

    // Update profile tier/status if we have a target user id
    if (targetUserId) {
      await ensureProfileRow(targetUserId, targetEmail);

      const profilePatch =
        nextStatus === "approved"
          ? { account_tier: "partner", partner_status: "approved", partner_tier: partnerTier }
          : nextStatus === "rejected"
            ? { account_tier: "customer", partner_status: "rejected", partner_tier: null }
            : { account_tier: "partner_pending", partner_status: "pending", partner_tier: null };

      const { error: profErr } = await supabaseServer
        .from("profiles")
        .update(profilePatch)
        .eq("id", targetUserId);

      if (profErr) {
        console.warn("Admin approve: profile update failed", profErr);
      }
    }

    return json(res, 200, { ok: true, status: nextStatus, targetUserId: targetUserId || null });
  } catch (e) {
    console.error("Admin partner update: unhandled error", e);
    return json(res, 500, { error: "Server error" });
  }
}
