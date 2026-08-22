// src/components/ProductCard.jsx — Noir Peptides
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import COABadge from "./COABadge";

const LabelPreview = lazy(() => import("./labels/LabelPreview"));

const STOCK_LABEL = {
  in_stock: "In Stock",
  low_stock: "Low Stock",
  out_of_stock: "Out of Stock",
};

// Lightweight static label thumbnail for the grid: the procedural front panel
// (no master raster, no WebGL) built from the approved label's real data.
// Mounts only when the card scrolls into view.
function LabelThumb({ label }) {
  const ref = useRef(null);
  const [show, setShow] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setShow(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setShow(true)),
      { rootMargin: "200px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className="absolute inset-0 flex items-center justify-center p-3 bg-gradient-to-b from-[#0d1118] to-[#070a10]">
      {show && (
        <Suspense fallback={null}>
          <LabelPreview config={label} templateId={label.template_id} presetId="front" className="!border-0 max-h-full" />
        </Suspense>
      )}
    </div>
  );
}

const ProductCard = ({ product, label = null }) => {
  const img = product.image_url || product.images?.[0] || null;
  const isOut = product.stock_status === "out_of_stock";
  const category = product.category_slug;

  return (
    <Link
      to={`/products/${product.slug ?? product.id}`}
      className="group block product-card overflow-hidden"
    >
      {/* Visual */}
      <div className="relative aspect-square overflow-hidden">
        {img ? (
          <img
            src={img}
            alt={product.name}
            className={`absolute inset-0 h-full w-full object-cover transition-all duration-700 ease-out ${
              isOut ? "opacity-40 grayscale" : "group-hover:scale-[1.04]"
            }`}
            loading="lazy"
          />
        ) : label ? (
          <LabelThumb label={label} />
        ) : (
          <div
            className={`vial-visual h-full w-full ${isOut ? "opacity-40" : ""}`}
            aria-hidden="true"
          />
        )}

        {/* Purity chip */}
        {product.purity_percent != null && (
          <div className="absolute top-3 left-3 badge badge-new">
            ≥ {product.purity_percent}% PURE
          </div>
        )}

        {/* Stock */}
        <div
          className={`absolute top-3 right-3 badge ${
            isOut ? "badge-sold-out" : product.stock_status === "low_stock" ? "badge-limited" : "badge-success"
          }`}
        >
          {STOCK_LABEL[product.stock_status] || "In Stock"}
        </div>

        {/* Select dosage (navigates to PDP — dosage + bundle chosen there) */}
        {!isOut && (
          <div className="absolute bottom-0 left-0 right-0 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-out">
            <div className="w-full py-3 bg-se-gold text-[#04121b] text-[10px] font-accent font-semibold tracking-[0.2em] uppercase text-center">
              Select Vial Size
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-4 pt-4 pb-4">
        <p className="text-[9px] tracking-[0.22em] uppercase text-se-gold font-accent mb-1.5">
          {category ? category.replace(/-/g, " ") : "Research Material"}
        </p>

        {/* Two lines so full names like "TB-500 (Thymosin β4)" aren't cut
            mid-word in the 2-col grid; min-height keeps card rows even when
            one title is 1 line and its neighbor is 2. Full name in title. */}
        <h3
          title={product.name}
          className="text-[14px] text-se-bone font-display tracking-[0.02em] mb-1 line-clamp-2 min-h-[2.5em] leading-tight"
        >
          {product.name}
        </h3>

        <p className="text-[11px] text-se-steel font-accent mb-3 line-clamp-1">
          {product.form || "Lyophilized powder"}
        </p>

        {/* flex-wrap + shrink-0 so at 320px the COA marker drops to its own
            line instead of overlapping the price (was a two-line collision). */}
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1.5">
          <div className="flex items-baseline gap-1.5 shrink-0">
            <span className="text-[10px] font-accent text-se-steel uppercase tracking-[0.1em]">
              from
            </span>
            <span className="text-[15px] font-accent font-semibold text-se-bone">
              ${product.price}
            </span>
          </div>
          {product.coa_url ? (
            <div className="shrink-0"><COABadge coaUrl={product.coa_url} /></div>
          ) : (
            <span className="shrink-0 whitespace-nowrap text-[9px] font-accent uppercase tracking-[0.1em] text-se-steel">
              COA on request
            </span>
          )}
        </div>

        <p className="mt-3 text-[9px] font-accent uppercase tracking-[0.12em] text-se-steel/80 border-t border-se-concrete/60 pt-2">
          Research use only · Not for human use
        </p>
      </div>
    </Link>
  );
};

export default ProductCard;
