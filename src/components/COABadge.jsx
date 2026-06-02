// src/components/COABadge.jsx
// Renders a "COA Verified" badge only when a Certificate of Analysis URL
// is present. Opens the PDF in a new tab with safe rel attributes.
import React from "react";

export default function COABadge({ coaUrl, batchNumber, compact = false, className = "" }) {
  if (!coaUrl) return null;

  return (
    <a
      href={coaUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`inline-flex items-center gap-2 border border-se-gold/40 bg-se-gold/[0.08] hover:bg-se-gold/[0.14] hover:border-se-gold/70 transition text-se-gold ${
        compact ? "px-2 py-1" : "px-3 py-1.5"
      } ${className}`}
      aria-label={
        batchNumber
          ? `View Certificate of Analysis for batch ${batchNumber}`
          : "View Certificate of Analysis"
      }
    >
      <span
        className={`font-accent tracking-[0.16em] uppercase ${
          compact ? "text-[9px]" : "text-[10px]"
        }`}
      >
        ✓ COA Verified
      </span>
      {batchNumber && !compact && (
        <span className="font-accent text-[10px] tracking-[0.12em] text-se-gold/70">
          · Batch {batchNumber}
        </span>
      )}
    </a>
  );
}
