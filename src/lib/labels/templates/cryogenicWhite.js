// Template 3 — CRYOGENIC WHITE
// Sterile white/light-gray pharmaceutical label; black and graphite type,
// minimal cool-blue hairline. Maximum legibility.
export default {
  id: "cryogenic-white",
  name: "Cryogenic White",
  bg: "#f7f8fa",
  panel: "#ffffff",
  fg: "#101318",
  fgMuted: "#565f6d",
  rule: "#c3cad4",
  accent: "#2f7fb8",        // restrained medical blue
  warnFg: "#101318",
  warnRule: "#8b94a2",
  tileBg: "#ffffff",
  tileFg: "#101318",
  light: true,
  defs() {
    return "";
  },
  decorate(w, h) {
    // One cool-blue hairline under the top edge; nothing else.
    return `<rect x="0" y="0" width="${w}" height="3" fill="#2f7fb8"/><rect x="0" y="${h - 2}" width="${w}" height="2" fill="#dfe4ea"/>`;
  },
};
