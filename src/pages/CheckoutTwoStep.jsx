// src/pages/CheckoutTwoStep.jsx
// Two-step checkout (1 Personal → 2 Payment). LIVE — this is what /checkout
// renders (see src/App.jsx). The previous single-step flow remains at
// src/pages/Checkout.jsx as a one-line rollback target.
//
// Compliance model: this build runs in the site's EXISTING authenticated
// model — /checkout is auth-walled and the server requires a stored
// attestation. The guest-checkout path the brief asks for is a documented
// seam (see CHECKOUT_NOTES.md "Guest vs. auth wall"); it is intentionally NOT
// wired here because it changes the site's compliance posture and needs an
// unauthenticated order backend + a migration — an owner decision.
//
// Step 1 collects contact + shipping (+ optional billing) + research info +
// shipping method + the three RUO certifications, persists the compliance
// record server-side (POST /api/checkout-compliance — SQL in
// scripts/proposed-order-attestations.sql), THEN advances to payment. Cart
// state is preserved across steps and across a back-navigation.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { readCheckoutDraft, writeCheckoutDraft, clearCheckoutDraft } from "../lib/checkoutDraft";
import { Link } from "react-router-dom";
import { useCart } from "../context/CartContext";
import { useUser } from "../context/UserContext";
import { supabase } from "../lib/supabaseClient";
import SEO from "../components/SEO";
import DisclaimerBanner from "../components/DisclaimerBanner";
import StepPersonal from "../components/checkout/StepPersonal";
import StepPayment from "../components/checkout/StepPayment";
import { isStep1Valid } from "../lib/checkoutValidation";
import { CHECKOUT_ATTESTATION_VERSION, CHECKOUT_ATTESTATION_IDS } from "../config/checkoutAttestations";
import { trackBeginCheckout } from "../utils/track";
import { REDEEM_INCREMENT, redeemDollars } from "../utils/loyalty";

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const emptyAddr = { institution: "", contactName: "", line1: "", line2: "", city: "", state: "", zip: "", phone: "" };

function ProgressBar({ step }) {
  const steps = [["1", "Personal"], ["2", "Payment"]];
  return (
    <ol className="flex items-center gap-3 mb-8" aria-label="Checkout progress">
      {steps.map(([n, label], i) => {
        const active = step === i + 1;
        const done = step > i + 1;
        return (
          <li key={n} className="flex items-center gap-3" aria-current={active ? "step" : undefined}>
            <span className={`w-7 h-7 rounded-full grid place-items-center text-[12px] font-accent border ${
              active ? "border-se-gold text-se-gold" : done ? "border-emerald-400 text-emerald-300" : "border-se-concrete text-se-steel"}`}>
              {done ? "✓" : n}
            </span>
            <span className={`text-[12px] font-accent uppercase tracking-[0.14em] ${active ? "text-se-bone" : "text-se-steel"}`}>{label}</span>
            {i === 0 && <span className="text-se-steel">→</span>}
          </li>
        );
      })}
    </ol>
  );
}

export default function CheckoutTwoStep() {
  const { items = [], total = 0 } = useCart();
  const { user } = useUser();

  const [step, setStep] = useState(1);
  const [showErrors, setShowErrors] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  // Rail selection is set from the SERVER's available-rails response
  // (StepPayment); no hardcoded default, so we never preselect a rail this
  // deployment can't charge.
  const [selectedRail, setSelectedRail] = useState("");

  // P1.1: one token per checkout ATTEMPT. Double-clicks, retries and a second
  // tab of THIS page share it, so the server's idempotency key collapses them
  // into a single Stripe session + coupon. A fresh page load starts a new
  // attempt and legitimately gets a new session.
  const requestTokenRef = useRef(
    (globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`)
  );

  // Single source of Step-1 state; preserved across step navigation.
  // Opt c6 (4.5): the step-1 draft survives a reload. sessionStorage (this
  // tab only, gone when it closes — never localStorage); the three RUO
  // certifications are deliberately NOT restored: they are re-affirmed on
  // every pass. Cleared the moment payment starts.
  const [form, setForm] = useState(() => {
    const fresh = {
      contact: {
        firstName: user?.name?.split(" ")[0] || "",
        lastName: user?.name?.split(" ").slice(1).join(" ") || "",
        email: user?.email || "",
        phone: "",
      },
      shipping: { ...emptyAddr },
      billingDifferent: false,
      billing: { ...emptyAddr },
      research: { entity: "", protocol: "" },
      shippingMethod: "",
      attestations: {},
    };
    const draft = readCheckoutDraft();
    return draft ? { ...fresh, ...draft, attestations: {} } : fresh;
  });
  useEffect(() => { writeCheckoutDraft(form); }, [form]);

  const subtotal = Number(total) || 0;
  const itemCount = items.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);
  // Opt cycle 11 (4.14): promo + points are optional hints; the server derives
  // every dollar (computeAdjustments). Balance is the server-hydrated
  // profiles.loyalty_points, so the select never offers points the server
  // would reject.
  const [promoCode, setPromoCode] = useState("");
  const [redeemPoints, setRedeemPoints] = useState(0);
  const pointsBalance = Math.max(0, Math.floor(Number(user?.loyaltyPoints) || 0));
  const redeemable = Math.floor(pointsBalance / REDEEM_INCREMENT) * REDEEM_INCREMENT;
  const pointsToRedeem = Math.min(Math.max(0, Math.floor(redeemPoints / REDEEM_INCREMENT) * REDEEM_INCREMENT), redeemable);
  const rewardsEstimate = Math.min(redeemDollars(pointsToRedeem), subtotal);
  const step1Valid = useMemo(() => isStep1Valid(form), [form]);

  // A ref, not state: two clicks in the same task both see submitting=false.
  const continueInFlight = useRef(false);
  const onContinue = async () => {
    if (!step1Valid) { setShowErrors(true); return; }
    if (continueInFlight.current) return;
    continueInFlight.current = true;
    setError(null);
    setSubmitting(true);
    try {
      // Persist the compliance record BEFORE payment (Stage 4). Server captures
      // IP + UA + timestamp itself; client values are never trusted for those.
      const token = supabase ? (await supabase.auth.getSession()).data?.session?.access_token : null;
      const res = await fetch("/api/checkout-compliance", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          contact: form.contact,
          shipping: form.shipping,
          billing: form.billingDifferent ? form.billing : null,
          research: form.research,
          shippingMethod: form.shippingMethod,
          attestationVersion: CHECKOUT_ATTESTATION_VERSION,
          attestations: CHECKOUT_ATTESTATION_IDS.map((id) => ({ id, agreed: form.attestations[id] === true })),
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Could not save your research-use certification. Please try again.");
      }
      const { complianceId } = await res.json();
      try { window.sessionStorage.setItem("noir_checkout_compliance_id", complianceId || ""); } catch { /* ignore */ }
      trackBeginCheckout({ items, value: subtotal });
      setStep(2);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      setError(e.message);
    } finally {
      continueInFlight.current = false;
      setSubmitting(false);
    }
  };

  const onPay = async (rail, spend = {}) => {
    clearCheckoutDraft();
    if (!rail) return;
    const discountCode = String(spend.discountCode ?? promoCode ?? "").trim().toUpperCase().slice(0, 32);
    const points = Math.min(
      Math.max(0, Math.floor((Number(spend.redeemPoints ?? redeemPoints) || 0) / REDEEM_INCREMENT) * REDEEM_INCREMENT),
      redeemable
    );
    setError(null);
    setSubmitting(true);
    try {
      const token = supabase ? (await supabase.auth.getSession()).data?.session?.access_token : null;
      if (!token) throw new Error("Please sign in again to continue to payment.");
      const complianceId = (() => { try { return window.sessionStorage.getItem("noir_checkout_compliance_id"); } catch { return null; } })();
      const res = await fetch(rail.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          items: items.map((i) => ({ variantId: i.variantId, sku: i.sku, name: i.name, image: i.image, quantity: Number(i.quantity) || 1 })),
          researchUseAcknowledged: true,
          qualifiedPurchaserConfirmed: true,
          shippingMethod: form.shippingMethod,
          complianceId: complianceId || undefined,
          requestToken: requestTokenRef.current,
          brand: "Noir Peptides",
          // Hints only — the server validates the code and the balance and
          // derives the dollars (lib/pricing.js computeAdjustments).
          discountCode: discountCode || undefined,
          redeemPoints: points > 0 ? points : undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Payment could not be started. Please try again.");
      }
      const data = await res.json();
      if (!data?.url) throw new Error("Payment URL missing.");
      window.location.assign(data.url);
    } catch (e) {
      setError(e.message);
      setSubmitting(false);
    }
  };

  if (!items.length) {
    return (
      <>
        <SEO title="Checkout — Noir Peptides" noindex />
        <div className="bg-se-black text-se-bone min-h-[70vh] pt-28 pb-24">
          <div className="content-wide text-center">
            <h1 className="font-display text-2xl mb-4">Your cart is empty</h1>
            <Link to="/shop" className="btn-primary">Browse the catalog</Link>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEO title="Secure Checkout — Noir Peptides" description="Encrypted checkout. For research use only." noindex />
      <div className="bg-se-black text-se-bone min-h-screen pt-28 pb-24">
        <div className="content-wide grid lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7">
            {/* Opt c7 (4.9): the page's level-one heading — axe flagged both steps
            without one. Visually the progress bar carries the step; the h1 is
            for the document outline and screen readers. */}
        <h1 className="sr-only">Checkout — step {step} of 2: {step === 1 ? "Personal" : "Payment"}</h1>
        <ProgressBar step={step} />
            <DisclaimerBanner className="mb-6" />
            {step === 1 && (
              /* Opt cycle 11 (4.8 F4): on one-column layouts the order summary
                 sat 3 000 px down a 5 400 px page. A compact strip at the top
                 of step 1 carries the count and subtotal and jumps to it. */
              <div className="lg:hidden glass-panel px-4 py-3 mb-6 flex items-center justify-between gap-3" data-testid="summary-strip">
                <div className="min-w-0">
                  <p className="text-[13px] font-accent text-se-bone">
                    {itemCount} {itemCount === 1 ? "item" : "items"} · Subtotal {money(subtotal)}
                  </p>
                  <p className="text-[11px] font-accent text-se-steel">Shipping calculated at payment</p>
                </div>
                <a href="#order-summary" className="shrink-0 inline-flex items-center min-h-[44px] px-3 text-[11px] font-accent uppercase tracking-[0.14em] text-se-gold hover:text-se-bone">
                  View summary
                </a>
              </div>
            )}
            {step === 1 ? (
              <StepPersonal submitting={submitting} state={form} setState={setForm} subtotalDollars={subtotal}
                showErrors={showErrors} onContinue={onContinue} user={user} />
            ) : (
              <StepPayment onBack={() => { setStep(1); window.scrollTo({ top: 0 }); }} onPay={onPay}
                promoCode={promoCode} setPromoCode={setPromoCode}
                redeemPoints={pointsToRedeem} setRedeemPoints={setRedeemPoints} pointsBalance={pointsBalance}
                submitting={submitting} error={error} selectedRail={selectedRail} setSelectedRail={setSelectedRail} />
            )}
            {step === 1 && error && <p className="text-[12px] text-se-red-bright font-accent mt-4">{error}</p>}
          </div>

          {/* Order summary */}
          <div className="lg:col-span-5">
            <div id="order-summary" className="sticky top-28 glass-panel p-6 scroll-mt-28">
              <h2 className="font-display text-[14px] tracking-[0.1em] mb-6">ORDER SUMMARY</h2>
              <div className="space-y-4">
                {items.map((item) => (
                  <div key={item.cartKey || item.id} className="flex gap-4">
                    {item.image ? (
                      <img src={item.image} alt={item.name} className="w-14 h-14 object-cover bg-se-asphalt border border-se-concrete" />
                    ) : <div className="vial-visual w-14 h-14 border border-se-concrete" aria-hidden="true" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-accent truncate">{item.name}</p>
                      <p className="text-[11px] text-se-steel mt-1 font-accent">Qty {item.quantity}</p>
                    </div>
                    <p className="text-[13px] font-accent">{money(item.price * item.quantity)}</p>
                  </div>
                ))}
              </div>
              <div className="border-t border-se-concrete mt-6 pt-6 space-y-3">
                <div className="flex justify-between text-[13px] font-accent">
                  <span className="text-se-bone/60">Subtotal</span><span>{money(subtotal)}</span>
                </div>
                <div className="flex justify-between text-[13px] font-accent">
                  <span className="text-se-bone/60">Shipping</span>
                  <span className="text-se-steel">{form.shippingMethod ? "Calculated at payment" : "Select a method"}</span>
                </div>
                <p className="text-[10px] text-se-steel font-accent uppercase tracking-[0.14em]">Ships within the United States only</p>
                {promoCode.trim() && (
                  <div className="flex justify-between text-[13px] font-accent">
                    <span className="text-se-bone/60">Promo code</span>
                    <span className="text-se-steel">{promoCode.trim()} · validated at payment</span>
                  </div>
                )}
                {pointsToRedeem > 0 && (
                  <div className="flex justify-between text-[13px] font-accent" data-testid="rewards-estimate">
                    <span className="text-se-bone/60">Rewards ({pointsToRedeem.toLocaleString()} pts)</span>
                    <span>−{money(rewardsEstimate)}</span>
                  </div>
                )}
                <div className="divider" />
                <div className="flex justify-between text-[15px] font-accent font-medium">
                  <span>Total</span><span>{money(Math.max(0, subtotal - rewardsEstimate))}</span>
                </div>
                <p className="text-[10px] text-se-steel/70 font-accent">Final total incl. shipping shown at payment; the server is authoritative on price.</p>
              </div>
              <Link to="/cart" className="block text-center text-[11px] text-se-steel hover:text-se-gold transition font-accent mt-6">
                Back to cart
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
