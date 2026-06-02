// src/components/DisclaimerBanner.jsx
// Reusable research-use compliance banner. Luxury compliance feel —
// dark surface, restrained red border, accessible contrast.
import React from "react";
import { AlertTriangle } from "lucide-react";
import { DISCLAIMER_FULL, DISCLAIMER_COMPACT } from "../config/compliance";

export default function DisclaimerBanner({ compact = false, className = "" }) {
  return (
    <div
      role="note"
      aria-label="Research use disclaimer"
      className={`flex items-start gap-3 border border-se-red/40 bg-[#180a0d] ${
        compact ? "px-3 py-2" : "px-4 py-3"
      } ${className}`}
    >
      <AlertTriangle
        className={`shrink-0 text-se-red-bright ${compact ? "mt-0.5 w-3.5 h-3.5" : "mt-0.5 w-4 h-4"}`}
        aria-hidden="true"
      />
      <p
        className={`font-accent text-se-bone/80 leading-relaxed ${
          compact ? "text-[10px]" : "text-[11px]"
        }`}
      >
        {compact ? DISCLAIMER_COMPACT : DISCLAIMER_FULL}
      </p>
    </div>
  );
}
