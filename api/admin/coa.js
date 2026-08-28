// api/admin/coa.js
// Admin COA manager. GET lists every COA (incl. unpublished); POST creates a
// COA; PATCH updates/publishes one. Server-enforced admin. NO fabricated data —
// the admin supplies real per-batch lab values; this only persists them.
import { requireAdmin } from "../_utils/auth.js";
import { supabaseServer } from "../../lib/supabaseServer.js";
import { readJsonBody, jsonResponse as json } from "../_utils/body.js";
import { isValidCas, normalizeCas } from "../../lib/cas.js";
import { failSafely } from "../../lib/apiError.js";

const COLUMNS =
  "id, product_id, batch_number, lot_number, lab_name, file_url, purity_percent, cas_number, " +
  "hplc, mass_spec, ms_confirmed, endotoxin, tested_at, is_published, created_at";

// Whitelist the columns an admin may write (never trust arbitrary keys).
function pickCoaFields(body = {}) {
  const out = {};
  const str = (k) => {
    if (body[k] != null && String(body[k]).trim() !== "") out[k] = String(body[k]).trim();
  };
  ["product_id", "batch_number", "lot_number", "lab_name", "file_url", "hplc", "mass_spec", "endotoxin"].forEach(str);
  // Lot-level CAS (W1): validated, never defaulted, never copied from the
  // product. Malformed input is REJECTED (sanitize() returns an error), not
  // silently stored. Empty/absent clears to null-by-omission.
  if (body.cas_number != null && String(body.cas_number).trim() !== "") {
    const cas = normalizeCas(body.cas_number);
    if (!isValidCas(cas)) {
      return { __error: "cas_number must be a valid CAS Registry Number (NNNNNNN-NN-N with a correct check digit)" };
    }
    out.cas_number = cas;
  }
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
    if (fields.__error) return json(res, 400, { error: fields.__error });
    if (!fields.product_id) return json(res, 400, { error: "product_id is required" });
    if (!fields.lot_number) return json(res, 400, { error: "lot_number (or batch_number) is required" });
    const { data, error } = await supabaseServer.from("coas").insert(fields).select(COLUMNS).maybeSingle();
    if (error) return failSafely(res, { status: 500, code: "coa_create_failed", message: "Could not save the COA. Please try again.", error, context: "admin/coa:create" });
    return json(res, 200, { coa: data });
  }

  if (req.method === "PATCH") {
    const body = await readJsonBody(req);
    const id = body?.id;
    if (!id) return json(res, 400, { error: "id is required" });
    const fields = pickCoaFields(body || {});
    if (fields.__error) return json(res, 400, { error: fields.__error });
    delete fields.product_id; // don't allow reparenting on edit
    const { data, error } = await supabaseServer.from("coas").update(fields).eq("id", id).select(COLUMNS).maybeSingle();
    if (error) return failSafely(res, { status: 500, code: "coa_update_failed", message: "Could not update the COA. Please try again.", error, context: "admin/coa:update" });
    return json(res, 200, { coa: data });
  }

  return json(res, 405, { error: "Method not allowed" });
}
