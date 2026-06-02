// src/pages/Success.jsx — Noir Peptides
import React, { useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import SEO from "../components/SEO";
import { useCart } from "../context/CartContext";
import { trackPurchase } from "../utils/track";

export default function Success() {
  const { clearCart } = useCart();
  const [searchParams] = useSearchParams();
  const sessionId = searchParams.get("session_id");

  useEffect(() => {
    if (!sessionId) return;

    try {
      const lastTracked = window.localStorage.getItem(
        "noir_purchase_tracked_session"
      );
      if (lastTracked !== sessionId) {
        const snapRaw = window.localStorage.getItem("noir_checkout_snapshot");
        const snap = snapRaw ? JSON.parse(snapRaw) : null;
        const value =
          snap && typeof snap.total !== "undefined"
            ? Number(snap.total)
            : undefined;
        const items = Array.isArray(snap?.items) ? snap.items : [];
        trackPurchase({ transaction_id: sessionId, value, items });
        window.localStorage.setItem(
          "noir_purchase_tracked_session",
          sessionId
        );
        window.localStorage.removeItem("noir_checkout_snapshot");
      }
    } catch {
      /* ignore */
    }

    clearCart();
  }, [sessionId, clearCart]);

  return (
    <>
      <SEO
        title="Order Confirmed — Noir Peptides"
        description="Your research material order has been placed."
        noindex={true}
      />

      <div className="bg-se-black text-se-bone min-h-[70vh] pt-32 pb-24">
        <div className="content-wide text-center">
          <p className="text-overline mb-4">Order</p>
          <h1 className="font-display font-extrabold text-[clamp(2rem,5vw,3rem)] tracking-[0.02em] mb-6">
            ORDER CONFIRMED
          </h1>
          <p className="text-[15px] text-se-bone/50 max-w-md mx-auto mb-6 font-accent">
            Thank you for your order with{" "}
            <strong className="text-se-bone">Noir Peptides</strong>. Your
            payment was successful and a confirmation email has been sent.
          </p>

          <div className="glass-panel max-w-md mx-auto p-6 mb-10 text-left">
            <p className="text-[12px] font-accent text-se-bone/55 leading-relaxed">
              All materials are supplied for laboratory research use only — not
              for human or veterinary use. Batch-specific analytical
              documentation is available to qualified researchers on request.
            </p>
          </div>

          {sessionId && (
            <p className="text-[10px] tracking-[0.2em] uppercase text-se-steel font-accent mb-10">
              Session · {sessionId.slice(-8)}
            </p>
          )}

          <div className="flex justify-center gap-4">
            <Link to="/shop" className="btn-primary">
              Continue Browsing
            </Link>
            <Link to="/account" className="btn-outline">
              View Orders
            </Link>
          </div>
        </div>
      </div>
    </>
  );
}
