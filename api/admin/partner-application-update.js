import { supabaseServer } from "../../lib/supabaseServer.js";
import { requireAdmin } from "../_utils/auth.js";
import { readJsonBody, jsonResponse as json } from "../_utils/body.js";
import { validateBody } from "../_utils/validate.js";

async function ensureProfileRow(userId, email) {
  if (!userId) return;
  await supabaseServer
    .from("profiles")
    .upsert({ id: userId, email: email || null }, { onConflict: "id" });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const admin = await requireAdmin(req, res);
  if (!admin) return; // 401/403 already sent

  const body = await readJsonBody(req);
  if (!body) return json(res, 400, { error: "Invalid JSON" });

  const applicationId = body.applicationId || body.id;
  const action = String(body.action || "").toLowerCase();
  const partnerTier = body.partnerTier || "wholesale";

  const { ok, errors } = validateBody(
    { applicationId, action },
    {
      applicationId: { type: "string", required: true },
      action: {
        type: "string",
        required: true,
        enum: ["approve", "approved", "reject", "rejected", "pending"],
      },
    }
  );
  if (!ok) return json(res, 400, { error: "Invalid request", details: errors });

  const { data: app, error: appErr } = await supabaseServer
    .from("partner_applications")
    .select("*")
    .eq("id", applicationId)
    .maybeSingle();

  if (appErr || !app) return json(res, 404, { error: "Application not found" });

  let targetUserId = app.user_id;
  const targetEmail = String(app.email || "").trim().toLowerCase();

  if (!targetUserId && targetEmail) {
    try {
      const { data } = await supabaseServer.auth.admin.getUserByEmail(targetEmail);
      targetUserId = data?.user?.id || null;
    } catch (e) {
      console.warn("Admin approve: getUserByEmail failed", e);
    }
  }

  const nextStatus = action.startsWith("approve")
    ? "approved"
    : action.startsWith("reject")
    ? "rejected"
    : "pending";

  try {
    const { error: updAppErr } = await supabaseServer
      .from("partner_applications")
      .update({
        status: nextStatus,
        reviewed_by: admin.id,
        reviewed_at: new Date().toISOString(),
        partner_tier: nextStatus === "approved" ? partnerTier : null,
      })
      .eq("id", applicationId);

    if (updAppErr) {
      return json(res, 500, {
        error: "Failed to update application",
        details: String(updAppErr.message || updAppErr),
      });
    }

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

      if (profErr) console.warn("Admin approve: profile update failed", profErr);
    }

    return json(res, 200, { ok: true, status: nextStatus, targetUserId: targetUserId || null });
  } catch (e) {
    console.error("Admin partner update: unhandled error", e);
    return json(res, 500, { error: "Server error" });
  }
}
