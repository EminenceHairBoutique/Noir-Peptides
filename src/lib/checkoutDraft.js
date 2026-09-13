// src/lib/checkoutDraft.js   (opt c6 — scorecard 4.5)
// The checkout step-1 draft survives a reload: contact, ship-to, billing,
// research use and shipping method live in sessionStorage (this tab only,
// gone when it closes — never localStorage). The three RUO certifications
// are deliberately not part of the draft: they are re-affirmed on every
// pass. Cleared the moment payment starts.
export const CHECKOUT_DRAFT_KEY = "noir_checkout_draft_v1";
const DRAFT_FIELDS = ["contact", "shipping", "billingDifferent", "billing", "research", "shippingMethod"];
export function readCheckoutDraft() {
  try {
    const raw = window.sessionStorage.getItem(CHECKOUT_DRAFT_KEY);
    if (!raw) return null;
    const d = JSON.parse(raw);
    if (!d || typeof d !== "object") return null;
    const out = {};
    for (const k of DRAFT_FIELDS) if (k in d) out[k] = d[k];
    return out;
  } catch { return null; }
}
export function writeCheckoutDraft(form) {
  try {
    const d = {};
    for (const k of DRAFT_FIELDS) d[k] = form[k];
    window.sessionStorage.setItem(CHECKOUT_DRAFT_KEY, JSON.stringify(d));
  } catch { /* storage unavailable — the draft is a convenience */ }
}
export function clearCheckoutDraft() {
  try { window.sessionStorage.removeItem(CHECKOUT_DRAFT_KEY); } catch { /* ignore */ }
}
