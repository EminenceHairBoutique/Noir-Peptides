// src/pages/VerifyLot.jsx
// Lot-verification lookup. The QR printed on each vial deep-links here
// (/verify?lot=XXX); a buyer can also type the lot manually. Shows the matching
// published COA or a clear "no match" so a counterfeit lot is obvious.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { CheckCircle2, XCircle, Search } from "lucide-react";
import SEO from "../components/SEO";
import CoaCard from "../components/CoaCard";
import { lookupByLot } from "../lib/coas";
import { getAllProducts } from "../data/tier1Catalog";

const ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "https://www.noirpeptides.com";

export default function VerifyLot() {
  const [params, setParams] = useSearchParams();
  const lot = params.get("lot") || "";
  const [input, setInput] = useState(lot);
  const [coa, setCoa] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | found | notfound

  const nameById = useMemo(() => {
    const m = {};
    for (const p of getAllProducts()) m[p.id] = p.name;
    return m;
  }, []);

  useEffect(() => {
    let alive = true;
    if (!lot.trim()) {
      setStatus("idle");
      setCoa(null);
      return;
    }
    setStatus("loading");
    lookupByLot(lot).then((row) => {
      if (!alive) return;
      setCoa(row);
      setStatus(row ? "found" : "notfound");
    });
    return () => {
      alive = false;
    };
  }, [lot]);

  function onSubmit(e) {
    e.preventDefault();
    setParams(input.trim() ? { lot: input.trim() } : {});
  }

  return (
    <>
      <SEO
        title="Verify a Lot — Certificate of Analysis"
        description="Verify the lot printed on your Noir Peptides vial against its batch-specific certificate of analysis. For research use only. Not for human or veterinary use."
        type="website"
        noindex
      />

      <main className="min-h-screen bg-se-black">
        <div className="content-wide pt-28 pb-16 max-w-3xl">
          <h1 className="font-display text-3xl text-se-bone">Verify a Lot</h1>
          <p className="mt-2 text-se-steel">
            Enter the lot number from your vial to view its certificate of analysis.
          </p>

          <form onSubmit={onSubmit} className="mt-6 flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Lot number…"
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

          <div className="mt-8">
            {status === "loading" && <p className="text-se-steel">Checking lot…</p>}

            {status === "found" && (
              <>
                <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300">
                  <CheckCircle2 size={15} />
                  Verified — certificate on file for lot {coa.lot}
                </div>
                <CoaCard coa={coa} productName={nameById[coa.product_id]} origin={ORIGIN} showQr={false} />
              </>
            )}

            {status === "notfound" && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6">
                <div className="inline-flex items-center gap-2 text-red-300">
                  <XCircle size={16} />
                  <span className="font-medium">No published certificate matches “{lot}”.</span>
                </div>
                <p className="mt-2 text-sm text-se-steel">
                  Double-check the lot exactly as printed on the vial. If it still doesn’t
                  match, the certificate may not be published yet — browse the{" "}
                  <Link to="/test-results" className="text-se-gold hover:underline">
                    full test-results library
                  </Link>{" "}
                  or contact us.
                </p>
              </div>
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
