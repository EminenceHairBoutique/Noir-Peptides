// src/components/FreeShipProgress.jsx
// Free-shipping progress for the cart (Task 5). Reads the SAME threshold the
// server prices against (src/config/checkout.js FREE_SHIP_THRESHOLD, which
// lib/shipping.js resolves from) — so the number shown can never disagree
// with the number charged.
//
// Displays the remaining amount when below the threshold and a plain
// confirmation once qualified. No urgency language, no countdowns.
import { FREE_SHIP_THRESHOLD } from "../config/checkout";

const money = (n) => `$${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

export default function FreeShipProgress({ subtotal }) {
  const s = Number(subtotal || 0);
  if (!Number.isFinite(s) || s <= 0) return null;
  const remaining = Math.max(0, FREE_SHIP_THRESHOLD - s);
  const pct = Math.max(0, Math.min(100, (s / FREE_SHIP_THRESHOLD) * 100));
  const qualified = remaining === 0;

  return (
    <div data-testid="free-ship-progress" className="mt-4">
      <p className="text-[12px] font-accent text-se-bone/70">
        {qualified
          ? `Qualifies for free shipping (orders over ${money(FREE_SHIP_THRESHOLD)}).`
          : `${money(remaining)} away from free shipping.`}
      </p>
      <div
        className="mt-1.5 h-1 w-full rounded-full bg-se-concrete overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={FREE_SHIP_THRESHOLD}
        aria-valuenow={Math.min(s, FREE_SHIP_THRESHOLD)}
        aria-label="Progress toward free shipping"
      >
        <div
          className={`h-full transition-all ${qualified ? "bg-emerald-400" : "bg-se-gold"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
