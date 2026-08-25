// src/lib/haptics.js
// Guarded, progressive haptic pulses (MOBILE_ROADMAP #10). navigator.vibrate
// exists on Android browsers and is absent on iOS Safari — absence is a
// silent no-op, never an error. Users who ask the OS to reduce motion get no
// haptics either: there is no standard preference for vibration, so the
// motion preference is the closest expressed intent and we honor it.
// Confirmation-only: call these on completed actions (added to cart, lot
// verified), never on scrolls, hovers, or errors-in-passing.

const CAN_VIBRATE = typeof navigator !== "undefined" && typeof navigator.vibrate === "function";

function reducedMotion() {
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

function pulse(pattern) {
  if (!CAN_VIBRATE || reducedMotion()) return;
  try {
    navigator.vibrate(pattern);
  } catch {
    /* never let feedback break the action it confirms */
  }
}

/** Single light tick — item added to cart. */
export const hapticConfirm = () => pulse(15);

/** Double tick — lot verification came back authentic. */
export const hapticVerified = () => pulse([15, 60, 15]);
