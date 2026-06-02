// src/pages/FdaDisclaimer.jsx — Noir Peptides (public /legal)
import React from "react";
import LegalPageLayout from "../components/LegalPageLayout";
import { FDA_DISCLAIMER_DOC } from "../config/legalCopy";

export default function FdaDisclaimer() {
  return (
    <LegalPageLayout
      seoTitle="FDA Disclaimer | Noir Peptides"
      seoDescription="Noir Peptides products are not FDA approved and are not intended to diagnose, treat, cure, or prevent any disease. For research use only."
      content={FDA_DISCLAIMER_DOC}
    />
  );
}
