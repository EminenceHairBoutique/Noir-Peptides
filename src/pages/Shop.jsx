// src/pages/Shop.jsx — Noir Peptides Research Catalog
import React, { useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Search } from "lucide-react";
import { motion as Motion } from "framer-motion";

import { products, categories } from "../data/products";
import ProductCard from "../components/ProductCard";
import DisclaimerBanner from "../components/DisclaimerBanner";
import SEO from "../components/SEO";

const SORT_OPTIONS = [
  { key: "featured", label: "Featured" },
  { key: "price-asc", label: "Price: Low to High" },
  { key: "price-desc", label: "Price: High to Low" },
  { key: "purity-desc", label: "Purity: High to Low" },
];

export default function Shop() {
  const { category: categorySlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");

  const sortParam = searchParams.get("sort") || "featured";
  const activeCategory =
    categories.find((c) => c.slug === categorySlug) || null;

  const filtered = useMemo(() => {
    let result = [...products];

    if (activeCategory) {
      result = result.filter((p) => p.category_slug === activeCategory.slug);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((p) => {
        const cat =
          categories.find((c) => c.slug === p.category_slug)?.name || "";
        return [
          p.name,
          p.cas_number,
          p.batch_number,
          p.category_slug,
          cat,
          p.peptide_sequence,
        ]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      });
    }

    switch (sortParam) {
      case "price-asc":
        result.sort((a, b) => a.price - b.price);
        break;
      case "price-desc":
        result.sort((a, b) => b.price - a.price);
        break;
      case "purity-desc":
        result.sort(
          (a, b) => (b.purity_percent || 0) - (a.purity_percent || 0)
        );
        break;
      default:
        result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    }

    return result;
  }, [activeCategory, query, sortParam]);

  const updateSort = (value) => {
    const p = new URLSearchParams(searchParams);
    if (value && value !== "featured") p.set("sort", value);
    else p.delete("sort");
    setSearchParams(p, { replace: true });
  };

  const pageTitle = activeCategory ? activeCategory.name : "Research Catalog";

  return (
    <>
      <SEO
        title="Research Catalog | Noir Peptides"
        description="Batch-documented peptide reference materials for qualified laboratory research. COA available. For research use only. Not for human or veterinary use."
      />

      <div className="bg-se-black text-se-bone min-h-screen">
        {/* Header */}
        <section className="pt-32 pb-8 md:pt-40 md:pb-12 border-b border-se-concrete">
          <div className="content-wide">
            <p className="text-overline mb-2">Noir Peptides</p>
            <h1 className="font-display font-extrabold text-[clamp(2rem,6vw,4rem)] leading-[0.95] tracking-[0.01em]">
              {pageTitle.toUpperCase()}
            </h1>
            <p className="text-[14px] text-se-bone/45 mt-4 max-w-xl font-accent">
              {activeCategory
                ? activeCategory.description
                : "Batch-documented peptide reference materials for qualified laboratory research."}
            </p>
          </div>
        </section>

        {/* Filter / sort / search bar */}
        <div className="border-b border-se-concrete sticky top-0 z-30 bg-se-black/95 backdrop-blur-sm">
          <div className="content-wide py-4">
            <div className="flex items-center gap-6 overflow-x-auto pb-3 scrollbar-hide">
              <Link
                to="/shop"
                className={`text-[11px] font-accent uppercase tracking-[0.18em] whitespace-nowrap transition ${
                  !activeCategory ? "text-se-gold" : "text-se-steel hover:text-se-bone"
                }`}
              >
                All
              </Link>
              {categories.map((cat) => (
                <Link
                  key={cat.slug}
                  to={`/shop/${cat.slug}`}
                  className={`text-[11px] font-accent uppercase tracking-[0.18em] whitespace-nowrap transition ${
                    activeCategory?.slug === cat.slug
                      ? "text-se-gold"
                      : "text-se-steel hover:text-se-bone"
                  }`}
                >
                  {cat.name}
                </Link>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-3 pt-3 border-t border-se-concrete">
              <div className="relative flex-1 max-w-sm">
                <Search
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-se-steel"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, CAS, batch, category"
                  aria-label="Search research materials"
                  className="w-full pl-9 pr-3 py-2 bg-se-charcoal border border-se-concrete text-se-bone text-[12px] font-accent placeholder:text-se-steel focus:outline-none focus:border-se-gold transition"
                />
              </div>

              <div className="flex items-center gap-3">
                <span className="text-[10px] text-se-steel font-accent whitespace-nowrap">
                  {filtered.length} materials
                </span>
                <select
                  value={sortParam}
                  onChange={(e) => updateSort(e.target.value)}
                  aria-label="Sort"
                  className="bg-se-charcoal border border-se-concrete px-3 py-2 text-[11px] font-accent uppercase tracking-[0.12em] text-se-bone focus:outline-none focus:border-se-gold cursor-pointer"
                >
                  {SORT_OPTIONS.map((opt) => (
                    <option key={opt.key} value={opt.key} className="bg-se-charcoal">
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Grid */}
        <section className="section-pad">
          <div className="content-wide">
            <DisclaimerBanner className="mb-10" />

            {filtered.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {filtered.map((product, i) => (
                  <Motion.div
                    key={product.id}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{
                      duration: 0.4,
                      delay: Math.min(i * 0.04, 0.4),
                      ease: [0.2, 0, 0, 1],
                    }}
                  >
                    <ProductCard product={product} />
                  </Motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-24">
                <p className="font-display text-[20px] tracking-[0.04em] text-se-steel mb-4">
                  NO RESEARCH MATERIALS FOUND
                </p>
                <p className="text-[13px] text-se-bone/40 mb-8 font-accent">
                  No research materials found in this category.
                </p>
                <Link to="/shop" className="btn-outline">
                  View Full Catalog
                </Link>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}
