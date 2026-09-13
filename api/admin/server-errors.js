// api/admin/server-errors.js   (opt c6 — scorecard 4.12)
// Control Room "Errors" tab, server side. Server-enforced admin; service-role
// reads (server_errors has admin-only RLS and no client writers).
//   GET   → open + recently-resolved API failures, newest first
//   PATCH → { id, resolved } to resolve/reopen a row
import { requireAdmin } from "../_utils/auth.js";
import { supabaseServer } from "../../lib/supabaseServer.js";
import { validateBody } from "../_utils/validate.js";
import { readJsonBody, jsonResponse as json } from "../_utils/body.js";

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return; // 401/403 already sent

  if (req.method === "GET") {
    const { data, error } = await supabaseServer
      .from("server_errors")
      .select("id, request_id, code, context, status, message, resolved, created_at")
      .order("resolved", { ascending: true })
      .order("created_at", { ascending: false })
      .limit(200);
    // A database that has not run 0035 yet: an empty, flagged list — never a
    // broken tab.
    if (error) return json(res, 200, { errors: [], migrationPending: true });
    return json(res, 200, { errors: data || [] });
  }

  if (req.method === "PATCH") {
    const body = await readJsonBody(req);
    const { ok, errors, value } = validateBody(body, {
      id: { type: "number", required: true, min: 1 },
      resolved: { type: "boolean", required: true },
    });
    if (!ok) return json(res, 400, { error: "Invalid request", details: errors });
    const { error } = await supabaseServer
      .from("server_errors")
      .update({ resolved: value.resolved })
      .eq("id", value.id);
    if (error) return json(res, 500, { error: "Update failed" });
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: "Method not allowed" });
}
