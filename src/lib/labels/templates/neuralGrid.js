// Template 4 — NEURAL GRID
// Dark base with a subtle computational coordinate grid + one waveform trace.
// Disciplined: the pattern stays far below the type in contrast; no clutter,
// no cyberpunk. Microtext-style rule under the wordmark.
export default {
  id: "neural-grid",
  name: "Neural Grid",
  bg: "#0a0f16",
  panel: "#0e141d",
  fg: "#eef2f7",
  fgMuted: "#93a0b4",
  rule: "#3f4b5e",
  accent: "#39c2ff",
  warnFg: "#eef2f7",
  warnRule: "#8a94a5",
  tileBg: "#ffffff",
  tileFg: "#0a0f16",
  defs() {
    return `
      <pattern id="np-grid" width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M24 0H0V24" fill="none" stroke="#141c28" stroke-width="1"/>
      </pattern>`;
  },
  decorate(w, h) {
    // Full-bleed faint grid + one low-amplitude waveform near the base.
    const midY = h - 34;
    let d = `M0 ${midY}`;
    for (let x = 0; x <= w; x += 16) {
      const y = midY + Math.round(Math.sin(x / 26) * 6);
      d += ` L${x} ${y}`;
    }
    return (
      `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#np-grid)" opacity="0.55"/>` +
      `<path d="${d}" fill="none" stroke="#1f4a63" stroke-width="1.5" opacity="0.8"/>`
    );
  },
};
