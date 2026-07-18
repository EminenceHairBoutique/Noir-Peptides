// Template 3 — CRYOGENIC WHITE
// Sterile white pharmaceutical label: subtle cool hex micro-pattern ground,
// deep-navy type, restrained medical-blue accents. Maximum legibility.
export default {
  id: "cryogenic-white",
  name: "Cryogenic White",
  bg: "#fbfcfd",
  panel: "#ffffff",
  fg: "#16233f",            // deep navy
  fgMuted: "#5a6780",
  rule: "#c2cad6",
  accent: "#1d6fb8",        // medical blue
  warnFg: "#16233f",
  warnRule: "#8f99aa",
  tileBg: "#ffffff",
  tileFg: "#16233f",
  light: true,
  monogram() {
    return { fill: "#1b2a52", stroke: "#1d6fb8", fg: "#ffffff" };
  },
  defs(w, h, uid) {
    return `
      <pattern id="np-cryo-hex-${uid}" width="22" height="38" patternUnits="userSpaceOnUse">
        <path d="M11 0 L22 6.3 L22 19 L11 25.3 L0 19 L0 6.3 Z M11 25.3 L11 38"
              fill="none" stroke="#e4e9ef" stroke-width="1"/>
      </pattern>`;
  },
  decorate(w, h, uid) {
    return (
      `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#np-cryo-hex-${uid})" opacity="0.7"/>` +
      `<rect x="0" y="0" width="${w}" height="4" fill="#1d6fb8"/>` +
      `<rect x="0" y="${h - 2}" width="${w}" height="2" fill="#d8dee6"/>`
    );
  },
};
