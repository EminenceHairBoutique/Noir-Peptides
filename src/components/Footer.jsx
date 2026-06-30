// src/components/Footer.jsx — Noir Peptides

import React, { useState } from "react";
import { Link } from "react-router-dom";
import { BRAND } from "../config/brand";
import { FOOTER_LEGAL } from "../config/compliance";
import { useUser } from "../context/UserContext";
import { subscribeEmail } from "../utils/subscribe";

const Footer = () => {
  const { authStatus } = useUser();
  const isAuthed = authStatus === "authed";
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle");

  const handleSubscribe = async (e) => {
    e.preventDefault();
    if (!email.trim() || status === "loading") return;
    try {
      setStatus("loading");
      await subscribeEmail({ email, source: "footer_research_updates" });
      setStatus("success");
      setEmail("");
    } catch {
      setStatus("error");
    }
  };

  return (
    <footer className="bg-se-charcoal border-t border-se-concrete mt-0">
      {/* Research updates strip — authed only */}
      {isAuthed && (
        <div className="border-b border-se-concrete">
          <div className="content-wide py-12 md:py-16 flex flex-col md:flex-row items-start md:items-center justify-between gap-8">
            <div>
              <h3 className="font-display text-[20px] md:text-[26px] text-se-bone tracking-[0.04em] mb-2">
                CATALOG &amp; BATCH UPDATES
              </h3>
              <p className="text-[13px] text-se-steel max-w-md font-accent">
                New reference materials, batch documentation, and supply notices
                for qualified researchers. No marketing noise.
              </p>
            </div>
            <form onSubmit={handleSubscribe} className="flex w-full md:w-auto gap-0">
              <input
                type="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setStatus("idle");
                }}
                placeholder="researcher@institution.org"
                aria-label="Email address"
                className="flex-1 md:w-[300px] px-4 py-3 bg-se-asphalt border border-se-concrete text-se-bone text-[13px] font-accent placeholder:text-se-steel focus:outline-none focus:border-se-gold transition"
                required
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className="btn-primary px-6 py-3 text-[10px]"
              >
                {status === "loading" ? "..." : status === "success" ? "Joined" : "Subscribe"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Main grid */}
      <div className="content-wide py-12 md:py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10 md:gap-8">
          {/* Catalog — public (browse without login; purchase is gated) */}
          <div>
            <p className="text-label text-se-gold mb-5">Catalog</p>
            <div className="space-y-3 text-[13px] font-accent">
              <Link to="/shop" className="block text-se-bone/60 hover:text-se-gold transition">Research Catalog</Link>
              <Link to="/shop/tissue-repair-research" className="block text-se-bone/60 hover:text-se-gold transition">Tissue &amp; Repair Research</Link>
              <Link to="/shop/gh-secretagogue-research" className="block text-se-bone/60 hover:text-se-gold transition">GH-Secretagogue Research</Link>
              <Link to="/shop/neuropeptide-research" className="block text-se-bone/60 hover:text-se-gold transition">Neuropeptide Research</Link>
              <Link to="/shop/mitochondrial-metabolic-research" className="block text-se-bone/60 hover:text-se-gold transition">Mitochondrial &amp; Metabolic Research</Link>
              <Link to="/test-results" className="block text-se-bone/60 hover:text-se-gold transition">Test Results (COA Library)</Link>
            </div>
          </div>

          {/* Compliance / trust */}
          <div>
            <p className="text-label text-se-gold mb-5">Compliance</p>
            <div className="space-y-3 text-[13px] font-accent">
              <Link to="/test-results" className="block text-se-bone/60 hover:text-se-gold transition">Test Results &amp; COAs</Link>
              <Link to="/coa-policy" className="block text-se-bone/60 hover:text-se-gold transition">COA Policy</Link>
              <Link to="/quality" className="block text-se-bone/60 hover:text-se-gold transition">Quality &amp; Batch Standards</Link>
              <Link to="/faqs" className="block text-se-bone/60 hover:text-se-gold transition">FAQ</Link>
              <Link to="/legal/research-use-policy" className="block text-se-bone/60 hover:text-se-gold transition">Research-Use Policy</Link>
              <Link to="/legal/fda-disclaimer" className="block text-se-bone/60 hover:text-se-gold transition">FDA Disclaimer</Link>
            </div>
          </div>

          {/* Company — authed only */}
          {isAuthed && (
            <div>
              <p className="text-label text-se-gold mb-5">Company</p>
              <div className="space-y-3 text-[13px] font-accent">
                <Link to="/about" className="block text-se-bone/60 hover:text-se-gold transition">About</Link>
                <Link to="/contact" className="block text-se-bone/60 hover:text-se-gold transition">Contact</Link>
                <Link to="/account" className="block text-se-bone/60 hover:text-se-gold transition">Account</Link>
              </div>
            </div>
          )}

          {/* Legal */}
          <div>
            <p className="text-label text-se-gold mb-5">Legal</p>
            <div className="space-y-3 text-[13px] font-accent">
              <Link to="/legal/terms" className="block text-se-bone/60 hover:text-se-gold transition">Terms &amp; Conditions</Link>
              <Link to="/legal/privacy" className="block text-se-bone/60 hover:text-se-gold transition">Privacy Policy</Link>
              <Link to="/legal/shipping" className="block text-se-bone/60 hover:text-se-gold transition">Shipping &amp; Refunds</Link>
              <a href={`mailto:${BRAND.supportEmail}`} className="block text-se-bone/60 hover:text-se-gold transition">{BRAND.supportEmail}</a>
            </div>
          </div>
        </div>
      </div>

      {/* Brand statement */}
      <div className="border-t border-se-concrete">
        <div className="content-wide py-10 text-center">
          <p className="font-display text-[clamp(1.1rem,3vw,1.8rem)] tracking-[0.16em] text-se-bone/[0.10] leading-tight">
            PRECISION · PURITY · PERFORMANCE
          </p>
        </div>
      </div>

      {/* Mandatory legal copy */}
      <div className="border-t border-se-concrete bg-se-black">
        <div className="content-wide py-8">
          <p className="text-[12px] text-se-bone/80 font-accent max-w-4xl mx-auto text-center mb-3 uppercase tracking-[0.12em]">
            For research use only. Not for human or veterinary use.
          </p>
          <p className="text-[11px] text-se-steel leading-relaxed font-accent max-w-4xl mx-auto text-center">
            {FOOTER_LEGAL}
          </p>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-se-concrete">
        <div className="content-wide py-6 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="font-display text-[14px] tracking-[0.2em] text-se-bone/50 font-extrabold">
              NOIR · PEPTIDES
            </span>
            <span className="text-[10px] text-se-steel tracking-[0.15em] uppercase font-accent">
              {BRAND.subTagline}
            </span>
          </div>

          <div className="flex flex-wrap gap-6 text-[11px] text-se-steel font-accent">
            <Link to="/legal/research-use-policy" className="hover:text-se-gold transition">Research-Use Policy</Link>
            <Link to="/legal/fda-disclaimer" className="hover:text-se-gold transition">FDA Disclaimer</Link>
            <Link to="/legal/privacy" className="hover:text-se-gold transition">Privacy</Link>
            <Link to="/legal/terms" className="hover:text-se-gold transition">Terms</Link>
          </div>

          <p className="text-[11px] text-se-steel font-accent">
            &copy; {new Date().getFullYear()} {BRAND.fullName}
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
