// Template 4 — NEURAL GRID (TECH)
// Deep blue-black with a visible molecular hex network on the flanks, blue
// brand type, blue frame, silver quantity band (reference mockup,
// template 4). Pattern stays below type contrast; code tiles solid white.
export default {
  id: "neural-grid",
  name: "Neural Grid — Tech",
  bg: "#0a1120",
  panel: "#0e1626",
  fg: "#eef2f7",
  fgMuted: "#93a0b4",
  rule: "#3c4a61",
  accent: "#4da3ff",        // tech blue (icons + scan caption)
  warnFg: "#eef2f7",
  warnRule: "#8a94a5",
  tileBg: "#ffffff",
  tileFg: "#0a1120",
  bandFg: "#0a1120",
  brandFg: "#4da3ff",       // blue wordmark per the reference thumbnail
  monogram() {
    return { fill: "#0e1a2e", stroke: "#4da3ff", fg: "#eef2f7" };
  },
  frame() {
    return "#2b6cb0";
  },
  defs(w, h, uid) {
    return `
      <linearGradient id="np-band-${uid}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="#78859a"/>
        <stop offset="0.5" stop-color="#e8ecf1"/>
        <stop offset="1" stop-color="#8d99ab"/>
      </linearGradient>`;
  },
  decorate(w, h) {
    // Molecular hex network on the flanks (nodes + bonds), fading center.
    const hexR = 16;
    let net = "";
    const hex = (cx, cy, r) => {
      const pts = [];
      for (let i = 0; i < 6; i++) {
        const a = (Math.PI / 180) * (60 * i - 30);
        pts.push(`${(cx + r * Math.sin(a)).toFixed(1)},${(cy - r * Math.cos(a)).toFixed(1)}`);
      }
      return `<polygon points="${pts.join(" ")}" fill="none" stroke="#16324f" stroke-width="1.1"/>`;
    };
    const cols = Math.ceil(w / (hexR * 1.74));
    const rows = Math.ceil(h / (hexR * 1.5)) + 1;
    for (let ri = 0; ri < rows; ri++) {
      for (let ci = 0; ci < cols; ci++) {
        const cx = ci * hexR * 1.74 + (ri % 2 ? hexR * 0.87 : 0);
        const cy = ri * hexR * 1.5;
        // Keep the network on the outer flanks only (fade toward center).
        const edge = Math.min(cx, w - cx) / w;
        if (edge > 0.16) continue;
        net += hex(cx, cy, hexR);
        if ((ci + ri) % 3 === 0) net += `<circle cx="${cx}" cy="${cy}" r="2" fill="#1e4a74"/>`;
      }
    }
    return `<g opacity="0.7">${net}</g>`;
  },
};
