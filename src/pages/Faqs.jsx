// src/pages/Faqs.jsx — Noir Peptides
import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown } from "lucide-react";
import SEO from "../components/SEO";
import DisclaimerBanner from "../components/DisclaimerBanner";

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

const FAQS = [
  {
    q: "What are research peptides?",
    a: "Research peptides are peptide reference materials supplied for controlled laboratory research. Noir Peptides products are not sold for human consumption, veterinary use, diagnostic use, therapeutic use, or any in vivo application.",
  },
  {
    q: "Are Noir Peptides products for human use?",
    a: "No. All Noir Peptides products are sold exclusively for laboratory research use by qualified purchasers. They are not intended for human consumption, veterinary use, diagnostic use, therapeutic use, or clinical use.",
  },
  {
    q: "Are these products drugs or dietary supplements?",
    a: "No. Noir Peptides products are not drugs, dietary supplements, cosmetics, medical devices, or approved pharmaceutical products. They are research materials only.",
  },
  {
    q: "Can Noir Peptides provide dosing, administration, or reconstitution instructions?",
    a: "No. Noir Peptides does not provide dosing, administration, injection, ingestion, topical-use, reconstitution-ratio, cycle, stacking, or human/veterinary-use guidance. Purchasers are responsible for following their institution's laboratory procedures and applicable regulations.",
  },
  {
    q: "What is a Certificate of Analysis?",
    a: "A Certificate of Analysis, or COA, is a document that may provide batch-specific analytical information such as product identity, purity, and testing details. A COA is provided for research documentation only and does not indicate approval for human or veterinary use.",
  },
  {
    q: "How should products be stored?",
    a: "Storage requirements vary by product and batch. Product pages may list storage information such as “store frozen,” “protect from light,” or other handling notes. Purchasers are responsible for reviewing product-specific storage information and following appropriate laboratory handling procedures.",
  },
  {
    q: "Who may purchase from Noir Peptides?",
    a: "Purchasers must be qualified to acquire and handle laboratory research materials. By placing an order, the purchaser confirms that products will be used only for lawful laboratory research and not for human or veterinary use.",
  },
  {
    q: "Do you ship cold-chain?",
    a: "Some products may be shipped with insulated packaging or cold packs when appropriate. Packaging is designed to support product integrity during normal transit but does not guarantee a specific temperature upon delivery.",
  },
  {
    q: "Do you offer bulk or wholesale orders?",
    a: "Qualified purchasers may contact Noir Peptides for research supply inquiries, bulk availability, or batch documentation requests.",
  },
  {
    q: "Can I return research materials?",
    a: "Due to chain-of-custody, product-integrity, and temperature-sensitivity concerns, all sales are final once shipped. Please review our Shipping & Refunds Policy for details.",
  },
];

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
              FREQUENTLY ASKED
              <br />
              QUESTIONS
            </h1>
            <p className="text-[15px] text-se-bone/45 max-w-2xl font-accent leading-relaxed">
              Answers to common questions about Noir Peptides, research-use
              restrictions, batch documentation, storage, shipping, and
              purchaser responsibilities.
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
