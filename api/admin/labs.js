// api/admin/labs.js
// Control Room: testing laboratories (migration 0032 `labs`). The lab record
// is what makes a certificate independently checkable — the public lookup
// URL template resolves a lot against the LAB'S OWN published record, which
// is the bar third-party vendor-audit sites treat as "two-factor confirmed".
//
// Server-enforced admin; every field whitelisted; nothing fabricated (the
// admin enters the laboratory's real accreditation and lookup pattern).
//
// The template is admin-entered data that becomes an outbound trust link on
// public pages, so it is validated the same way src/lib/labVerify.js will
// consume it: absolute https, and it must contain the literal `{code}`
// placeholder. Anything else is rejected here rather than silently stored
// and silently never rendered.
import { requireAdmin } from "../_utils/auth.js";
import { supabaseServer } from "../../lib/supabaseServer.js";
import { readJsonBody, jsonResponse as json } from "../_utils/body.js";
import { failSafely } from "../../lib/apiError.js";
import { checkLabelText } from "../../lib/labelCopyRules.js";

export const LAB_COLUMNS =
  "id, name, accreditation_body, accreditation_number, public_lookup_url_template, verified_at, notes, created_at";

const PLACEHOLDER = "{code}";

/** null when valid, else a customer-safe reason. Exported for tests. */
export function labTemplateError(value) {
  const t = String(value || "").trim();
  if (!t) return null; // absent is allowed: a lab with no public lookup
  if (!t.includes(PLACEHOLDER)) return `public_lookup_url_template must contain the literal ${PLACEHOLDER} placeholder`;
  let url;
  try {
    url = new URL(t.split(PLACEHOLDER).join("X"));
  } catch {
    return "public_lookup_url_template must be an absolute URL";
  }
  if (url.protocol !== "https:") return "public_lookup_url_template must use https";
  if (t.length > 512) return "public_lookup_url_template is too long (max 512)";
  return null;
}

// Whitelist. Returns { fields } or { __error }.
export function pickLabFields(body = {}, { forCreate = false } = {}) {
  const out = {};
  const text = (k, max) => {
    if (body[k] === undefined) return;
    if (body[k] === null || String(body[k]).trim() === "") {
      out[k] = null;
      return;
    }
    const v = String(body[k]).trim();
    if (v.length > max) return `${k} is too long (max ${max})`;
    out[k] = v;
  };
  for (const [k, max] of [["name", 120], ["accreditation_body", 120], ["accreditation_number", 64], ["notes", 500]]) {
    const err = text(k, max);
    if (err) return { __error: err };
  }
  if (body.public_lookup_url_template !== undefined) {
    const err = labTemplateError(body.public_lookup_url_template);
    if (err) return { __error: err };
    const t = String(body.public_lookup_url_template || "").trim();
    out.public_lookup_url_template = t || null;
  }
  if (body.verified_at !== undefined) {
    if (body.verified_at === null || body.verified_at === "") out.verified_at = null;
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(body.verified_at))) return { __error: "verified_at must be an ISO day (YYYY-MM-DD)" };
    else if (Number.isNaN(Date.parse(`${body.verified_at}T00:00:00Z`))) return { __error: "verified_at is not a real date" };
    else out.verified_at = String(body.verified_at);
  }
  if (forCreate && !out.name) return { __error: "name is required" };
  if (!forCreate && out.name === null) return { __error: "name cannot be cleared" };
  return { fields: out };
}

function tableMissing(error) {
  const code = error?.code;
  return code === "42P01" || code === "PGRST205" || /relation .* does not exist|could not find the table/i.test(String(error?.message || ""));
}

async function auditLog(req, actorId, action, entityId, metadata = {}) {
  try {
    await supabaseServer.from("audit_logs").insert({
      actor_id: actorId,
      action,
      entity: "lab",
      entity_id: String(entityId),
      metadata,
      ip: String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim() || null,
    });
  } catch { /* table optional; never block */ }
}

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (req.method === "GET") {
    const { data, error } = await supabaseServer.from("labs").select(LAB_COLUMNS).order("name", { ascending: true });
    if (error) {
      // Pre-0032 database: no labs table yet. Say so instead of 500-ing, so
      // the Control Room can hide the lab controls until the migration runs.
      if (tableMissing(error)) return json(res, 200, { labs: [], migrationPending: true });
      return failSafely(res, { status: 500, code: "labs_load_failed", message: "Could not load laboratories.", error, context: "admin/labs:list" });
    }
    return json(res, 200, { labs: data || [], migrationPending: false });
  }

  if (req.method === "POST") {
    const body = (await readJsonBody(req)) || {};
    const picked = pickLabFields(body, { forCreate: true });
    // Opt c7 (4.1): the lab's name renders on every COA card.
    if (picked.fields?.name && checkLabelText(picked.fields.name).length) {
      return json(res, 400, { error: "Lab name rejected — use language is not allowed in public copy", details: checkLabelText(picked.fields.name).map((d) => ({ field: "name", ...d })) });
    }
    if (picked.__error) return json(res, 400, { error: picked.__error });
    const { data, error } = await supabaseServer.from("labs").insert(picked.fields).select(LAB_COLUMNS).maybeSingle();
    if (error || !data) return failSafely(res, { status: 500, code: "lab_create_failed", message: "Could not save the laboratory. Please try again.", error, context: "admin/labs:create" });
    await auditLog(req, admin.id, "lab.create", data.id, { fields: Object.keys(picked.fields) });
    return json(res, 200, { lab: data });
  }

  if (req.method === "PATCH") {
    const body = (await readJsonBody(req)) || {};
    const id = Number(body.id);
    if (!Number.isInteger(id) || id < 1) return json(res, 400, { error: "id is required" });
    const picked = pickLabFields(body);
    if (picked.fields?.name && checkLabelText(picked.fields.name).length) {
      return json(res, 400, { error: "Lab name rejected — use language is not allowed in public copy", details: checkLabelText(picked.fields.name).map((d) => ({ field: "name", ...d })) });
    }
    if (picked.__error) return json(res, 400, { error: picked.__error });
    if (!Object.keys(picked.fields).length) return json(res, 400, { error: "No editable fields supplied" });
    const { data, error } = await supabaseServer.from("labs").update(picked.fields).eq("id", id).select(LAB_COLUMNS).maybeSingle();
    if (error) return failSafely(res, { status: 500, code: "lab_update_failed", message: "Could not update the laboratory. Please try again.", error, context: "admin/labs:update" });
    if (!data) return json(res, 404, { error: "Not found" });
    await auditLog(req, admin.id, "lab.update", id, { fields: Object.keys(picked.fields) });
    return json(res, 200, { lab: data });
  }

  return json(res, 405, { error: "Method not allowed" });
}
