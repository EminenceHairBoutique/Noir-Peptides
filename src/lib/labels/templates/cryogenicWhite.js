// Template 3 — CRYOGENIC (WHITE)
// Sterile white, deep-navy type, medical-blue frame + blue quantity band
// with white type; faint hex micro-pattern ground (reference mockup,
// template 3).
export default {
  id: "cryogenic-white",
  name: "Cryogenic — White",
  bg: "#ffffff",
  panel: "#ffffff",
  fg: "#101c36",            // deep navy
  fgMuted: "#57657f",
  rule: "#bcc6d4",
  accent: "#1d6fb8",        // medical blue
  warnFg: "#101c36",
  warnRule: "#8f99aa",
  tileBg: "#ffffff",
  tileFg: "#101c36",
  bandFg: "#ffffff",        // white type on the blue band
  light: true,
  monogram() {
    return { fill: "#1d6fb8", stroke: "#155a97", fg: "#ffffff" };
  },
  frame() {
    return "#1d6fb8";
  },
  defs(w, h, uid) {
    return `
      <linearGradient id="np-band-${uid}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#155a97"/>
        <stop offset="0.5" stop-color="#3b8ad2"/>
        <stop offset="1" stop-color="#155a97"/>
      </linearGradient>
      <pattern id="np-cryo-hex-${uid}" width="22" height="38" patternUnits="userSpaceOnUse">
        <path d="M11 0 L22 6.3 L22 19 L11 25.3 L0 19 L0 6.3 Z M11 25.3 L11 38"
              fill="none" stroke="#eaeef3" stroke-width="1"/>
      </pattern>`;
  },
  decorate(w, h, uid) {
    return `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#np-cryo-hex-${uid})" opacity="0.8"/>`;
  },
};
