// src/pages/TestResults.jsx
// Public Certificate-of-Analysis (COA) dashboard. Published, batch-specific
// certificates grouped by product with expandable batch history (W4),
// headline trust counters derived from published rows only (W2), CAS search +
// research-category filter sharing the /shop taxonomy (W3), and the original
// lot-number search that jumps to verification. Filter state is URL-encoded so
// a filtered view is linkable. No login required — verifiable third-party lab
// results are the core trust signal for a research-materials vendor.
//
// EVERY number on this page is derived at query time from the coas table via
// deriveCoaStats; nothing is hardcoded, and empty data suppresses the blocks.
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams, Link } from "react-router-dom";
import { Search, ChevronDown } from "lucide-react";
import SEO from "../components/SEO";
import BatchHistoryTable from "../components/BatchHistoryTable";
import QrVerifyExplainer from "../components/QrVerifyExplainer";
import { getAllCoas } from "../lib/coas";
import { getAllProducts, getCategories } from "../data/tier1Catalog";
import { deriveCoaStats, filterCoas, groupByProduct } from "../lib/coaStats";

function fmtDate(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(d);
  }
}

const inputCls =
  "rounded-lg border border-white/15 bg-white/[0.03] px-3 py-2 text-se-bone placeholder:text-se-steel focus:border-se-gold focus:outline-none";

export default function TestResults() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [coas, setCoas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lotQuery, setLotQuery] = useState("");
  const [expanded, setExpanded] = useState({}); // product_id -> bool

  // URL-encoded filter state (W3): linkable + crawlable filtered views.
  const productFilter = params.get("product") || "all";
  const categoryFilter = params.get("category") || "all";
  const casQuery = params.get("cas") || "";

  const setFilter = (key, value) => {
    const next = new URLSearchParams(params);
    if (!value || value === "all") next.delete(key);
    else next.set(key, value);
    setParams(next, { replace: true });
  };

  // Same catalog source as the seed and /shop — a single taxonomy.
  const catalogIndex = useMemo(() => {
    const m = {};
    for (const p of getAllProducts()) m[p.id] = { name: p.name, category_slug: p.category_slug, slug: p.slug };
    return m;
  }, []);
  const categories = useMemo(() => getCategories(), []);

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

  const stats = useMemo(() => deriveCoaStats(coas), [coas]);

  const productOptions = useMemo(() => {
    const ids = Array.from(new Set(coas.map((c) => c.product_id))).filter(Boolean);
    return ids
      .map((id) => ({ id, name: catalogIndex[id]?.name || id }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [coas, catalogIndex]);

  const visible = useMemo(
    () => filterCoas(coas, { productId: productFilter, category: categoryFilter, cas: casQuery }, catalogIndex),
    [coas, productFilter, categoryFilter, casQuery, catalogIndex]
  );

  const grouped = useMemo(() => groupByProduct(visible), [visible]);

  function onLotSubmit(e) {
    e.preventDefault();
    const lot = lotQuery.trim();
    if (lot) navigate(`/verify-lot?lot=${encodeURIComponent(lot)}`);
  }

  const anyFilter = productFilter !== "all" || categoryFilter !== "all" || casQuery !== "";

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

          {/* W2 — headline counters, derived from published COAs only.
              Labels describe exactly what is counted; whole block suppressed
              at zero. */}
          {!loading && stats.totalCerts > 0 && (
            <dl className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4" data-testid="trust-counters">
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <dd className="font-display text-3xl text-se-bone">{stats.productsWithCerts}</dd>
                <dt className="mt-1 text-[11px] font-accent uppercase tracking-[0.14em] text-se-steel">
                  Products with published certificates
                </dt>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <dd className="font-display text-3xl text-se-bone">{stats.totalCerts}</dd>
                <dt className="mt-1 text-[11px] font-accent uppercase tracking-[0.14em] text-se-steel">
                  Published certificates (batches)
                </dt>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5">
                <dd className="font-display text-3xl text-se-bone">{fmtDate(stats.latestTestedAt) || "—"}</dd>
                <dt className="mt-1 text-[11px] font-accent uppercase tracking-[0.14em] text-se-steel">
                  Most recent certificate
                </dt>
              </div>
            </dl>
          )}

          {/* W6 — computed metrics: average purity (suppressed below the lot
              threshold, labeled with its sample size) + analytical panel
              breadth. Derived only; suppressed when absent. */}
          {!loading && (stats.avgPurity !== null || stats.msConfirmedLots > 0) && (
            <div className="mt-4 flex flex-wrap gap-3 text-[12px] font-accent text-se-bone/70" data-testid="trust-metrics">
              {stats.avgPurity !== null && (
                <span className="rounded-full border border-se-gold/30 px-3 py-1.5">
                  Average assay purity {stats.avgPurity}% across {stats.purityLots} published lots
                </span>
              )}
              {stats.msConfirmedLots > 0 && (
                <span className="rounded-full border border-white/15 px-3 py-1.5">
                  Analytical panel: HPLC purity on {stats.hplcLots} lots · MS identity confirmed on {stats.msConfirmedLots}
                </span>
              )}
            </div>
          )}

          {/* Lot verification search (unchanged behavior) */}
          <form onSubmit={onLotSubmit} className="mt-8 flex max-w-md gap-2">
            <input
              type="text"
              value={lotQuery}
              onChange={(e) => setLotQuery(e.target.value)}
              placeholder="Enter or scan a lot number…"
              aria-label="Lot number"
              className={`flex-1 ${inputCls} px-4 py-2.5`}
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-lg bg-se-gold px-4 py-2.5 font-accent text-sm uppercase tracking-wide text-se-black hover:opacity-90"
            >
              <Search size={15} />
              Verify
            </button>
          </form>

          {/* W8 — how the on-vial QR maps to this library */}
          <div className="mt-6 max-w-2xl">
            <QrVerifyExplainer />
          </div>

          {/* W3 — filters: product, research category (shop taxonomy), CAS */}
          <div className="mt-8 flex flex-wrap items-end gap-3">
            {productOptions.length > 0 && (
              <div>
                <label htmlFor="coa-product" className="block text-[10px] font-accent uppercase tracking-[0.14em] text-se-steel mb-1">
                  Product
                </label>
                <select
                  id="coa-product"
                  value={productFilter}
                  onChange={(e) => setFilter("product", e.target.value)}
                  className={inputCls}
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
            <div>
              <label htmlFor="coa-category" className="block text-[10px] font-accent uppercase tracking-[0.14em] text-se-steel mb-1">
                Research category
              </label>
              <select
                id="coa-category"
                value={categoryFilter}
                onChange={(e) => setFilter("category", e.target.value)}
                className={inputCls}
              >
                <option value="all">All categories</option>
                {categories.map((c) => (
                  <option key={c.slug} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="coa-cas" className="block text-[10px] font-accent uppercase tracking-[0.14em] text-se-steel mb-1">
                CAS number
              </label>
              <input
                id="coa-cas"
                type="text"
                value={casQuery}
                onChange={(e) => setFilter("cas", e.target.value)}
                placeholder="e.g. 0000-00-0"
                className={inputCls}
              />
            </div>
          </div>

          {/* W4 — per-product batch history, expandable; batch rows stay in
              the DOM when collapsed (hidden attr) so crawlable HTML retains
              them; the permalink page renders them expanded. */}
          <div className="mt-8 grid gap-4">
            {loading ? (
              <p className="text-se-steel">Loading certificates…</p>
            ) : grouped.size === 0 ? (
              <div className="rounded-xl border border-white/10 bg-white/[0.02] p-6 text-se-steel">
                {anyFilter ? (
                  <>
                    <p className="text-se-bone font-medium">No certificates match these filters.</p>
                    <p className="mt-1 text-sm">
                      Try clearing the CAS, category, or product filter — or verify a specific
                      lot with the lot number from your vial above.
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-se-bone font-medium">Certificates are published per batch.</p>
                    <p className="mt-1 text-sm">
                      As lots are tested and released, their certificates appear here. To verify a
                      specific lot, enter the lot number from your vial above.
                    </p>
                  </>
                )}
              </div>
            ) : (
              [...grouped.entries()].map(([pid, rows]) => {
                const meta = catalogIndex[pid];
                const isOpen = !!expanded[pid];
                const regionId = `batches-${pid}`;
                return (
                  <section key={pid} className="rounded-xl border border-white/10 bg-white/[0.02]">
                    <div className="flex items-center justify-between gap-3 p-5">
                      <button
                        type="button"
                        aria-expanded={isOpen}
                        aria-controls={regionId}
                        onClick={() => setExpanded((s) => ({ ...s, [pid]: !s[pid] }))}
                        className="flex items-center gap-3 text-left min-h-[44px] flex-1"
                      >
                        <ChevronDown
                          size={16}
                          aria-hidden="true"
                          className={`shrink-0 text-se-gold transition-transform ${isOpen ? "rotate-180" : ""}`}
                        />
                        <span className="font-display text-lg text-se-bone">
                          {meta?.name || pid}
                        </span>
                        <span className="text-[11px] font-accent text-se-steel">
                          {rows.length} {rows.length === 1 ? "batch" : "batches"}
                        </span>
                      </button>
                      {meta?.slug && (
                        <Link
                          to={`/test-results/${meta.slug}`}
                          className="shrink-0 text-[11px] font-accent uppercase tracking-[0.12em] text-se-gold hover:underline py-3"
                        >
                          Batch history →
                        </Link>
                      )}
                    </div>
                    <div id={regionId} hidden={!isOpen} className="px-5 pb-5">
                      <BatchHistoryTable rows={rows} captionId={`${regionId}-caption`} productName={meta?.name || pid} />
                    </div>
                  </section>
                );
              })
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
