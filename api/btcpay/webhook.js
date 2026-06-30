// api/btcpay/webhook.js
// BTCPay Server settlement webhook. Configure in BTCPay (Store → Webhooks) to
// POST the "Invoice settled" event here. On settlement we re-fetch the invoice
// from BTCPay (never trust the delivered body for amounts), read the order
// snapshot we stored in invoice metadata at creation, and fulfill the order
// through the SHARED, idempotent path used by the card rail.
//
// Honest crypto: the customer knowingly pays in crypto. This does NOT disguise
// the transaction — there is no card-to-stablecoin conversion here.
//
// Idempotent: fulfillOrder keys on orders.provider_ref (= the invoice id), so a
// retried webhook can never double-create an order.

import crypto from "node:crypto";
import { fulfillOrder } from "../../lib/payments/fulfillment.js";

export const config = {
  api: {
    bodyParser: false, // raw body required for HMAC signature verification
  },
};

async function getRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") return Buffer.from(req.body);
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
}

// BTCPay signs the raw body: header "BTCPay-Sig: sha256=<hex>".
function verifySignature(raw, header, secret) {
  if (!secret) return true; // no secret configured → skip (dev only)
  if (!header) return false;
  const expected = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  const provided = String(header).replace(/^sha256=/, "");
  const a = Buffer.from(expected, "hex");
  const b = Buffer.from(provided, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function btcpayConfigured() {
  return Boolean(
    process.env.BTCPAY_URL && process.env.BTCPAY_API_KEY && process.env.BTCPAY_STORE_ID
  );
}

async function fetchInvoice(invoiceId) {
  const base = String(process.env.BTCPAY_URL).replace(/\/+$/, "");
  const resp = await fetch(
    `${base}/api/v1/stores/${process.env.BTCPAY_STORE_ID}/invoices/${invoiceId}`,
    { headers: { Authorization: `token ${process.env.BTCPAY_API_KEY}` } }
  );
  if (!resp.ok) return null;
  return resp.json();
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).send("Method Not Allowed");
  if (!btcpayConfigured()) return res.status(503).send("BTCPay is not configured.");

  const raw = await getRawBody(req);

  if (!verifySignature(raw, req.headers["btcpay-sig"], process.env.BTCPAY_WEBHOOK_SECRET)) {
    console.error("❌ BTCPay webhook signature verification failed");
    return res.status(400).send("Invalid signature");
  }

  let event;
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    return res.status(400).send("Invalid JSON");
  }

  // Fulfill only on final settlement. Other events (created, processing,
  // expired) are acknowledged but not fulfilled.
  const SETTLED = new Set(["InvoiceSettled", "InvoicePaymentSettled"]);
  if (!SETTLED.has(event?.type)) {
    return res.json({ received: true, ignored: event?.type || "unknown" });
  }

  const invoiceId = event.invoiceId;
  if (!invoiceId) return res.status(400).send("Missing invoiceId");

  try {
    const invoice = await fetchInvoice(invoiceId);
    if (!invoice) {
      console.error("❌ BTCPay: could not fetch invoice", invoiceId);
      return res.status(502).send("Could not fetch invoice");
    }

    // Only fulfill an invoice that is actually paid in full.
    const status = invoice.status; // Settled | Processing | Expired | Invalid | New
    if (status !== "Settled") {
      return res.json({ received: true, status });
    }

    const md = invoice.metadata || {};
    const amountTotalCents =
      Number(md.amountTotalCents) ||
      Math.round(Number(invoice.amount || 0) * 100);

    const result = await fulfillOrder({
      provider: "btcpay",
      providerRef: invoiceId,
      paymentRef: invoiceId,
      userId: md.userId || null,
      email: md.buyerEmail || null,
      customerName: md.shippingAddress?.name || null,
      amountTotalCents,
      currency: (invoice.currency || "USD").toLowerCase(),
      items: md.orderItems || [],
      shippingAddress: md.shippingAddress || null,
      consent: md.consent || {},
      ip: req.headers["x-forwarded-for"] || null,
    });

    if (!result.ok) {
      console.error("❌ BTCPay: fulfillment failed", result.error);
      return res.status(500).json({ error: "Fulfillment failed" });
    }
    console.log(
      result.duplicate
        ? `ℹ️ BTCPay invoice ${invoiceId} already fulfilled`
        : `✅ BTCPay order fulfilled: ${result.orderNumber}`
    );

    return res.json({ received: true });
  } catch (err) {
    console.error("❌ BTCPay webhook handler error:", err?.message || err);
    return res.status(500).json({ error: "Webhook handler failed" });
  }
}
