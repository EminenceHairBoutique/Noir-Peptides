/* eslint-env node */
import Stripe from "stripe";
import { supabaseServer } from "../lib/supabaseServer.js";
import { generateOrderNumber } from "../lib/orderNumber.js";
import { sendOrderConfirmationEmail } from "../lib/email.js";
import { LOYALTY, pointsForPurchaseCents } from "../src/utils/loyalty.js";

export const config = {
  api: {
    bodyParser: false, // ❗ REQUIRED for Stripe signature verification
  },
};

// Lazy-init: guard against missing key in local dev
let _stripe = null;
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

async function getRawBody(req) {
  // Local dev (express.raw) provides a Buffer on req.body
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body);

  // Vercel/Node fallback: read the request stream
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

async function safeInsertOrder(order) {
  // Some deployments may not have newer columns yet.
  // Try full insert; if it fails due to unknown columns, retry with a reduced payload.
  const { error: firstErr } = await supabaseServer.from("orders").insert(order);
  if (!firstErr) return { ok: true };

  const msg = String(firstErr.message || "");

  // Fallback: remove user_id if column doesn't exist
  if (msg.includes('column "user_id"') && msg.includes("does not exist")) {
    const { user_id, ...rest } = order;
    const { error: secondErr } = await supabaseServer.from("orders").insert(rest);
    if (!secondErr) return { ok: true, warned: "orders.user_id missing" };
    return { ok: false, error: secondErr };
  }

  return { ok: false, error: firstErr };
}

async function awardLoyalty({ userId, email, amountTotalCents, orderNumber, stripeSessionId }) {
  if (!userId) return;

  try {
    // Ensure a profile row exists and fetch current values in one round-trip.
    // ignoreDuplicates: true means existing rows are left unchanged (no overwrite of earned points).
    const { data: profile, error: profErr } = await supabaseServer
      .from("profiles")
      .upsert(
        {
          id: userId,
          email: email || null,
          loyalty_points: 0,
          lifetime_spend_cents: 0,
          first_purchase_bonus_awarded: false,
        },
        { onConflict: "id", ignoreDuplicates: true }
      )
      .select("id, email, loyalty_points, lifetime_spend_cents, first_purchase_bonus_awarded")
      .maybeSingle();

    if (profErr) {
      // Table might not exist yet, or RLS is misconfigured.
      console.warn("Loyalty: could not read/create profile", profErr);
      return;
    }

    const currentPoints = Number(profile?.loyalty_points || 0);
    const currentSpend = Number(profile?.lifetime_spend_cents || 0);

    const earned = pointsForPurchaseCents(amountTotalCents);
    const bonus = profile?.first_purchase_bonus_awarded ? 0 : LOYALTY.firstPurchaseBonusPoints;

    const nextPoints = currentPoints + earned + bonus;
    const nextSpend = currentSpend + Number(amountTotalCents || 0);

    const { error: updErr } = await supabaseServer
      .from("profiles")
      .update({
        loyalty_points: nextPoints,
        lifetime_spend_cents: nextSpend,
        first_purchase_bonus_awarded: profile?.first_purchase_bonus_awarded || bonus > 0,
      })
      .eq("id", userId);

    if (updErr) {
      console.warn("Loyalty: profile update failed", updErr);
      return;
    }

    // Optional: write a ledger entry (if table exists)
    try {
      const entries = [];
      if (earned > 0)
        entries.push({
          user_id: userId,
          delta: earned,
          reason: "purchase",
          order_number: orderNumber,
          stripe_session_id: stripeSessionId,
        });
      if (bonus > 0)
        entries.push({
          user_id: userId,
          delta: bonus,
          reason: "first_purchase_bonus",
          order_number: orderNumber,
          stripe_session_id: stripeSessionId,
        });

      if (entries.length) {
        const { error: ledgerErr } = await supabaseServer.from("loyalty_ledger").insert(entries);
        if (ledgerErr) {
          // Table may not exist; do not fail webhook.
          console.warn("Loyalty: ledger insert skipped", ledgerErr.message || ledgerErr);
        }
      }
    } catch (e) {
      console.warn("Loyalty: ledger insert exception", e?.message || e);
    }
  } catch (err) {
    console.warn("Loyalty: award exception", err?.message || err);
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).send("Method Not Allowed");
  }

  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).send("Stripe is not configured.");
  }

  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      await getRawBody(req),
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("❌ Webhook signature verification failed:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ✅ EVENT VERIFIED — SAFE TO TRUST
  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object;

        // Prevent duplicate inserts (Stripe retries webhooks)
        const { data: existing } = await supabaseServer
          .from("orders")
          .select("id")
          .eq("stripe_session_id", session.id)
          .maybeSingle();

        if (existing) {
          console.log("ℹ️ Order already exists for session", session.id);
          break;
        }

        const orderNumber = await generateOrderNumber(supabaseServer);

        const lineItems = await stripe.checkout.sessions.listLineItems(session.id);

        const email =
          session.customer_details?.email ||
          session.customer_email ||
          session.metadata?.customer_email ||
          null;

        const userId = session.client_reference_id || session.metadata?.user_id || null;

        const order = {
          order_number: orderNumber,
          stripe_session_id: session.id,
          stripe_payment_intent: session.payment_intent,
          user_id: userId,
          email,
          customer_name: session.customer_details?.name || null,
          amount_total: session.amount_total,
          currency: session.currency,

          // Purchased items
          items: lineItems.data,

          consent: session.metadata || {},
          status: "paid",
        };

        const inserted = await safeInsertOrder(order);

        if (!inserted.ok) {
          console.error("❌ Failed to save order:", inserted.error);
          throw inserted.error;
        }

        console.log("✅ Order saved:", orderNumber);

        // Loyalty award (safe: never blocks webhook)
        await awardLoyalty({
          userId,
          email,
          amountTotalCents: session.amount_total,
          orderNumber,
          stripeSessionId: session.id,
        });

        // Send confirmation email
        try {
          console.log("📧 Attempting to send confirmation email to:", email);

          await sendOrderConfirmationEmail({
            to: email,
            orderNumber,
            amount: session.amount_total,
          });

          console.log("📧 Email send call completed");
        } catch (err) {
          console.error("❌ Email send failed:", err);
        }

        break;
      }

      case "payment_intent.succeeded": {
        const intent = event.data.object;
        console.log("💰 PaymentIntent succeeded:", intent.id);
        break;
      }

      default:
        console.log(`ℹ️ Unhandled event type: ${event.type}`);
    }

    res.json({ received: true });
  } catch (err) {
    console.error("❌ Webhook handler error:", err);
    res.status(500).json({ error: "Webhook handler failed" });
  }
}
