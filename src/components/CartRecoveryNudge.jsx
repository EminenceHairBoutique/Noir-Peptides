// src/components/CartRecoveryNudge.jsx — saved-cart return affordance
// (opt cycle 11, 4.14d). Mounted by App.jsx ONLY when VITE_FEATURE_CART_RECOVERY
// is on (default off). Reads the persisted cart through CartContext (np_cart)
// and never the tab-scoped checkout draft — a documented compliance decision:
// the draft holds personal and certification fields and must not be surfaced
// outside the checkout. Client-only; no network, no email.
import React, { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { X } from "lucide-react";
import { useCart } from "../context/CartContext";

const HIDDEN_ON = [/^\/cart/, /^\/checkout/, /^\/success/, /^\/cancel/, /^\/admin/, /^\/login/, /^\/register/];
const DISMISS_KEY = "np_cart_nudge_dismissed";

function readDismissed() {
  try { return sessionStorage.getItem(DISMISS_KEY) === "1"; } catch { return false; }
}
// The consent sheet (CookieBanner) owns the bottom of the viewport until it is
// answered; the nudge waits for it (opt cycle 12).
function consentAnswered() {
  try { return Boolean(localStorage.getItem("np_cookie_consent")); } catch { return true; }
}

export default function CartRecoveryNudge() {
  const { items } = useCart();
  const location = useLocation();
  const [dismissed, setDismissed] = useState(readDismissed);
  const [consented, setConsented] = useState(consentAnswered);
  const count = items.reduce((sum, i) => sum + (Number(i.quantity) || 1), 0);

  useEffect(() => { setDismissed(readDismissed()); }, [location.pathname]);
  useEffect(() => {
    const onConsent = () => setConsented(consentAnswered());
    window.addEventListener("se_consent_updated", onConsent);
    return () => window.removeEventListener("se_consent_updated", onConsent);
  }, []);

  if (dismissed || !consented || count === 0 || HIDDEN_ON.some((re) => re.test(location.pathname))) return null;

  const dismiss = () => {
    try { sessionStorage.setItem(DISMISS_KEY, "1"); } catch { /* private mode */ }
    setDismissed(true);
    // The focused button is about to disappear — land on the page's main landmark.
    document.getElementById("main")?.focus();
  };

  return (
    /* Opt cycle 12 (4.10): clears the 52 px bottom nav below md with the same
       offset the consent sheet uses; z-[45] sits above the bar (z-40) and below
       the consent sheet (z-50). A named region with a polite live area. */
    <div
      role="region"
      aria-label="Saved cart"
      data-testid="cart-recovery-nudge"
      className="fixed left-4 right-4 sm:left-auto sm:right-6 sm:max-w-sm z-[45] bottom-[max(1rem,env(safe-area-inset-bottom))] max-md:bottom-[calc(52px+1rem+env(safe-area-inset-bottom))] glass-panel border border-se-concrete p-4 flex items-center gap-3"
    >
      <div className="flex-1 min-w-0" aria-live="polite">
        <p className="text-[13px] font-accent text-se-bone">Your cart is saved.</p>
        <p className="text-[11px] font-accent text-se-steel">
          {count} {count === 1 ? "item" : "items"} waiting. Prices are confirmed at checkout.
        </p>
      </div>
      <Link to="/cart" className="btn-outline text-[11px] px-4 py-3 min-h-[44px] inline-flex items-center whitespace-nowrap">
        Return to cart
      </Link>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss saved-cart notice"
        className="p-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center text-se-steel hover:text-se-bone"
      >
        <X size={16} aria-hidden="true" />
      </button>
    </div>
  );
}
