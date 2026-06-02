// src/pages/NotFound.jsx — Noir Peptides
import React from "react";
import { Link } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import SEO from "../components/SEO";

export default function NotFound() {
  return (
    <>
      <SEO title="Page Not Found" description="This page doesn't exist." noindex={true} />
      <div className="min-h-screen bg-se-black text-se-bone flex items-center justify-center relative overflow-hidden">
        {/* Background atmosphere */}
        <div className="absolute inset-0 bg-gradient-to-b from-se-black via-se-charcoal/20 to-se-black" />
        <div className="grain-overlay absolute inset-0 opacity-30" />

        <Motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.2, 0, 0, 1] }}
          className="relative z-10 text-center px-6"
        >
          <p className="font-display text-[clamp(6rem,20vw,14rem)] leading-[0.85] tracking-[0.02em] text-se-bone/[0.04] mb-0">
            404
          </p>
          <div className="mt-[-2rem] md:mt-[-3rem]">
            <div className="divider-gold w-16 mx-auto mb-6" />
            <h1 className="font-display font-extrabold text-[clamp(1.5rem,4vw,2.5rem)] tracking-[0.04em] mb-4">
              PAGE NOT FOUND
            </h1>
            <p className="text-[14px] text-se-bone/40 max-w-sm mx-auto mb-10 font-accent">
              The link you followed may be outdated, or the page has been moved.
            </p>
            <div className="flex flex-wrap gap-4 justify-center">
              <Link to="/shop" className="btn-primary">Research Catalog</Link>
              <Link to="/" className="btn-outline">Home</Link>
            </div>
          </div>
        </Motion.div>
      </div>
    </>
  );
}
