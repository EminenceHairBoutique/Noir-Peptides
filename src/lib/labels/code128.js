// src/lib/labels/code128.js
// Dependency-free Code 128 (subset B) encoder → SVG bar geometry. Encodes the
// internal lot/SKU identifier (e.g. NP-BPC5-2607-001). Pure + Node-safe so it
// unit-tests without a DOM and adds zero bundle weight.
//
// Spec: each symbol is 11 modules (bars+spaces from the pattern table); stop is
// 13. Checksum = (startValue + Σ value_i × position_i) mod 103.
// NO fake UPC/GS1 — this is an internal Code 128 identifier only.

// Widths for values 0..106 (start B = 104, stop = 106), 6 digits = 3 bars/3 spaces.
const PATTERNS = [
  "212222","222122","222221","121223","121322","131222","122213","122312","132212","221213",
  "221312","231212","112232","122132","122231","113222","123122","123221","223211","221132",
  "221231","213212","223112","312131","311222","321122","321221","312212","322112","322211",
  "212123","212321","232121","111323","131123","131321","112313","132113","132311","211313",
  "231113","231311","112133","112331","132131","113123","113321","133121","313121","211331",
  "231131","213113","213311","213131","311123","311321","331121","312113","312311","332111",
  "314111","221411","431111","111224","111422","121124","121421","141122","141221","112214",
  "112412","122114","122411","142112","142211","241211","221114","413111","241112","134111",
  "111242","121142","121241","114212","124112","124211","411212","421112","421211","212141",
  "214121","412121","111143","111341","131141","114113","114311","411113","411311","113141",
  "114131","311141","411131","211412","211214","211232","2331112",
];

const START_B = 104;
const STOP = 106;

/** Code 128B value for a character (space=0 … DEL=95 range). */
function charValue(ch) {
  const code = ch.charCodeAt(0);
  if (code < 32 || code > 126) {
    throw new Error(`code128: unsupported character "${ch}" (Code 128B accepts ASCII 32–126)`);
  }
  return code - 32;
}

/**
 * Encode a string (Code 128B). Returns { values, checksum, modules } where
 * modules is the full module-width sequence (bar,space,bar,space,…) including
 * start, data, checksum, and stop.
 */
export function encodeCode128B(text) {
  const s = String(text || "");
  if (!s) throw new Error("code128: empty input");
  const values = [...s].map(charValue);

  let sum = START_B;
  values.forEach((v, i) => {
    sum += v * (i + 1);
  });
  const checksum = sum % 103;

  const symbols = [START_B, ...values, checksum, STOP];
  const modules = [];
  for (const v of symbols) {
    for (const d of PATTERNS[v]) modules.push(Number(d));
  }
  return { values, checksum, modules };
}

/**
 * Render a Code 128B barcode as an SVG <g> of black rects.
 * Ladder orientation is achieved by the CALLER rotating the group — bars here
 * are vertical strips across x. Quiet zone: ≥10 modules each side (caller
 * reserves it; this renders bars only, starting at x=0).
 *
 * @returns {{ svg: string, totalModules: number }}
 */
export function code128Svg(text, { height = 30, moduleWidth = 1, color = "#000" } = {}) {
  const { modules } = encodeCode128B(text);
  let x = 0;
  let bars = "";
  modules.forEach((w, i) => {
    const wid = w * moduleWidth;
    if (i % 2 === 0) {
      // even index = bar
      bars += `<rect x="${x}" y="0" width="${wid}" height="${height}" fill="${color}"/>`;
    }
    x += wid;
  });
  return { svg: `<g shape-rendering="crispEdges">${bars}</g>`, totalModules: x / moduleWidth };
}
