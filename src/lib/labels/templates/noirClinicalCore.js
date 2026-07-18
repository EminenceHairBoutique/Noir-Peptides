// Template 1 — NOIR CLINICAL CORE
// Restrained matte black/charcoal, crisp white pharmaceutical type, fine
// silver rules and a hairline inner frame. The evergreen system.
export default {
  id: "noir-clinical-core",
  name: "Noir Clinical Core",
  bg: "#0b0d12",            // matte near-black
  panel: "#10131a",
  fg: "#f2f4f8",
  fgMuted: "#9aa4b5",
  rule: "#4d5665",          // fine silver-gray
  accent: "#c8cfd9",        // cool silver
  warnFg: "#f2f4f8",
  warnRule: "#7d8798",
  tileBg: "#ffffff",        // solid field behind QR/barcode
  tileFg: "#0b0d12",
  monogram() {
    return { fill: "none", stroke: "#8a94a5", fg: "#f2f4f8" };
  },
  defs(w, h, uid) {
    return `
      <linearGradient id="np-core-sheen-${uid}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#161b24" stop-opacity="0.9"/>
        <stop offset="0.5" stop-color="#0b0d12" stop-opacity="0"/>
        <stop offset="1" stop-color="#060709" stop-opacity="0.8"/>
      </linearGradient>`;
  },
  // Soft vertical sheen + a fine silver inner frame — quiet, pharmaceutical.
  decorate(w, h, uid) {
    return (
      `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#np-core-sheen-${uid})"/>` +
      `<rect x="6" y="6" width="${w - 12}" height="${h - 12}" fill="none" stroke="#39414e" stroke-width="1" opacity="0.85"/>`
    );
  },
};
