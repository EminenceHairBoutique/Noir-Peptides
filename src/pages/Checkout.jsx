// src/pages/Checkout.jsx — Noir Peptides
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Lock } from "lucide-react";
import { useCart } from "../context/CartContext";
import { supabase } from "../lib/supabaseClient";
import StripeProvider from "../components/StripeProvider";
import SEO from "../components/SEO";
import DisclaimerBanner from "../components/DisclaimerBanner";
import CheckoutResearchCheckbox from "../components/CheckoutResearchCheckbox";
import { trackBeginCheckout } from "../utils/track";

const money = (n) =>
  `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

const CONSENT_VERSION = "noir-v1.0";

async function buildAndRedirectCheckout({ items, discountCode, onError }) {
  try {
    const total = items.reduce(
      (s, i) => s + Number(i.price || 0) * Number(i.quantity || 0),
      0
    );

    try {
      window.localStorage.setItem(
        "noir_checkout_snapshot",
        JSON.stringify({
          items,
          total,
          currency: "USD",
          timestamp: Date.now(),
        })
      );
    } catch {
      /* ignore */
    }

    trackBeginCheckout({ items, value: total });

    // Identity + attestation are enforced server-side from this bearer token;
    // userId/email are no longer trusted from the request body.
    let token = null;
    if (supabase) {
      const { data: sessionData } = await supabase.auth.getSession();
      token = sessionData?.session?.access_token || null;
    }
    if (!token) {
      throw new Error("Please sign in again to continue to payment.");
    }

    const res = await fetch("/api/create-checkout-session", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        // Server re-prices from these stable identifiers; client price is never trusted.
        items: items.map((i) => ({
          variantId: i.variantId,
          sku: i.sku,
          name: i.name,
          image: i.image,
          quantity: Number(i.quantity) || 1,
        })),
        consentVersion: CONSENT_VERSION,
        researchUseAcknowledged: true,
        qualifiedPurchaserConfirmed: true,
        brand: "Noir Peptides",
        discountCode: discountCode || undefined,
      }),
    });

    if (!res.ok) {
      let msg = "Checkout API error";
      try {
        const j = await res.json();
        msg = j?.error || msg;
      } catch {
        /* non-JSON */
      }
      throw new Error(msg);
    }

    const data = await res.json();
    if (!data?.url) throw new Error("Stripe checkout URL missing");
    window.location.assign(data.url);
  } catch (err) {
    console.error("Checkout error:", err);
    if (onError) onError(err);
  }
}

export default function Checkout() {
  const { items = [], total = 0 } = useCart();

  const [pageLoading, setPageLoading] = useState(true);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState(null);
  const [promoCode, setPromoCode] = useState("");
  const rootRef = useRef(null);

  useEffect(() => {
    setPageLoading(true);
    const t = setTimeout(() => setPageLoading(false), 180);
    return () => clearTimeout(t);
  }, []);

  const onError = (err) => {
    setSubmitting(false);
    setCheckoutError(
      err?.message ||
        "Payment system temporarily unavailable. Please refresh and try again."
    );
  };

  async function handleCheckout() {
    if (!items.length || !acknowledged) return;
    setCheckoutError(null);
    setSubmitting(true);
    await buildAndRedirectCheckout({ items, discountCode: promoCode.trim(), onError });
  }

  const canCheckout = items.length > 0 && acknowledged && !submitting;

  return (
    <>
      <SEO
        title="Secure Checkout — Noir Peptides"
        description="Encrypted checkout. For research use only."
        noindex={true}
      />

      <div className="bg-se-black text-se-bone min-h-screen pt-28 pb-24">
        <div
          ref={rootRef}
          tabIndex={-1}
          className="content-wide grid lg:grid-cols-12 gap-12 outline-none"
        >
          {/* Left */}
          <div className="lg:col-span-7">
            <div className="flex items-center gap-2 text-[10px] text-se-steel font-accent mb-4 uppercase tracking-[0.16em]">
              <span className="text-se-bone">Cart</span>
              <span>→</span>
              <span className="text-se-gold">Checkout</span>
              <span>→</span>
              <span>Payment</span>
            </div>

            <h1 className="font-display font-extrabold text-[clamp(1.5rem,4vw,2.5rem)] tracking-[0.02em] mb-6">
              CHECKOUT
            </h1>

            <div className="flex items-center gap-2 text-[11px] text-se-steel font-accent mb-6">
              <Lock className="w-4 h-4" />
              Secure &amp; encrypted checkout via Stripe
            </div>

            <DisclaimerBanner className="mb-6" />

            {pageLoading ? (
              <div className="space-y-4">
                <div className="h-24 glass-panel se-skeleton" />
                <div className="h-24 glass-panel se-skeleton" />
              </div>
            ) : (
              <StripeProvider>
                <div className="glass-panel p-6 space-y-5">
                  <p className="text-[13px] text-se-bone/55 font-accent">
                    You will be securely redirected to Stripe to complete your
                    purchase. The acknowledgment below is required before
                    checkout.
                  </p>

                  <CheckoutResearchCheckbox
                    checked={acknowledged}
                    onChange={setAcknowledged}
                  />

                  <div>
                    <label
                      htmlFor="promo"
                      className="text-[10px] font-accent uppercase tracking-[0.2em] text-se-steel block mb-2"
                    >
                      Promo code (optional)
                    </label>
                    <input
                      id="promo"
                      type="text"
                      value={promoCode}
                      onChange={(e) => setPromoCode(e.target.value.toUpperCase())}
                      autoCapitalize="characters"
                      autoCorrect="off"
                      spellCheck="false"
                      placeholder="WELCOME10"
                      className="w-full px-4 py-3 bg-se-charcoal border border-se-concrete text-se-bone text-[13px] font-accent tracking-[0.12em] placeholder:text-se-steel focus:outline-none focus:border-se-gold transition"
                    />
                    <p className="text-[10px] text-se-steel/70 font-accent mt-1.5">
                      Applied and validated at payment. Bundles &amp; kits are
                      excluded.
                    </p>
                  </div>
                </div>
              </StripeProvider>
            )}
          </div>

          {/* Right */}
          <div className="lg:col-span-5">
            <div className="sticky top-28 glass-panel p-6">
              <h2 className="font-display text-[14px] tracking-[0.1em] mb-6">
                ORDER SUMMARY
              </h2>

              {items.length === 0 ? (
                <p className="text-[13px] text-se-steel font-accent">
                  Your cart is empty.
                </p>
              ) : (
                <div className="space-y-4">
                  {items.map((item) => (
                    <div
                      key={item.cartKey || item.id}
                      className="flex gap-4"
                    >
                      {item.image ? (
                        <img
                          src={item.image}
                          alt={item.name}
                          className="w-16 h-16 object-cover bg-se-asphalt border border-se-concrete"
                        />
                      ) : (
                        <div
                          className="vial-visual w-16 h-16 border border-se-concrete"
                          aria-hidden="true"
                        />
                      )}

                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-accent truncate">
                          {item.name}
                        </p>
                        <p className="text-[11px] text-se-steel mt-1 font-accent">
                          Qty {item.quantity}
                        </p>
                      </div>

                      <p className="text-[13px] font-accent">
                        {money(item.price * item.quantity)}
                      </p>
                    </div>
                  ))}
                </div>
              )}

              <div className="border-t border-se-concrete mt-6 pt-6 space-y-3">
                <div className="flex justify-between text-[13px] font-accent">
                  <span className="text-se-bone/60">Subtotal</span>
                  <span>{money(total)}</span>
                </div>
                <div className="flex justify-between text-[13px] font-accent">
                  <span className="text-se-bone/60">Shipping</span>
                  <span className="text-se-steel">At checkout</span>
                </div>
                <p className="text-[10px] text-se-steel font-accent uppercase tracking-[0.14em]">
                  Ships within the United States only
                </p>
                <div className="divider" />
                <div className="flex justify-between text-[15px] font-accent font-medium">
                  <span>Total</span>
                  <span>{money(total)}</span>
                </div>
              </div>

              <p className="mt-4 text-[10px] text-se-steel font-accent text-center leading-relaxed">
                By completing your purchase you agree to our{" "}
                <Link to="/legal/terms" className="text-se-gold underline underline-offset-2">
                  Terms
                </Link>
                ,{" "}
                <Link to="/legal/privacy" className="text-se-gold underline underline-offset-2">
                  Privacy Policy
                </Link>
                , and{" "}
                <Link to="/legal/research-use-policy" className="text-se-gold underline underline-offset-2">
                  Research-Use Policy
                </Link>
                .
              </p>

              {checkoutError && (
                <p className="mt-3 text-[11px] text-se-red-bright text-center font-accent">
                  {checkoutError}
                </p>
              )}

              <button
                disabled={!canCheckout}
                onClick={handleCheckout}
                className={`mt-6 w-full ${
                  !canCheckout
                    ? "btn-outline opacity-50 cursor-not-allowed"
                    : "btn-primary"
                }`}
                type="button"
              >
                {submitting ? "Redirecting…" : "Continue to Payment"}
              </button>

              {!acknowledged && items.length > 0 && (
                <p className="mt-3 text-[10px] text-se-steel font-accent text-center uppercase tracking-[0.14em]">
                  Acknowledgment required to continue
                </p>
              )}

              <Link
                to="/shop"
                className="block text-center text-[11px] text-se-steel hover:text-se-gold transition font-accent mt-6"
              >
                Continue browsing catalog
              </Link>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
