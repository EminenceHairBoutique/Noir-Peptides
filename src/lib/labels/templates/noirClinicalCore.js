// Template 1 — NOIR CORE (BLACK)
// Matte black, white pharmaceutical type, silver frame + silver quantity
// band. The evergreen system (reference mockup, template 1).
export default {
  id: "noir-clinical-core",
  name: "Noir Core — Black",
  bg: "#0a0b0e",
  panel: "#101318",
  fg: "#f4f6f9",
  fgMuted: "#a7b0be",
  rule: "#5a6472",
  accent: "#aeb9c9",        // silver (icons + scan caption)
  warnFg: "#f4f6f9",
  warnRule: "#7d8798",
  tileBg: "#ffffff",
  tileFg: "#0a0b0e",
  bandFg: "#0a0b0e",        // dark type on the silver band
  monogram() {
    return { fill: "#14171d", stroke: "#9aa4b2", fg: "#f4f6f9" };
  },
  frame() {
    return "#8a94a2";
  },
  defs(w, h, uid) {
    return `
      <linearGradient id="np-band-${uid}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#6a7482"/>
        <stop offset="0.5" stop-color="#e8ecf1"/>
        <stop offset="1" stop-color="#8d97a5"/>
      </linearGradient>
      <linearGradient id="np-core-sheen-${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#151920" stop-opacity="0.9"/>
        <stop offset="0.5" stop-color="#0a0b0e" stop-opacity="0"/>
        <stop offset="1" stop-color="#06070a" stop-opacity="0.8"/>
      </linearGradient>`;
  },
  decorate(w, h, uid) {
    return `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#np-core-sheen-${uid})"/>`;
  },
};
