// src/pages/CoaPolicy.jsx — Noir Peptides
import React from "react";
import LegalPageLayout from "../components/LegalPageLayout";
import { COA_POLICY_DOC } from "../config/legalCopy";

export default function CoaPolicy() {
  return (
    <LegalPageLayout
      seoTitle="COA Policy | Noir Peptides"
      seoDescription="How Noir Peptides documents batch-specific Certificates of Analysis for research reference materials. For research use only."
      content={COA_POLICY_DOC}
    />
  );
}
