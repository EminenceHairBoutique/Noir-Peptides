// src/pages/Deals.jsx — PUBLIC deals page. Lists active public promo codes
// (RLS allows reading is_public + active discounts) plus the standing bundle
// ladder. Claim-safe; funnels to registration. No prices implied as benefits.
import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Tag, ArrowRight, Package } from "lucide-react";
import SEO from "../components/SEO";
import { supabase } from "../lib/supabaseClient";

const offerLabel = (d) =>
  d.kind === "percent" ? `${Number(d.value)}% off` : `$${Number(d.value)} off`;

export default function Deals() {
  const [codes, setCodes] = useState([]);

  useEffect(() => {
    let active = true;
    if (!supabase) return;
    supabase
      .from("discounts")
      .select("code, description, kind, value, min_subtotal")
      .eq("is_public", true)
      .eq("active", true)
      .then(({ data }) => {
        if (active && Array.isArray(data)) setCodes(data);
      });
    return () => {
      active = false;
    };
  }, []);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "Deals & Bundle Pricing — Noir Peptides",
    description:
      "Current promotional codes and the volume bundle ladder for research reference materials. For research use only.",
  };

  return (
    <>
      <SEO
        title="Deals & Bundle Pricing | Noir Peptides"
        description="Current promo codes and volume bundle pricing (1/2/3/5/10 vials) for research reference materials. For research use only. Not for human or veterinary use."
        jsonLd={jsonLd}
      />
      <div className="bg-se-black text-se-bone min-h-screen">
        <section className="pt-32 pb-10 md:pt-40 border-b border-se-concrete">
          <div className="content-wide">
            <p className="text-overline mb-2">Deals</p>
            <h1 className="font-display font-extrabold text-[clamp(2rem,6vw,4rem)] leading-[0.95]">
              OFFERS &amp; BUNDLE PRICING
            </h1>
            <p className="text-[14px] text-se-bone/50 mt-4 max-w-2xl font-accent">
              Promotional codes and volume pricing for qualified researchers. All
              materials are supplied for laboratory research use only.
            </p>
          </div>
        </section>

        <section className="section-pad">
          <div className="content-wide">
            {codes.length > 0 && (
              <div className="grid md:grid-cols-3 gap-6 mb-12">
                {codes.map((d) => (
                  <div key={d.code} className="glass-panel p-6">
                    <Tag className="w-5 h-5 text-se-gold mb-4" strokeWidth={1.5} />
                    <p className="font-display text-[20px] tracking-[0.04em] text-se-bone">
                      {offerLabel(d)}
                    </p>
                    <code className="inline-block my-3 text-[13px] font-accent tracking-[0.14em] bg-se-asphalt border border-se-concrete px-3 py-1.5 text-se-gold">
                      {d.code}
                    </code>
                    <p className="text-[12px] text-se-bone/55 font-accent leading-relaxed">
                      {d.description}
                    </p>
                    {Number(d.min_subtotal) > 0 && (
                      <p className="text-[10px] text-se-steel font-accent mt-2 uppercase tracking-[0.12em]">
                        Min eligible subtotal ${Number(d.min_subtotal)}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Standing bundle ladder */}
            <div className="glass-panel p-6 md:p-8">
              <div className="flex items-center gap-2 mb-5">
                <Package className="w-5 h-5 text-se-gold" strokeWidth={1.5} />
                <h2 className="font-display text-[18px] tracking-[0.04em]">
                  VOLUME BUNDLE PRICING
                </h2>
              </div>
              <p className="text-[13px] text-se-bone/55 font-accent mb-5">
                Every vial size uses the same buy-more-save-more ladder. Free US
                shipping at $200.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                {[
                  ["1 vial", "—"],
                  ["2 vials", "5% off"],
                  ["3 vials", "10% off"],
                  ["5 vials", "15% off"],
                  ["10 vials", "22% off"],
                ].map(([q, s]) => (
                  <div
                    key={q}
                    className="border border-se-concrete p-4 text-center"
                  >
                    <p className="text-[13px] font-accent text-se-bone">{q}</p>
                    <p className="text-[12px] font-accent text-se-gold mt-1">{s}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="text-center mt-12">
              <Link to="/register" className="btn-primary">
                Create a Researcher Account <ArrowRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
