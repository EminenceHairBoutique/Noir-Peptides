// api/admin/order-status.js
// Admin-only: update an order's status and notify the customer (Resend).
import { supabaseServer } from "../../lib/supabaseServer.js";
import { requireAdmin } from "../_utils/auth.js";
import { readJsonBody, jsonResponse as json } from "../_utils/body.js";
import { validateBody } from "../_utils/validate.js";
import { sendOrderStatusEmail } from "../../lib/email.js";

const STATUSES = ["processing", "shipped", "delivered", "canceled", "refunded", "paid"];

export default async function handler(req, res) {
  if (req.method !== "POST") return json(res, 405, { error: "Method not allowed" });

  const admin = await requireAdmin(req, res);
  if (!admin) return; // 401/403 already sent

  const body = await readJsonBody(req);
  if (!body) return json(res, 400, { error: "Invalid JSON" });

  const { ok, errors, value } = validateBody(body, {
    orderNumber: { type: "string", required: true, max: 64 },
    status: { type: "string", required: true, enum: STATUSES },
    trackingUrl: { type: "string", max: 500 },
    trackingCarrier: { type: "string", max: 60 },
    fulfillmentNotes: { type: "string", max: 2000 },
  });
  if (!ok) return json(res, 400, { error: "Invalid request", details: errors });

  // Tracking links must be real https URLs — they land in customer email.
  if (value.trackingUrl && !/^https:\/\/.+/i.test(value.trackingUrl.trim())) {
    return json(res, 400, { error: "trackingUrl must be an https:// link" });
  }

  const update = { status: value.status, updated_at: new Date().toISOString() };
  if (value.trackingUrl) update.tracking_url = value.trackingUrl.trim();
  if (value.trackingCarrier) update.tracking_carrier = value.trackingCarrier.trim();
  if (value.fulfillmentNotes !== undefined) update.fulfillment_notes = value.fulfillmentNotes;
  if (value.status === "shipped") update.shipped_at = new Date().toISOString();

  const { data: order, error } = await supabaseServer
    .from("orders")
    .update(update)
    .eq("order_number", value.orderNumber)
    .select("email, tracking_url")
    .maybeSingle();
  if (error) return json(res, 500, { error: "Could not update order" });
  if (!order) return json(res, 404, { error: "Order not found" });

  // Best-effort notification (never fails the status update).
  try {
    await sendOrderStatusEmail({
      to: order.email,
      orderNumber: value.orderNumber,
      status: value.status,
      trackingUrl: value.trackingUrl || order.tracking_url || undefined,
    });
  } catch {
    /* ignore email failures */
  }

  return json(res, 200, { ok: true, status: value.status });
}
