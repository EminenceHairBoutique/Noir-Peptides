// src/components/ProductCard.jsx — Noir Peptides
import React, { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import COABadge from "./COABadge";
import { getLatestCoaMap } from "../lib/coas";
import { formatPurity } from "../lib/labVerify";

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

const ProductCard = ({ product, label = null, latestCoa: latestCoaProp }) => {
  // W5: latest PUBLISHED certificate for this product, from ONE shared,
  // module-memoized query (getLatestCoaMap) — no per-card requests. Null
  // until resolved or when none exists; the card then falls back to its
  // static behavior ("COA on request" only when genuinely none exists).
  // Opt cycle 11: a grid that already resolved the map passes the row in
  // (`latestCoa`, null = none); a card mounted alone still resolves its own.
  const [ownCoa, setOwnCoa] = useState(null);
  const managed = latestCoaProp !== undefined;
  useEffect(() => {
    if (managed) return undefined;
    let alive = true;
    getLatestCoaMap().then((map) => {
      if (alive) setOwnCoa(map[product.id] || null);
    });
    return () => {
      alive = false;
    };
  }, [product.id, managed]);
  const latestCoa = managed ? latestCoaProp : ownCoa;

  const img = product.image_url || product.images?.[0] || null;
  const isOut = product.stock_status === "out_of_stock";
  const category = product.category_slug;

  return (
    /* Opt cycle 12 (4.9): the card is an <article> and the product NAME is the
       link — stretched over the card with a pseudo-element — so the
       certificate chip below is a sibling control, never a link inside a
       link (invalid HTML; screen readers concatenated both names). */
    <article className="group relative product-card overflow-hidden">
      {/* Visual */}
      <div className="relative aspect-square overflow-hidden">
        {img ? (
          <img
            src={img}
            alt={product.displayName || product.name}
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

        {/* Purity + stock chips. Opt cycle 11 (4.8 F6): one wrapping row —
            two absolute corners collided on a 163 px card at 390 px. */}
        <div className="absolute top-2 left-2 right-2 md:top-3 md:left-3 md:right-3 flex flex-wrap items-start justify-between gap-1">
          {/* Purity chip only from the latest PUBLISHED certificate (opt cycle 12);
              a product without one shows no purity claim at all. */}
          {formatPurity(latestCoa) ? (
            <div className="badge badge-new">{formatPurity(latestCoa)} HPLC</div>
          ) : <span />}
          <div
            className={`badge ${
              isOut ? "badge-sold-out" : product.stock_status === "low_stock" ? "badge-limited" : "badge-success"
            }`}
          >
            {STOCK_LABEL[product.stock_status] || "In Stock"}
          </div>
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
      <div className="px-3 pt-3 pb-3 md:px-4 md:pt-4 md:pb-4">
        <p className="text-[9px] tracking-[0.22em] uppercase text-se-gold font-accent mb-1.5">
          {category ? category.replace(/-/g, " ") : "Research Material"}
        </p>

        {/* Two lines so full names like "TB-500 (Thymosin β4)" aren't cut
            mid-word in the 2-col grid; min-height keeps card rows even when
            one title is 1 line and its neighbor is 2. Full name in title. */}
        <h3
          title={product.displayName || product.name}
          className="text-[14px] text-se-bone font-display tracking-[0.02em] mb-1 leading-tight"
        >
          <Link
            to={`/products/${product.slug ?? product.id}`}
            className="block min-h-[44px] line-clamp-2 after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-se-gold focus-visible:after:outline-offset-[-2px]"
          >
            {product.displayName || product.name}
          </Link>
        </h3>

        {/* Identical on every card; below 480 px the grid carries it once in
            the page header instead (F6). */}
        <p className="max-[479px]:hidden text-[11px] text-se-steel font-accent mb-3 line-clamp-1">
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
          {latestCoa?.file_url ? (
            /* W5: a real published certificate exists — link it with lot +
               test date visible; a sibling control above the stretched link. */
            <a
              href={latestCoa.file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="relative z-10 shrink-0 inline-flex items-center min-h-[44px] whitespace-nowrap text-[9px] font-accent uppercase tracking-[0.1em] text-se-gold border border-se-gold/40 px-2 py-1.5 hover:bg-se-gold/[0.08] transition"
              aria-label={`Certificate of Analysis for lot ${latestCoa.lot}${latestCoa.tested_at ? `, tested ${String(latestCoa.tested_at).slice(0, 10)}` : ""}`}
            >
              ✓ COA · {latestCoa.lot}
              {latestCoa.tested_at ? (
                /* the date clipped a 163 px card at 390 (F6); the aria-label keeps it */
                <span className="max-[479px]:hidden">{` · ${String(latestCoa.tested_at).slice(0, 10)}`}</span>
              ) : null}
            </a>
          ) : product.coa_url ? (
            <div className="relative z-10 shrink-0"><COABadge coaUrl={product.coa_url} /></div>
          ) : (
            /* same height as the certificate chip so the row never grows when
               the map resolves (page height stable after a scroll to the end) */
            <span className="shrink-0 inline-flex items-center min-h-[44px] whitespace-nowrap text-[9px] font-accent uppercase tracking-[0.1em] text-se-steel">
              COA on request
            </span>
          )}
        </div>

        <p className="mt-3 text-[9px] font-accent uppercase tracking-[0.12em] text-se-steel/80 border-t border-se-concrete/60 pt-2">
          Research use only · Not for human use
        </p>
      </div>
    </article>
  );
};

// Opt cycle 12 (4.7 TBT): the grid re-renders on every facet, query or
// compare change and on the certificate map's arrival; a card whose product,
// label and certificate are unchanged has nothing to redo.
export default React.memo(ProductCard);
