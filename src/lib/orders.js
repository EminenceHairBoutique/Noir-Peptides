// src/lib/orders.js
// Client order history. RLS (orders_select_own) guarantees a signed-in user
// only ever reads their OWN orders — no user_id filter is needed or trusted
// client-side. Returns [] on error / no access.
import { supabase } from "./supabaseClient";

export async function getMyOrders(limit = 25) {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from("orders")
      .select("order_number, amount_total, currency, status, created_at, items, payment_provider, tracking_url, tracking_carrier, shipped_at")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (!error && Array.isArray(data)) return data;
    // Fulfillment columns (migration 0029) may not exist yet on this database —
    // order history must degrade to the legacy shape, never go blank.
    const legacy = await supabase
      .from("orders")
      .select("order_number, amount_total, currency, status, created_at, items, payment_provider")
      .order("created_at", { ascending: false })
      .limit(limit);
    return !legacy.error && Array.isArray(legacy.data) ? legacy.data : [];
  } catch {
    return [];
  }
}
