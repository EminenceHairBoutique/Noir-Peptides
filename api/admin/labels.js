// api/admin/labels.js
// Admin label-config CRUD + approval workflow. Server-enforced admin
// (requireAdmin); column-whitelisted writes (lib/labelConstants); every
// mutation snapshots to label_config_history and writes an audit_logs row
// (first writer of that table — columns per migration 0005).
//
// COMPLIANCE: status transitions are validated against STATUS_TRANSITIONS;
// approval stamps approved_at/approved_by; only approved/production_ready
// configs are renderable outside the studio (enforced by consumers via
// canRenderOutsideStudio — the /api/verify endpoint re-checks it).
import { requireAdmin } from "../_utils/auth.js";
import { supabaseServer } from "../../lib/supabaseServer.js";
import { readJsonBody, jsonResponse as json } from "../_utils/body.js";
import {
  LABEL_WRITABLE_COLUMNS,
  LABEL_TEMPLATE_IDS,
  LABEL_PRESET_IDS,
  LABEL_STATUSES,
  STATUS_TRANSITIONS,
} from "../../lib/labelConstants.js";

const COLS = "*";

function pickWritable(body = {}) {
  const out = {};
  for (const k of LABEL_WRITABLE_COLUMNS) {
    if (body[k] !== undefined) out[k] = body[k];
  }
  if (out.template_id && !LABEL_TEMPLATE_IDS.includes(out.template_id)) delete out.template_id;
  if (out.default_preset && !LABEL_PRESET_IDS.includes(out.default_preset)) delete out.default_preset;
  // Dates: keep YYYY-MM-DD or null.
  for (const d of ["packaged_date", "expiration_date", "retest_date"]) {
    if (out[d] === "") out[d] = null;
    else if (out[d] && !/^\d{4}-\d{2}-\d{2}$/.test(String(out[d]))) delete out[d];
  }
  return out;
}

// Crockford base32 via Node crypto (serverless runtime).
async function uniqueVerificationCode() {
  const { randomBytes } = await import("node:crypto");
  const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const gen = () => {
    const bytes = randomBytes(13);
    let out = "";
    for (let i = 0; i < 13; i++) out += CROCKFORD[bytes[i] % 32];
    return out;
  };
  // UNIQUE-retry loop (collision odds ~2^-65, but belt and braces).
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = gen();
    const { data } = await supabaseServer
      .from("label_configs")
      .select("id")
      .eq("verification_code", code)
      .maybeSingle();
    if (!data) return code;
  }
  throw new Error("Could not allocate a unique verification code");
}

async function snapshotHistory(configId, action, actorId, row) {
  try {
    await supabaseServer.from("label_config_history").insert({
      config_id: configId,
      action,
      snapshot: row || {},
      actor_id: actorId,
    });
  } catch { /* best-effort */ }
}

async function auditLog(req, actorId, action, entityId, metadata = {}) {
  try {
    await supabaseServer.from("audit_logs").insert({
      actor_id: actorId,
      action,
      entity: "label_config",
      entity_id: String(entityId),
      metadata,
      ip: String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || null,
    });
  } catch { /* table optional; never block */ }
}

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  // ── GET: list (or one by ?id=, or history by ?history=<id>) ─────────────
  if (req.method === "GET") {
    const url = new URL(req.url, "http://x");
    const id = url.searchParams.get("id");
    const historyOf = url.searchParams.get("history");

    if (historyOf) {
      const { data, error } = await supabaseServer
        .from("label_config_history")
        .select("id, action, snapshot, actor_id, created_at")
        .eq("config_id", historyOf)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return json(res, 500, { error: "Could not load history" });
      return json(res, 200, { history: data || [] });
    }
    if (id) {
      const { data, error } = await supabaseServer.from("label_configs").select(COLS).eq("id", id).maybeSingle();
      if (error || !data) return json(res, 404, { error: "Not found" });
      return json(res, 200, { config: data });
    }
    const { data, error } = await supabaseServer
      .from("label_configs")
      .select(COLS)
      .order("updated_at", { ascending: false })
      .limit(300);
    if (error) return json(res, 500, { error: "Could not load label configs" });
    return json(res, 200, { configs: data || [] });
  }

  // ── POST: create draft ──────────────────────────────────────────────────
  if (req.method === "POST") {
    const body = await readJsonBody(req);
    const fields = pickWritable(body || {});
    if (!fields.product_id) return json(res, 400, { error: "product_id is required" });
    if (!fields.display_name) return json(res, 400, { error: "display_name is required" });
    if (!fields.quantity_label) return json(res, 400, { error: "quantity_label is required" });
    if (!fields.sku) return json(res, 400, { error: "sku is required" });

    let code;
    try {
      code = await uniqueVerificationCode();
    } catch (e) {
      return json(res, 500, { error: e.message });
    }

    const { data, error } = await supabaseServer
      .from("label_configs")
      .insert({ ...fields, status: "draft", verification_code: code, created_by: admin.id })
      .select(COLS)
      .maybeSingle();
    if (error) return json(res, 500, { error: error.message || "Could not create label config" });

    await snapshotHistory(data.id, "created", admin.id, data);
    await auditLog(req, admin.id, "label.create", data.id, { product_id: data.product_id });
    return json(res, 200, { config: data });
  }

  // ── PATCH: update fields and/or transition status ───────────────────────
  if (req.method === "PATCH") {
    const body = await readJsonBody(req);
    const id = body?.id;
    if (!id) return json(res, 400, { error: "id is required" });

    const { data: existing } = await supabaseServer.from("label_configs").select(COLS).eq("id", id).maybeSingle();
    if (!existing) return json(res, 404, { error: "Not found" });

    const fields = pickWritable(body || {});
    delete fields.product_id; // no reparenting on edit

    // Status transition (optional, validated against the shared map).
    let action = "updated";
    if (body.status && body.status !== existing.status) {
      if (!LABEL_STATUSES.includes(body.status)) return json(res, 400, { error: "Invalid status" });
      const allowed = STATUS_TRANSITIONS[existing.status] || [];
      if (!allowed.includes(body.status)) {
        return json(res, 400, { error: `Cannot move ${existing.status} → ${body.status}` });
      }
      fields.status = body.status;
      action = `status:${body.status}`;
      if (body.status === "approved" || body.status === "production_ready") {
        fields.approved_at = new Date().toISOString();
        fields.approved_by = admin.id;
      }
      // Any material change after approval bumps the version on re-approve.
      if (body.status === "in_review" && ["approved", "production_ready", "changes_requested"].includes(existing.status)) {
        fields.label_version = Number(existing.label_version || 1) + 1;
      }
    }

    fields.updated_at = new Date().toISOString();
    const { data, error } = await supabaseServer
      .from("label_configs")
      .update(fields)
      .eq("id", id)
      .select(COLS)
      .maybeSingle();
    if (error) return json(res, 500, { error: error.message || "Could not update label config" });

    await snapshotHistory(id, action, admin.id, data);
    await auditLog(req, admin.id, `label.${action}`, id, { status: data.status });
    return json(res, 200, { config: data });
  }

  return json(res, 405, { error: "Method not allowed" });
}
