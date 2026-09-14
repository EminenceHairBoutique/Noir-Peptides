// src/lib/motion.js — programmatic motion that honours the user's setting
// (opt cycle 12, 4.10). framer-motion already respects prefers-reduced-motion
// through MotionConfig; the hand-written scrolls (route change, checkout step
// change, "notify me" jump, chat autoscroll) did not.
export function prefersReducedMotion() {
  try {
    return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
  } catch {
    return false;
  }
}

/** "smooth" unless the user asked for reduced motion, then "auto" (instant). */
export function scrollBehavior() {
  return prefersReducedMotion() ? "auto" : "smooth";
}
