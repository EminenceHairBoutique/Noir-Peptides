// src/pages/Quality.jsx — Noir Peptides
import React from "react";
import LegalPageLayout from "../components/LegalPageLayout";
import { QUALITY_DOC } from "../config/legalCopy";

export default function Quality() {
  return (
    <LegalPageLayout
      seoTitle="Quality & Batch Standards | Noir Peptides"
      seoDescription="Noir Peptides quality and batch standards. Research-use transparency, batch documentation, and clear product metadata."
      content={QUALITY_DOC}
    />
  );
}
