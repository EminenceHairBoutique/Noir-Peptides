// src/pages/VerifyLot.jsx
// Verification lookup, two entry paths:
//   /verify-lot?lot=XXX — COA lookup by the lot printed on the vial
//   /v/:code            — label QR deep link (secure verification code) →
//                         batch verification via /api/verify (state banner +
//                         label fields + linked published COA)
import { useEffect, useMemo, useState } from "react";
import { useSearchParams, useParams, Link } from "react-router-dom";
import { CheckCircle2, XCircle, AlertTriangle, Search, ScanLine } from "lucide-react";
import QrScanner from "../components/QrScanner";
import { hapticVerified } from "../lib/haptics";
import SEO from "../components/SEO";
import CoaCard from "../components/CoaCard";
import TestPanel from "../components/TestPanel";
import { lookupByLot } from "../lib/coas";
import { verifyCode } from "../lib/labelsApi";
import { getAllProducts } from "../data/tier1Catalog";

const ORIGIN =
  typeof window !== "undefined" ? window.location.origin : "https://www.noirpeptides.com";

// Verification-state presentation (states come from /api/verify — never
// fabricated lab data).
const CODE_STATES = {
  verified: { icon: CheckCircle2, cls: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300", label: "Verified — authentic Noir Peptides label on file" },
  expired: { icon: AlertTriangle, cls: "border-amber-500/30 bg-amber-500/10 text-amber-300", label: "Past the labeled expiration / retest date" },
  recalled: { icon: XCircle, cls: "border-red-500/30 bg-red-500/10 text-red-300", label: "RECALLED — do not use this batch; contact support" },
  administrative_hold: { icon: AlertTriangle, cls: "border-amber-500/30 bg-amber-500/10 text-amber-300", label: "Administrative hold — verification temporarily withheld" },
  not_found: { icon: XCircle, cls: "border-red-500/30 bg-red-500/10 text-red-300", label: "Code not found — no matching label on file" },
  unavailable: { icon: AlertTriangle, cls: "border-white/15 bg-white/5 text-se-steel", label: "Verification temporarily unavailable — try again shortly" },
};

function CodeResult({ code }) {
  const [result, setResult] = useState(null);

  useEffect(() => {
    let alive = true;
    setResult(null);
    verifyCode(code).then((r) => {
      if (!alive) return;
      setResult(r);
      if (r?.state === "verified") hapticVerified();
    });
    return () => {
      alive = false;
    };
  }, [code]);

  if (!result) return <p className="text-se-steel">Checking code…</p>;
  const meta = CODE_STATES[result.state] || CODE_STATES.unavailable;
  const Icon = meta.icon;
  const l = result.label;

  return (
    <div className="space-y-4">
      <div className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm ${meta.cls}`}>
        <Icon size={15} />
        {meta.label}
      </div>
      <p className="text-[12px] text-se-steel font-mono">Code {code}</p>

      {l && (
        <dl className="rounded-xl border border-white/10 bg-white/[0.02] p-5 grid grid-cols-2 gap-x-6 gap-y-2 text-sm max-w-xl">
          <div><dt className="text-se-steel text-[11px] uppercase tracking-wide">Product</dt><dd className="text-se-bone">{l.display_name} {l.quantity_label}</dd></div>
          <div><dt className="text-se-steel text-[11px] uppercase tracking-wide">SKU</dt><dd className="text-se-bone font-mono">{l.sku || "—"}</dd></div>
          <div><dt className="text-se-steel text-[11px] uppercase tracking-wide">Lot</dt><dd className="text-se-bone font-mono">{l.lot_number || "—"}</dd></div>
          <div>
            <dt className="text-se-steel text-[11px] uppercase tracking-wide">{l.retest_date && !l.expiration_date ? "Retest" : "Expiration"}</dt>
            <dd className="text-se-bone font-mono">{l.expiration_date || l.retest_date || "—"}</dd>
          </div>
          {l.packaged_date && (
            <div><dt className="text-se-steel text-[11px] uppercase tracking-wide">Packaged</dt><dd className="text-se-bone font-mono">{l.packaged_date}</dd></div>
          )}
          <div><dt className="text-se-steel text-[11px] uppercase tracking-wide">Label version</dt><dd className="text-se-bone font-mono">v{l.label_version}</dd></div>
        </dl>
      )}

      {result.coa && (
        <div className="max-w-xl">
          <p className="text-[11px] uppercase tracking-[0.14em] text-se-gold mb-2">Linked certificate of analysis</p>
          <CoaCard coa={{ ...result.coa, lot_number: l?.lot_number, product_id: l?.product_id }} productName={l?.display_name} origin={ORIGIN} showQr={false} />
          {/* Full analytical panel for this exact lot — the page a scanned
              vial lands on. Renders nothing when no panel rows exist. */}
          <TestPanel tests={result.coa.tests} />
        </div>
      )}

      <p className="text-xs text-se-steel">{result.disclaimer || "For research use only. Not for human or veterinary use."}</p>
    </div>
  );
}

export default function VerifyLot() {
  const [params, setParams] = useSearchParams();
  const { code } = useParams(); // present on /v/:code
  const lot = params.get("lot") || "";
  const [input, setInput] = useState(lot);
  const [coa, setCoa] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | found | notfound
  const [scanOpen, setScanOpen] = useState(false);

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
          <h1 className="font-display text-3xl text-se-bone">
            {code ? "Batch Verification" : "Verify a Lot"}
          </h1>
          <p className="mt-2 text-se-steel">
            {code
              ? "This code was scanned from a Noir Peptides vial label."
              : "Enter the lot number from your vial to view its certificate of analysis."}
          </p>

          {code && (
            <div className="mt-8">
              <CodeResult code={code} />
              <div className="divider my-8" />
              <p className="text-[12px] text-se-steel mb-2">Or look up a lot number directly:</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => setScanOpen(true)}
            className="mt-6 inline-flex items-center gap-2 min-h-[44px] rounded-lg border border-se-gold/50 px-5 font-accent text-sm uppercase tracking-wide text-se-gold hover:bg-se-gold/10 transition"
          >
            <ScanLine size={16} aria-hidden="true" />
            Scan vial QR
          </button>
          <QrScanner open={scanOpen} onClose={() => setScanOpen(false)} />

          <form onSubmit={onSubmit} className="mt-4 flex gap-2">
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
