// api/admin/overview.js
// Admin dashboard aggregates. Server-enforced admin (requireAdmin) + service-
// role reads, so RLS gaps on individual tables can't leak or block the numbers.
// Every count is defensive: a missing table/column yields null, never a 500.
import { requireAdmin } from "../_utils/auth.js";
import { supabaseServer } from "../../lib/supabaseServer.js";
import { jsonResponse as json } from "../_utils/body.js";

async function countOf(table, build) {
  try {
    let q = supabaseServer.from(table).select("*", { count: "exact", head: true });
    if (build) q = build(q);
    const { count, error } = await q;
    return error ? null : count ?? 0;
  } catch {
    return null;
  }
}

async function paidRevenueCents() {
  try {
    const { data, error } = await supabaseServer
      .from("orders")
      .select("amount_total")
      .eq("status", "paid")
      .limit(5000);
    if (error || !Array.isArray(data)) return null;
    return data.reduce((s, r) => s + Number(r.amount_total || 0), 0);
  } catch {
    return null;
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") return json(res, 405, { error: "Method not allowed" });

  const admin = await requireAdmin(req, res);
  if (!admin) return; // 401/403 already sent

  const [
    products,
    coasTotal,
    coasPublished,
    orders,
    ordersPaid,
    revenueCents,
    reviewsTotal,
    reviewsPending,
    backInStock,
    partnersPending,
    aiConversations,
    discountsActive,
  ] = await Promise.all([
    countOf("products"),
    countOf("coas"),
    countOf("coas", (q) => q.eq("is_published", true)),
    countOf("orders"),
    countOf("orders", (q) => q.eq("status", "paid")),
    paidRevenueCents(),
    countOf("product_reviews"),
    countOf("product_reviews", (q) => q.eq("status", "pending")),
    countOf("back_in_stock_subscriptions"),
    countOf("partner_applications", (q) => q.eq("status", "pending")),
    countOf("ai_conversations"),
    countOf("discounts", (q) => q.eq("active", true)),
  ]);

  const [aiFlagsUnreviewed, clientErrorsOpen] = await Promise.all([
    countOf("ai_flags", (q) => q.eq("reviewed", false)),
    countOf("client_errors", (q) => q.eq("resolved", false)),
  ]);

  return json(res, 200, {
    catalog: { products, coasTotal, coasPublished },
    commerce: { orders, ordersPaid, revenueCents, discountsActive },
    moderation: { reviewsTotal, reviewsPending, backInStock, partnersPending },
    ai: { conversations: aiConversations, unreviewedFlags: aiFlagsUnreviewed },
    ops: { clientErrorsOpen },
    generatedAt: null, // stamped client-side to avoid Date in prerender/build
  });
}
