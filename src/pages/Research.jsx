// src/pages/Research.jsx — PUBLIC, indexable research/education index.
// No prices, no buy buttons. Funnels qualified researchers to registration.
import React from "react";
import { Link } from "react-router-dom";
import { ArrowRight, BookOpen } from "lucide-react";
import SEO from "../components/SEO";
import { researchArticles } from "../data/research";

export default function Research() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Research & Education — Noir Peptides",
    description:
      "Educational articles on analytical methods, certificates of analysis, and how peptide reference materials are studied in the laboratory.",
    hasPart: researchArticles.map((a) => ({
      "@type": "Article",
      headline: a.title,
      description: a.summary,
      url: `/research/${a.slug}`,
    })),
  };

  return (
    <>
      <SEO
        title="Research & Education | Noir Peptides"
        description="Educational articles on certificates of analysis, HPLC purity, and how peptide reference materials are studied in the laboratory. For research use only."
        jsonLd={jsonLd}
      />

      <div className="bg-se-black text-se-bone min-h-screen">
        <section className="pt-32 pb-10 md:pt-40 border-b border-se-concrete">
          <div className="content-wide">
            <p className="text-overline mb-2">Research &amp; Education</p>
            <h1 className="font-display font-extrabold text-[clamp(2rem,6vw,4rem)] leading-[0.95]">
              THE REFERENCE LIBRARY
            </h1>
            <p className="text-[14px] text-se-bone/50 mt-4 max-w-2xl font-accent">
              Background on analytical methods and how research materials are
              documented and studied. Educational only — for laboratory research
              use, not for human or veterinary use.
            </p>
          </div>
        </section>

        <section className="section-pad">
          <div className="content-wide grid md:grid-cols-3 gap-6">
            {researchArticles.map((a) => (
              <Link
                key={a.slug}
                to={`/research/${a.slug}`}
                className="group glass-panel card-hover p-6 flex flex-col"
              >
                <BookOpen className="w-5 h-5 text-se-gold mb-5" strokeWidth={1.5} />
                <h2 className="font-display text-[18px] tracking-[0.02em] mb-3">
                  {a.title}
                </h2>
                <p className="text-[13px] text-se-bone/50 leading-relaxed font-accent flex-1">
                  {a.summary}
                </p>
                <span className="mt-5 inline-flex items-center gap-2 text-[11px] font-accent uppercase tracking-[0.18em] text-se-gold group-hover:gap-3 transition-all">
                  Read {a.readingTime} <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="border-t border-se-concrete">
          <div className="content-wide py-16 text-center">
            <h2 className="font-display text-[clamp(1.4rem,3.5vw,2.2rem)] tracking-[0.02em] mb-4">
              ACCESS THE RESEARCH CATALOG
            </h2>
            <p className="text-[14px] text-se-bone/45 max-w-xl mx-auto leading-relaxed font-accent mb-8">
              The full batch-documented catalog and certificates of analysis are
              available to verified researchers after a brief research-use
              attestation.
            </p>
            <Link to="/register" className="btn-primary">
              Create a Researcher Account <ArrowRight size={14} />
            </Link>
          </div>
        </section>
      </div>
    </>
  );
}
