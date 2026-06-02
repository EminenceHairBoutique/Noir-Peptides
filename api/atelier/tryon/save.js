/* eslint-env node */
/**
 * api/atelier/tryon/save.js
 * Saves the try-on result (composite image URL + adjustments) and optionally
 * sends the session to the concierge queue.
 *
 * POST /api/atelier/tryon/save
 * Body: { sessionId, resultUrl?, adjustments?, sendToConcierge? }
 * Returns: { ok: true, conciergeId? }
 */
import { getUserFromReq } from "../../_utils/auth.js";
import { supabaseServer } from "../../../lib/supabaseServer.js";
import { sendConciergeRequestEmail } from "../../../lib/email.js";

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
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const body = await parseJsonBody(req);
  if (!body) return json(res, 400, { error: "Invalid JSON" });

  const { sessionId, resultUrl, adjustments, sendToConcierge } = body;
  if (!sessionId) return json(res, 400, { error: "sessionId required" });

  const user = await getUserFromReq(req);

  // Build update patch
  const patch = {
    status: sendToConcierge ? "sent_to_concierge" : "saved",
    updated_at: new Date().toISOString(),
  };
  if (resultUrl) patch.result_url = String(resultUrl);
  if (adjustments) patch.adjustments = adjustments;

  // Verify session ownership before update (anon sessions: user_id IS NULL)
  const { data: session, error: fetchErr } = await supabaseServer
    .from("tryon_sessions")
    .select("id, user_id, product_id, product_name, overlay_key")
    .eq("id", sessionId)
    .maybeSingle();

  if (fetchErr || !session) {
    return json(res, 404, { error: "Session not found" });
  }

  // Ownership check: if session has a user_id, the caller must match.
  if (session.user_id && session.user_id !== user?.id) {
    return json(res, 403, { error: "Forbidden" });
  }

  const { error: updateErr } = await supabaseServer
    .from("tryon_sessions")
    .update(patch)
    .eq("id", sessionId);

  if (updateErr) {
    console.warn("tryon/save update:", updateErr.message);
    return json(res, 500, { error: "DB error" });
  }

  let conciergeId = null;

  if (sendToConcierge) {
    try {
      // Log a structured concierge request record for admin follow-up
      const { data: conciergeRow } = await supabaseServer
        .from("concierge_requests")
        .insert({
          user_id: user?.id || null,
          email: user?.email || null,
          type: "tryon_consultation",
          payload: {
            tryonSessionId: sessionId,
            productId: session.product_id,
            productName: session.product_name,
            resultUrl: resultUrl || null,
            adjustments: adjustments || null,
          },
          status: "pending",
        })
        .select("id")
        .maybeSingle();

      if (conciergeRow?.id) {
        conciergeId = conciergeRow.id;
        // Link back to the session
        await supabaseServer
          .from("tryon_sessions")
          .update({ concierge_id: conciergeId })
          .eq("id", sessionId);
      }

      // Send email notification
      await sendConciergeRequestEmail({
        type: "tryon_consultation",
        payload: {
          tryonSessionId: sessionId,
          productName: session.product_name,
          resultUrl: resultUrl || null,
          accountId: user?.id || null,
          accountEmail: user?.email || null,
        },
      });
    } catch (e) {
      console.warn("tryon/save concierge:", e?.message);
      // Non-fatal: the session is saved even if concierge notification fails.
    }
  }

  return json(res, 200, { ok: true, conciergeId });
}
