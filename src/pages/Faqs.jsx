// src/pages/Faqs.jsx — Noir Peptides
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import SEO from "../components/SEO";
import DisclaimerBanner from "../components/DisclaimerBanner";
import { FAQS, FAQ_HEADING_LINES, FAQ_INTRO } from "../data/faqs";

function FaqItem({ q, a, open, onToggle }) {
  return (
    <div className="border-b border-se-concrete">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-4 py-5 text-left"
      >
        <span className="text-[15px] text-se-bone font-display tracking-[0.02em]">
          {q}
        </span>
        <ChevronDown
          className={`h-4 w-4 text-se-steel shrink-0 transition-transform ${
            open ? "rotate-180 text-se-gold" : ""
          }`}
        />
      </button>
      {open && (
        <div className="pb-5 text-[14px] text-se-bone/55 leading-relaxed font-accent">
          {a}
        </div>
      )}
    </div>
  );
}


export default function Faqs() {
  const [openId, setOpenId] = useState(0);

  return (
    <>
      <SEO
        title="FAQ | Noir Peptides"
        description="Frequently asked questions about Noir Peptides research materials, COA documentation, storage, shipping, and purchaser responsibilities."
      />

      <div className="bg-se-black text-se-bone min-h-screen">
        <section className="pt-32 pb-16 md:pt-40 md:pb-20 border-b border-se-concrete">
          <div className="content-wide">
            <p className="text-overline mb-4">Support</p>
            <h1 className="font-display font-extrabold text-[clamp(2rem,6vw,4rem)] tracking-[0.01em] mb-5">
              {FAQ_HEADING_LINES.map((line, i) => (
                <React.Fragment key={line}>
                  {i > 0 && <br />}
                  {line}
                </React.Fragment>
              ))}
            </h1>
            <p className="text-[15px] text-se-bone/45 max-w-2xl font-accent leading-relaxed">
              {FAQ_INTRO}
            </p>
          </div>
        </section>

        <section className="section-pad">
          <div className="content-wrap max-w-3xl">
            <DisclaimerBanner className="mb-10" />
            {FAQS.map((item, i) => (
              <FaqItem
                key={i}
                q={item.q}
                a={item.a}
                open={openId === i}
                onToggle={() => setOpenId(openId === i ? null : i)}
              />
            ))}
            <div className="mt-12">
              <DisclaimerBanner />
            </div>
          </div>
        </section>

        <section className="pb-20 md:pb-28 border-t border-se-concrete">
          <div className="content-wide text-center pt-16">
            <p className="text-overline mb-3">Still have questions?</p>
            <h2 className="font-display text-[20px] tracking-[0.04em] mb-6">
              CONTACT OUR TEAM
            </h2>
            <Link to="/contact" className="btn-outline">
              Contact Us
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
