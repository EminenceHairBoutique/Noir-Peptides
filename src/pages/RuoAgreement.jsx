// src/pages/RuoAgreement.jsx — Noir Peptides (public /legal/ruo-agreement)
// The standalone research-use agreement competitors publish as its own linkable
// document. The 21+ affirmation it references is enforced by <AgeGate> site-wide
// (src/App.jsx) and recorded, bindingly, by the registration attestation.
import React from "react";
import LegalPageLayout from "../components/LegalPageLayout";
import { RUO_AGREEMENT_DOC } from "../config/legalCopy";

export default function RuoAgreement() {
  return (
    <LegalPageLayout
      seoTitle="Research-Use Agreement | Noir Peptides"
      seoDescription="The terms under which Noir Peptides supplies peptide reference materials: laboratory research use by qualified purchasers only. Not for human or veterinary use."
      content={RUO_AGREEMENT_DOC}
    />
  );
}
