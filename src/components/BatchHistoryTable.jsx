// src/components/BatchHistoryTable.jsx
// Per-product certificate (batch) history as a REAL table (W4). Columns: lot,
// purity %, CAS, test date, lab, HPLC, MS identity, certificate link. Values
// render only when present — a null CAS or missing purity renders an empty
// cell, never "N/A" or a placeholder. Rows are expected pre-sorted
// newest-test-first by the caller (groupByProduct does this).
//
// Claim-safe: analytical facts only. The MS column reports confirmation state
// verbatim from the certificate row.
import { FileText } from "lucide-react";

function fmtDate(d) {
  if (!d) return "";
  try {
    return new Date(d).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  } catch {
    return String(d);
  }
}

export default function BatchHistoryTable({ rows, captionId, productName }) {
  if (!rows || rows.length === 0) return null;
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
            <th scope="col" className="py-2 pr-4 border-b border-se-concrete">CAS</th>
            <th scope="col" className="py-2 pr-4 border-b border-se-concrete">Test date</th>
            <th scope="col" className="py-2 pr-4 border-b border-se-concrete">Lab</th>
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
                  {c.purity_percent != null ? `${c.purity_percent}%` : ""}
                </td>
                <td className="py-2.5 pr-4 border-b border-se-concrete/50 font-mono">
                  {c.cas_number || ""}
                </td>
                <td className="py-2.5 pr-4 border-b border-se-concrete/50">{fmtDate(c.tested_at)}</td>
                <td className="py-2.5 pr-4 border-b border-se-concrete/50">{c.lab_name || ""}</td>
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
                      aria-label={`Certificate PDF for lot ${lot}`}
                    >
                      <FileText size={13} aria-hidden="true" />
                      PDF
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
