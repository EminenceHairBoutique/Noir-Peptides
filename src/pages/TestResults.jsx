// src/pages/TestResults.jsx
// Public Certificate-of-Analysis (COA) library. Lists every published, batch-
// specific COA, filterable by product, with a lot-number search that jumps to
// the verification page. No login required — verifiable third-party lab results
// are the core trust signal for a research-materials vendor.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search } from "lucide-react";
import SEO from "../components/SEO";
import CoaCard from "../components/CoaCard";
import { getAllCoas } from "../lib/coas";
import { getAllProducts } from "../data/tier1Catalog";

const ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "https://www.noirpeptides.com";

export default function TestResults() {
  const navigate = useNavigate();
  const [coas, setCoas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [productFilter, setProductFilter] = useState("all");
  const [lotQuery, setLotQuery] = useState("");

  // product_id -> display name (from the same catalog source as the seed)
  const nameById = useMemo(() => {
    const m = {};
    for (const p of getAllProducts()) m[p.id] = p.name;
    return m;
  }, []);

  useEffect(() => {
    let alive = true;
    getAllCoas().then((rows) => {
      if (alive) {
        setCoas(rows);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const productOptions = useMemo(() => {
    const ids = Array.from(new Set(coas.map((c) => c.product_id))).filter(Boolean);
    return ids
      .map((id) => ({ id, name: nameById[id] || id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [coas, nameById]);

  const visible = useMemo(
    () => (productFilter === "all" ? coas : coas.filter((c) => c.product_id === productFilter)),
    [coas, productFilter]
  );

  function onLotSubmit(e) {
    e.preventDefault();
    const lot = lotQuery.trim();
    if (lot) navigate(`/verify-lot?lot=${encodeURIComponent(lot)}`);
  }

  return (
    <>
      <SEO
        title="Test Results — Certificate of Analysis Library"
        description="Browse batch-specific certificates of analysis (HPLC purity + mass-spec identity) for Noir Peptides research reference materials. Verify any lot. For research use only. Not for human or veterinary use."
        type="website"
      />

      <main className="min-h-screen bg-se-black">
        <div className="content-wide pt-28 pb-16">
          <p className="text-[11px] font-accent tracking-[0.2em] uppercase text-se-gold">
            Transparency
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl text-se-bone">
            Test Results &amp; Certificates of Analysis
          </h1>
          <p className="mt-3 max-w-2xl text-se-steel">
            Every batch is documented with third-party analytical testing — identity by
            mass spectrometry and purity by HPLC. Browse published certificates below, or
            verify the exact lot printed on your vial.
          </p>

          {/* Lot verification search */}
          <form onSubmit={onLotSubmit} className="mt-6 flex max-w-md gap-2">
            <input
              type="text"
              value={lotQuery}
              onChange={(e) => setLotQuery(e.target.value)}
              placeholder="Enter or scan a lot number…"
              aria-label="Lot number"
              className="flex-1 rounded-lg border border-white/15 bg-white/[0.03] px-4 py-2.5 text-se-bone placeholder:text-se-steel focus:border-se-gold focus:outline-none"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-se-gold px-4 py-2.5 font-accent text-sm uppercase tracking-wide text-se-black hover:opacity-90"
            >
              <Search size={15} />
              Verify
            </button>
          </form>

          {/* Product filter */}
          {productOptions.length > 0 && (
            <div className="mt-6">
              <label htmlFor="coa-product" className="sr-only">
                Filter by product
              </label>
              <select
                id="coa-product"
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-se-bone focus:border-se-gold focus:outline-none"
              >
                <option value="all">All products</option>
                {productOptions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* COA list */}
          <div className="mt-8 grid gap-4">
            {loading ? (
              <p className="text-se-steel">Loading certificates…</p>
            ) : visible.length === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-se-steel">
                <p className="text-se-bone font-medium">Certificates are published per batch.</p>
                <p className="mt-1 text-sm">
                  As lots are tested and released, their certificates appear here. To verify a
                  specific lot, enter the lot number from your vial above.
                </p>
              </div>
            ) : (
              visible.map((coa) => (
                <CoaCard
                  key={coa.id}
                  coa={coa}
                  productName={nameById[coa.product_id]}
                  origin={ORIGIN}
                />
              ))
            )}
          </div>

          <p className="mt-10 text-xs text-se-steel">
            For research use only. Not for human or veterinary use.
          </p>
        </div>
      </main>
    </>
  );
}
