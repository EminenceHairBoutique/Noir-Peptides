// Template 4 — NEURAL GRID
// Dark base with a subtle computational coordinate grid and a faint molecular
// bond motif. Disciplined: the pattern stays far below the type in contrast;
// no clutter, no cyberpunk.
export default {
  id: "neural-grid",
  name: "Neural Grid",
  bg: "#0a0f16",
  panel: "#0e141d",
  fg: "#eef2f7",
  fgMuted: "#93a0b4",
  rule: "#3c4759",
  accent: "#39c2ff",
  warnFg: "#eef2f7",
  warnRule: "#8a94a5",
  tileBg: "#ffffff",
  tileFg: "#0a0f16",
  monogram() {
    return { fill: "none", stroke: "#39c2ff", fg: "#eef2f7" };
  },
  defs(w, h, uid) {
    return `
      <pattern id="np-grid-${uid}" width="24" height="24" patternUnits="userSpaceOnUse">
        <path d="M24 0H0V24" fill="none" stroke="#131b27" stroke-width="1"/>
      </pattern>`;
  },
  decorate(w, h, uid) {
    // Faint full-bleed grid + a molecular bond chain along the base line.
    const y0 = h - 22;
    const step = 34;
    let bonds = "";
    let nodes = "";
    for (let x = 10; x + step <= w - 10; x += step) {
      const yA = y0 + (Math.round(x / step) % 2 === 0 ? -6 : 6);
      const yB = y0 + (Math.round(x / step) % 2 === 0 ? 6 : -6);
      bonds += `<line x1="${x}" y1="${yA}" x2="${x + step}" y2="${yB}" stroke="#1e415a" stroke-width="1.3"/>`;
      nodes += `<circle cx="${x}" cy="${yA}" r="2.2" fill="#1f4f70"/>`;
    }
    return (
      `<rect x="0" y="0" width="${w}" height="${h}" fill="url(#np-grid-${uid})" opacity="0.5"/>` +
      `<g opacity="0.75">${bonds}${nodes}</g>` +
      `<rect x="0" y="0" width="${w}" height="3" fill="#123243"/>`
    );
  },
};
