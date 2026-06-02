/* eslint-env node */
/**
 * api/atelier/tryon/concierge.js
 *
 * Dedicated concierge request endpoint for the Atelier Mirror try-on feature.
 * Handles both session-linked requests (where a tryon_sessions record already
 * exists) and direct requests (e.g., from the Concierge Review mode without
 * a persisted session).
 *
 * POST /api/atelier/tryon/concierge
 * Body: {
 *   sessionId?   - existing tryon_sessions.id to link this request to
 *   productId    - product slug / id
 *   productName? - human-readable product name
 *   resultUrl?   - data URL or storage path of the result image
 *   adjustments? - { scale, offsetX, offsetY, rotation }
 *   notes?       - free-text notes from the client
 * }
 * Returns: { ok: true, conciergeId }
 */

import { getUserFromReq } from "../../_utils/auth.js";
import { supabaseServer } from "../../../lib/supabaseServer.js";
import { sendConciergeRequestEmail } from "../../../lib/email.js";

// Simple per-IP rate limit: max 5 concierge requests per 10 minutes for guests.
const guestRateMap = new Map(); // ip → { count, windowStart }
const GUEST_MAX = 5;
const GUEST_WINDOW_MS = 10 * 60 * 1000;

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json");
  res.end(JSON.stringify(body));
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

function getClientIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) return String(forwarded).split(",")[0].trim();
  return req.socket?.remoteAddress || "unknown";
}

function checkGuestRateLimit(ip) {
  const now = Date.now();
  const entry = guestRateMap.get(ip);
  if (!entry || now - entry.windowStart > GUEST_WINDOW_MS) {
    guestRateMap.set(ip, { count: 1, windowStart: now });
    return true; // allowed
  }
  if (entry.count >= GUEST_MAX) return false; // blocked
  entry.count += 1;
  return true;
}

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const body = await parseJsonBody(req);
  if (!body) return json(res, 400, { error: "Invalid JSON" });

  const { sessionId, productId, productName, resultUrl, adjustments, notes } = body;
  if (!productId) return json(res, 400, { error: "productId required" });

  const user = await getUserFromReq(req);

  // Rate-limit anonymous requests
  if (!user) {
    const ip = getClientIp(req);
    if (!checkGuestRateLimit(ip)) {
      return json(res, 429, { error: "Too many requests. Please try again later." });
    }
  }

  // If a sessionId was provided, verify ownership before updating it
  let session = null;
  if (sessionId) {
    const { data, error: fetchErr } = await supabaseServer
      .from("tryon_sessions")
      .select("id, user_id, product_id, product_name")
      .eq("id", sessionId)
      .maybeSingle();

    if (fetchErr || !data) {
      // Session not found — proceed without linking
    } else if (data.user_id && data.user_id !== user?.id) {
      return json(res, 403, { error: "Forbidden" });
    } else {
      session = data;
    }
  }

  // Insert concierge request record
  let conciergeId = null;
  try {
    const { data: conciergeRow, error: insertErr } = await supabaseServer
      .from("concierge_requests")
      .insert({
        user_id: user?.id || null,
        email: user?.email || null,
        type: "tryon_consultation",
        payload: {
          tryonSessionId: sessionId || null,
          productId,
          productName: productName || productId,
          resultUrl: resultUrl || null,
          adjustments: adjustments || null,
          notes: notes || null,
          accountId: user?.id || null,
          accountEmail: user?.email || null,
        },
        status: "pending",
      })
      .select("id")
      .maybeSingle();

    if (insertErr) {
      console.warn("concierge insert:", insertErr.message);
      return json(res, 500, { error: "Could not create concierge request" });
    }

    conciergeId = conciergeRow?.id || null;

    // Link back to the try-on session if we have one
    if (session && conciergeId) {
      await supabaseServer
        .from("tryon_sessions")
        .update({
          status: "sent_to_concierge",
          concierge_id: conciergeId,
          updated_at: new Date().toISOString(),
        })
        .eq("id", sessionId);
    }

    // Send notification email (non-fatal if it fails)
    await sendConciergeRequestEmail({
      type: "tryon_consultation",
      payload: {
        tryonSessionId: sessionId || null,
        productName: productName || productId,
        resultUrl: resultUrl || null,
        notes: notes || null,
        accountId: user?.id || null,
        accountEmail: user?.email || null,
      },
    }).catch((e) => {
      // Email failure is non-fatal but should be visible in logs for follow-up
      console.error("[concierge] email notification failed:", e?.message, { conciergeId, productId });
    });
  } catch (e) {
    console.warn("concierge handler:", e?.message);
    return json(res, 500, { error: "Server error" });
  }

  return json(res, 200, { ok: true, conciergeId });
}
