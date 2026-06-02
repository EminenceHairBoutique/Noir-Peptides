// src/pages/Cancel.jsx — Noir Peptides
import React from "react";
import { Link } from "react-router-dom";
import SEO from "../components/SEO";

export default function Cancel() {
  return (
    <>
      <SEO title="Payment Cancelled — Noir Peptides" description="Your payment was cancelled." noindex={true} />
      <div className="bg-se-black text-se-bone min-h-[70vh] pt-32 pb-24 text-center">
        <div className="content-wide">
          <p className="text-overline mb-4">Checkout</p>
          <h1 className="font-display font-extrabold text-[clamp(2rem,5vw,3rem)] tracking-[0.02em] mb-6">
            PAYMENT CANCELLED
          </h1>
          <p className="text-[15px] text-se-bone/40 max-w-md mx-auto mb-10 font-accent">
            Your payment was not completed. Your selected research materials are still in your cart.
          </p>
          <div className="flex justify-center gap-4">
            <Link to="/checkout" className="btn-primary">Return to Checkout</Link>
            <Link to="/shop" className="btn-outline">Continue Browsing</Link>
          </div>
        </div>
      </div>
    </>
  );
}
