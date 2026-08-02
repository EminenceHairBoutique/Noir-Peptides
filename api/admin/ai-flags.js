// api/admin/ai-flags.js
// Admin AI safety queue. GET lists recorded refusals/flags; PATCH marks a flag
// reviewed. Server-enforced admin; ai_flags is service-role-insert only, so the
// queue can't be forged by clients.
import { requireAdmin } from "../_utils/auth.js";
import { supabaseServer } from "../../lib/supabaseServer.js";
import { readJsonBody, jsonResponse as json } from "../_utils/body.js";

const COLUMNS = "id, user_id, feature, kind, prompt, reply, reviewed, created_at";

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === "GET") {
    const { data, error } = await supabaseServer
      .from("ai_flags")
      .select(COLUMNS)
      .order("reviewed", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) return json(res, 500, { error: "Could not load AI flags" });
    return json(res, 200, { flags: data || [] });
  }

  if (req.method === "PATCH") {
    const body = await readJsonBody(req);
    if (!body?.id) return json(res, 400, { error: "id is required" });
    const { data, error } = await supabaseServer
      .from("ai_flags")
      .update({ reviewed: body.reviewed !== false })
      .eq("id", body.id)
      .select("id, reviewed")
      .maybeSingle();
    if (error) return json(res, 500, { error: error.message || "Could not update flag" });
    return json(res, 200, { flag: data });
  }

  return json(res, 405, { error: "Method not allowed" });
}
