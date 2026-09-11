// src/components/FreeShipNudge.jsx
// One-line free-shipping nudge for the cart drawer and cart page (Sept-11 T5).
//
// The wording and the maths both come from src/config/checkout.js — the SAME
// threshold the server prices against — computed in integer cents. This
// component holds no number and no string of its own. Renders nothing for an
// empty cart.
import { freeShipNudgeText, toCents } from "../config/checkout";

export default function FreeShipNudge({ subtotal, className = "" }) {
  const text = freeShipNudgeText(toCents(subtotal));
  if (!text) return null;
  return (
    <p
      data-testid="free-ship-nudge"
      className={`text-[12px] font-accent ${text.startsWith("Free shipping") ? "text-emerald-300" : "text-se-bone/70"} ${className}`}
    >
      {text}
    </p>
  );
}
