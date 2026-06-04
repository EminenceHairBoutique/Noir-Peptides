// src/pages/ResearchArticle.jsx — PUBLIC, indexable article page.
// No price, no buy button — funnels to registration. Article JSON-LD only.
import React from "react";
import { Link, useParams, Navigate } from "react-router-dom";
import { ChevronLeft, ArrowRight } from "lucide-react";
import SEO from "../components/SEO";
import DisclaimerBanner from "../components/DisclaimerBanner";
import { getResearchArticle, researchArticles } from "../data/research";

export default function ResearchArticle() {
  const { slug } = useParams();
  const article = getResearchArticle(slug);

  if (!article) return <Navigate to="/research" replace />;

  const others = researchArticles.filter((a) => a.slug !== article.slug).slice(0, 2);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: article.title,
    description: article.summary,
    author: { "@type": "Organization", name: "Noir Peptides" },
    publisher: { "@type": "Organization", name: "Noir Peptides" },
    articleSection: "Research & Education",
  };

  return (
    <>
      <SEO
        title={`${article.title} | Noir Peptides`}
        description={article.summary}
        type="article"
        jsonLd={jsonLd}
      />

      <article className="bg-se-black text-se-bone min-h-screen">
        <div className="content-wrap max-w-3xl pt-28 pb-4">
          <Link
            to="/research"
            className="inline-flex items-center gap-1.5 text-se-steel hover:text-se-gold text-[11px] font-accent tracking-[0.15em] uppercase transition-colors"
          >
            <ChevronLeft size={14} /> Research &amp; Education
          </Link>
        </div>

        <div className="content-wrap max-w-3xl pb-16">
          <p className="text-overline mb-3">Research &amp; Education</p>
          <h1 className="font-display font-extrabold text-3xl md:text-4xl leading-tight mb-4">
            {article.title}
          </h1>
          <p className="text-[15px] text-se-bone/55 font-accent mb-8">{article.summary}</p>

          <DisclaimerBanner className="mb-10" />

          <div className="space-y-8">
            {article.sections.map((s) => (
              <section key={s.heading}>
                <h2 className="font-display text-[18px] tracking-[0.02em] text-se-gold mb-3">
                  {s.heading}
                </h2>
                <p className="text-[14px] text-se-bone/70 leading-relaxed font-accent">
                  {s.body}
                </p>
              </section>
            ))}
          </div>

          <div className="mt-12 glass-panel p-6 text-center">
            <p className="text-[14px] text-se-bone/60 font-accent mb-5">
              Batch-documented materials and certificates of analysis are
              available to verified researchers.
            </p>
            <Link to="/register" className="btn-primary">
              Create a Researcher Account <ArrowRight size={14} />
            </Link>
          </div>

          {others.length > 0 && (
            <div className="mt-14 border-t border-se-concrete pt-8">
              <p className="text-overline mb-5">Keep reading</p>
              <div className="grid sm:grid-cols-2 gap-4">
                {others.map((a) => (
                  <Link
                    key={a.slug}
                    to={`/research/${a.slug}`}
                    className="glass-panel card-hover p-5"
                  >
                    <h3 className="font-display text-[15px] tracking-[0.02em] mb-2">
                      {a.title}
                    </h3>
                    <p className="text-[12px] text-se-bone/45 font-accent">{a.summary}</p>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </div>
      </article>
    </>
  );
}
