// api/product-labels.js
// PUBLIC batch read of APPROVED labels for the shop grid — ONE label per
// product (the highest-version publishable one) so each card can show a
// lightweight static label preview without N round-trips. Same approved-only
// gate and whitelisted field set as /api/product-label; label_configs has no
// public RLS, this rate-limited service-role read is the only public path.
//
// GET /api/product-labels        → { labels: { <product_id>: {...}, ... } }
import { supabaseServer } from "../lib/supabaseServer.js";
import { checkRateLimit } from "./_utils/rateLimit.js";
import { jsonResponse as json } from "./_utils/body.js";
import { isLabelPubliclyRenderable } from "../lib/labelConstants.js";

const RENDER_COLUMNS =
  "template_id, default_preset, display_name, quantity_label, material_type, " +
  "composition, sku, lot_number, batch_number, packaged_date, expiration_date, " +
  "retest_date, barcode_value, verification_code, storage_short, storage_full, " +
  "storage_source_verified, manufacturer, distributed_by, country_of_origin, " +
  "net_contents, label_version, status, recalled, product_id, variant_id";

function present(row) {
  const { status, recalled, ...rest } = row;
  void status;
  void recalled;
  return rest;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const allowed = await checkRateLimit(req, res, { endpoint: "product-labels", max: 60, windowMs: 60_000 });
  if (!allowed) return;

  try {
    const { data, error } = await supabaseServer
      .from("label_configs")
      .select(RENDER_COLUMNS)
      .in("status", ["approved", "production_ready"])
      .order("label_version", { ascending: false })
      .limit(500);
    if (error) return json(res, 200, { labels: {} });

    const labels = {};
    for (const row of data || []) {
      if (!isLabelPubliclyRenderable(row)) continue;
      // First publishable row per product wins (already ordered by version desc).
      if (!labels[row.product_id]) labels[row.product_id] = present(row);
    }
    return json(res, 200, { labels });
  } catch {
    return json(res, 200, { labels: {} });
  }
}
