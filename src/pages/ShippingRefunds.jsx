// src/pages/ShippingRefunds.jsx — Noir Peptides
import React from "react";
import LegalPageLayout from "../components/LegalPageLayout";
import { SHIPPING_REFUNDS_DOC } from "../config/legalCopy";
import { BUSINESS, hasGuarantee } from "../config/business";

export default function ShippingRefunds() {
  // Satisfaction guarantee is surfaced from the SAME config the footer/contact
  // use (src/config/business.js) — single source of truth. Renders nothing when
  // guaranteeDays is unset (default), so this page is unchanged until launch.
  const prelude = hasGuarantee() ? (
    <p
      data-testid="returns-guarantee"
      className="mb-8 text-[14px] font-accent text-se-gold"
    >
      {BUSINESS.guaranteeDays}-day satisfaction guarantee.
    </p>
  ) : null;

  return (
    <LegalPageLayout
      seoTitle="Shipping & Refunds Policy | Noir Peptides"
      seoDescription="Noir Peptides shipping and refunds policy. Research use only. All sales final once shipped."
      content={SHIPPING_REFUNDS_DOC}
      prelude={prelude}
    />
  );
}
