// src/components/checkout/StepPayment.jsx
// Checkout Step 2 (Payment). Rails come from the SERVER
// (GET /api/payment-rails) so the customer is never offered a processor this
// deployment can't actually charge — the previous build-time list showed crypto
// as the recommended option even when BTCPay was unconfigured (audit P1.2).
//
// Each rail hands off to the same server endpoints, which re-price
// server-side, verify webhook signatures, and key fulfillment on provider_ref.
// This step selects a rail and submits; it does not implement payment.
import React, { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { fetchPaymentRails } from "../../lib/paymentRails";
import FulfillmentStatements from "../FulfillmentStatements";

export default function StepPayment({ onBack, onPay, submitting, error, selectedRail, setSelectedRail }) {
  const [rails, setRails] = useState(null); // null = still loading
  const [degraded, setDegraded] = useState(false);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    let alive = true;
    fetchPaymentRails().then((d) => {
      if (!alive) return;
      setRails(d.rails);
      setDegraded(Boolean(d.degraded));
      setUnavailable(Boolean(d.unavailable));
      // Select the server's primary rail, or the first available one. Never
      // leave a stale selection pointing at a rail the server didn't offer.
      const ids = d.rails.map((r) => r.id);
      if (!ids.includes(selectedRail)) {
        const primary = d.rails.find((r) => r.primary) || d.rails[0];
        if (primary) setSelectedRail(primary.id);
      }
    });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[11px] text-se-steel font-accent">
        <Lock className="w-4 h-4" /> Encrypted payment · the compliance record for this order is
        stored before payment begins.
      </div>

      <fieldset className="space-y-3">
        <legend className="font-display text-[15px] tracking-[0.08em] mb-2">PAYMENT METHOD</legend>

        {rails === null && (
          <p className="text-[12.5px] text-se-steel font-accent">Checking available payment methods…</p>
        )}

        {rails !== null && unavailable && (
          <div className="glass-panel p-4 border border-amber-500/30">
            <p className="text-[13px] text-amber-300 font-accent">
              Payments are temporarily unavailable.
            </p>
            <p className="text-[12px] text-se-bone/60 font-accent mt-1">
              Your cart and research certification are saved. Please try again shortly, or contact
              support and we&apos;ll complete the order for you.
            </p>
          </div>
        )}

        {rails?.map((r) => (
          <label key={r.id} className={`flex items-center gap-3 p-4 border cursor-pointer transition ${
            selectedRail === r.id ? "border-se-gold bg-se-gold/5" : "border-se-concrete hover:border-se-steel"}`}>
            <input type="radio" name="rail" value={r.id} checked={selectedRail === r.id}
              onChange={() => setSelectedRail(r.id)} className="w-4 h-4 accent-se-gold" />
            <span className="flex-1 min-w-0">
              <span className="block text-[13.5px] font-accent text-se-bone">{r.label}</span>
              <span className="block text-[11.5px] text-se-steel font-accent">{r.note}</span>
            </span>
            {r.primary && <span className="text-[10px] uppercase tracking-wide text-se-gold font-accent">Recommended</span>}
          </label>
        ))}

        {degraded && rails?.length > 0 && (
          <p className="text-[11px] text-se-steel font-accent">
            We couldn&apos;t confirm every payment option just now; the methods above are available.
          </p>
        )}
      </fieldset>

      {/* Task 5: packaging and billing-descriptor facts belong here, at the
          moment the charge is authorised — an unrecognised descriptor is what
          becomes a chargeback. Renders nothing until the config is set. */}
      <FulfillmentStatements variant="inline" />

      {error && <p className="text-[12px] text-se-red-bright font-accent">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={onBack} disabled={submitting} className="btn-outline flex-1 disabled:opacity-50">
          Back
        </button>
        <button type="button" onClick={() => onPay(rails?.find((r) => r.id === selectedRail))}
          disabled={submitting || !selectedRail || !rails?.length}
          className="btn-primary flex-[2] disabled:opacity-50">
          {submitting ? "Redirecting…" : "Complete payment"}
        </button>
      </div>
    </div>
  );
}
