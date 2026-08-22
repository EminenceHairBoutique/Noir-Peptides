// src/pages/Shop.jsx — Noir Peptides Research Catalog
// Advanced, research-grade catalog UX: faceted filters (category, vial size,
// stock, COA availability, featured/new, price range), analytical compare mode
// (up to 4 materials, analytical fields only), and premium loading/empty/error
// states. All data is RLS-gated via lib/catalog; no static product fallback.
import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import { Search, SlidersHorizontal, X, GitCompare, Check } from "lucide-react";
import { motion as Motion } from "framer-motion";

import { getProducts, getCategories, getAllVariants } from "../lib/catalog";
import { getAllCoas } from "../lib/coas";
import { getApprovedProductLabels } from "../lib/labelsApi";
import ProductCard from "../components/ProductCard";
import DisclaimerBanner from "../components/DisclaimerBanner";
import SEO from "../components/SEO";
import BottomSheet from "../components/ui/BottomSheet";
import { trackSearch } from "../utils/track";

const SORT_OPTIONS = [
  { key: "featured", label: "Featured" },
  { key: "price-asc", label: "Price: Low to High" },
  { key: "price-desc", label: "Price: High to Low" },
  { key: "purity-desc", label: "Purity: High to Low" },
  { key: "name-asc", label: "Name: A–Z" },
];

const MAX_COMPARE = 4;
const money = (n) => `$${Number(n || 0).toLocaleString()}`;

// Analytical-only comparison rows (no use/dosing implications).
const COMPARE_ROWS = [
  { key: "sizes", label: "Vial sizes" },
  { key: "price", label: "From price", render: (p) => money(p.price) },
  { key: "purity_percent", label: "Purity", render: (p) => (p.purity_percent ? `≥ ${p.purity_percent}%` : "—") },
  { key: "molecular_weight", label: "Molecular weight" },
  { key: "peptide_sequence", label: "Sequence" },
  { key: "form", label: "Form" },
  { key: "storage_temp", label: "Storage" },
  { key: "cas_number", label: "CAS" },
  { key: "coa", label: "COA on file" },
  { key: "stock_status", label: "Stock", render: (p) => (p.stock_status === "out_of_stock" ? "Out of stock" : "In stock") },
];

export default function Shop() {
  const { category: categorySlug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [query, setQuery] = useState("");

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [variants, setVariants] = useState([]);
  const [coaProductIds, setCoaProductIds] = useState(new Set());
  const [labelByProduct, setLabelByProduct] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  // Search analytics: report the term once typing settles (consent-gated).
  useEffect(() => {
    if (!query.trim()) return undefined;
    const t = setTimeout(() => trackSearch(query), 900);
    return () => clearTimeout(t);
  }, [query]);

  // Facets
  const [showFilters, setShowFilters] = useState(false);
  const [sizes, setSizes] = useState(() => new Set());
  const [inStockOnly, setInStockOnly] = useState(false);
  const [coaOnly, setCoaOnly] = useState(false);
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [newOnly, setNewOnly] = useState(false);
  const [priceCap, setPriceCap] = useState(null);

  // Compare
  const [compareMode, setCompareMode] = useState(false);
  const [compareIds, setCompareIds] = useState([]);
  const [compareOpen, setCompareOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(false);
    Promise.all([getProducts(), getCategories(), getAllVariants(), getAllCoas(), getApprovedProductLabels()])
      .then(([p, c, v, coas, labels]) => {
        if (!active) return;
        setProducts(p);
        setCategories(c);
        setVariants(v);
        setCoaProductIds(new Set((coas || []).map((x) => x.product_id).filter(Boolean)));
        setLabelByProduct(labels || {});
        setLoading(false);
      })
      .catch(() => {
        if (!active) return;
        setError(true);
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const sortParam = searchParams.get("sort") || "featured";
  const activeCategory = categories.find((c) => c.slug === categorySlug) || null;

  const variantsByProduct = useMemo(() => {
    const m = {};
    for (const v of variants) {
      (m[v.product_id] = m[v.product_id] || []).push(v);
    }
    return m;
  }, [variants]);

  const allSizes = useMemo(() => {
    const s = new Set(variants.map((v) => v.vial_size_mg).filter((n) => n != null));
    return Array.from(s).sort((a, b) => a - b);
  }, [variants]);

  const priceBounds = useMemo(() => {
    if (!products.length) return [0, 0];
    const prices = products.map((p) => Number(p.price || 0));
    return [Math.min(...prices), Math.max(...prices)];
  }, [products]);

  const sizeLabel = (p) => {
    const vs = variantsByProduct[p.id] || [];
    const labels = vs.map((v) => v.size_label || `${v.vial_size_mg} mg`);
    return labels.length ? labels.join(" · ") : "—";
  };

  const filtered = useMemo(() => {
    let result = [...products];

    if (activeCategory) result = result.filter((p) => p.category_slug === activeCategory.slug);

    const q = query.trim().toLowerCase();
    if (q) {
      result = result.filter((p) => {
        const cat = categories.find((c) => c.slug === p.category_slug)?.name || "";
        return [p.name, p.cas_number, p.batch_number, p.category_slug, cat, p.peptide_sequence, p.short_description]
          .filter(Boolean)
          .some((v) => String(v).toLowerCase().includes(q));
      });
    }

    if (sizes.size > 0) {
      result = result.filter((p) => (variantsByProduct[p.id] || []).some((v) => sizes.has(v.vial_size_mg)));
    }
    if (inStockOnly) result = result.filter((p) => p.stock_status !== "out_of_stock");
    if (coaOnly) result = result.filter((p) => coaProductIds.has(p.id));
    if (featuredOnly) result = result.filter((p) => p.featured);
    if (newOnly) result = result.filter((p) => p.isNew || p.is_new);
    if (priceCap != null) result = result.filter((p) => Number(p.price || 0) <= priceCap);

    switch (sortParam) {
      case "price-asc": result.sort((a, b) => a.price - b.price); break;
      case "price-desc": result.sort((a, b) => b.price - a.price); break;
      case "purity-desc": result.sort((a, b) => (b.purity_percent || 0) - (a.purity_percent || 0)); break;
      case "name-asc": result.sort((a, b) => String(a.name).localeCompare(String(b.name))); break;
      default: result.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0));
    }
    return result;
  }, [products, categories, activeCategory, query, sizes, inStockOnly, coaOnly, featuredOnly, newOnly, priceCap, sortParam, variantsByProduct, coaProductIds]);

  const updateSort = (value) => {
    const p = new URLSearchParams(searchParams);
    if (value && value !== "featured") p.set("sort", value); else p.delete("sort");
    setSearchParams(p, { replace: true });
  };

  const toggleSize = (mg) =>
    setSizes((prev) => {
      const n = new Set(prev);
      n.has(mg) ? n.delete(mg) : n.add(mg);
      return n;
    });

  const clearFilters = () => {
    setSizes(new Set());
    setInStockOnly(false); setCoaOnly(false); setFeaturedOnly(false); setNewOnly(false);
    setPriceCap(null); setQuery("");
  };

  const activeFilterCount =
    sizes.size + [inStockOnly, coaOnly, featuredOnly, newOnly].filter(Boolean).length + (priceCap != null ? 1 : 0);

  const toggleCompare = (id) =>
    setCompareIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= MAX_COMPARE) return prev;
      return [...prev, id];
    });

  const compareProducts = compareIds.map((id) => products.find((p) => p.id === id)).filter(Boolean);
  const pageTitle = activeCategory ? activeCategory.name : "Research Catalog";

  const facetChip = (active, onClick, label) => (
    <button
      type="button"
      key={label}
      onClick={onClick}
      className={`rounded-full border px-4 min-h-[44px] inline-flex items-center text-[11px] font-accent uppercase tracking-[0.1em] transition ${
        active ? "border-se-gold text-se-gold bg-se-gold/10" : "border-white/12 text-se-bone/60 hover:border-se-gold/40"
      }`}
    >
      {label}
    </button>
  );

  // The facet controls, shared by the desktop inline panel and the mobile
  // bottom sheet (one source, no duplication).
  const filterFacets = (
    <>
      <div>
        <p className="text-[10px] uppercase tracking-[0.16em] text-se-steel mb-2">Vial size</p>
        <div className="flex flex-wrap gap-1.5">
          {allSizes.map((mg) => facetChip(sizes.has(mg), () => toggleSize(mg), `${mg} mg`))}
          {allSizes.length === 0 && <span className="text-[11px] text-se-steel">—</span>}
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.16em] text-se-steel mb-2">Attributes</p>
        <div className="flex flex-wrap gap-1.5">
          {facetChip(inStockOnly, () => setInStockOnly((v) => !v), "In stock")}
          {facetChip(coaOnly, () => setCoaOnly((v) => !v), "COA on file")}
          {facetChip(featuredOnly, () => setFeaturedOnly((v) => !v), "Featured")}
          {facetChip(newOnly, () => setNewOnly((v) => !v), "New")}
        </div>
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-[0.16em] text-se-steel mb-2">
          Max price {priceCap != null ? `· ${money(priceCap)}` : ""}
        </p>
        <input
          type="range"
          min={priceBounds[0]} max={priceBounds[1]}
          value={priceCap ?? priceBounds[1]}
          onChange={(e) => setPriceCap(Number(e.target.value))}
          className="w-full accent-se-gold"
          aria-label="Maximum price"
        />
        <div className="flex justify-between text-[10px] text-se-steel mt-1">
          <span>{money(priceBounds[0])}</span><span>{money(priceBounds[1])}</span>
        </div>
      </div>
    </>
  );

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
              {activeCategory ? activeCategory.description : "Batch-documented peptide reference materials for qualified laboratory research."}
            </p>
          </div>
        </section>

        {/* Sticky control bar */}
        <div className="border-b border-se-concrete sticky top-0 z-30 bg-se-black/95 backdrop-blur-sm">
          <div className="content-wide py-4">
            {/* Category tabs. py+negative-my expands each link's hit box to
                44px without changing the strip's visual height. */}
            <div className="flex items-center gap-6 overflow-x-auto pb-3 scrollbar-hide">
              <Link to="/shop" className={`inline-flex items-center py-[14px] -my-[14px] text-[11px] font-accent uppercase tracking-[0.18em] whitespace-nowrap transition ${!activeCategory ? "text-se-gold" : "text-se-steel hover:text-se-bone"}`}>All</Link>
              {categories.map((cat) => (
                <Link key={cat.slug} to={`/shop/${cat.slug}`} className={`inline-flex items-center py-[14px] -my-[14px] text-[11px] font-accent uppercase tracking-[0.18em] whitespace-nowrap transition ${activeCategory?.slug === cat.slug ? "text-se-gold" : "text-se-steel hover:text-se-bone"}`}>{cat.name}</Link>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mt-3 pt-3 border-t border-se-concrete">
              <div className="relative flex-1 max-w-sm">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-se-steel" />
                <input
                  type="search" value={query} onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name, CAS, batch, sequence"
                  aria-label="Search research materials"
                  className="w-full pl-9 pr-3 py-2 bg-se-charcoal border border-se-concrete text-se-bone text-[12px] font-accent placeholder:text-se-steel focus:outline-none focus:border-se-gold transition"
                />
              </div>

              {/* Wraps at phone widths (was a non-wrapping row that overflowed
                  320px, running "Filters" and "Compare" together and clipping
                  the sort control). Each control is shrink-0 with a ≥44px tap
                  height; the sort select takes its own line below sm. */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowFilters((s) => !s)}
                  className={`shrink-0 inline-flex items-center gap-2 px-3 py-2.5 border text-[11px] font-accent uppercase tracking-[0.12em] transition whitespace-nowrap ${showFilters || activeFilterCount ? "border-se-gold text-se-gold" : "border-se-concrete text-se-bone/70 hover:border-se-gold/40"}`}
                >
                  <SlidersHorizontal size={13} /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
                </button>
                <button
                  type="button"
                  onClick={() => { setCompareMode((m) => !m); if (compareMode) { setCompareIds([]); setCompareOpen(false); } }}
                  className={`shrink-0 inline-flex items-center gap-2 px-3 py-2.5 border text-[11px] font-accent uppercase tracking-[0.12em] transition whitespace-nowrap ${compareMode ? "border-se-gold text-se-gold" : "border-se-concrete text-se-bone/70 hover:border-se-gold/40"}`}
                >
                  <GitCompare size={13} /> Compare
                </button>
                <select
                  value={sortParam} onChange={(e) => updateSort(e.target.value)} aria-label="Sort"
                  className="w-full sm:w-auto bg-se-charcoal border border-se-concrete px-3 py-2.5 min-h-[44px] text-[11px] font-accent uppercase tracking-[0.12em] text-se-bone focus:outline-none focus:border-se-gold cursor-pointer"
                >
                  {SORT_OPTIONS.map((opt) => <option key={opt.key} value={opt.key} className="bg-se-charcoal">{opt.label}</option>)}
                </select>
              </div>
            </div>

            {/* Filter panel — inline expand on DESKTOP only; on mobile the same
                facets render inside an accessible bottom sheet (below). */}
            {showFilters && (
              <div className="hidden md:grid mt-3 pt-3 border-t border-se-concrete gap-4 md:grid-cols-4">
                {filterFacets}
                <div className="flex items-end">
                  {activeFilterCount > 0 && (
                    <button onClick={clearFilters} className="inline-flex items-center gap-1.5 min-h-[44px] text-[11px] text-se-steel hover:text-se-gold">
                      <X size={13} /> Clear all filters
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Mobile filter bottom sheet — same facets as the desktop panel,
            in the accessible BottomSheet primitive (md:hidden built in). */}
        <BottomSheet
          open={showFilters}
          onClose={() => setShowFilters(false)}
          title={`Filters${activeFilterCount ? ` (${activeFilterCount})` : ""}`}
          footer={
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={clearFilters}
                disabled={activeFilterCount === 0}
                className="inline-flex items-center gap-1.5 min-h-[44px] text-[11px] text-se-steel hover:text-se-gold disabled:opacity-40"
              >
                <X size={14} /> Clear all
              </button>
              <button type="button" onClick={() => setShowFilters(false)} className="btn-primary text-[11px] px-6 min-h-[44px]">
                Show results
              </button>
            </div>
          }
        >
          <div className="space-y-6">{filterFacets}</div>
        </BottomSheet>

        {/* Grid */}
        <section className="section-pad">
          <div className="content-wide">
            <DisclaimerBanner className="mb-10" />

            <div className="flex items-center justify-between mb-6">
              <span className="text-[11px] text-se-steel font-accent">{loading ? "Loading…" : `${filtered.length} materials`}</span>
              {compareMode && (
                <span className="text-[11px] text-se-gold font-accent">Select up to {MAX_COMPARE} to compare · {compareIds.length} selected</span>
              )}
            </div>

            {error ? (
              <div className="text-center py-24">
                <p className="font-display text-[20px] tracking-[0.04em] text-se-steel mb-4">COULDN'T LOAD THE CATALOG</p>
                <p className="text-[13px] text-se-bone/40 mb-8 font-accent">A network or access error occurred. Please retry.</p>
                <button onClick={() => window.location.reload()} className="btn-outline">Retry</button>
              </div>
            ) : loading ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {Array.from({ length: 8 }).map((_, i) => <div key={i} className="aspect-[3/4] glass-panel se-skeleton" aria-hidden="true" />)}
              </div>
            ) : filtered.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
                {filtered.map((product, i) => {
                  const selected = compareIds.includes(product.id);
                  return (
                    <Motion.div
                      key={product.id}
                      initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.4, delay: Math.min(i * 0.04, 0.4), ease: [0.2, 0, 0, 1] }}
                      className="relative"
                    >
                      {compareMode && (
                        <button
                          type="button"
                          onClick={() => toggleCompare(product.id)}
                          aria-pressed={selected}
                          className={`absolute top-2 left-2 z-10 flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-accent uppercase tracking-wide backdrop-blur ${
                            selected ? "border-se-gold bg-se-gold text-se-black" : "border-white/30 bg-black/50 text-se-bone"
                          }`}
                        >
                          {selected ? <Check size={12} /> : null} {selected ? "Selected" : "Compare"}
                        </button>
                      )}
                      <ProductCard product={product} label={labelByProduct[product.id] || null} />
                    </Motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-24">
                <p className="font-display text-[20px] tracking-[0.04em] text-se-steel mb-4">NO RESEARCH MATERIALS FOUND</p>
                <p className="text-[13px] text-se-bone/40 mb-8 font-accent">
                  {activeFilterCount ? "No materials match the selected filters." : "No research materials found in this category."}
                </p>
                {activeFilterCount ? (
                  <button onClick={clearFilters} className="btn-outline">Clear filters</button>
                ) : (
                  <Link to="/shop" className="btn-outline">View Full Catalog</Link>
                )}
              </div>
            )}
          </div>
        </section>

        {/* Compare table */}
        {compareOpen && compareProducts.length > 0 && (
          <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6" onClick={() => setCompareOpen(false)}>
            <div className="bg-[#0a0e16] border border-white/10 w-full sm:max-w-4xl max-h-[85vh] overflow-auto rounded-t-2xl sm:rounded-2xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-5 border-b border-white/10 sticky top-0 bg-[#0a0e16]">
                <h2 className="font-display text-lg">Analytical comparison</h2>
                <button onClick={() => setCompareOpen(false)} aria-label="Close"><X size={18} className="text-se-steel hover:text-se-bone" /></button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr>
                      <th className="text-left p-3 text-[11px] uppercase tracking-wide text-se-steel font-accent sticky left-0 bg-[#0a0e16]">Field</th>
                      {compareProducts.map((p) => (
                        <th key={p.id} className="text-left p-3 min-w-[140px]">
                          <Link to={`/product/${p.slug}`} className="text-se-gold hover:underline font-display">{p.name}</Link>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {COMPARE_ROWS.map((row) => (
                      <tr key={row.key} className="border-t border-white/5">
                        <td className="p-3 text-se-steel font-accent text-[12px] sticky left-0 bg-[#0a0e16]">{row.label}</td>
                        {compareProducts.map((p) => {
                          let val;
                          if (row.key === "sizes") val = sizeLabel(p);
                          else if (row.key === "coa") val = coaProductIds.has(p.id) ? "Yes" : "—";
                          else if (row.render) val = row.render(p);
                          else val = p[row.key] || "—";
                          return <td key={p.id} className="p-3 text-se-bone/80 align-top">{val}</td>;
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="p-4 text-[11px] text-se-steel">Analytical fields only. For research use only. Not for human or veterinary use.</p>
            </div>
          </div>
        )}

        {/* Compare tray */}
        {compareMode && compareIds.length > 0 && (
          <div className="fixed bottom-0 inset-x-0 z-40 border-t border-white/10 bg-[#0a0e16]/95 backdrop-blur">
            <div className="content-wide py-3 flex items-center justify-between gap-3">
              <span className="text-[12px] text-se-bone/70 font-accent">{compareIds.length} selected (max {MAX_COMPARE})</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setCompareIds([])} className="text-[11px] text-se-steel hover:text-se-bone">Clear</button>
                <button onClick={() => setCompareOpen(true)} disabled={compareIds.length < 2} className="btn-primary disabled:opacity-40">
                  Compare {compareIds.length}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
