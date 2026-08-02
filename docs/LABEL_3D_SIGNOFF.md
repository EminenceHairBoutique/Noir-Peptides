# 3D Vial — Phase 3 Sign-off Package

_Interactive procedural 10 mL serum vial (Label Studio → 3D vial view),
textured with the EXACT-master label renders. Sign-off renders:
`docs/labels/vial-renders/` (one per template + back views showing the wrap
seam placement)._

## What changed for Phase 3

| Area | Change |
|---|---|
| Geometry | Tall masters (Spectral/Neural ≈ 34 mm) now clamp to the vial's straight wall — the label top never rides the shoulder curve; per-template height follows the artwork aspect (no stretching) |
| Texture quality | Anisotropic filtering (up to 8×, clamped to device max) — label text stays sharp at grazing angles |
| Default framing | Camera pulled back so the full vial (cap included) is in frame at rest |
| Studio responsiveness | Label re-rasterization debounced (350 ms) — typing in the form no longer re-renders the texture per keystroke; the previous texture stays until the new one is ready |
| Mobile | Antialiasing off on phones/tablets (GPU headroom), 1024 px texture cap (vs 2048 desktop), dpr ≤ 2 |

## Performance architecture (unchanged, verified)

- three.js + r3f live ONLY in the lazy `vendor-three` chunk (245 KB gzip),
  loaded when an admin opens the 3D view — never in the initial bundle.
- `frameloop="demand"`: zero GPU work unless rotating/interacting; auto-rotate
  invalidates per frame and pauses on interaction and under
  `prefers-reduced-motion` (browser rAF throttling idles hidden tabs).
- IntersectionObserver gate + WebGL probe in `VialPreview`; devices without
  WebGL get the flat label; textures + render targets dispose on unmount;
  context-loss handled.
- Wheel zoom stays OFF (page scroll never traps); zoom via 44 px +/− buttons;
  Front/Back/Reset controls; screen-reader summary carries the label content.

## Sign-off checklist for the owner (on the Vercel preview)

1. Open `/admin/labels` → any draft → **3D vial** on desktop: drag-rotate,
   Front/Back, +/−, reset, auto-rotate toggle.
2. Same on a phone (iOS Safari + Android Chrome): page scroll must never
   trap over the canvas; rotation via drag; textures crisp; no heat/jank.
3. Confirm the wrap seam (back, gap ≈ 23°) and label position per template.
4. Approve → Phase 4 (full catalog rollout matrix), then Phase 5
   (customer-facing PDP/shop integration with static-poster lazy 3D).

## Render harness note

The sign-off renders were produced headlessly (Chromium WebGL) from a harness
that mirrors `VialScene.jsx` constants exactly (geometry, materials, lights,
environment); the interactive component itself is what ships.
