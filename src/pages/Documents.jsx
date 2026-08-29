// src/pages/Documents.jsx
// Public document library (Task 2). One address that answers "where is the
// paperwork?" — Safety Data Sheets per material, the certificate library, lot
// verification, and the binding policy documents.
//
// The SDS list is built ENTIRELY from products that carry a real
// products.sds_file_url (migration 0033). Materials without a published sheet
// are named in a separate, plainly-labelled list rather than being hidden or
// given a dead link: an EHS reviewer needs to know what is missing, and a
// silent omission reads as a broken index.
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileText, ShieldAlert, ScanLine, Scale } from "lucide-react";
import SEO from "../components/SEO";
import SdsLink from "../components/SdsLink";
import { getProducts } from "../lib/catalog";
import { hasSds, withSds, sdsCoverage } from "../lib/sds";

const CARD = "rounded-xl border border-white/10 bg-white/[0.02] p-5";

const POLICY_DOCS = [
  { to: "/legal/ruo-agreement", label: "Research-Use Agreement" },
  { to: "/legal/research-use-policy", label: "Research-Use Policy" },
  { to: "/legal/coa-policy", label: "COA Policy" },
  { to: "/legal/fda-disclaimer", label: "FDA Disclaimer" },
  { to: "/legal/shipping", label: "Shipping & Refunds Policy" },
  { to: "/legal/terms", label: "Terms & Conditions" },
  { to: "/legal/privacy", label: "Privacy Policy" },
];

export default function Documents() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getProducts().then((rows) => {
      if (alive) {
        setProducts(Array.isArray(rows) ? rows : []);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  const sheets = useMemo(() => withSds(products), [products]);
  const missing = useMemo(
    () =>
      products
        .filter((p) => !hasSds(p))
        .sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""))),
    [products]
  );
  const coverage = useMemo(() => sdsCoverage(products), [products]);

  return (
    <>
      <SEO
        title="Document Library — Safety Data Sheets & Certificates"
        description="Safety Data Sheets (GHS 16-section), batch certificates of analysis, lot verification and policy documents for Noir Peptides research reference materials. For research use only. Not for human or veterinary use."
        type="website"
      />

      <main className="min-h-screen bg-se-black">
        <div className="content-wide pt-28 pb-16">
          <p className="text-[11px] font-accent tracking-[0.2em] uppercase text-se-gold">
            Documentation
          </p>
          <h1 className="mt-2 font-display text-3xl sm:text-4xl text-se-bone">Document Library</h1>
          <p className="mt-3 max-w-2xl text-se-steel">
            Safety Data Sheets, batch certificates of analysis, lot verification and the
            policies under which these materials are supplied. Every document here is the
            real published file — nothing on this page is a placeholder.
          </p>

          {/* Cross-links to the other document surfaces. */}
          <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Link to="/test-results" className={`${CARD} block hover:border-se-gold/40 transition`}>
              <FileText className="w-4 h-4 text-se-gold" aria-hidden="true" />
              <h2 className="mt-2 font-display text-lg text-se-bone">Certificates of Analysis</h2>
              <p className="mt-1 text-[13px] text-se-steel">
                Batch-specific HPLC purity and mass-spec identity results.
              </p>
            </Link>
            <Link to="/verify-lot" className={`${CARD} block hover:border-se-gold/40 transition`}>
              <ScanLine className="w-4 h-4 text-se-gold" aria-hidden="true" />
              <h2 className="mt-2 font-display text-lg text-se-bone">Verify a Lot</h2>
              <p className="mt-1 text-[13px] text-se-steel">
                Look up the certificate for the lot printed on your vial.
              </p>
            </Link>
            <Link to="/legal/ruo-agreement" className={`${CARD} block hover:border-se-gold/40 transition`}>
              <Scale className="w-4 h-4 text-se-gold" aria-hidden="true" />
              <h2 className="mt-2 font-display text-lg text-se-bone">Research-Use Agreement</h2>
              <p className="mt-1 text-[13px] text-se-steel">
                The terms under which these materials are supplied.
              </p>
            </Link>
          </div>

          {/* ── Safety Data Sheets ── */}
          <section className="mt-14" aria-labelledby="sds-heading">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-se-gold" aria-hidden="true" />
              <h2 id="sds-heading" className="font-display text-2xl text-se-bone">
                Safety Data Sheets
              </h2>
            </div>
            <p className="mt-2 max-w-2xl text-[13px] text-se-steel">
              GHS 16-section format, covering hazard identification, handling and storage,
              exposure controls, and disposal for each material.
            </p>

            {loading ? (
              <p className="mt-6 text-[13px] font-accent text-se-steel">Loading documents…</p>
            ) : sheets.length > 0 ? (
              <>
                <p className="mt-4 text-[12px] font-accent text-se-bone/60" data-testid="sds-coverage">
                  {coverage.published} of {coverage.total} catalog materials have a published
                  Safety Data Sheet.
                </p>
                <ul className="mt-4 divide-y divide-white/10 border-y border-white/10" data-testid="sds-list">
                  {sheets.map((p) => (
                    <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                      <Link
                        to={`/product/${p.slug}`}
                        className="text-[14px] text-se-bone hover:text-se-gold transition"
                      >
                        {p.name}
                      </Link>
                      <SdsLink product={p} />
                    </li>
                  ))}
                </ul>
              </>
            ) : (
              <p className="mt-6 max-w-2xl text-[13px] font-accent text-se-steel" data-testid="sds-empty">
                No Safety Data Sheets are published yet. Request the sheet for a specific
                material at{" "}
                <Link to="/contact" className="text-se-gold underline underline-offset-2">
                  contact
                </Link>
                .
              </p>
            )}

            {/* Named, not hidden: an index that quietly omits what it lacks is
                worse than one that states it. */}
            {!loading && sheets.length > 0 && missing.length > 0 && (
              <details className="mt-6" data-testid="sds-missing">
                <summary className="cursor-pointer text-[12px] font-accent text-se-steel hover:text-se-bone">
                  {missing.length} material{missing.length === 1 ? "" : "s"} without a published
                  Safety Data Sheet
                </summary>
                <ul className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1">
                  {missing.map((p) => (
                    <li key={p.id} className="text-[13px] text-se-steel">
                      <Link to={`/product/${p.slug}`} className="hover:text-se-bone transition">
                        {p.name}
                      </Link>
                    </li>
                  ))}
                </ul>
                <p className="mt-3 text-[12px] font-accent text-se-steel">
                  Request any of these at{" "}
                  <Link to="/contact" className="text-se-gold underline underline-offset-2">
                    contact
                  </Link>
                  .
                </p>
              </details>
            )}
          </section>

          {/* ── Policy documents ── */}
          <section className="mt-14" aria-labelledby="policy-heading">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-se-gold" aria-hidden="true" />
              <h2 id="policy-heading" className="font-display text-2xl text-se-bone">
                Policy Documents
              </h2>
            </div>
            <ul className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-2">
              {POLICY_DOCS.map((d) => (
                <li key={d.to}>
                  <Link
                    to={d.to}
                    className="text-[14px] text-se-bone/80 hover:text-se-gold underline underline-offset-2 transition"
                  >
                    {d.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <p className="mt-14 text-[11px] font-accent text-se-steel/80">
            For research use only. Not for human or veterinary use.
          </p>
        </div>
      </main>
    </>
  );
}
