// src/components/FreeShipProgress.jsx
// Free-shipping progress for the cart (Task 5). Reads the SAME threshold the
// server prices against (src/config/checkout.js FREE_SHIP_THRESHOLD, which
// lib/shipping.js resolves from) — so the number shown can never disagree
// with the number charged.
//
// Displays the remaining amount when below the threshold and a plain
// confirmation once qualified. No urgency language, no countdowns.
import { FREE_SHIP_THRESHOLD, freeShipProgressCents, toCents } from "../config/checkout";
import FreeShipNudge from "./FreeShipNudge";

export default function FreeShipProgress({ subtotal }) {
  const cents = toCents(subtotal);
  if (cents <= 0) return null;
  // Integer-cents maths (Sept-11 T5); the text line is the shared nudge so
  // the drawer and the cart page can never word it differently.
  const { qualifies: qualified, pct } = freeShipProgressCents(cents);

  return (
    <div data-testid="free-ship-progress" className="mt-4">
      <FreeShipNudge subtotal={subtotal} />
      <div
        className="mt-1.5 h-1 w-full rounded-full bg-se-concrete overflow-hidden"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={FREE_SHIP_THRESHOLD}
        aria-valuenow={Math.min(cents / 100, FREE_SHIP_THRESHOLD)}
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
