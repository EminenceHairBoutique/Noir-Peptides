// Template 2 — SPECTRAL (HOLOGRAPHIC)
// Black foundation with an iridescent holographic frame + quantity band
// (reference mockup, template 2). PRINT: holo areas are a cold-foil /
// holographic-laminate SPOT layer; type, warnings and code tiles sit on
// solid black or white — never on the foil.
export default {
  id: "spectral-biotech",
  name: "Spectral — Holographic",
  bg: "#0a0a0e",
  panel: "#101218",
  fg: "#f2f4f8",
  fgMuted: "#a3abba",
  rule: "#565f6e",
  accent: "#a78bfa",        // iridescent violet (icons + scan caption)
  warnFg: "#f2f4f8",
  warnRule: "#7d8798",
  tileBg: "#ffffff",
  tileFg: "#0a0a0e",
  bandFg: "#0a0a0e",
  monogram(uid) {
    return { fill: "#14161c", stroke: `url(#np-holo-${uid})`, fg: "#f2f4f8" };
  },
  frame(uid) {
    return `url(#np-holo-${uid})`;
  },
  defs(w, h, uid) {
    return `
      <linearGradient id="np-holo-${uid}" x1="0" y1="0" x2="1" y2="0.3">
        <stop offset="0" stop-color="#67e8f9"/>
        <stop offset="0.25" stop-color="#a78bfa"/>
        <stop offset="0.5" stop-color="#5eead4"/>
        <stop offset="0.75" stop-color="#93c5fd"/>
        <stop offset="1" stop-color="#f0abfc"/>
      </linearGradient>
      <linearGradient id="np-band-${uid}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#9fb2c8"/>
        <stop offset="0.25" stop-color="#e7ebf2"/>
        <stop offset="0.5" stop-color="#c4b5e8"/>
        <stop offset="0.75" stop-color="#bfe3ea"/>
        <stop offset="1" stop-color="#94a5bb"/>
      </linearGradient>
      <linearGradient id="np-spec-sheen-${uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#67e8f9" stop-opacity="0.07"/>
        <stop offset="0.5" stop-color="#a78bfa" stop-opacity="0.05"/>
        <stop offset="1" stop-color="#f0abfc" stop-opacity="0.07"/>
      </linearGradient>`;
  },
  decorate(w, h, uid) {
    return `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#np-spec-sheen-${uid})"/>`;
  },
};
