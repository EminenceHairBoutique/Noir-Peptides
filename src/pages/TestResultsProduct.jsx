// src/pages/TestResultsProduct.jsx
// Per-product batch-history permalink (W4): /test-results/:productSlug.
// Renders the product's full published certificate history EXPANDED — the
// permalink route is the always-reachable form of the data the dashboard shows
// behind an expander. Prerendered like the rest of the catalog (the generator
// emits this route with the static shell, plus batch rows when the build has
// database access). No rows are ever fabricated: with no published
// certificates the page states that plainly.
import { useEffect, useMemo, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import SEO from "../components/SEO";
import BatchHistoryTable from "../components/BatchHistoryTable";
import QrVerifyExplainer from "../components/QrVerifyExplainer";
import { getCoasForProduct } from "../lib/coas";
import { getAllProducts } from "../data/tier1Catalog";
import { publishedOnly } from "../lib/coaStats";

export default function TestResultsProduct() {
  const { productSlug } = useParams();
  const product = useMemo(
    () => getAllProducts().find((p) => p.slug === productSlug || p.id === productSlug) || null,
    [productSlug]
  );
  const [coas, setCoas] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    if (!product) return undefined;
    getCoasForProduct(product.id).then((rows) => {
      if (alive) {
        setCoas(publishedOnly(rows));
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, [product]);

  if (!product) return <Navigate to="/test-results" replace />;

  return (
    <>
      <SEO
        title={`${product.name} — Batch Test History`}
        description={`Published batch-specific certificates of analysis for ${product.name}: lot numbers, HPLC purity, mass-spec identity, and test dates. For research use only. Not for human or veterinary use.`}
        type="website"
      />

      <main className="min-h-screen bg-se-black">
        <div className="content-wide pt-28 pb-16">
          <nav aria-label="Breadcrumb" className="text-[11px] font-accent uppercase tracking-[0.12em] text-se-steel">
            <Link to="/test-results" className="inline-flex items-center gap-1.5 py-[14px] -my-[14px] hover:text-se-gold transition-colors">
              <ChevronLeft size={14} aria-hidden="true" />
              All test results
            </Link>
          </nav>

          <h1 className="mt-4 font-display text-3xl sm:text-4xl text-se-bone">
            {product.name} — Batch Test History
          </h1>
          <p className="mt-3 max-w-2xl text-se-steel">
            Every published certificate for this material, newest first. Each row is a
            specific tested lot;{" "}
            <Link to={`/product/${product.slug}`} className="text-se-gold hover:underline">
              view the product page
            </Link>
            .
          </p>

          <div className="mt-8">
            {loading ? (
              <p className="text-se-steel">Loading certificates…</p>
            ) : coas.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-se-steel">
                <p className="text-se-bone font-medium">
                  No published certificates for this material yet.
                </p>
                <p className="mt-1 text-sm">
                  Certificates are published per batch as lots are tested and released.
                </p>
              </div>
            ) : (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <BatchHistoryTable
                  rows={coas}
                  captionId={`batches-${product.id}-caption`}
                  productName={product.name}
                />
              </div>
            )}
          </div>

          <div className="mt-8 max-w-2xl">
            <QrVerifyExplainer compact />
          </div>

          <p className="mt-10 text-xs text-se-steel">
            For research use only. Not for human or veterinary use.
          </p>
        </div>
      </main>
    </>
  );
}
