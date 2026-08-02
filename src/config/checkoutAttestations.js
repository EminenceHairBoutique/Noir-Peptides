// src/config/checkoutAttestations.js
// The three per-order RUO certification affirmations shown at checkout Step 1.
// OUR wording (not copied from any competitor). Each is independently required.
// The exact text here is what gets persisted with the order (Stage 4), so the
// consent record is reconstructable. Bump CHECKOUT_ATTESTATION_VERSION if any
// wording changes.
export const CHECKOUT_ATTESTATION_VERSION = "checkout-v1.0";

export const CHECKOUT_ATTESTATIONS = [
  {
    id: "ruo_only",
    text:
      "I confirm these materials are purchased strictly for laboratory research use only — " +
      "not for human or animal consumption, and not for any diagnostic, therapeutic, or household use.",
  },
  {
    id: "terms_privacy",
    text:
      "I have read and agree to the Terms & Conditions and the Privacy Policy.",
    // links rendered by the component so the labels can point at real routes.
    links: [
      { label: "Terms & Conditions", to: "/legal/terms" },
      { label: "Privacy Policy", to: "/legal/privacy" },
    ],
  },
  {
    id: "qualified_purchaser",
    text:
      "I am at least 21 years old and a qualified purchaser. I will not use these products for human " +
      "or animal consumption, or as food additives, drugs, or household chemicals, and I take full " +
      "responsibility for their lawful handling, storage, and disposal.",
  },
];

export const CHECKOUT_ATTESTATION_IDS = CHECKOUT_ATTESTATIONS.map((a) => a.id);
