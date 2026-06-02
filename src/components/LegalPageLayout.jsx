// src/components/LegalPageLayout.jsx
import React from "react";
import SEO from "./SEO";
import LegalDoc from "./LegalDoc";
import DisclaimerBanner from "./DisclaimerBanner";

export default function LegalPageLayout({ seoTitle, seoDescription, content }) {
  return (
    <>
      <SEO title={seoTitle} description={seoDescription} />
      <div className="bg-se-black text-se-bone min-h-screen">
        <section className="pt-32 pb-12 md:pt-40 border-b border-se-concrete">
          <div className="content-wrap max-w-3xl">
            <p className="text-overline mb-4">Noir Peptides</p>
            <DisclaimerBanner />
          </div>
        </section>
        <section className="py-14 md:py-20">
          <div className="content-wrap max-w-3xl">
            <LegalDoc content={content} />
            <div className="mt-14 pt-8 border-t border-se-concrete">
              <DisclaimerBanner />
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
