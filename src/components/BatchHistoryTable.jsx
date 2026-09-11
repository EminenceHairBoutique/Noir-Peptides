// src/components/BatchHistoryTable.jsx
// Per-product certificate (batch) history as a REAL table (W4). Columns: lot,
// purity %, CAS, test date, lab, HPLC, MS identity, certificate link. Values
// render only when present — never "N/A" or a placeholder. Rows are expected
// pre-sorted newest-test-first by the caller (groupByProduct does this).
//
// Sept-11 T3 honesty rules (shared with the prerenderer via src/lib/coaTable):
//  - the CAS column is rendered only when `showCas` (default: some row on this
//    table carries one) — a column of blanks implies data that does not exist;
//  - a row with a confirmed MS identity but no purity figure shows an
//    "Identity panel only" chip instead of a blank;
//  - the certificate link is labelled by the asset's real type — an image is
//    never called "PDF".
//
// Claim-safe: analytical facts only. The MS column reports confirmation state
// verbatim from the certificate row.
import { FileText } from "lucide-react";
import LabVerifyLink from "./LabVerifyLink";
import { certificateLabel, purityCell } from "../lib/coaTable";
import { hasAnyCas } from "../lib/coaStats";

function fmtDate(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(d);
  }
}

export default function BatchHistoryTable({ rows, captionId, productName, showCas }) {
  if (!rows || rows.length === 0) return null;
  // Page-level callers (the /test-results dashboard) pass showCas so every
  // table on the page agrees; otherwise decide from this table's own rows.
  const casColumn = typeof showCas === "boolean" ? showCas : hasAnyCas(rows);
  return (
    <div className="overflow-x-auto">
      <table
        className="w-full text-left text-sm border-separate border-spacing-0"
        aria-describedby={captionId}
      >
        <caption id={captionId} className="sr-only">
          Published certificate history for {productName}
        </caption>
        <thead>
          <tr className="text-[10px] font-accent uppercase tracking-[0.14em] text-se-steel">
            <th scope="col" className="py-2 pr-4 border-b border-se-concrete">Lot</th>
            <th scope="col" className="py-2 pr-4 border-b border-se-concrete">Purity %</th>
            {casColumn && (
              <th scope="col" className="py-2 pr-4 border-b border-se-concrete">CAS</th>
            )}
            <th scope="col" className="py-2 pr-4 border-b border-se-concrete">Test date</th>
            <th scope="col" className="py-2 pr-4 border-b border-se-concrete">Lab</th>
            <th scope="col" className="py-2 pr-4 border-b border-se-concrete">Verify at lab</th>
            <th scope="col" className="py-2 pr-4 border-b border-se-concrete">HPLC</th>
            <th scope="col" className="py-2 pr-4 border-b border-se-concrete">MS identity</th>
            <th scope="col" className="py-2 border-b border-se-concrete">Certificate</th>
          </tr>
        </thead>
        <tbody className="text-se-bone/80 font-accent">
          {rows.map((c) => {
            const lot = c.lot || c.lot_number || c.batch_number || "";
            return (
              <tr key={c.id}>
                <th scope="row" className="py-2.5 pr-4 border-b border-se-concrete/50 font-mono font-normal text-se-bone">
                  {lot}
                </th>
                <td className="py-2.5 pr-4 border-b border-se-concrete/50">
                  {(() => {
                    const cell = purityCell(c);
                    if (cell.kind === "chip") {
                      return (
                        <span
                          data-testid="identity-only-chip"
                          className="inline-block rounded-full border border-white/15 px-2 py-0.5 text-[10px] uppercase tracking-[0.12em] text-se-steel"
                        >
                          {cell.text}
                        </span>
                      );
                    }
                    return cell.kind === "value" ? cell.text : "";
                  })()}
                </td>
                {casColumn && (
                  <td className="py-2.5 pr-4 border-b border-se-concrete/50 font-mono">
                    {c.cas_number || ""}
                  </td>
                )}
                <td className="py-2.5 pr-4 border-b border-se-concrete/50">{fmtDate(c.tested_at)}</td>
                <td className="py-2.5 pr-4 border-b border-se-concrete/50">
                  {c.lab?.name || c.lab_name || ""}
                  {c.lab?.accreditation_body && (
                    <span className="block text-[10px] text-se-steel">
                      {c.lab.accreditation_body}
                      {c.lab.accreditation_number ? ` · ${c.lab.accreditation_number}` : ""}
                    </span>
                  )}
                </td>
                <td className="py-2.5 pr-4 border-b border-se-concrete/50">
                  <LabVerifyLink coa={c} compact />
                </td>
                <td className="py-2.5 pr-4 border-b border-se-concrete/50">{c.hplc || ""}</td>
                <td className="py-2.5 pr-4 border-b border-se-concrete/50">
                  {c.ms_confirmed === true ? "Confirmed" : c.ms_confirmed === false ? "Not confirmed" : c.mass_spec || ""}
                </td>
                <td className="py-2.5 border-b border-se-concrete/50">
                  {c.file_url ? (
                    <a
                      href={c.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-se-gold hover:underline"
                      aria-label={`${certificateLabel(c.file_url)} for lot ${lot}`}
                    >
                      <FileText size={13} aria-hidden="true" />
                      {certificateLabel(c.file_url)}
                    </a>
                  ) : (
                    ""
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
