// lib/payments/fulfillment.js
// Provider-agnostic order fulfillment. Every payment rail (Stripe, BTCPay, and
// any future card/ACH adapter) funnels a confirmed payment through fulfillOrder,
// so order creation, idempotency, loyalty/referral, the attestation record, and
// the confirmation email behave identically regardless of rail.
//
// Idempotency is keyed on orders.provider_ref (UNIQUE, migration 0016): a
// retried/duplicate webhook can never double-create an order.

import { supabaseServer } from "../supabaseServer.js";
import { generateOrderNumber } from "../orderNumber.js";
import { sendOrderConfirmationEmail } from "../email.js";
import { LOYALTY, pointsForPurchaseCents } from "../../src/utils/loyalty.js";
import { recordRedemption } from "../discounts.js";
import {
  deductLoyaltyPoints,
  ensureReferralCode,
  applyReferralOnOrder,
} from "../rewards.js";

async function awardLoyalty({ userId, email, amountTotalCents, orderNumber, providerRef }) {
  if (!userId) return;
  try {
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
      .select("id, loyalty_points, lifetime_spend_cents, first_purchase_bonus_awarded")
      .maybeSingle();
    if (profErr) {
      console.warn("Loyalty: could not read/create profile", profErr);
      return;
    }

    const currentPoints = Number(profile?.loyalty_points || 0);
    const currentSpend = Number(profile?.lifetime_spend_cents || 0);
    const earned = pointsForPurchaseCents(amountTotalCents);
    const bonus = profile?.first_purchase_bonus_awarded ? 0 : LOYALTY.firstPurchaseBonusPoints;

    const { error: updErr } = await supabaseServer
      .from("profiles")
      .update({
        loyalty_points: currentPoints + earned + bonus,
        lifetime_spend_cents: currentSpend + Number(amountTotalCents || 0),
        first_purchase_bonus_awarded: profile?.first_purchase_bonus_awarded || bonus > 0,
      })
      .eq("id", userId);
    if (updErr) {
      console.warn("Loyalty: profile update failed", updErr);
      return;
    }

    try {
      const entries = [];
      if (earned > 0)
        entries.push({ user_id: userId, delta: earned, reason: "purchase", order_number: orderNumber, stripe_session_id: providerRef });
      if (bonus > 0)
        entries.push({ user_id: userId, delta: bonus, reason: "first_purchase_bonus", order_number: orderNumber, stripe_session_id: providerRef });
      if (entries.length) {
        const { error: ledgerErr } = await supabaseServer.from("loyalty_ledger").insert(entries);
        if (ledgerErr) console.warn("Loyalty: ledger insert skipped", ledgerErr.message || ledgerErr);
      }
    } catch (e) {
      console.warn("Loyalty: ledger insert exception", e?.message || e);
    }
  } catch (err) {
    console.warn("Loyalty: award exception", err?.message || err);
  }
}

// Write a checkout-time attestation record stamped with the order id, so every
// purchase ties to the research-use attestation that authorized it (Task 4).
// The exact attested text/version/legal name come from the user's stored
// attestation snapshot (captured at consent time in profiles + attestation_audit).
async function logCheckoutAttestation({ userId, orderNumber, ip }) {
  if (!userId) return;
  try {
    const { data: p } = await supabaseServer
      .from("profiles")
      .select("attestation_version, attestation_statements, attestation_legal_name, attestation_ip")
      .eq("id", userId)
      .maybeSingle();
    if (!p?.attestation_version) return;
    await supabaseServer.from("attestation_audit").insert({
      user_id: userId,
      version: p.attestation_version,
      statements: p.attestation_statements || [],
      legal_name: p.attestation_legal_name || "",
      ip_address: ip || p.attestation_ip || null,
      order_id: orderNumber,
      context: "checkout",
    });
  } catch (e) {
    console.warn("Attestation log: skipped", e?.message || e);
  }
}

/**
 * Create + fulfill an order from a confirmed payment on any rail.
 * @returns {Promise<{ok:boolean, duplicate?:boolean, orderNumber?:string, error?:any}>}
 */
export async function fulfillOrder({
  provider,
  providerRef,
  paymentRef = null,
  userId = null,
  email = null,
  customerName = null,
  amountTotalCents,
  currency = "usd",
  items = [],
  shippingAddress = null,
  consent = {},
  ip = null,
}) {
  if (!providerRef) return { ok: false, error: new Error("Missing providerRef") };

  // Idempotency: one order per provider reference.
  const { data: existing } = await supabaseServer
    .from("orders")
    .select("order_number")
    .eq("provider_ref", providerRef)
    .maybeSingle();
  if (existing) {
    return { ok: true, duplicate: true, orderNumber: existing.order_number };
  }

  const orderNumber = await generateOrderNumber(supabaseServer);
  const order = {
    order_number: orderNumber,
    payment_provider: provider,
    provider_ref: providerRef,
    stripe_session_id: provider === "stripe" ? providerRef : null,
    stripe_payment_intent: paymentRef,
    user_id: userId,
    email,
    customer_name: customerName,
    amount_total: amountTotalCents,
    currency,
    items,
    shipping_address: shippingAddress,
    consent,
    status: "paid",
  };

  const { error } = await supabaseServer.from("orders").insert(order);
  if (error) {
    // A concurrent webhook may have inserted first (unique provider_ref) — treat
    // a uniqueness violation as a successful duplicate rather than an error.
    if (String(error.code) === "23505") {
      return { ok: true, duplicate: true, orderNumber };
    }
    return { ok: false, error };
  }

  // Post-order side effects (all best-effort — never unwind a paid order).
  if (consent.discount_code) {
    await recordRedemption({
      code: consent.discount_code,
      userId,
      orderNumber,
      amount: consent.discount_amount,
    });
  }
  if (consent.loyalty_points) {
    await deductLoyaltyPoints({ userId, points: Number(consent.loyalty_points), orderNumber });
  }
  if (userId) {
    await ensureReferralCode(userId, email);
    if (consent.referral_code) {
      await applyReferralOnOrder({ buyerId: userId, referralCode: consent.referral_code, orderNumber });
    }
  }
  await awardLoyalty({ userId, email, amountTotalCents, orderNumber, providerRef });
  await logCheckoutAttestation({ userId, orderNumber, ip });

  try {
    await sendOrderConfirmationEmail({ to: email, orderNumber, amount: amountTotalCents });
  } catch (err) {
    console.error("Email send failed:", err?.message || err);
  }

  return { ok: true, duplicate: false, orderNumber };
}
