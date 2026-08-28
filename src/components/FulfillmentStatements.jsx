// src/components/FulfillmentStatements.jsx
// Discreet-packaging and billing-descriptor statements (Task 5).
//
// Both are FACTUAL claims about how a real order is packed and how the charge
// appears on a real statement, so both live in src/config/business.js and are
// null by default. A wrong billing descriptor is not a cosmetic error — it is
// what turns an unrecognised charge into a chargeback — so nothing is rendered
// until the owner sets the true value.
import { Package, CreditCard } from "lucide-react";
import {
  BUSINESS,
  hasDiscreetPackaging,
  hasBillingDescriptor,
} from "../config/business";

/**
 * @param {"stacked"|"inline"} variant  layout context
 */
export default function FulfillmentStatements({ variant = "stacked", className = "" }) {
  const packaging = hasDiscreetPackaging();
  const descriptor = hasBillingDescriptor();
  if (!packaging && !descriptor) return null;

  const wrap =
    variant === "inline"
      ? `flex flex-wrap gap-x-5 gap-y-1 text-[12px] font-accent text-se-bone/60 ${className}`
      : `space-y-2 text-[13px] font-accent text-se-bone/60 ${className}`;

  return (
    <div className={wrap} data-testid="fulfillment-statements">
      {packaging && (
        <p className="flex items-start gap-2">
          <Package className="w-3.5 h-3.5 mt-0.5 text-se-gold shrink-0" aria-hidden="true" />
          <span>{BUSINESS.discreetPackaging}</span>
        </p>
      )}
      {descriptor && (
        <p className="flex items-start gap-2">
          <CreditCard className="w-3.5 h-3.5 mt-0.5 text-se-gold shrink-0" aria-hidden="true" />
          <span>
            Charges appear on your statement as{" "}
            <span className="text-se-bone" data-testid="billing-descriptor">
              {BUSINESS.billingDescriptor}
            </span>
            .
          </span>
        </p>
      )}
    </div>
  );
}
