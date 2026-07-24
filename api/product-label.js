// api/product-label.js
// PUBLIC read of an APPROVED product label for customer-facing surfaces
// (the PDP 3D vial + flat label). label_configs has NO public RLS policy, so
// this rate-limited, service-role endpoint is the only public path — and it
// returns a label ONLY when it is approved/production_ready, not recalled, and
// in date. Renderable field set only (what renderLabelSvg needs); no internal
// columns (created_by, approver, revision notes, asset URLs, timestamps).
//
// GET /api/product-label?product_id=<id>&variant_id=<id>
//   → { label: {...} }  when an approved label exists for that variant
//   → { label: null }   otherwise (PDP falls back to the placeholder)
import { supabaseServer } from "../lib/supabaseServer.js";
import { checkRateLimit } from "./_utils/rateLimit.js";
import { jsonResponse as json } from "./_utils/body.js";
import { isLabelPubliclyRenderable } from "../lib/labelConstants.js";

// Fields the SVG engine renders from (mirrors ProductLabelConfig). No PII,
// no workflow/internal columns.
const RENDER_COLUMNS =
  "template_id, default_preset, display_name, quantity_label, material_type, " +
  "composition, sku, lot_number, batch_number, packaged_date, expiration_date, " +
  "retest_date, barcode_value, verification_code, storage_short, storage_full, " +
  "storage_source_verified, manufacturer, distributed_by, country_of_origin, " +
  "net_contents, label_version, status, recalled, product_id, variant_id";

// Strip the gating columns before returning to the client.
function present(row) {
  const { status, recalled, ...rest } = row;
  void status;
  void recalled;
  return rest;
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const allowed = await checkRateLimit(req, res, { endpoint: "product-label", max: 120, windowMs: 60_000 });
  if (!allowed) return;

  const url = new URL(req.url, "http://x");
  const productId = url.searchParams.get("product_id");
  const variantId = url.searchParams.get("variant_id");
  if (!productId) return json(res, 400, { error: "product_id is required" });

  try {
    // Prefer the label for the exact variant; fall back to a product-level
    // label (variant_id null) only if no variant-specific one is published.
    const { data, error } = await supabaseServer
      .from("label_configs")
      .select(RENDER_COLUMNS)
      .eq("product_id", productId)
      .order("label_version", { ascending: false })
      .limit(50);
    if (error) return json(res, 200, { label: null });

    const rows = (data || []).filter((r) => isLabelPubliclyRenderable(r));
    const exact = variantId ? rows.find((r) => r.variant_id === variantId) : null;
    const chosen = exact || rows.find((r) => !r.variant_id) || null;
    return json(res, 200, { label: chosen ? present(chosen) : null });
  } catch {
    return json(res, 200, { label: null });
  }
}
