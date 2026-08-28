// src/pages/PublicLanding.jsx
// The ONLY storefront-adjacent page reachable while logged out. No product,
// pricing, or COA content — brand mark, one-line RUO statement, and the two
// auth entry points. Authenticated + attested users are sent into the store.
import React from "react";
import { Link, Navigate } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import SEO from "../components/SEO";
import { useUser } from "../context/UserContext";
import { HERO_DISCLAIMER } from "../config/compliance";

export default function PublicLanding() {
  const { authStatus, attestationComplete } = useUser();

  // Already through the wall → into the store.
  if (authStatus === "authed" && attestationComplete) {
    return <Navigate to="/home" replace />;
  }

  return (
    <>
      <SEO
        title="Noir Peptides | Research-Grade Peptide Materials"
        description="Batch-documented peptide reference materials for qualified laboratory research. Account and research-use attestation required. For research use only — not for human or veterinary use."
      />

      <main className="relative min-h-screen bg-se-black text-se-bone overflow-hidden flex flex-col">
        {/* Atmosphere */}
        <div
          className="absolute inset-0 animate-glow-pulse"
          aria-hidden="true"
          style={{
            background:
              "radial-gradient(900px circle at 50% 0%, rgba(0,194,255,0.12), transparent 60%)",
          }}
        />
        <div className="grain-overlay absolute inset-0" aria-hidden="true" />

        <div className="relative flex-1 flex flex-col items-center justify-center px-6 text-center">
          <Motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, ease: [0.2, 0, 0, 1] }}
            className="max-w-2xl"
          >
            {/* Wordmark */}
            <div className="flex items-center justify-center gap-3 mb-8">
              <span className="font-display text-[clamp(1.8rem,5vw,3rem)] tracking-[0.22em] text-se-bone font-extrabold">
                NOIR
              </span>
              <span
                className="inline-block w-2.5 h-2.5 rounded-full bg-se-gold"
                aria-hidden="true"
                style={{ boxShadow: "0 0 14px rgba(0,194,255,0.9)" }}
              />
              <span className="font-display text-[clamp(1.8rem,5vw,3rem)] tracking-[0.22em] text-se-bone font-extrabold">
                PEPTIDES
              </span>
            </div>

            <p className="text-overline mb-6">Precision · Purity · Provenance</p>

            <p className="text-[15px] md:text-[16px] text-se-bone/60 font-accent leading-relaxed max-w-lg mx-auto mb-2">
              A research-grade peptide reference catalog for qualified
              purchasers. Access requires an account and a completed research-use
              attestation.
            </p>
            <p className="text-[11px] font-accent uppercase tracking-[0.18em] text-se-steel mb-10">
              {HERO_DISCLAIMER}
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/login" className="btn-primary min-w-[180px]">
                Log In
              </Link>
              <Link to="/register" className="btn-outline min-w-[180px]">
                Create Account
              </Link>
            </div>
          </Motion.div>
        </div>

        {/* Minimal public footer — legal links only (crawlable, allowed) */}
        <div className="relative border-t border-se-concrete">
          <div className="content-wide py-6 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-[10px] font-accent uppercase tracking-[0.18em] text-se-steel">
              © {new Date().getFullYear()} Noir Peptides
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-2 justify-center text-[11px] font-accent text-se-steel">
              <Link to="/legal/research-use-policy" className="hover:text-se-gold transition">Research-Use Policy</Link>
              <Link to="/legal/fda-disclaimer" className="hover:text-se-gold transition">FDA Disclaimer</Link>
              <Link to="/legal/terms" className="hover:text-se-gold transition">Terms</Link>
              <Link to="/legal/privacy" className="hover:text-se-gold transition">Privacy</Link>
              <Link to="/legal/shipping" className="hover:text-se-gold transition">Shipping</Link>
            </div>
          </div>
          <div className="content-wide pb-6">
            <p className="text-[10px] text-se-steel/80 leading-relaxed font-accent max-w-3xl mx-auto text-center">
              All products are sold strictly for laboratory and research use
              only. Not for human or animal consumption. Not drugs, food, or
              cosmetics. Not evaluated by the FDA and not intended to diagnose,
              treat, cure, or prevent any disease.
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
