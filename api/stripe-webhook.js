import Stripe from "stripe";
import { fulfillOrder } from "../lib/payments/fulfillment.js";

export const config = {
  api: {
    bodyParser: false, // ❗ REQUIRED for Stripe signature verification
  },
};

// Pin the Stripe API version so webhook payload shapes are stable across SDK
// upgrades (must match api/create-checkout-session.js).
const STRIPE_API_VERSION = "2024-06-20";

// Lazy-init: guard against missing key in local dev
let _stripe = null;
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: STRIPE_API_VERSION,
    });
  }
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

        // Expand price.product so each line carries the SKU we stamped into
        // product_data.metadata at checkout — inventory decrement keys on it.
        const lineItems = await stripe.checkout.sessions.listLineItems(session.id, {
          expand: ["data.price.product"],
        });

        const email =
          session.customer_details?.email ||
          session.customer_email ||
          session.metadata?.customer_email ||
          null;

        const userId = session.client_reference_id || session.metadata?.user_id || null;

        // Shipping address (US-only, collected by Stripe). The field name moved
        // across Stripe API versions, so read both shapes defensively.
        const shippingDetails =
          session.shipping_details ||
          session.collected_information?.shipping_details ||
          null;

        // Shared, idempotent fulfillment (same path as the BTCPay rail).
        const result = await fulfillOrder({
          provider: "stripe",
          providerRef: session.id,
          paymentRef: session.payment_intent,
          userId,
          email,
          customerName: shippingDetails?.name || session.customer_details?.name || null,
          amountTotalCents: session.amount_total,
          currency: session.currency,
          items: lineItems.data,
          shippingAddress: shippingDetails?.address || null,
          consent: session.metadata || {},
          ip: req.headers["x-forwarded-for"] || null,
        });

        if (!result.ok) {
          console.error("❌ Failed to fulfill order:", result.error);
          throw result.error;
        }
        console.log(
          result.duplicate
            ? `ℹ️ Order already fulfilled for session ${session.id}`
            : `✅ Order fulfilled: ${result.orderNumber}`
        );

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
