// src/components/CoaCard.jsx
// Renders a single batch-specific Certificate of Analysis: testing lab, lot,
// test date, HPLC purity, mass-spec identity confirmation, a link to the PDF,
// and a QR that deep-links to the lot-verification page (for printing on vial
// labels). Claim-safe: reports analytical facts only, no human-use language.
import { Link } from "react-router-dom";
import { FileText, ShieldCheck } from "lucide-react";
import QrCode from "./QrCode";

function fmtDate(d) {
  if (!d) return "—";
  try {
    return new Date(d).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return String(d);
  }
}

export default function CoaCard({ coa, productName, origin = "", showQr = true }) {
  if (!coa) return null;
  const lot = coa.lot || coa.lot_number || coa.batch_number || null;
  const purity = coa.hplc || (coa.purity_percent != null ? `${coa.purity_percent}%` : null);
  const verifyUrl = lot ? `${origin}/verify-lot?lot=${encodeURIComponent(lot)}` : null;

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 flex flex-col sm:flex-row gap-5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 text-se-gold">
          <ShieldCheck size={16} />
          <span className="text-[11px] font-accent tracking-[0.15em] uppercase">
            Certificate of Analysis
          </span>
        </div>

        <h3 className="mt-2 text-se-bone font-display text-lg truncate">
          {productName || coa.product_id}
        </h3>

        <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
          <div>
            <dt className="text-se-steel text-[11px] uppercase tracking-wide">Lot</dt>
            <dd className="text-se-bone font-mono">{lot || "—"}</dd>
          </div>
          <div>
            <dt className="text-se-steel text-[11px] uppercase tracking-wide">Testing lab</dt>
            <dd className="text-se-bone">{coa.lab_name || "—"}</dd>
          </div>
          <div>
            <dt className="text-se-steel text-[11px] uppercase tracking-wide">Test date</dt>
            <dd className="text-se-bone">{fmtDate(coa.tested_at)}</dd>
          </div>
          <div>
            <dt className="text-se-steel text-[11px] uppercase tracking-wide">HPLC purity</dt>
            <dd className="text-se-bone">{purity || "—"}</dd>
          </div>
          <div className="col-span-2">
            <dt className="text-se-steel text-[11px] uppercase tracking-wide">
              Mass-spec identity
            </dt>
            <dd className="text-se-bone">
              {coa.ms_confirmed === true
                ? "Confirmed"
                : coa.ms_confirmed === false
                ? "Not confirmed"
                : coa.mass_spec || "—"}
            </dd>
          </div>
        </dl>

        {coa.file_url ? (
          <a
            href={coa.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm text-se-gold hover:underline"
          >
            <FileText size={15} />
            View COA (PDF)
          </a>
        ) : null}
      </div>

      {showQr && verifyUrl ? (
        <div className="flex flex-col items-center gap-2 shrink-0">
          <QrCode value={verifyUrl} size={104} alt={`Verify lot ${lot}`} />
          <Link
            to={`/verify-lot?lot=${encodeURIComponent(lot)}`}
            className="text-[11px] text-se-steel hover:text-se-gold tracking-wide"
          >
            Verify this lot
          </Link>
        </div>
      ) : null}
    </div>
  );
}
