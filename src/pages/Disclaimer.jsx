// src/pages/Disclaimer.jsx — Noir Peptides
import React from "react";
import LegalPageLayout from "../components/LegalPageLayout";
import { DISCLAIMER_DOC } from "../config/legalCopy";

export default function Disclaimer() {
  return (
    <LegalPageLayout
      seoTitle="Research Use Disclaimer | Noir Peptides"
      seoDescription="Noir Peptides research use disclaimer. For research use only. Not for human or veterinary use. Not intended to diagnose, treat, cure, or prevent disease."
      content={DISCLAIMER_DOC}
    />
  );
}
