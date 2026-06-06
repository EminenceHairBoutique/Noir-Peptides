// src/pages/ProductDetail.jsx — Noir Peptides Research Material PDP
import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, FileText, Snowflake, XCircle, Truck } from "lucide-react";
import { motion as Motion } from "framer-motion";

import {
  getProduct,
  getProducts,
  getCategories,
  getVariants,
  getTiers,
  unitPriceForQuantity,
} from "../lib/catalog";
import { useCart } from "../context/CartContext";
import SEO from "../components/SEO";
import ProductCard from "../components/ProductCard";
import PeptideSpecsPanel from "../components/PeptideSpecsPanel";
import COABadge from "../components/COABadge";
import DisclaimerBanner from "../components/DisclaimerBanner";
import { PRODUCT_IS_NOT, STORAGE_GUIDANCE } from "../config/compliance";

const FREE_SHIP_THRESHOLD = 200;
const money = (n) => `$${Number(n || 0).toLocaleString()}`;

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.5, ease: "easeOut" },
  }),
};

export default function ProductDetail() {
  const { slug } = useParams();
  const { addToCart } = useCart();

  const [product, setProduct] = useState(null);
  const [variants, setVariants] = useState([]);
  const [related, setRelated] = useState([]);
  const [categories, setCategories] = useState([]);
  const [variantId, setVariantId] = useState(null);
  const [tiers, setTiers] = useState([]);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);

  // Load product + its dosage variants.
  useEffect(() => {
    let active = true;
    setLoading(true);
    setQuantity(1);
    setTiers([]);
    setVariantId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });

    (async () => {
      const [p, cats] = await Promise.all([getProduct(slug), getCategories()]);
      if (!active) return;
      setProduct(p);
      setCategories(cats);
      if (p) {
        const [vars, sameDomain] = await Promise.all([
          getVariants(p.id),
          getProducts({ category: p.category_slug }),
        ]);
        if (!active) return;
        setVariants(vars);
        setVariantId(vars[0]?.id || null);
        setRelated(sameDomain.filter((x) => x.id !== p.id).slice(0, 4));
      } else {
        setVariants([]);
        setRelated([]);
      }
      setLoading(false);
    })();

    return () => {
      active = false;
    };
  }, [slug]);

  const selectedVariant = useMemo(
    () => variants.find((v) => v.id === variantId) || variants[0] || null,
    [variants, variantId]
  );

  // Load bundle tiers for the selected dosage variant.
  useEffect(() => {
    let active = true;
    if (!selectedVariant?.id) {
      setTiers([]);
      return;
    }
    setQuantity(1);
    getTiers(selectedVariant.id).then((t) => {
      if (active) setTiers(t);
    });
    return () => {
      active = false;
    };
  }, [selectedVariant?.id]);

  const basePrice = Number(selectedVariant?.price || product?.price || 0);
  const unitPrice = unitPriceForQuantity(basePrice, tiers, quantity);
  const lineTotal = unitPrice * quantity;
  const isOut =
    selectedVariant?.stock_status === "out_of_stock" ||
    product?.stock_status === "out_of_stock";

  // Bundle options come from the tier ladder (1/2/3/5/10).
  const bundleOptions = useMemo(() => {
    if (!tiers.length) return [{ qty: 1, unit: basePrice, savings: 0 }];
    return tiers.map((t) => ({
      qty: Number(t.min_quantity),
      unit: Number(t.unit_price),
      savings: Number(t.savings_pct || 0),
    }));
  }, [tiers, basePrice]);

  const handleAddToCart = useCallback(() => {
    if (!product || !selectedVariant || isOut) return;
    addToCart(
      {
        id: product.id,
        slug: product.slug,
        name: product.name,
        image: product.image_url || product.images?.[0] || null,
      },
      {
        variantId: selectedVariant.id,
        sku: selectedVariant.sku,
        sizeLabel: selectedVariant.size_label,
        basePrice,
        tiers,
        quantity,
      }
    );
  }, [product, selectedVariant, isOut, addToCart, basePrice, tiers, quantity]);

  if (loading) {
    return (
      <div className="min-h-screen bg-se-black flex items-center justify-center">
        <div className="content-wide grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 pt-28 w-full">
          <div className="aspect-square glass-panel se-skeleton" aria-hidden="true" />
          <div className="space-y-4">
            <div className="h-8 w-2/3 glass-panel se-skeleton" />
            <div className="h-4 w-1/3 glass-panel se-skeleton" />
            <div className="h-32 glass-panel se-skeleton" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-se-black flex flex-col items-center justify-center gap-6 px-6">
        <h1 className="font-display text-3xl text-se-bone tracking-wider">
          MATERIAL NOT FOUND
        </h1>
        <p className="text-se-steel font-accent text-sm">
          This research material does not exist or has been removed.
        </p>
        <Link to="/shop" className="btn-primary">
          Back to Catalog
        </Link>
      </div>
    );
  }

  const categoryName =
    categories.find((c) => c.slug === product.category_slug)?.name ||
    "Research Material";
  const remainingForFreeShip = Math.max(0, FREE_SHIP_THRESHOLD - lineTotal);
  const specProduct = {
    ...product,
    vial_size_mg: selectedVariant?.vial_size_mg ?? product.vial_size_mg,
    cas_number: product.cas_number ?? null,
  };

  return (
    <>
      <SEO
        title={`${product.name} | COA-Documented Research Material | Noir Peptides`}
        description={`${product.short_description || product.name}. For research use only. Not for human or veterinary use.`}
        type="product"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: `${product.description || product.short_description || product.name} For research use only. Not for human or veterinary use.`,
          sku: selectedVariant?.sku || product.id,
          category: categoryName,
          brand: { "@type": "Brand", name: "Noir Peptides" },
          offers: {
            "@type": "Offer",
            price: basePrice,
            priceCurrency: "USD",
            availability: isOut
              ? "https://schema.org/OutOfStock"
              : "https://schema.org/InStock",
          },
        }}
      />

      <main className="min-h-screen bg-se-black">
        <div className="content-wide pt-28 pb-4">
          <Link
            to="/shop"
            className="inline-flex items-center gap-1.5 text-se-steel hover:text-se-gold text-[11px] font-accent tracking-[0.15em] uppercase transition-colors"
          >
            <ChevronLeft size={14} />
            Back to Catalog
          </Link>
        </div>

        <div className="content-wide pb-20 lg:pb-28">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16">
            {/* Visual */}
            <Motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              className="lg:sticky lg:top-28 lg:self-start"
            >
              <div className="relative aspect-square glass-panel overflow-hidden">
                {product.image_url || product.images?.[0] ? (
                  <img
                    src={product.image_url || product.images[0]}
                    alt={`${product.name} research reference vial`}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="vial-visual h-full w-full" aria-hidden="true" />
                )}
                <div className="absolute top-4 left-4 badge badge-new">
                  ≥ {product.purity_percent}% PURE
                </div>
                {isOut && (
                  <div className="absolute top-4 right-4 badge badge-archive">
                    Out of stock
                  </div>
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 mt-3">
                {["Identity", "Purity", "Batch"].map((tag) => (
                  <div
                    key={tag}
                    className="glass-panel py-3 text-center text-[10px] font-accent uppercase tracking-[0.16em] text-se-steel"
                  >
                    {tag}
                  </div>
                ))}
              </div>
            </Motion.div>

            {/* Info */}
            <Motion.div
              initial="hidden"
              animate="visible"
              variants={fadeUp}
              custom={1}
              className="flex flex-col"
            >
              <Link
                to={`/shop/${product.category_slug}`}
                className="text-overline hover:text-se-bone transition-colors mb-3"
              >
                {categoryName}
              </Link>

              <h1 className="font-display font-extrabold text-3xl md:text-4xl text-se-bone tracking-[0.01em] leading-tight">
                {product.name}
              </h1>
              <p className="text-[13px] font-accent text-se-bone/50 mt-2">
                {product.short_description}
              </p>

              <div className="flex items-baseline gap-3 mt-5">
                <span className="text-2xl font-accent font-semibold text-se-bone">
                  {money(unitPrice)}
                </span>
                <span className="text-[11px] font-accent text-se-steel uppercase tracking-[0.14em]">
                  per vial · USD
                </span>
              </div>

              <div className="divider my-6" />

              {/* Dosage selector */}
              {variants.length > 0 && (
                <div className="mb-6">
                  <span
                    id="dosage-label"
                    className="text-label text-se-bone/80 mb-3 block"
                  >
                    Dosage
                  </span>
                  <div
                    role="radiogroup"
                    aria-labelledby="dosage-label"
                    className="flex flex-wrap gap-2"
                  >
                    {variants.map((v) => {
                      const active = v.id === selectedVariant?.id;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          onClick={() => setVariantId(v.id)}
                          className={`min-h-[44px] px-4 border text-[13px] font-accent transition ${
                            active
                              ? "border-se-gold text-se-gold bg-se-gold/5"
                              : "border-se-concrete text-se-bone/70 hover:border-se-gold/40"
                          }`}
                        >
                          {v.size_label || `${v.vial_size_mg} mg`}
                        </button>
                      );
                    })}
                  </div>
                  {selectedVariant?.sku && (
                    <p className="text-[10px] text-se-steel font-accent mt-2 uppercase tracking-[0.14em]">
                      SKU {selectedVariant.sku}
                    </p>
                  )}
                </div>
              )}

              {/* Bundle selector */}
              {!isOut ? (
                <>
                  <div className="mb-5">
                    <span
                      id="bundle-label"
                      className="text-label text-se-bone/80 mb-3 block"
                    >
                      Bundle &amp; save
                    </span>
                    <div
                      role="radiogroup"
                      aria-labelledby="bundle-label"
                      className="grid grid-cols-1 sm:grid-cols-2 gap-2"
                    >
                      {bundleOptions.map((b) => {
                        const active = quantity === b.qty;
                        return (
                          <button
                            key={b.qty}
                            type="button"
                            role="radio"
                            aria-checked={active}
                            onClick={() => setQuantity(b.qty)}
                            className={`min-h-[44px] px-4 py-2 border flex items-center justify-between gap-3 text-left transition ${
                              active
                                ? "border-se-gold bg-se-gold/5"
                                : "border-se-concrete hover:border-se-gold/40"
                            }`}
                          >
                            <span className="text-[13px] font-accent text-se-bone">
                              {b.qty} {b.qty === 1 ? "vial" : "vials"}
                            </span>
                            <span className="text-right">
                              <span className="block text-[13px] font-accent text-se-bone">
                                {money(b.unit)} ea
                              </span>
                              {b.savings > 0 && (
                                <span className="block text-[10px] font-accent text-se-gold uppercase tracking-[0.12em]">
                                  save {b.savings}%
                                </span>
                              )}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="btn-primary w-full py-4 text-[12px] tracking-[0.2em] mb-3"
                  >
                    Add to Cart — {money(lineTotal)}
                  </button>

                  {/* Free-shipping progress */}
                  <div className="mb-6">
                    <div className="flex items-center gap-2 text-[11px] font-accent text-se-steel mb-2">
                      <Truck className="w-3.5 h-3.5" />
                      {remainingForFreeShip > 0 ? (
                        <span>
                          {money(remainingForFreeShip)} from free US shipping
                        </span>
                      ) : (
                        <span className="text-se-gold">
                          This order qualifies for free US shipping
                        </span>
                      )}
                    </div>
                    <div className="h-1 bg-se-concrete overflow-hidden">
                      <div
                        className="h-full bg-se-gold transition-all"
                        style={{
                          width: `${Math.min(
                            100,
                            (lineTotal / FREE_SHIP_THRESHOLD) * 100
                          )}%`,
                        }}
                      />
                    </div>
                  </div>
                </>
              ) : (
                <button
                  type="button"
                  disabled
                  className="w-full py-4 bg-se-asphalt text-se-steel text-[12px] font-accent font-semibold tracking-[0.2em] uppercase cursor-not-allowed mb-4"
                >
                  Out of Stock
                </button>
              )}

              <DisclaimerBanner compact className="mb-8" />

              {/* Description */}
              <div className="mb-8">
                <h2 className="text-[12px] font-accent uppercase tracking-[0.16em] text-se-gold mb-3">
                  About this research compound
                </h2>
                <p className="text-[14px] text-se-bone/65 leading-relaxed font-accent">
                  {product.description}
                </p>
              </div>

              {/* Specs (null-tolerant) */}
              <div className="mb-8">
                <PeptideSpecsPanel product={specProduct} />
              </div>

              {/* COA block */}
              <div className="glass-panel p-6 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-se-gold" />
                  <h2 className="text-[12px] font-accent uppercase tracking-[0.16em] text-se-gold">
                    Certificate of Analysis
                  </h2>
                </div>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-[12px] font-accent mb-4">
                  <div className="flex justify-between border-b border-se-concrete/50 py-1">
                    <dt className="text-se-steel">Purity</dt>
                    <dd className="text-se-bone">≥ {product.purity_percent}% (HPLC)</dd>
                  </div>
                  <div className="flex justify-between border-b border-se-concrete/50 py-1">
                    <dt className="text-se-steel">Methods</dt>
                    <dd className="text-se-bone">HPLC / MS</dd>
                  </div>
                  <div className="flex justify-between border-b border-se-concrete/50 py-1">
                    <dt className="text-se-steel">Endotoxin</dt>
                    <dd className="text-se-bone">LAL tested</dd>
                  </div>
                  <div className="flex justify-between border-b border-se-concrete/50 py-1">
                    <dt className="text-se-steel">Lot</dt>
                    <dd className="text-se-bone break-all">
                      {product.batch_number || "per batch"}
                    </dd>
                  </div>
                </dl>
                {product.coa_url ? (
                  <COABadge coaUrl={product.coa_url} batchNumber={product.batch_number} />
                ) : (
                  <p className="text-[12px] text-se-steel font-accent">
                    The batch-specific Certificate of Analysis (lot, exact purity %,
                    HPLC/MS, endotoxin) is provided with each batch and available to
                    verified researchers on request via{" "}
                    <Link
                      to="/contact"
                      className="text-se-gold underline underline-offset-2"
                    >
                      our contact page
                    </Link>
                    .
                  </p>
                )}
              </div>

              {/* Storage & handling */}
              <div className="glass-panel p-6 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Snowflake className="w-4 h-4 text-se-gold" />
                  <h2 className="text-[12px] font-accent uppercase tracking-[0.16em] text-se-gold">
                    Storage &amp; Handling
                  </h2>
                </div>
                <p className="text-[13px] text-se-bone/55 leading-relaxed font-accent">
                  Label storage condition:{" "}
                  <span className="text-se-bone">{product.storage_temp}</span>.{" "}
                  {STORAGE_GUIDANCE}
                </p>
              </div>

              {/* What this product is NOT */}
              <div className="border border-se-red/40 bg-[#180a0d] p-6">
                <h2 className="text-[12px] font-accent uppercase tracking-[0.16em] text-se-red-bright mb-4">
                  What This Product Is Not
                </h2>
                <ul className="space-y-2">
                  {PRODUCT_IS_NOT.map((line) => (
                    <li
                      key={line}
                      className="flex items-start gap-2 text-[13px] text-se-bone/70 font-accent"
                    >
                      <XCircle className="w-3.5 h-3.5 text-se-red-bright mt-0.5 shrink-0" />
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </Motion.div>
          </div>
        </div>

        {related.length > 0 && (
          <section className="section-pad border-t border-se-concrete">
            <div className="content-wide">
              <h2 className="font-display text-xl tracking-[0.04em] text-se-bone mb-10">
                FROM THE SAME RESEARCH DOMAIN
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-5">
                {related.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
