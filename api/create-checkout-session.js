import Stripe from "stripe";
import { products as staticProducts } from "../src/data/products.js";
import { supabaseServer } from "../lib/supabaseServer.js";
import { requireUser } from "./_utils/auth.js";
import { checkRateLimit } from "./_utils/rateLimit.js";
import { ATTESTATION_VERSION } from "../lib/attestationStatements.js";

// Pin the Stripe API version so behavior is stable across SDK upgrades.
const STRIPE_API_VERSION = "2024-06-20";

// Lazy-init: guard against missing key in local dev (no .env set up)
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

// ── Server-trusted price source ──────────────────────────────────────────
// Prices are resolved server-side and NEVER read from the client body. We
// prefer the RLS-gated Supabase `products` table (authoritative); if a row is
// not found (e.g. local dev without a seeded DB) we fall back to the static
// catalog, which is imported ONLY here on the server and is therefore never
// shipped in the client bundle.
async function resolvePricedProduct({ id, slug }) {
  // 1) Authoritative: Supabase products (service role bypasses RLS).
  try {
    let query = supabaseServer
      .from("products")
      .select("id, slug, name, price, stock_status, batch_number, cas_number, image_url")
      .limit(1);
    query = id ? query.eq("id", id) : query.eq("slug", slug);
    const { data, error } = await query.maybeSingle();
    if (!error && data) return data;
  } catch {
    /* fall through to static */
  }

  // 2) Fallback: static server-side catalog.
  const p = staticProducts.find((x) => x.id === id || x.slug === slug);
  return p || null;
}

export default async function handler(req, res) {
  return await createHandler(req, res);
}

export async function createHandler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  // Rate limit checkout session creation per IP.
  const allowed = await checkRateLimit(req, res, {
    endpoint: "checkout",
    max: 15,
    windowMs: 60_000,
  });
  if (!allowed) return;

  const stripe = getStripe();
  if (!stripe) {
    return res.status(503).json({
      error:
        "Stripe is not configured. Set STRIPE_SECRET_KEY in your .env.local file.",
    });
  }

  // ── AUTH: identity is derived from the Supabase bearer token, never body ──
  const user = await requireUser(req, res);
  if (!user) return; // 401 already sent

  // ── ATTESTATION GATE: must be completed AND on the current version ────────
  let profile = null;
  try {
    const { data } = await supabaseServer
      .from("profiles")
      .select("attestation_completed_at, attestation_version, email")
      .eq("id", user.id)
      .maybeSingle();
    profile = data;
  } catch {
    profile = null;
  }

  const attested =
    !!profile?.attestation_completed_at &&
    profile?.attestation_version === ATTESTATION_VERSION;

  if (!attested) {
    return res.status(403).json({
      error:
        "A current research-use attestation is required before checkout. Please complete the attestation and try again.",
    });
  }

  try {
    const { items, researchUseAcknowledged, qualifiedPurchaserConfirmed } =
      req.body || {};

    // Per-checkout acknowledgment (defense in depth on top of the gate).
    if (!researchUseAcknowledged) {
      return res.status(400).json({
        error: "Research-use acknowledgment is required before checkout.",
      });
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: "Invalid cart items" });
    }

    const userId = user.id;
    const customerEmail = user.email || profile?.email || null;

    const origin =
      req.headers.origin ||
      `https://${req.headers["x-forwarded-host"] || req.headers.host}`;

    const line_items = await Promise.all(
      items.map(async (item) => {
        if ((!item?.id && !item?.slug) || !item.quantity) {
          throw new Error("Missing item fields");
        }

        const product = await resolvePricedProduct({
          id: item.id,
          slug: item.slug,
        });
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

        const qty = Math.max(1, Math.min(99, Math.floor(Number(item.quantity))));

        const imgPath = product.image_url || item.image || null;
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
          quantity: qty,
        };
      })
    );

    // ── US-only shipping ────────────────────────────────────────────────────
    // Restrict the address Stripe collects to the US, and attach a shipping
    // rate (a pre-created rate id when available, else an inline flat rate).
    const shippingOption = process.env.STRIPE_US_SHIPPING_RATE_ID
      ? { shipping_rate: process.env.STRIPE_US_SHIPPING_RATE_ID }
      : {
          shipping_rate_data: {
            type: "fixed_amount",
            display_name: "Standard US Shipping",
            fixed_amount: { amount: 900, currency: "usd" },
            delivery_estimate: {
              minimum: { unit: "business_day", value: 2 },
              maximum: { unit: "business_day", value: 5 },
            },
          },
        };

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items,
      mode: "payment",
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cancel`,
      allow_promotion_codes: true,
      client_reference_id: String(userId),
      customer_email: customerEmail ? String(customerEmail) : undefined,
      shipping_address_collection: { allowed_countries: ["US"] },
      shipping_options: [shippingOption],
      metadata: {
        source: "noir_checkout",
        brand: "Noir Peptides",
        research_use_acknowledged: researchUseAcknowledged ? "true" : "false",
        qualified_purchaser_confirmed: qualifiedPurchaserConfirmed
          ? "true"
          : "false",
        research_use_only: "true",
        attestation_version: ATTESTATION_VERSION,
        user_id: String(userId),
        customer_email: customerEmail ? String(customerEmail) : "",
      },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error("Stripe error:", err?.message || err);
    res.status(500).json({ error: err?.message || "Stripe error" });
  }
}
