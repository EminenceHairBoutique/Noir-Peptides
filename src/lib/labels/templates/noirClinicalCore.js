// Template 1 — NOIR CLINICAL CORE
// Restrained matte black/charcoal, crisp white pharmaceutical type, fine
// silver rules. The evergreen system. Pure token module (Node-safe).
export default {
  id: "noir-clinical-core",
  name: "Noir Clinical Core",
  bg: "#0b0d12",            // matte near-black
  panel: "#10131a",
  fg: "#f2f4f8",
  fgMuted: "#9aa4b5",
  rule: "#5c6674",          // fine silver-gray
  accent: "#c8cfd9",        // cool silver (family accent tints from this)
  warnFg: "#f2f4f8",
  warnRule: "#8a94a5",
  tileBg: "#ffffff",        // solid field behind QR/barcode
  tileFg: "#0b0d12",
  defs() {
    return "";
  },
  // Subtle vertical hairline texture on the flanks only.
  decorate(w, h) {
    let lines = "";
    for (let x = 12; x < w; x += 60) {
      lines += `<line x1="${x}" y1="10" x2="${x}" y2="${h - 10}" stroke="#1a1f28" stroke-width="1"/>`;
    }
    return `<g opacity="0.5">${lines}</g>`;
  },
};
