/**
 * Shared Framer Motion presets for Noir Peptides.
 * Keeps all animation constants in one place so they stay consistent.
 * Uses subtle, luxury-appropriate timing – nothing floaty or excessive.
 */

// ─── Ease curves ───────────────────────────────────────────────────
export const ease = {
  out: [0.0, 0.0, 0.2, 1],
  inOut: [0.4, 0, 0.2, 1],
};

// ─── Fade-up (hero text, section intros) ───────────────────────────
export const fadeUp = {
  hidden: { opacity: 0, y: 8 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: ease.out },
  },
};

// ─── Fade in (images, subtle reveals) ──────────────────────────────
export const fadeIn = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.4, ease: ease.out },
  },
};

// ─── Scale-in (modals, drawers) ─────────────────────────────────────
export const scaleIn = {
  hidden: { opacity: 0, scale: 0.97 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 0.3, ease: ease.out },
  },
};

// ─── Stagger container for lists / grids ───────────────────────────
export const staggerContainer = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.07,
      delayChildren: 0.05,
    },
  },
};

// ─── Individual stagger child ───────────────────────────────────────
export const staggerChild = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: ease.out },
  },
};

// ─── Card hover lift (tiny – applied via whileHover) ────────────────
export const hoverLift = {
  y: -3,
  transition: { duration: 0.2, ease: ease.out },
};

// ─── Viewport defaults (trigger when 15 % of element is visible) ────
export const viewport = { once: true, amount: 0.15 };
