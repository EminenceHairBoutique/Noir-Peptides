// api/admin/orders.js
// Admin order reads. GET → list (last 100, summary columns);
// GET ?order=<number> → full fulfillment detail: line items, shipping
// address, tracking, timestamps — everything needed to pick, pack, and ship.
// Status updates + customer notification stay in api/admin/order-status.js.
// Server-enforced admin; service-role read.
import { requireAdmin } from "../_utils/auth.js";
import { supabaseServer } from "../../lib/supabaseServer.js";
import { jsonResponse as json } from "../_utils/body.js";

// Opt cycle 3 (4.11 / 4.1): the research-use attestation that authorized the
// order — the checkout-context attestation_audit row stamped with the order
// number by lib/payments/fulfillment.js (migration 0015; IP + UA since cycle
// 2). Returned so the Control Room can show the consent record without SQL.
// Null when none is on file (guest / legacy / pre-0015 database) — the screen
// says so plainly instead of rendering a placeholder.
export const ATTESTATION_COLUMNS = "version, legal_name, statements, ip_address, user_agent, context, created_at";
export async function loadAttestation(orderNumber) {
  try {
    const { data, error } = await supabaseServer
      .from("attestation_audit")
      .select(ATTESTATION_COLUMNS)
      .eq("order_id", String(orderNumber))
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    return {
      version: data.version || null,
      legal_name: data.legal_name || "",
      statements: Array.isArray(data.statements) ? data.statements : [],
      ip_address: data.ip_address || null,
      user_agent: data.user_agent || null,
      context: data.context || null,
      created_at: data.created_at || null,
    };
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const url = new URL(req.url, "http://x");
  const orderNumber = url.searchParams.get("order");

  if (orderNumber) {
    const { data, error } = await supabaseServer
      .from("orders")
      .select(
        "order_number, email, customer_name, amount_total, currency, status, payment_provider, " +
          "items, shipping_address, tracking_url, tracking_carrier, shipped_at, fulfillment_notes, created_at, updated_at"
      )
      .eq("order_number", String(orderNumber).slice(0, 64))
      .maybeSingle();
    if (error) return json(res, 500, { error: "Could not load order" });
    if (!data) return json(res, 404, { error: "Order not found" });
    return json(res, 200, { order: data, attestation: await loadAttestation(data.order_number) });
  }

  const { data, error } = await supabaseServer
    .from("orders")
    .select("order_number, email, customer_name, amount_total, currency, status, payment_provider, tracking_url, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return json(res, 500, { error: "Could not load orders" });
  return json(res, 200, { orders: data || [] });
}
