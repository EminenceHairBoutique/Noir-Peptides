// src/pages/About.jsx — Noir Peptides
import React from "react";
import { Link } from "react-router-dom";
import { motion as Motion } from "framer-motion";
import { Microscope, Boxes, ShieldCheck } from "lucide-react";
import SEO from "../components/SEO";
import DisclaimerBanner from "../components/DisclaimerBanner";
import { ABOUT_COPY } from "../data/pageCopy";

const fadeUp = {
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-60px" },
  transition: { duration: 0.7, ease: [0.2, 0, 0, 1] },
};

// Icons are presentational and stay here; all pillar TEXT comes from the
// shared copy module so the prerendered body and the page cannot drift.
const PILLAR_ICONS = [Microscope, Boxes, ShieldCheck];
const PILLARS = ABOUT_COPY.pillars.map((p, i) => ({ ...p, icon: PILLAR_ICONS[i] }));

export default function About() {
  return (
    <>
      <SEO
        title="About Noir Peptides | Research-Only Peptide Materials"
        description="Noir Peptides was built for researchers who need reliable, batch-documented peptide reference materials without the noise of consumer wellness marketing."
      />

      <div className="bg-se-black text-se-bone min-h-screen">
        {/* Hero */}
        <section className="relative pt-36 pb-20 md:pt-44 md:pb-28 border-b border-se-concrete overflow-hidden">
          <div
            className="absolute inset-0 animate-glow-pulse"
            aria-hidden="true"
            style={{
              background:
                "radial-gradient(800px circle at 70% 10%, rgba(0,194,255,0.12), transparent 55%)",
            }}
          />
          <div className="content-wide relative">
            <Motion.div {...fadeUp}>
              <p className="text-overline mb-5">{ABOUT_COPY.overline}</p>
              <h1 className="font-display font-extrabold text-[clamp(2.4rem,7vw,5rem)] leading-[0.95] tracking-[0.01em] mb-7">
                {ABOUT_COPY.headingLines[0]}
                <br />
                <span className="text-se-gold">{ABOUT_COPY.headingLines[1]}</span>
              </h1>
              <p className="text-[clamp(1rem,2.2vw,1.4rem)] text-se-bone/65 leading-relaxed font-accent max-w-2xl">
                {ABOUT_COPY.intro}
              </p>
            </Motion.div>
          </div>
        </section>

        {/* Our Standard */}
        <section className="section-pad border-b border-se-concrete">
          <div className="content-wrap max-w-3xl">
            <Motion.div {...fadeUp}>
              <p className="text-overline mb-4">{ABOUT_COPY.standardOverline}</p>
              <p className="text-[15px] md:text-[17px] text-se-bone/60 leading-relaxed font-accent">
                {ABOUT_COPY.standard}
              </p>
            </Motion.div>
          </div>
        </section>

        {/* Pillars */}
        <section className="section-pad border-b border-se-concrete">
          <div className="content-wide">
            <div className="grid md:grid-cols-3 gap-6">
              {PILLARS.map((p, i) => {
                const Icon = p.icon;
                return (
                  <Motion.div
                    key={p.title}
                    initial={{ opacity: 0, y: 18 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.5, delay: i * 0.1, ease: [0.2, 0, 0, 1] }}
                    className="glass-panel p-8"
                  >
                    <Icon className="w-7 h-7 text-se-gold mb-5" strokeWidth={1.5} />
                    <h3 className="font-display text-[20px] tracking-[0.02em] mb-3">
                      {p.title}
                    </h3>
                    <p className="text-[14px] text-se-bone/50 leading-relaxed font-accent">
                      {p.body}
                    </p>
                  </Motion.div>
                );
              })}
            </div>
          </div>
        </section>

        {/* Compliance banner */}
        <section className="border-b border-se-concrete">
          <div className="content-wide py-10">
            <DisclaimerBanner />
          </div>
        </section>

        <section className="py-16 md:py-24">
          <div className="content-wide text-center">
            <h2 className="font-display text-[clamp(1.4rem,3.5vw,2.2rem)] tracking-[0.02em] mb-6">
              {ABOUT_COPY.ctaHeading}
            </h2>
            <div className="flex justify-center gap-4">
              <Link to="/shop" className="btn-primary">
                Research Catalog
              </Link>
              <Link to="/coa-policy" className="btn-outline">
                COA Policy
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
