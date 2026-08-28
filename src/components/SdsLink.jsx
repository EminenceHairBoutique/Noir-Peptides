// src/components/SdsLink.jsx
// Download link for a product's GHS 16-section Safety Data Sheet.
//
// Renders NOTHING when the product has no SDS on file (products.sds_file_url,
// migration 0033). An SDS is a controlled document: a dead link or a "coming
// soon" placeholder is worse than no link, because a purchaser's EHS review
// treats a broken SDS reference as a compliance failure rather than an absence.
import { FileDown } from "lucide-react";
import { hasSds, sdsRevision } from "../lib/sds";

export default function SdsLink({ product, className = "" }) {
  if (!hasSds(product)) return null;
  const revised = sdsRevision(product);

  return (
    <a
      href={product.sds_file_url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="sds-link"
      className={`inline-flex items-center gap-2 text-[12px] font-accent text-se-gold underline underline-offset-2 ${className}`}
    >
      <FileDown className="w-3.5 h-3.5" aria-hidden="true" />
      <span>
        Safety Data Sheet (GHS, 16-section)
        {revised ? <span className="text-se-steel"> — revised {revised}</span> : null}
      </span>
    </a>
  );
}
