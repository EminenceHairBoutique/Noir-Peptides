// src/pages/ShippingRefunds.jsx — Noir Peptides
import React from "react";
import LegalPageLayout from "../components/LegalPageLayout";
import { SHIPPING_REFUNDS_DOC } from "../config/legalCopy";

export default function ShippingRefunds() {
  return (
    <LegalPageLayout
      seoTitle="Shipping & Refunds Policy | Noir Peptides"
      seoDescription="Noir Peptides shipping and refunds policy. Research use only. All sales final once shipped."
      content={SHIPPING_REFUNDS_DOC}
    />
  );
}
