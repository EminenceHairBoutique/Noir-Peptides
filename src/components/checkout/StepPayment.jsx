// src/components/checkout/StepPayment.jsx
// Checkout Step 2 (Payment). Renders the available rails from the payment
// abstraction. Crypto (BTCPay) is the primary/default rail; Stripe (card)
// shows when configured. Each rail hands off through the SAME existing
// server endpoints (which re-price server-side, verify webhook signatures,
// and key fulfillment on provider_ref for idempotency) — this step does not
// re-implement payment, it selects a rail and submits.
import React from "react";
import { Lock } from "lucide-react";
import { availableRails } from "../../lib/paymentRails";

export default function StepPayment({ onBack, onPay, submitting, error, selectedRail, setSelectedRail }) {
  const rails = availableRails();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2 text-[11px] text-se-steel font-accent">
        <Lock className="w-4 h-4" /> Encrypted payment · the compliance record for this order is
        stored before payment begins.
      </div>

      <fieldset className="space-y-3">
        <legend className="font-display text-[15px] tracking-[0.08em] mb-2">PAYMENT METHOD</legend>
        {rails.map((r) => (
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
        {rails.length === 1 && (
          <p className="text-[11px] text-se-steel font-accent">
            Card payments aren&apos;t configured on this deployment yet — crypto is available now.
          </p>
        )}
      </fieldset>

      {error && <p className="text-[12px] text-se-red-bright font-accent">{error}</p>}

      <div className="flex gap-3">
        <button type="button" onClick={onBack} disabled={submitting} className="btn-outline flex-1 disabled:opacity-50">
          Back
        </button>
        <button type="button" onClick={() => onPay(rails.find((r) => r.id === selectedRail))}
          disabled={submitting || !selectedRail} className="btn-primary flex-[2] disabled:opacity-50">
          {submitting ? "Redirecting…" : "Complete payment"}
        </button>
      </div>
    </div>
  );
}
