// api/admin/orders.js
// Admin order list (GET). Status updates + customer notification go through the
// existing api/admin/order-status.js. Server-enforced admin; service-role read.
import { requireAdmin } from "../_utils/auth.js";
import { supabaseServer } from "../../lib/supabaseServer.js";
import { jsonResponse as json } from "../_utils/body.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  const { data, error } = await supabaseServer
    .from("orders")
    .select("order_number, email, customer_name, amount_total, currency, status, payment_provider, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) return json(res, 500, { error: "Could not load orders" });
  return json(res, 200, { orders: data || [] });
}
