/* eslint-env node */
import Stripe from "stripe";
import { products } from "../src/data/products.js";

// Lazy-init: guard against missing key in local dev (no .env set up)
let _stripe = null;
function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (!_stripe) _stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  return _stripe;
}

export default async function handler(req, res) {
  return await createHandler(req, res);
}

export async function createHandler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({
      error:
        "Stripe is not configured. Set STRIPE_SECRET_KEY in your .env.local file.",
    });
  }

  try {
    const {
      items,
      userId,
      customerEmail,
      researchUseAcknowledged,
      qualifiedPurchaserConfirmed,
    } = req.body || {};

    // Server-side gate: do not create a session unless the research-use
    // acknowledgment was confirmed client-side.
    if (!researchUseAcknowledged) {
      return res.status(400).json({
        error: "Research-use acknowledgment is required before checkout.",
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Invalid cart items" });
    }

    const origin =
      req.headers.origin ||
      `https://${req.headers["x-forwarded-host"] || req.headers.host}`;

    const line_items = items.map((item) => {
      if ((!item?.id && !item?.slug) || !item.quantity) {
        throw new Error("Missing item fields");
      }

      const product = products.find(
        (p) => p.id === item.id || p.slug === item.slug
      );
      if (!product) {
        throw new Error(`Unknown product: ${item.id || item.slug}`);
      }
      if (product.stock_status === "out_of_stock") {
        throw new Error(`Out of stock: ${product.name}`);
      }

      // Flat, server-trusted pricing.
      const unitAmount = Math.round(Number(product.price) * 100);
      if (!Number.isFinite(unitAmount) || unitAmount <= 0) {
        throw new Error(`Invalid price for ${product.id}`);
      }

      const imgPath = item.image || product.image_url || null;
      const image = imgPath
        ? String(imgPath).startsWith("http")
          ? imgPath
          : `${origin}${imgPath}`
        : null;

      return {
        price_data: {
          currency: "usd",
          product_data: {
            name: `${product.name} — Research Use Only`,
            description:
              "Lyophilized research reference material. Not for human or veterinary use.",
            images: image ? [image] : [],
            metadata: {
              batch_number: product.batch_number || "",
              cas_number: product.cas_number || "",
              research_use_only: "true",
            },
          },
          unit_amount: unitAmount,
        },
        quantity: Number(item.quantity),
      };
    });

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items,
      mode: "payment",
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel`,
      allow_promotion_codes: true,
      client_reference_id: userId ? String(userId) : undefined,
      customer_email: customerEmail ? String(customerEmail) : undefined,
      metadata: {
        source: "noir_checkout",
        brand: "Noir Peptides",
        research_use_acknowledged: researchUseAcknowledged ? "true" : "false",
        qualified_purchaser_confirmed: qualifiedPurchaserConfirmed ? "true" : "false",
        research_use_only: "true",
        user_id: userId ? String(userId) : "",
        customer_email: customerEmail ? String(customerEmail) : "",
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err?.message || err);
    res.status(500).json({ error: err?.message || "Stripe error" });
  }
}
