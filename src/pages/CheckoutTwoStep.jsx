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
import React, { useMemo, useRef, useState } from "react";
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
  const [form, setForm] = useState({
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
  });

  const subtotal = Number(total) || 0;
  const step1Valid = useMemo(() => isStep1Valid(form), [form]);

  const onContinue = async () => {
    if (!step1Valid) { setShowErrors(true); return; }
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
      setSubmitting(false);
    }
  };

  const onPay = async (rail) => {
    if (!rail) return;
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
            <ProgressBar step={step} />
            <DisclaimerBanner className="mb-6" />
            {step === 1 ? (
              <StepPersonal state={form} setState={setForm} subtotalDollars={subtotal}
                showErrors={showErrors} onContinue={onContinue} user={user} />
            ) : (
              <StepPayment onBack={() => { setStep(1); window.scrollTo({ top: 0 }); }} onPay={onPay}
                submitting={submitting} error={error} selectedRail={selectedRail} setSelectedRail={setSelectedRail} />
            )}
            {step === 1 && error && <p className="text-[12px] text-se-red-bright font-accent mt-4">{error}</p>}
          </div>

          {/* Order summary */}
          <div className="lg:col-span-5">
            <div className="sticky top-28 glass-panel p-6">
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
                <div className="divider" />
                <div className="flex justify-between text-[15px] font-accent font-medium">
                  <span>Total</span><span>{money(subtotal)}</span>
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
