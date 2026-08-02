// lib/attestationStatements.js
// CANONICAL research-use attestation definition — the single source of truth
// shared by the client (src/config/attestation.js re-exports this) and the
// server (api/attestation.js validates against it). The server stores its OWN
// canonical text for each affirmed statement, ignoring any client-supplied
// text, so the recorded consent record is defensible and reconstructable for
// any version.
//
// Bumping ATTESTATION_VERSION forces every user to re-attest at their next
// gated navigation (the auth guard compares the profile's stored version
// against this value).

export const ATTESTATION_VERSION = "v1.0";

// The exact confirmation phrase the user must type to enable Submit.
export const CONFIRM_PHRASE = "FOR RESEARCH USE ONLY";

// Individually-checked affirmations. `id` is stored in the audit trail so the
// precise statement set agreed to is reconstructable for any version.
export const ATTESTATION_STATEMENTS = [
  {
    id: "age",
    text: "I am at least 21 years of age.",
  },
  {
    id: "research_intent",
    text: "I am acquiring these products solely for legitimate laboratory, research, analytical, or in-vitro purposes.",
  },
  {
    id: "no_consumption",
    text: "I understand these products are NOT for human or animal consumption, and are not drugs, food, supplements, or cosmetics.",
  },
  {
    id: "no_medical_use",
    text: "I understand these products are not approved by the FDA and are not intended to diagnose, treat, cure, or prevent any disease.",
  },
  {
    id: "no_guidance",
    text: "I understand Noir Peptides provides no dosing, administration, or usage instructions, and I will not request them.",
  },
  {
    id: "qualified_handler",
    text: "I am qualified to handle research materials and will follow good laboratory practices and applicable safety procedures.",
  },
  {
    id: "legal_compliance",
    text: "I am solely responsible for complying with all local, state, and federal laws governing the purchase, possession, and use of these materials in my jurisdiction.",
  },
  {
    id: "terms_privacy",
    text: "I have read and agree to the Terms & Conditions, Privacy Policy, and Research-Use Policy.",
  },
];

// Every statement ID that must be explicitly affirmed for a valid attestation.
export const REQUIRED_STATEMENT_IDS = ATTESTATION_STATEMENTS.map((s) => s.id);

// Fast lookup: id -> canonical text.
export const STATEMENT_TEXT_BY_ID = Object.fromEntries(
  ATTESTATION_STATEMENTS.map((s) => [s.id, s.text])
);
