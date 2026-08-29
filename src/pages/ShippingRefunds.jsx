// src/pages/ShippingRefunds.jsx — Noir Peptides
import React from "react";
import LegalPageLayout from "../components/LegalPageLayout";
import { SHIPPING_REFUNDS_DOC } from "../config/legalCopy";
import {
  BUSINESS,
  hasGuarantee,
  hasDiscreetPackaging,
  hasBillingDescriptor,
} from "../config/business";
import FulfillmentStatements from "../components/FulfillmentStatements";

export default function ShippingRefunds() {
  // Satisfaction guarantee is surfaced from the SAME config the footer/contact
  // use (src/config/business.js) — single source of truth. Renders nothing when
  // guaranteeDays is unset (default), so this page is unchanged until launch.
  // Task 5: how orders are packed and how the charge appears belong on the
  // shipping policy, but only once they are true of the real operation —
  // <FulfillmentStatements> renders nothing while the config is unset.
  const guarantee = hasGuarantee() ? (
    <p
      data-testid="returns-guarantee"
      className="text-[14px] font-accent text-se-gold"
    >
      {BUSINESS.guaranteeDays}-day satisfaction guarantee.
    </p>
  ) : null;
  const statements = <FulfillmentStatements />;
  const prelude =
    guarantee || hasDiscreetPackaging() || hasBillingDescriptor() ? (
      <div className="mb-8 space-y-3">
        {guarantee}
        {statements}
      </div>
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
