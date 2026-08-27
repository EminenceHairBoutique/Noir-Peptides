/*
  scripts/generate-pwa-icons.mjs
  Rasterizes the Noir Peptides vial glyph (public/noir-favicon.svg geometry)
  into the PNG icons PWA installability requires. Pure Node (zlib) — no native
  image dependency, same approach as generate-og-image.mjs.

  Outputs (committed to the repo — icons change rarely; run this only when the
  mark changes):
    public/assets/pwa/icon-192.png            rounded-tile, like the favicon
    public/assets/pwa/icon-512.png            rounded-tile
    public/assets/pwa/icon-maskable-512.png   full-bleed bg, glyph in safe zone
    public/assets/pwa/apple-touch-icon.png    180px full-bleed (iOS rounds it)

  Run: node scripts/generate-pwa-icons.mjs
*/
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

const OUT_DIR = path.join(process.cwd(), "public", "assets", "pwa");

// Palette (from noir-favicon.svg)
const BG = [5, 8, 15]; // #05080f
const BORDER = [30, 45, 64]; // #1e2d40
const CYAN = [0, 194, 255]; // #00c2ff

// ── Signed-distance helpers in the favicon's 64×64 coordinate space ──────
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

function sdRoundBox(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - hw + r;
  const qy = Math.abs(py - cy) - hh + r;
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  return Math.hypot(ox, oy) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdSegment(px, py, ax, ay, bx, by) {
  const abx = bx - ax;
  const aby = by - ay;
  const t = clamp(((px - ax) * abx + (py - ay) * aby) / (abx * abx + aby * aby), 0, 1);
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

// Distance to the bottom half of a circle (the tube's rounded base).
function sdBottomArc(px, py, cx, cy, r) {
  if (py >= cy) return Math.abs(Math.hypot(px - cx, py - cy) - r);
  // above the diameter: nearest arc points are its ends
  return Math.min(Math.hypot(px - (cx - r), py - cy), Math.hypot(px - (cx + r), py - cy));
}

// Coverage (0..1) of the vial glyph at a point in 64-space; aa = half-pixel in
// 64-space for antialiasing.
function glyphCoverage(x, y, aa) {
  const cover = (d) => clamp(0.5 - d / (2 * aa), 0, 1);
  let a = 0;

  // Cap: filled rounded rect x25 y14 w14 h6 r1.5
  a = Math.max(a, cover(sdRoundBox(x, y, 32, 17, 7, 3, 1.5)));

  // Tube outline, stroke width 3: two walls + rounded bottom
  const stroke = 1.5;
  const walls = Math.min(
    sdSegment(x, y, 27, 20, 27, 45),
    sdSegment(x, y, 37, 20, 37, 45),
    sdBottomArc(x, y, 32, 45, 5)
  );
  a = Math.max(a, cover(walls - stroke));

  // Mid graduation line (width 2, 70% opacity)
  a = Math.max(a, 0.7 * cover(sdSegment(x, y, 27, 36, 37, 36) - 1));

  // Fill dot (85% opacity)
  a = Math.max(a, 0.85 * cover(Math.hypot(x - 32, y - 43) - 3));

  return a;
}

function renderIcon(size, { rounded, glyphScale }) {
  const buf = Buffer.alloc(size * size * 4);
  const s = size / 64;
  const aa = 0.5 / s; // half output pixel, in 64-space
  const tileR = rounded ? 12 : 0;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const gx = (x + 0.5) / s;
      const gy = (y + 0.5) / s;

      // Tile: rounded (favicon-like) or full-bleed (maskable/apple)
      const dTile = rounded ? sdRoundBox(gx, gy, 32, 32, 32, 32, tileR) : -1;
      const tileA = rounded ? clamp(0.5 - dTile / (2 * aa), 0, 1) : 1;

      let c = [0, 0, 0, 0];
      if (tileA > 0) {
        c = [BG[0], BG[1], BG[2], tileA];
        if (rounded) {
          // 1px (in 64-space) border ring, as in the favicon
          const ring = clamp(0.5 - (Math.abs(dTile + 0.5) - 0.5) / (2 * aa), 0, 1);
          c = [
            c[0] + (BORDER[0] - c[0]) * ring,
            c[1] + (BORDER[1] - c[1]) * ring,
            c[2] + (BORDER[2] - c[2]) * ring,
            c[3],
          ];
        }
        // Glyph, optionally scaled into the maskable safe zone (center anchor)
        const lx = 32 + (gx - 32) / glyphScale;
        const ly = 32 + (gy - 32) / glyphScale;
        const g = glyphCoverage(lx, ly, aa / glyphScale);
        c = [
          c[0] + (CYAN[0] - c[0]) * g,
          c[1] + (CYAN[1] - c[1]) * g,
          c[2] + (CYAN[2] - c[2]) * g,
          c[3],
        ];
      }

      const i = (y * size + x) * 4;
      buf[i] = Math.round(c[0]);
      buf[i + 1] = Math.round(c[1]);
      buf[i + 2] = Math.round(c[2]);
      buf[i + 3] = Math.round(c[3] * 255);
    }
  }
  return buf;
}

// ── Minimal PNG encoder (RGBA, 8-bit) ────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function encodePng(rgba, size) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

await fs.mkdir(OUT_DIR, { recursive: true });
const targets = [
  ["icon-192.png", 192, { rounded: true, glyphScale: 1 }],
  ["icon-512.png", 512, { rounded: true, glyphScale: 1 }],
  // Maskable: full-bleed background, glyph shrunk into the ~80% safe zone.
  ["icon-maskable-512.png", 512, { rounded: false, glyphScale: 0.72 }],
  ["apple-touch-icon.png", 180, { rounded: false, glyphScale: 0.9 }],
];
for (const [name, size, opts] of targets) {
  const png = encodePng(renderIcon(size, opts), size);
  await fs.writeFile(path.join(OUT_DIR, name), png);
  console.log(`wrote ${name} (${png.length} bytes)`);
}
