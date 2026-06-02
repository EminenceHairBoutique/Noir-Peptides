/* eslint-env node */
/**
 * api/atelier/tryon/create.js
 * Creates a new try-on session record in Supabase.
 * Also returns a signed upload URL so the client can upload the source photo
 * directly to Supabase Storage without going through this function.
 *
 * POST /api/atelier/tryon/create
 * Body: { productId, productName, overlayKey, adjustments? }
 * Returns: { sessionId, uploadUrl, storagePath }
 */
import { getUserFromReq } from "../../_utils/auth.js";
import { supabaseServer } from "../../../lib/supabaseServer.js";

const BUCKET = "tryon-sessions";

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

  const { productId, productName, overlayKey, adjustments } = body;
  if (!productId) return json(res, 400, { error: "productId required" });

  // Auth is optional — anonymous try-ons are allowed but not saved to profiles.
  const user = await getUserFromReq(req);

  const sessionId = crypto.randomUUID();
  const uid = user?.id || "anon";
  const storagePath = `${uid}/${sessionId}/input.jpg`;

  // Create the session record first (status = 'created')
  const { error: insertErr } = await supabaseServer
    .from("tryon_sessions")
    .insert({
      id: sessionId,
      user_id: user?.id || null,
      product_id: productId,
      product_name: productName || productId,
      overlay_key: overlayKey || productId,
      adjustments: adjustments || null,
      status: "created",
    });

  if (insertErr) {
    // DB insert failed — return error so the client knows the session is not persisted.
    // The client should handle this gracefully (e.g., still allow manual try-on).
    console.warn("tryon/create insert:", insertErr.message);
    return json(res, 500, { error: "Could not create session: " + insertErr.message });
  }

  // Generate a signed upload URL (60 s TTL) for the source photo.
  let uploadUrl = null;
  try {
    const { data, error: signErr } = await supabaseServer.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (!signErr && data?.signedUrl) {
      uploadUrl = data.signedUrl;
    } else {
      console.warn("tryon/create signed-url:", signErr?.message);
    }
  } catch (e) {
    console.warn("tryon/create storage:", e?.message);
  }

  return json(res, 200, { sessionId, uploadUrl, storagePath });
}
