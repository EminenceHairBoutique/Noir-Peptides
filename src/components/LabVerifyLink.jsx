// src/components/LabVerifyLink.jsx
// The SECOND FACTOR: an outbound link to the issuing laboratory's own public
// record for this lot. Renders ONLY when the lab publishes a lookup template
// and this certificate carries a lookup code — otherwise nothing at all, so
// the absence of a link is itself honest.
//
// The link is clearly marked as leaving the site (external icon +
// "opens {host}" + rel="noopener noreferrer"), because the whole point is
// that the confirmation comes from a party other than us.
import { ExternalLink } from "lucide-react";
import { labVerifyUrl } from "../lib/labVerify";

export default function LabVerifyLink({ coa, lab, compact = false }) {
  const resolved = lab || coa?.lab || null;
  const url = labVerifyUrl(resolved, coa?.lab_lookup_code);
  if (!url) return null;

  let host = "";
  try {
    host = new URL(url).host;
  } catch {
    return null;
  }
  const labName = resolved?.name || "the testing laboratory";

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      data-testid="lab-verify-link"
      className={`inline-flex items-center gap-1.5 text-se-gold hover:underline font-accent ${
        compact ? "text-[11px]" : "text-[12px]"
      }`}
      aria-label={`Verify this lot at ${labName} — opens ${host} in a new tab`}
    >
      <ExternalLink size={compact ? 12 : 13} aria-hidden="true" />
      Verify at {labName}
      <span className="text-se-steel">— opens {host}</span>
    </a>
  );
}
