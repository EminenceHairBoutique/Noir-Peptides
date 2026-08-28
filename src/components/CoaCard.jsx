// src/components/CoaCard.jsx
// Renders a single batch-specific Certificate of Analysis: testing lab, lot,
// test date, HPLC purity, mass-spec identity confirmation, a link to the PDF,
// and a QR that deep-links to the lot-verification page (for printing on vial
// labels). Claim-safe: reports analytical facts only, no human-use language.
import { Link } from "react-router-dom";
import { FileText, ShieldCheck } from "lucide-react";
import QrCode from "./QrCode";
import LabVerifyLink from "./LabVerifyLink";
import { formatPurity } from "../lib/labVerify";

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
  // formatPurity honours purity_operator so ">= 99%" is never shown as "99%".
  const purity = formatPurity(coa) || coa.hplc || null;
  const lab = coa.lab || null;
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
            <dd className="text-se-bone">
              {lab?.name || coa.lab_name || "—"}
              {/* Naming the lab AND its accreditation is what audit sites
                  score; rendered only from real record values. */}
              {lab?.accreditation_body && (
                <span className="block text-[11px] text-se-steel">
                  {lab.accreditation_body}
                  {lab.accreditation_number ? ` · ${lab.accreditation_number}` : ""}
                </span>
              )}
            </dd>
          </div>
          {/* Net peptide content vs label claim: purity grades the peptide
              fraction; net content is how many mg are actually present. Both
              render only when the certificate records them. */}
          {coa.net_peptide_content_mg != null && (
            <div>
              <dt className="text-se-steel text-[11px] uppercase tracking-wide">Net peptide content</dt>
              <dd className="text-se-bone">
                {coa.net_peptide_content_mg} mg
                {coa.label_claim_mg != null && (
                  <span className="text-se-steel"> of {coa.label_claim_mg} mg label claim</span>
                )}
              </dd>
            </div>
          )}
          {/* Lot-level CAS (W1): OMITTED entirely when null — never "N/A". */}
          {coa.cas_number && (
            <div>
              <dt className="text-se-steel text-[11px] uppercase tracking-wide">CAS</dt>
              <dd className="text-se-bone font-mono">{coa.cas_number}</dd>
            </div>
          )}
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

        {/* SECOND FACTOR — resolves this lot on the lab's own public record.
            Renders only when the lab publishes a lookup and this lot has a
            code; its absence is honest, not hidden. */}
        <div className="mt-3">
          <LabVerifyLink coa={coa} lab={lab} />
        </div>

        {coa.file_url ? (
          <a
            href={coa.file_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm text-se-gold hover:underline"
          >
            <FileText size={15} />
            {/^data:|\.pdf($|\?)/i.test(coa.file_url) ? "View COA (PDF)" : "View full certificate"}
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
