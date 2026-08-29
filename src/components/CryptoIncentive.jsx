// src/components/CryptoIncentive.jsx
// Surfaces the crypto-payment discount BEFORE the payment step, where it can
// actually influence the choice, instead of only at rail selection.
//
// The percentage is never hardcoded here. It comes from GET /api/payment-rails,
// which reads the same BTCPAY_CRYPTO_DISCOUNT_PCT that
// api/btcpay/create-invoice.js applies to the invoice — so the advertised
// saving and the charged saving cannot drift apart.
//
// Renders NOTHING unless the server reports a live crypto rail AND a non-zero
// discount. This is the specific failure the rails endpoint was built to end:
// crypto was once advertised as the recommended option on a deployment where
// BTCPay was not configured, so customers picked it and got a 503. A degraded
// (unreachable) rails response also renders nothing — silence beats a claim we
// could not confirm.
import { useEffect, useState } from "react";
import { Bitcoin } from "lucide-react";
import { fetchPaymentRails } from "../lib/paymentRails";

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function CryptoIncentive({ subtotal = 0, className = "" }) {
  const [pct, setPct] = useState(0);

  useEffect(() => {
    let alive = true;
    fetchPaymentRails().then((d) => {
      if (!alive) return;
      const hasCrypto = Array.isArray(d?.rails) && d.rails.some((r) => r.id === "crypto");
      const p = Number(d?.cryptoDiscountPct || 0);
      setPct(!d?.degraded && hasCrypto && p > 0 ? p : 0);
    });
    return () => {
      alive = false;
    };
  }, []);

  if (!(pct > 0)) return null;

  const s = Number(subtotal || 0);
  // Mirrors the server: the discount applies to the goods subtotal (after any
  // promo code), not to shipping. Shown only when there is a subtotal to apply
  // it to, and described as an estimate because a promo code applied later
  // lowers the base it is taken from.
  const saving = s > 0 ? Math.round(s * (pct / 100) * 100) / 100 : 0;

  return (
    <div
      data-testid="crypto-incentive"
      className={`rounded-lg border border-se-gold/25 bg-se-gold/[0.04] px-3 py-2.5 ${className}`}
    >
      <p className="flex items-center gap-2 text-[12px] font-accent text-se-bone">
        <Bitcoin className="w-3.5 h-3.5 text-se-gold shrink-0" aria-hidden="true" />
        <span>
          Save {pct}% paying with crypto
          {saving > 0 ? <span className="text-se-gold"> — about {money(saving)} on this order</span> : null}
        </span>
      </p>
      <p className="mt-1 text-[11px] font-accent text-se-steel">
        Applied automatically at checkout when you choose the crypto rail. BTC, ETH,
        USDC and USDT; no account needed.
      </p>
    </div>
  );
}
