// src/pages/Privacy.jsx — Noir Peptides
import React from "react";
import LegalPageLayout from "../components/LegalPageLayout";
import { PRIVACY_DOC } from "../config/legalCopy";

export default function Privacy() {
  return (
    <LegalPageLayout
      seoTitle="Privacy Policy | Noir Peptides"
      seoDescription="Privacy policy for Noir Peptides."
      content={PRIVACY_DOC}
    />
  );
}
