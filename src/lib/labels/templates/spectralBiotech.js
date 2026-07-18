// Template 2 — SPECTRAL HELIX (id kept as "spectral-biotech" for DB compat)
// Light silver holographic label in the style of premium pharma foils: hex
// micro-pattern ground, iridescent sheen, a DNA double-helix band, and
// holographic-gradient brand type. Deep-navy body type for legibility.
// PRINT: the holographic effects print as a holo-laminate / cold-foil SPOT
// layer over a white underprint (see LABEL_PRINT_SPECS); codes and warnings
// always sit on solid white or solid navy — never on the foil.
export default {
  id: "spectral-biotech",
  name: "Spectral Helix (Holographic)",
  bg: "#eef0f4",            // silver-white ground
  panel: "#f7f8fa",
  fg: "#15203a",            // deep navy
  fgMuted: "#51607e",
  rule: "#b6bfce",
  accent: "#2467b0",        // pharmaceutical blue
  warnFg: "#15203a",
  warnRule: "#8b96a8",
  tileBg: "#ffffff",
  tileFg: "#15203a",
  light: true,
  monogram(uid) {
    return { fill: "#1b2a52", stroke: `url(#np-holo-${uid})`, fg: "#ffffff" };
  },
  brandFill(uid) {
    return `url(#np-holo-${uid})`;
  },
  defs(w, h, uid) {
    return `
      <linearGradient id="np-holo-${uid}" x1="0" y1="0" x2="1" y2="0.35">
        <stop offset="0" stop-color="#2f6fd0"/>
        <stop offset="0.28" stop-color="#7c5bd6"/>
        <stop offset="0.52" stop-color="#0ea5c9"/>
        <stop offset="0.76" stop-color="#4f7fd9"/>
        <stop offset="1" stop-color="#8b5fc9"/>
      </linearGradient>
      <linearGradient id="np-holo-sheen-${uid}" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="#bcd4f2" stop-opacity="0.35"/>
        <stop offset="0.25" stop-color="#e4d3f2" stop-opacity="0.28"/>
        <stop offset="0.5" stop-color="#c8ecf0" stop-opacity="0.3"/>
        <stop offset="0.75" stop-color="#d3ddf5" stop-opacity="0.26"/>
        <stop offset="1" stop-color="#e8d8ef" stop-opacity="0.32"/>
      </linearGradient>
      <pattern id="np-hex-${uid}" width="22" height="38" patternUnits="userSpaceOnUse">
        <path d="M11 0 L22 6.3 L22 19 L11 25.3 L0 19 L0 6.3 Z M11 25.3 L11 38"
              fill="none" stroke="#d7dce4" stroke-width="1"/>
      </pattern>`;
  },
  // Hex micro-pattern + iridescent sheen + DNA double-helix band along the
  // base (background art only — all critical content sits above it).
  decorate(w, h, uid) {
    const midY = h - 26;
    const amp = 13;
    const wave = 120;
    let a = `M0 ${midY}`;
    let b = `M0 ${midY}`;
    let rungs = "";
    for (let x = 0; x <= w; x += 6) {
      const ya = midY + Math.sin((x / wave) * Math.PI * 2) * amp;
      const yb = midY - Math.sin((x / wave) * Math.PI * 2) * amp;
      a += ` L${x} ${ya.toFixed(1)}`;
      b += ` L${x} ${yb.toFixed(1)}`;
    }
    for (let x = 9; x <= w; x += 18) {
      const ya = midY + Math.sin((x / wave) * Math.PI * 2) * amp;
      const yb = midY - Math.sin((x / wave) * Math.PI * 2) * amp;
      if (Math.abs(ya - yb) > 7) {
        rungs += `<line x1="${x}" y1="${ya.toFixed(1)}" x2="${x}" y2="${yb.toFixed(1)}" stroke="url(#np-holo-${uid})" stroke-width="1.4" opacity="0.5"/>`;
      }
    }
    return (
      `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#np-hex-${uid})" opacity="0.55"/>` +
      `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#np-holo-sheen-${uid})"/>` +
      `<g opacity="0.6"><path d="${a}" fill="none" stroke="url(#np-holo-${uid})" stroke-width="1.8"/>` +
      `<path d="${b}" fill="none" stroke="url(#np-holo-${uid})" stroke-width="1.8" opacity="0.75"/>${rungs}</g>` +
      `<rect x="0" y="0" width="${w}" height="4" fill="url(#np-holo-${uid})"/>` +
      `<rect x="0" y="${h - 3}" width="${w}" height="3" fill="url(#np-holo-${uid})" opacity="0.8"/>`
    );
  },
};
