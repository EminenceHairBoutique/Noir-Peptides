// src/pages/Terms.jsx — Noir Peptides
import React from "react";
import LegalPageLayout from "../components/LegalPageLayout";
import { TERMS_DOC } from "../config/legalCopy";

export default function Terms() {
  return (
    <LegalPageLayout
      seoTitle="Terms & Conditions | Noir Peptides"
      seoDescription="Terms and conditions for Noir Peptides. Research use only. Not for human or veterinary use."
      content={TERMS_DOC}
    />
  );
}
