// api/admin/catalog.js
// Control Room catalog manager. Lets the owner run day-to-day catalog changes
// (price, stock, featured/new flags) WITHOUT touching SQL. Server-enforced
// admin + service-role writes; every change is column-whitelisted and
// audit-logged. Descriptive copy is deliberately NOT editable here — product
// descriptions are compliance-reviewed text and change through the repo.
//
// Completing the back-in-stock loop: when a stock_status flips TO in_stock,
// un-notified subscribers for that variant/product get their one-time restock
// email (config-gated on RESEND_API_KEY; without it the flip still succeeds
// and subscribers simply stay queued) and are marked notified.
import { requireAdmin } from "../_utils/auth.js";
import { supabaseServer } from "../../lib/supabaseServer.js";
import { sendBackInStockEmail } from "../../lib/email.js";
import { deriveStockStatus } from "../../lib/inventory.js";
import { readJsonBody, jsonResponse as json } from "../_utils/body.js";

const STOCK_STATUSES = ["in_stock", "low_stock", "out_of_stock"];
const MAX_NOTIFY_PER_FLIP = 200;

async function auditLog(req, actorId, action, entityId, metadata = {}) {
  try {
    await supabaseServer.from("audit_logs").insert({
      actor_id: actorId,
      action,
      entity: "catalog",
      entity_id: String(entityId),
      metadata,
      ip: String(req.headers["x-forwarded-for"] || "").split(",")[0].trim() || null,
    });
  } catch { /* table optional; never block */ }
}

// Validate + pick only the fields this endpoint may ever write.
function pickFields(kind, body) {
  const out = {};
  const errors = [];
  const has = (k) => body[k] !== undefined && body[k] !== null && body[k] !== "";

  if (has("price")) {
    const n = Number(body.price);
    if (!Number.isFinite(n) || n < 0 || n > 100000) errors.push("price must be 0–100000");
    else out.price = Math.round(n * 100) / 100;
  }
  if (has("stock_status")) {
    if (!STOCK_STATUSES.includes(body.stock_status)) errors.push("invalid stock_status");
    else out.stock_status = body.stock_status;
  }
  if (kind === "product") {
    if (body.featured !== undefined) {
      if (typeof body.featured !== "boolean") errors.push("featured must be boolean");
      else out.featured = body.featured;
    }
    if (body.is_new !== undefined) {
      if (typeof body.is_new !== "boolean") errors.push("is_new must be boolean");
      else out.is_new = body.is_new;
    }
  }
  if (kind === "variant") {
    // inventory_count: a number enables TRACKED mode (stock_status derived);
    // explicit null/"" returns the variant to manual, untracked stock.
    if ("inventory_count" in body) {
      if (body.inventory_count === null || body.inventory_count === "") {
        out.inventory_count = null;
      } else {
        const n = Number(body.inventory_count);
        if (!Number.isInteger(n) || n < 0 || n > 1000000) errors.push("inventory_count must be an integer 0–1000000 (or null to untrack)");
        else out.inventory_count = n;
      }
    }
    if (has("low_stock_threshold")) {
      const n = Number(body.low_stock_threshold);
      if (!Number.isInteger(n) || n < 0 || n > 10000) errors.push("low_stock_threshold must be an integer 0–10000");
      else out.low_stock_threshold = n;
    }
  }
  return { fields: out, errors };
}

// One-time restock notices for a stock flip to in_stock. Variant flips cover
// the variant's own subscribers plus product-level ones; product flips cover
// product-level subscribers only (variant-specific requests wait for THEIR
// variant). Best-effort: an email failure never fails the stock update.
async function notifyBackInStock({ kind, productRow, variantRow }) {
  let q = supabaseServer
    .from("back_in_stock_subscriptions")
    .select("id, email")
    .eq("notified", false)
    .limit(MAX_NOTIFY_PER_FLIP);
  if (kind === "variant") {
    q = q.or(`variant_id.eq.${variantRow.id},and(product_id.eq.${productRow.id},variant_id.is.null)`);
  } else {
    q = q.eq("product_id", productRow.id).is("variant_id", null);
  }
  const { data: subs, error } = await q;
  if (error || !subs?.length) return { notified: 0, queued: 0 };

  let sent = 0;
  for (const sub of subs) {
    try {
      const r = await sendBackInStockEmail({
        to: sub.email,
        productName: productRow.name,
        sizeLabel: kind === "variant" ? variantRow.size_label : null,
        productSlug: productRow.slug,
      });
      if (r === null) return { notified: 0, queued: subs.length }; // Resend unconfigured
      await supabaseServer
        .from("back_in_stock_subscriptions")
        .update({ notified: true })
        .eq("id", sub.id);
      sent += 1;
    } catch { /* skip this subscriber; keep going */ }
  }
  return { notified: sent, queued: subs.length - sent };
}

export default async function handler(req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return; // 401/403 already sent

  if (req.method === "GET") {
    const [prods, vars, subs] = await Promise.all([
      supabaseServer
        .from("products")
        .select("id, slug, name, category_slug, price, stock_status, featured, is_new")
        .order("name"),
      supabaseServer
        .from("product_variants")
        .select("id, product_id, sku, size_label, vial_size_mg, price, stock_status, sort_order, inventory_count, low_stock_threshold")
        .order("sort_order"),
      supabaseServer
        .from("back_in_stock_subscriptions")
        .select("product_id, variant_id")
        .eq("notified", false),
    ]);
    if (prods.error || vars.error) return json(res, 500, { error: "Could not load catalog" });
    return json(res, 200, {
      products: prods.data || [],
      variants: vars.data || [],
      waitlist: subs.data || [], // pending restock requests (for badge counts)
    });
  }

  if (req.method === "PATCH") {
    const body = await readJsonBody(req);
    const kind = body?.kind === "variant" ? "variant" : body?.kind === "product" ? "product" : null;
    const id = typeof body?.id === "string" ? body.id.slice(0, 64) : null;
    if (!kind || !id) return json(res, 400, { error: "kind ('product'|'variant') and id are required" });

    const { fields, errors } = pickFields(kind, body);
    if (errors.length) return json(res, 400, { error: "Invalid request", details: errors });
    if (!Object.keys(fields).length) return json(res, 400, { error: "No editable fields supplied" });

    const table = kind === "variant" ? "product_variants" : "products";
    const { data: existing } = await supabaseServer.from(table).select("*").eq("id", id).maybeSingle();
    if (!existing) return json(res, 404, { error: "Not found" });

    // TRACKED mode: stock_status is derived from the count, never hand-set —
    // one source of truth, and entering a restock count flips the status
    // through the same path that triggers the back-in-stock emails below.
    if (kind === "variant") {
      const effectiveCount =
        "inventory_count" in fields ? fields.inventory_count : existing.inventory_count;
      if (effectiveCount !== null && effectiveCount !== undefined) {
        const threshold =
          "low_stock_threshold" in fields ? fields.low_stock_threshold : existing.low_stock_threshold;
        fields.stock_status = deriveStockStatus(effectiveCount, threshold);
      }
    }

    const { data: updated, error } = await supabaseServer
      .from(table)
      .update(kind === "product" ? { ...fields, updated_at: new Date().toISOString() } : fields)
      .eq("id", id)
      .select("*")
      .maybeSingle();
    if (error || !updated) return json(res, 500, { error: "Update failed" });

    await auditLog(req, admin.id, `catalog.${kind}.update`, id, {
      changed: Object.keys(fields),
      from: Object.fromEntries(Object.keys(fields).map((k) => [k, existing[k]])),
      to: fields,
    });

    // Restock notifications only on a genuine flip INTO in_stock.
    let restock = null;
    const flipped =
      fields.stock_status === "in_stock" && existing.stock_status !== "in_stock";
    if (flipped) {
      const productRow =
        kind === "product"
          ? updated
          : (await supabaseServer.from("products").select("id, slug, name").eq("id", updated.product_id).maybeSingle()).data;
      if (productRow) {
        restock = await notifyBackInStock({
          kind,
          productRow,
          variantRow: kind === "variant" ? updated : null,
        });
        await auditLog(req, admin.id, "catalog.restock_notify", id, restock);
      }
    }

    return json(res, 200, { [kind]: updated, restock });
  }

  return json(res, 405, { error: "Method not allowed" });
}
