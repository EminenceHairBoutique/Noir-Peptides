// src/pages/ResearchUsePolicy.jsx — Noir Peptides (public /legal)
import React from "react";
import LegalPageLayout from "../components/LegalPageLayout";
import { RESEARCH_USE_POLICY_DOC } from "../config/legalCopy";

export default function ResearchUsePolicy() {
  return (
    <LegalPageLayout
      seoTitle="Research-Use Policy | Noir Peptides"
      seoDescription="Noir Peptides research-use policy. Products are supplied strictly for laboratory and research use by qualified purchasers. Not for human or veterinary use."
      content={RESEARCH_USE_POLICY_DOC}
    />
  );
}
