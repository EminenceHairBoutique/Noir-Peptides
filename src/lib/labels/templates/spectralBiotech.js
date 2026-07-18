// Template 2 — SPECTRAL BIOTECH
// Graphite foundation with ONE restrained holographic security strip (SVG
// gradient on web; printed as a foil/spot layer — see LABEL_PRINT_SPECS).
// Codes and warnings always sit on solid high-contrast fields, never on the
// spectral strip.
export default {
  id: "spectral-biotech",
  name: "Spectral Biotech",
  bg: "#0c0e13",
  panel: "#12151c",
  fg: "#eef1f6",
  fgMuted: "#98a2b3",
  rule: "#4c5666",
  accent: "#7fd4ff",
  warnFg: "#eef1f6",
  warnRule: "#8a94a5",
  tileBg: "#ffffff",
  tileFg: "#0c0e13",
  defs() {
    return `
      <linearGradient id="np-spectral" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#6ee7ff" stop-opacity="0.85"/>
        <stop offset="0.3" stop-color="#a78bfa" stop-opacity="0.7"/>
        <stop offset="0.55" stop-color="#5eead4" stop-opacity="0.7"/>
        <stop offset="0.8" stop-color="#93c5fd" stop-opacity="0.75"/>
        <stop offset="1" stop-color="#f0abfc" stop-opacity="0.6"/>
      </linearGradient>`;
  },
  // A single narrow spectral security strip along the top edge.
  decorate(w) {
    return (
      `<rect x="0" y="0" width="${w}" height="7" fill="url(#np-spectral)"/>` +
      `<rect x="0" y="7" width="${w}" height="1.5" fill="#2a3140"/>`
    );
  },
};
