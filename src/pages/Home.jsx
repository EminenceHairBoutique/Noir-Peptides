// src/pages/Home.jsx — Noir Peptides Homepage

import React from "react";
import { Link } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import {
  ArrowRight,
  ChevronRight,
  FlaskConical,
  FileCheck2,
  Snowflake,
  ShieldCheck,
} from "lucide-react";
import { categories, getFeaturedProducts } from "../data/products";
import ProductCard from "../components/ProductCard";
import BrandPromise from "../components/BrandPromise";
import DisclaimerBanner from "../components/DisclaimerBanner";
import SEO from "../components/SEO";
import { HERO_DISCLAIMER } from "../config/compliance";

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.7, ease: [0.2, 0, 0, 1] },
};

const FAQ_PREVIEW = [
  {
    q: "Are these products for human use?",
    a: "No. They are not for human or veterinary use. All materials are supplied exclusively for in vitro laboratory research.",
  },
  {
    q: "Are these products drugs or supplements?",
    a: "No. They are sold as laboratory research materials only and are not intended to diagnose, treat, cure, or prevent disease.",
  },
  {
    q: "What is a Certificate of Analysis?",
    a: "A batch-specific document reporting analytical identity and purity testing for the material as supplied.",
  },
];

export default function Home() {
  const featured = getFeaturedProducts().slice(0, 8);

  return (
    <>
      <SEO
        title="Noir Peptides | Research-Grade Peptide Materials"
        description="Batch-documented peptide reference materials for laboratory research. COA available. For research use only. Not for human or veterinary use."
      />

      <div className="bg-se-black text-se-bone">
        {/* ═══════════════════ HERO ═══════════════════ */}
        <section className="relative overflow-hidden border-b border-se-concrete">
          <div
            className="absolute inset-0 animate-glow-pulse"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(900px circle at 80% 20%, rgba(0,194,255,0.14), transparent 55%)",
            }}
          />
          <div className="content-wide relative pt-36 pb-20 md:pt-44 md:pb-28">
            <div className="grid lg:grid-cols-2 gap-14 items-center">
              {/* Copy */}
              <Motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, ease: [0.2, 0, 0, 1] }}
              >
                <p className="text-overline mb-5">Research-Grade Peptides</p>
                <h1 className="font-display font-extrabold text-se-bone leading-[0.92] tracking-[0.01em] text-[clamp(2.8rem,7vw,5.5rem)] mb-6">
                  ENGINEERED
                  <br />
                  FOR <span className="text-se-gold">RESEARCH.</span>
                </h1>
                <p className="text-[15px] md:text-[16px] text-se-bone/55 leading-relaxed max-w-md mb-8 font-accent">
                  Precision-synthesized research materials. Third-party tested.
                  Batch-documented. COA verified.
                </p>

                <div className="flex flex-wrap gap-4 mb-6">
                  <Link to="/shop" className="btn-primary">
                    Browse Research Catalog
                    <ArrowRight size={14} />
                  </Link>
                  <Link to="/coa-policy" className="btn-outline">
                    View COA Policy
                  </Link>
                </div>

                <p className="text-[11px] font-accent uppercase tracking-[0.16em] text-se-steel">
                  {HERO_DISCLAIMER}
                </p>
              </Motion.div>

              {/* Visual — abstract vial cards */}
              <Motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, ease: [0.2, 0, 0, 1] }}
                className="relative grid grid-cols-2 gap-4"
                aria-hidden="true"
              >
                {[
                  { label: "BPC-157", spec: "5 mg · ≥ 99%" },
                  { label: "CJC-1295", spec: "2 mg · ≥ 98%" },
                  { label: "NAD+", spec: "500 mg · ≥ 99%" },
                  { label: "GHK-Cu", spec: "50 mg · ≥ 99%" },
                ].map((v, i) => (
                  <div
                    key={v.label}
                    className={`glass-panel p-5 ${i % 2 === 1 ? "mt-8" : ""}`}
                  >
                    <div className="vial-visual aspect-[3/4] mb-4" />
                    <p className="font-display text-[15px] tracking-[0.04em] text-se-bone">
                      {v.label}
                    </p>
                    <p className="text-[10px] font-accent text-se-gold tracking-[0.14em] uppercase mt-1">
                      {v.spec}
                    </p>
                  </div>
                ))}
              </Motion.div>
            </div>
          </div>
        </section>

        {/* ═══════════════════ TECHNICAL MARQUEE ═══════════════════ */}
        <div className="border-b border-se-concrete overflow-hidden bg-se-black py-4">
          <div
            className="animate-marquee flex items-center gap-12 whitespace-nowrap"
            style={{ width: "max-content" }}
          >
            {[...Array(2)].map((_, setIdx) => (
              <React.Fragment key={setIdx}>
                {[
                  "COA VERIFIED",
                  "◆",
                  "THIRD-PARTY TESTED",
                  "◆",
                  "BATCH TRACEABLE",
                  "◆",
                  "LYOPHILIZED RESEARCH MATERIAL",
                  "◆",
                  "IN VITRO LABORATORY RESEARCH",
                  "◆",
                  "QUALIFIED RESEARCHERS",
                  "◆",
                ].map((text, i) => (
                  <span
                    key={`${setIdx}-${i}`}
                    className={`font-accent text-[11px] md:text-[12px] tracking-[0.25em] ${
                      text === "◆" ? "text-se-gold/50 text-[8px]" : "text-se-bone/25"
                    }`}
                  >
                    {text}
                  </span>
                ))}
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* ═══════════════════ 1. RESEARCH CATALOG TEASER ═══════════════════ */}
        <section className="section-pad">
          <div className="content-wide">
            <Motion.div {...fadeUp} className="mb-10 md:mb-14">
              <p className="text-overline mb-2">Research Domains</p>
              <h2 className="font-display text-[clamp(1.6rem,4vw,2.6rem)] tracking-[0.02em]">
                THE CATALOG
              </h2>
              <p className="text-[14px] text-se-bone/45 mt-3 max-w-lg font-accent">
                Batch-documented peptide reference materials organized by
                research domain.
              </p>
            </Motion.div>

            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {categories.map((cat, i) => (
                <Motion.div
                  key={cat.slug}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: i * 0.06, ease: [0.2, 0, 0, 1] }}
                >
                  <Link
                    to={`/shop/${cat.slug}`}
                    className="group block glass-panel card-hover p-6 h-full"
                  >
                    <div className="flex items-start justify-between mb-6">
                      <FlaskConical
                        className="w-5 h-5 text-se-gold"
                        strokeWidth={1.5}
                      />
                      <ChevronRight
                        size={16}
                        className="text-se-steel group-hover:text-se-gold transition"
                      />
                    </div>
                    <h3 className="font-display text-[17px] tracking-[0.02em] mb-2">
                      {cat.name}
                    </h3>
                    <p className="text-[12px] text-se-bone/45 leading-relaxed font-accent">
                      {cat.description}
                    </p>
                  </Link>
                </Motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══════════════════ 2 & 3. TRANSPARENCY + COLD CHAIN ═══════════════════ */}
        <section className="section-pad border-t border-se-concrete">
          <div className="content-wide grid md:grid-cols-2 gap-6">
            <Motion.div {...fadeUp} className="glass-panel p-8 md:p-10">
              <FileCheck2 className="w-7 h-7 text-se-gold mb-5" strokeWidth={1.5} />
              <h3 className="font-display text-[20px] tracking-[0.02em] mb-4">
                BATCH TRANSPARENCY · COA VERIFIED
              </h3>
              <p className="text-[14px] text-se-bone/50 leading-relaxed mb-4 font-accent">
                Every listed material is positioned around analytical
                transparency. Batch numbers, identity, and purity testing are
                documented and available to qualified researchers.
              </p>
              <Link
                to="/coa-policy"
                className="inline-flex items-center gap-2 text-[11px] font-accent uppercase tracking-[0.18em] text-se-gold hover:gap-3 transition-all"
              >
                Read COA Policy <ArrowRight size={14} />
              </Link>
            </Motion.div>

            <Motion.div {...fadeUp} className="glass-panel p-8 md:p-10">
              <Snowflake className="w-7 h-7 text-se-gold mb-5" strokeWidth={1.5} />
              <h3 className="font-display text-[20px] tracking-[0.02em] mb-4">
                COLD-CHAIN HANDLING &amp; STORAGE
              </h3>
              <p className="text-[14px] text-se-bone/50 leading-relaxed mb-4 font-accent">
                Lyophilized materials are packaged for stable transit and
                labeled with storage conditions. Handling and storage follow
                your institution's laboratory SOP.
              </p>
              <Link
                to="/faqs"
                className="inline-flex items-center gap-2 text-[11px] font-accent uppercase tracking-[0.18em] text-se-gold hover:gap-3 transition-all"
              >
                Storage &amp; Shipping FAQ <ArrowRight size={14} />
              </Link>
            </Motion.div>
          </div>
        </section>

        {/* ═══════════════════ 4. COMPLIANCE BANNER ═══════════════════ */}
        <section className="border-t border-se-concrete">
          <div className="content-wide py-10">
            <DisclaimerBanner />
          </div>
        </section>

        {/* ═══════════════════ 5. FEATURED MATERIALS ═══════════════════ */}
        <section className="section-pad border-t border-se-concrete">
          <div className="content-wide">
            <Motion.div {...fadeUp} className="flex items-end justify-between mb-10 md:mb-14">
              <div>
                <p className="text-overline mb-2">Featured</p>
                <h2 className="font-display text-[clamp(1.6rem,4vw,2.6rem)] tracking-[0.02em]">
                  RESEARCH MATERIALS
                </h2>
              </div>
              <Link
                to="/shop"
                className="hidden md:flex items-center gap-2 text-[11px] font-accent uppercase tracking-[0.18em] text-se-bone/50 hover:text-se-gold transition"
              >
                Full Catalog <ArrowRight size={14} />
              </Link>
            </Motion.div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
              {featured.map((product, i) => (
                <Motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 18 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true, margin: "-40px" }}
                  transition={{ duration: 0.5, delay: i * 0.06, ease: [0.2, 0, 0, 1] }}
                >
                  <ProductCard product={product} />
                </Motion.div>
              ))}
            </div>

            <div className="mt-10 text-center md:hidden">
              <Link to="/shop" className="btn-outline">
                View Full Catalog
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════════════ 6. TRUST ROW ═══════════════════ */}
        <BrandPromise />

        {/* ═══════════════════ 7. FAQ PREVIEW ═══════════════════ */}
        <section className="section-pad border-t border-se-concrete">
          <div className="content-wrap max-w-3xl">
            <Motion.div {...fadeUp} className="text-center mb-12">
              <p className="text-overline mb-2">Common Questions</p>
              <h2 className="font-display text-[clamp(1.6rem,4vw,2.6rem)] tracking-[0.02em]">
                BEFORE YOU ORDER
              </h2>
            </Motion.div>

            <div className="space-y-px">
              {FAQ_PREVIEW.map((item) => (
                <div
                  key={item.q}
                  className="glass-panel p-6 border-b-0 last:border-b"
                >
                  <h3 className="font-display text-[15px] tracking-[0.02em] text-se-bone mb-2">
                    {item.q}
                  </h3>
                  <p className="text-[13px] text-se-bone/50 leading-relaxed font-accent">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>

            <div className="text-center mt-10">
              <Link to="/faqs" className="btn-outline">
                All FAQ
              </Link>
            </div>
          </div>
        </section>

        {/* ═══════════════════ COMPLIANCE CLOSER ═══════════════════ */}
        <section className="border-t border-se-concrete">
          <div className="content-wide py-16 text-center">
            <ShieldCheck className="w-8 h-8 text-se-gold mx-auto mb-5" strokeWidth={1.5} />
            <h2 className="font-display text-[clamp(1.4rem,3.5vw,2.2rem)] tracking-[0.02em] mb-4">
              RESEARCH-ONLY INTEGRITY
            </h2>
            <p className="text-[14px] text-se-bone/45 max-w-xl mx-auto leading-relaxed font-accent mb-8">
              No human-use claims. No therapeutic claims. No dosage language.
              Just documented research materials, supplied to qualified
              researchers.
            </p>
            <Link to="/disclaimer" className="btn-outline">
              Research Use Disclaimer
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
