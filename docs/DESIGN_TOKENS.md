# Design tokens (opt cycle 11, scorecard 4.8)

One palette, written once. `scripts/test-design-tokens.mjs` (in `npm run test:unit`)
gates everything on this page.

## Where the values live

| Layer | File | What it holds |
| --- | --- | --- |
| **Tokens** | `src/index.css` `:root { … }` | The only place a palette hex is written: `--noir-*` (bg, surface, elevated, border, accent, accent-dim, accent-glow, text, muted, success, warning, danger), the legacy `--se-*` aliases (each a `var(--noir-*)`, plus the three unique legacy values `--se-cream`, `--se-white`, `--se-red-bright`), the three font stacks (`--font-heading`, `--font-body`, `--font-mono`) and the spacing rhythm. |
| **Tailwind namespace** | `src/index.css` `@theme inline { … }` | `--color-se-*` and `--color-noir-*`, every one a `var()` reference to a `:root` token — no literal. `inline` makes utilities carry the reference (`color: var(--se-steel)`), so opacity modifiers such as `text-se-steel/70` keep working through `color-mix()`. |
| **Utilities / components** | `src/index.css` below the theme, `src/**/*.jsx` | `bg-se-*`, `text-noir-*`, `.glass-panel`, `.btn-*` … all resolve to the same hex. |

Tailwind v4 reads no `tailwind.config.js`; the one that used to sit at the repo root
described a different brand (Playfair, gold `#D4AF37`) and nothing imported it. It and
`src/input.css` (an unreferenced second entry point) are deleted; the gate keeps them
deleted. The three `--font-family-*` lines that used to sit in `@theme` were a v3-style
namespace v4 ignores; the real font utilities are `.font-display` / `.font-accent` /
`.font-signature`, which read `--font-heading` / `--font-mono`.

## Rules

1. Add a colour to `:root` first; expose it to Tailwind by adding a `var()` line to
   `@theme inline`. Never write a hex in the theme block or a second time in `index.css`.
2. Every theme colour must be used by at least one utility in `src/`, and every `:root`
   token must be referenced somewhere (a dead token fails the gate).
3. Colour literals in JSX are ratcheted, never grown. Ceilings at the audit (2026-09-13):

   | Literal kind (src JSX) | Count | Where they cluster |
   | --- | --- | --- |
   | `#rrggbb` | 37 | `product3d/VialScene.jsx` (9, WebGL material colours), `Shop.jsx` (5), `AdminHome.jsx` (4) |
   | `rgba(…)` | 9 | motion shadows in `PublicLanding.jsx`, `Home.jsx` |
   | arbitrary colour classes `bg-[#…]` etc. | 26 | the same files |
   | palette hexes re-typed as literals | 6 | `#05080f` ×2, `#00c2ff` ×3, `#0a0e16`-style near-misses |

   Lower a ceiling in `scripts/test-design-tokens.mjs` whenever a count falls. The
   `text-[Npx]` size literals (hundreds) are recorded here as a known debt and are not
   gated: they are a typography-scale decision, not a colour-consistency one.

## Verification at the audit

Computed colours were captured for 13 representative selectors on `/shop` before and
after the restructure (`text-se-steel`, `bg-se-charcoal`, `border-se-concrete`,
`text-se-gold`, `bg-se-black`, `text-se-bone`, `text-se-steel/70`, `bg-se-gold/5`,
`text-se-bone/60`, `border-se-concrete/60`, `.glass-panel`, `.btn-primary`,
`.btn-outline`): 0 differences. Built CSS 83 827 → 83 255 bytes.
