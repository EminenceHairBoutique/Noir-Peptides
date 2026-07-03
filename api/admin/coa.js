// api/admin/coa.js
// Admin COA manager. GET lists every COA (incl. unpublished); POST creates a
// COA; PATCH updates/publishes one. Server-enforced admin. NO fabricated data —
// the admin supplies real per-batch lab values; this only persists them.
import { requireAdmin } from "../_utils/auth.js";
import { supabaseServer } from "../../lib/supabaseServer.js";
import { readJsonBody, jsonResponse as json } from "../_utils/body.js";

const COLUMNS =
  "id, product_id, batch_number, lot_number, lab_name, file_url, purity_percent, " +
  "hplc, mass_spec, ms_confirmed, endotoxin, tested_at, is_published, created_at";

// Whitelist the columns an admin may write (never trust arbitrary keys).
function pickCoaFields(body = {}) {
  const out = {};
  const str = (k) => {
    if (body[k] != null && String(body[k]).trim() !== "") out[k] = String(body[k]).trim();
  };
  ["product_id", "batch_number", "lot_number", "lab_name", "file_url", "hplc", "mass_spec", "endotoxin"].forEach(str);
  if (body.tested_at) out.tested_at = String(body.tested_at).slice(0, 10);
  if (body.purity_percent != null && body.purity_percent !== "") out.purity_percent = Number(body.purity_percent);
  if (typeof body.ms_confirmed === "boolean") out.ms_confirmed = body.ms_confirmed;
  if (typeof body.is_published === "boolean") out.is_published = body.is_published;
  // Default lot_number to batch_number if only one supplied.
  if (!out.lot_number && out.batch_number) out.lot_number = out.batch_number;
  return out;
}

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === "GET") {
    const { data, error } = await supabaseServer
      .from("coas")
      .select(COLUMNS)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) return json(res, 500, { error: "Could not load COAs" });
    return json(res, 200, { coas: data || [] });
  }

  if (req.method === "POST") {
    const body = await readJsonBody(req);
    const fields = pickCoaFields(body || {});
    if (!fields.product_id) return json(res, 400, { error: "product_id is required" });
    if (!fields.lot_number) return json(res, 400, { error: "lot_number (or batch_number) is required" });
    const { data, error } = await supabaseServer.from("coas").insert(fields).select(COLUMNS).maybeSingle();
    if (error) return json(res, 500, { error: error.message || "Could not create COA" });
    return json(res, 200, { coa: data });
  }

  if (req.method === "PATCH") {
    const body = await readJsonBody(req);
    const id = body?.id;
    if (!id) return json(res, 400, { error: "id is required" });
    const fields = pickCoaFields(body || {});
    delete fields.product_id; // don't allow reparenting on edit
    const { data, error } = await supabaseServer.from("coas").update(fields).eq("id", id).select(COLUMNS).maybeSingle();
    if (error) return json(res, 500, { error: error.message || "Could not update COA" });
    return json(res, 200, { coa: data });
  }

  return json(res, 405, { error: "Method not allowed" });
}
