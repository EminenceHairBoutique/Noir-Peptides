// src/pages/ProductDetail.jsx — Noir Peptides Research Material PDP
import React, { useMemo, useState, useEffect, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { ChevronLeft, Minus, Plus, FileText, Snowflake, XCircle } from "lucide-react";
import { motion as Motion } from "framer-motion";

import { products, categories } from "../data/products";
import { useCart } from "../context/CartContext";
import SEO from "../components/SEO";
import ProductCard from "../components/ProductCard";
import PeptideSpecsPanel from "../components/PeptideSpecsPanel";
import COABadge from "../components/COABadge";
import DisclaimerBanner from "../components/DisclaimerBanner";
import { PRODUCT_IS_NOT, STORAGE_GUIDANCE } from "../config/compliance";

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
  const { addToCart, openCart } = useCart();

  const product = useMemo(
    () => products.find((p) => p.slug === slug || p.id === slug),
    [slug]
  );

  const [quantity, setQuantity] = useState(1);

  useEffect(() => {
    setQuantity(1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, [slug]);

  const isOut = product?.stock_status === "out_of_stock";

  const related = useMemo(() => {
    if (!product) return [];
    return products
      .filter(
        (p) =>
          p.id !== product.id && p.category_slug === product.category_slug
      )
      .slice(0, 4);
  }, [product]);

  const handleAddToCart = useCallback(() => {
    if (!product || isOut) return;
    addToCart(
      {
        id: product.id,
        slug: product.slug,
        name: product.name,
        price: product.price,
        image: product.image_url || product.images?.[0] || null,
      },
      { quantity }
    );
    openCart();
  }, [product, quantity, isOut, addToCart, openCart]);

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

  return (
    <>
      <SEO
        title={`${product.name} | COA-Documented Research Material | Noir Peptides`}
        description={`${product.short_description} For research use only. Not for human or veterinary use.`}
        type="product"
        jsonLd={{
          "@context": "https://schema.org",
          "@type": "Product",
          name: product.name,
          description: `${product.description} For research use only. Not for human or veterinary use.`,
          sku: product.id,
          mpn: product.batch_number,
          category: categoryName,
          brand: { "@type": "Brand", name: "Noir Peptides" },
          offers: {
            "@type": "Offer",
            price: product.price,
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
                    alt={product.name}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="vial-visual h-full w-full" aria-hidden="true" />
                )}
                <div className="absolute top-4 left-4 badge badge-new">
                  ≥ {product.purity_percent}% PURE
                </div>
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
                {product.subtitle}
              </p>

              {/* Spec row */}
              <div className="flex flex-wrap items-center gap-2 mt-5">
                <span className="badge badge-success">
                  {product.vial_size_mg} mg Vial
                </span>
                <span className="badge badge-new">
                  ≥ {product.purity_percent}% HPLC
                </span>
                {product.coa_url ? (
                  <COABadge
                    coaUrl={product.coa_url}
                    batchNumber={product.batch_number}
                  />
                ) : (
                  <span className="badge badge-archive">COA on request</span>
                )}
              </div>

              <div className="flex items-baseline gap-3 mt-6">
                {product.compare_at_price && (
                  <span className="text-lg text-se-steel line-through font-accent">
                    ${product.compare_at_price}
                  </span>
                )}
                <span className="text-2xl font-accent font-semibold text-se-bone">
                  ${product.price}
                </span>
                <span className="text-[11px] font-accent text-se-steel uppercase tracking-[0.14em]">
                  USD
                </span>
              </div>

              <div className="divider my-6" />

              {/* Quantity + Add */}
              {!isOut ? (
                <>
                  <div className="mb-5">
                    <span className="text-label text-se-bone/80 mb-3 block">
                      Quantity
                    </span>
                    <div className="inline-flex items-center border border-se-concrete">
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                        className="px-3.5 py-2.5 text-se-bone/60 hover:text-se-gold transition-colors"
                        aria-label="Decrease quantity"
                      >
                        <Minus size={14} />
                      </button>
                      <span className="px-5 py-2.5 text-[13px] font-accent font-medium text-se-bone min-w-[3rem] text-center border-x border-se-concrete">
                        {quantity}
                      </span>
                      <button
                        type="button"
                        onClick={() => setQuantity((q) => Math.min(20, q + 1))}
                        className="px-3.5 py-2.5 text-se-bone/60 hover:text-se-gold transition-colors"
                        aria-label="Increase quantity"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="btn-primary w-full py-4 text-[12px] tracking-[0.2em] mb-4"
                  >
                    Add to Cart — ${product.price * quantity}
                  </button>
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
                  Description
                </h2>
                <p className="text-[14px] text-se-bone/65 leading-relaxed font-accent">
                  {product.description}
                </p>
              </div>

              {/* Specs */}
              <div className="mb-8">
                <PeptideSpecsPanel product={product} />
              </div>

              {/* Batch documentation */}
              <div className="glass-panel p-6 mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-se-gold" />
                  <h2 className="text-[12px] font-accent uppercase tracking-[0.16em] text-se-gold">
                    Batch Documentation
                  </h2>
                </div>
                <p className="text-[13px] text-se-bone/55 leading-relaxed font-accent mb-4">
                  This material is supplied under batch{" "}
                  <span className="text-se-bone">{product.batch_number}</span>.
                  Batch-specific analytical documentation (identity and purity)
                  is third-party tested.
                </p>
                {product.coa_url ? (
                  <COABadge
                    coaUrl={product.coa_url}
                    batchNumber={product.batch_number}
                  />
                ) : (
                  <p className="text-[12px] text-se-steel font-accent">
                    A batch-specific Certificate of Analysis is available to
                    qualified researchers on request via{" "}
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
