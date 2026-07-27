// api/admin/discounts.js
// Control Room promo-code manager. Codes were previously created only via
// SQL; checkout already validates them server-side (lib/discounts.js) — this
// endpoint closes the authoring gap. Server-enforced admin, whitelisted
// fields, audit-logged. Redemption history is read-only here (it is the
// financial record; nothing deletes it).
import { requireAdmin } from "../_utils/auth.js";
import { supabaseServer } from "../../lib/supabaseServer.js";
import { readJsonBody, jsonResponse as json } from "../_utils/body.js";

const CODE_RE = /^[A-Z0-9][A-Z0-9-]{1,31}$/;

async function auditLog(req, actorId, action, entityId, metadata = {}) {
  try {
    await supabaseServer.from("audit_logs").insert({
      actor_id: actorId,
      action,
      entity: "discount",
      entity_id: String(entityId),
      metadata,
      ip: String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || null,
    });
  } catch { /* table optional; never block */ }
}

// Validate + pick the writable discount fields (create and edit share this).
function pickFields(body, { requireCore } = {}) {
  const out = {};
  const errors = [];

  if (body.code !== undefined || requireCore) {
    const code = String(body.code || "").trim().toUpperCase();
    if (!CODE_RE.test(code)) errors.push("code must be 2–32 chars, A–Z 0–9 and dashes");
    else out.code = code;
  }
  if (body.kind !== undefined || requireCore) {
    if (!["percent", "fixed"].includes(body.kind)) errors.push("kind must be percent or fixed");
    else out.kind = body.kind;
  }
  if (body.value !== undefined || requireCore) {
    const v = Number(body.value);
    const kind = out.kind || body.kind;
    if (!Number.isFinite(v) || v <= 0) errors.push("value must be > 0");
    else if (kind === "percent" && v > 100) errors.push("percent value cannot exceed 100");
    else if (kind === "fixed" && v > 10000) errors.push("fixed value cannot exceed 10000");
    else out.value = Math.round(v * 100) / 100;
  }
  if (body.description !== undefined) out.description = String(body.description || "").slice(0, 300) || null;
  if (body.min_subtotal !== undefined) {
    const v = Number(body.min_subtotal);
    if (!Number.isFinite(v) || v < 0 || v > 100000) errors.push("min_subtotal must be 0–100000");
    else out.min_subtotal = Math.round(v * 100) / 100;
  }
  if (body.max_redemptions !== undefined) {
    if (body.max_redemptions === null || body.max_redemptions === "") out.max_redemptions = null;
    else {
      const v = Number(body.max_redemptions);
      if (!Number.isInteger(v) || v < 1 || v > 1000000) errors.push("max_redemptions must be a positive integer (or blank for unlimited)");
      else out.max_redemptions = v;
    }
  }
  if (body.per_user_limit !== undefined) {
    if (body.per_user_limit === null || body.per_user_limit === "") out.per_user_limit = null;
    else {
      const v = Number(body.per_user_limit);
      if (!Number.isInteger(v) || v < 1 || v > 1000) errors.push("per_user_limit must be a positive integer (or blank for unlimited)");
      else out.per_user_limit = v;
    }
  }
  for (const flag of ["excludes_bundles", "is_public", "active"]) {
    if (body[flag] !== undefined) {
      if (typeof body[flag] !== "boolean") errors.push(`${flag} must be boolean`);
      else out[flag] = body[flag];
    }
  }
  for (const dateField of ["starts_at", "ends_at"]) {
    if (body[dateField] !== undefined) {
      if (body[dateField] === null || body[dateField] === "") out[dateField] = null;
      else {
        const d = new Date(body[dateField]);
        if (Number.isNaN(d.getTime())) errors.push(`${dateField} must be a valid date`);
        else out[dateField] = d.toISOString();
      }
    }
  }
  return { fields: out, errors };
}

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return; // 401/403 already sent

  if (req.method === "GET") {
    const [discounts, redemptions] = await Promise.all([
      supabaseServer.from("discounts").select("*").order("created_at", { ascending: false }).limit(200),
      supabaseServer.from("discount_redemptions").select("discount_id"),
    ]);
    if (discounts.error) return json(res, 500, { error: "Could not load discounts" });
    const counts = {};
    for (const r of redemptions.data || []) {
      counts[r.discount_id] = (counts[r.discount_id] || 0) + 1;
    }
    return json(res, 200, {
      discounts: (discounts.data || []).map((d) => ({ ...d, redemption_count: counts[d.id] || 0 })),
    });
  }

  if (req.method === "POST") {
    const body = await readJsonBody(req);
    const { fields, errors } = pickFields(body || {}, { requireCore: true });
    if (errors.length) return json(res, 400, { error: "Invalid request", details: errors });

    const { data, error } = await supabaseServer
      .from("discounts")
      .insert(fields)
      .select("*")
      .maybeSingle();
    if (error) {
      if (String(error.code) === "23505") return json(res, 409, { error: `Code ${fields.code} already exists.` });
      return json(res, 500, { error: "Could not create discount" });
    }
    await auditLog(req, admin.id, "discount.create", data.id, { code: data.code, kind: data.kind, value: data.value });
    return json(res, 200, { discount: { ...data, redemption_count: 0 } });
  }

  if (req.method === "PATCH") {
    const body = await readJsonBody(req);
    const id = Number(body?.id);
    if (!Number.isInteger(id) || id < 1) return json(res, 400, { error: "id is required" });

    const { fields, errors } = pickFields(body || {});
    if (errors.length) return json(res, 400, { error: "Invalid request", details: errors });
    if (!Object.keys(fields).length) return json(res, 400, { error: "No editable fields supplied" });

    const { data: existing } = await supabaseServer.from("discounts").select("*").eq("id", id).maybeSingle();
    if (!existing) return json(res, 404, { error: "Not found" });

    const { data, error } = await supabaseServer
      .from("discounts")
      .update(fields)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error || !data) return json(res, 500, { error: "Update failed" });

    await auditLog(req, admin.id, "discount.update", id, {
      changed: Object.keys(fields),
      from: Object.fromEntries(Object.keys(fields).map((k) => [k, existing[k]])),
      to: fields,
    });
    return json(res, 200, { discount: data });
  }

  return json(res, 405, { error: "Method not allowed" });
}
