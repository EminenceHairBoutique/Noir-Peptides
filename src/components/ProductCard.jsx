// src/components/ProductCard.jsx — Noir Peptides
import React from "react";
import { Link } from "react-router-dom";
import COABadge from "./COABadge";

const STOCK_LABEL = {
  in_stock: "In Stock",
  low_stock: "Low Stock",
  out_of_stock: "Out of Stock",
};

const ProductCard = ({ product }) => {
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
              Select Dosage
            </div>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="px-4 pt-4 pb-4">
        <p className="text-[9px] tracking-[0.22em] uppercase text-se-gold font-accent mb-1.5">
          {category ? category.replace(/-/g, " ") : "Research Material"}
        </p>

        <h3 className="text-[14px] text-se-bone font-display tracking-[0.02em] mb-1 line-clamp-1">
          {product.name}
        </h3>

        <p className="text-[11px] text-se-steel font-accent mb-3 line-clamp-1">
          {product.form || "Lyophilized powder"}
        </p>

        <div className="flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-[11px] font-accent text-se-steel uppercase tracking-[0.12em]">
              from
            </span>
            <span className="text-[15px] font-accent font-semibold text-se-bone">
              ${product.price}
            </span>
          </div>
          {product.coa_url ? (
            <COABadge coaUrl={product.coa_url} />
          ) : (
            <span className="text-[9px] font-accent uppercase tracking-[0.14em] text-se-steel">
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
