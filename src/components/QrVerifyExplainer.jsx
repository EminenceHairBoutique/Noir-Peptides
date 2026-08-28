// src/components/QrVerifyExplainer.jsx
// Factual explainer for the per-lot QR verification path (W8 / gap G3).
// Mechanism only: every vial label carries a QR unique to its lot; scanning it
// opens that lot's verification record and certificate. No superlatives, no
// comparative claims, no effect language.
import { Link } from "react-router-dom";
import { QrCode } from "lucide-react";

export default function QrVerifyExplainer({ compact = false }) {
  return (
    <div
      className={`rounded-xl border border-se-gold/25 bg-se-gold/[0.04] ${compact ? "p-4" : "p-5"}`}
      data-testid="qr-verify-explainer"
    >
      <div className="flex items-center gap-2 text-se-gold">
        <QrCode size={compact ? 14 : 16} aria-hidden="true" />
        <span className="text-[11px] font-accent tracking-[0.15em] uppercase">
          Verify the vial in hand
        </span>
      </div>
      <p className={`mt-2 text-se-bone/70 font-accent ${compact ? "text-[12px]" : "text-[13px]"} leading-relaxed`}>
        Every vial label carries a QR code unique to its lot. Scanning it opens that
        lot&rsquo;s verification record — its batch details and, where published, the
        certificate of analysis for that exact batch. You can also{" "}
        <Link to="/verify-lot" className="text-se-gold hover:underline">
          enter or scan a lot number
        </Link>{" "}
        directly.
      </p>
    </div>
  );
}
