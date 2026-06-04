/*
  scripts/generate-og-image.mjs
  Generates a 1200x630 raster OG image (PNG) for social sharing.

  WHY: SVG OG images do not render on most social platforms (Facebook, X,
  LinkedIn, iMessage). This emits a real raster PNG with the Noir palette so
  link previews display. Pure Node (zlib) — no native image dependency.

  A fully designed banner (logo + wordmark + tagline) can replace the output at
  the same path; this generates a clean, on-brand geometric fallback.

  Run: node scripts/generate-og-image.mjs   (also wired into npm build)
*/

import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

const W = 1200;
const H = 630;
const OUT = path.join(process.cwd(), "public", "assets", "noir", "noir-og.png");

// Noir palette
const BG = [14, 14, 16]; // near-black charcoal
const PANEL = [22, 22, 26];
const GOLD = [212, 175, 55];
const STEEL = [90, 96, 110];

function lerp(a, b, t) {
  return [
    Math.round(a[0] + (b[0] - a[0]) * t),
    Math.round(a[1] + (b[1] - a[1]) * t),
    Math.round(a[2] + (b[2] - a[2]) * t),
  ];
}

// Build RGBA pixel buffer with a subtle radial glow + gold rule + framing.
function render() {
  const buf = Buffer.alloc(W * H * 4);
  const cx = W * 0.78;
  const cy = H * 0.22;
  const maxd = Math.hypot(W, H);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const d = Math.hypot(x - cx, y - cy) / maxd;
      // radial glow from a charcoal-blue toward base charcoal
      let c = lerp([26, 30, 40], BG, Math.min(1, d * 1.6));

      // centered panel block
      const inPanelX = x > 90 && x < W - 90;
      const inPanelY = y > 90 && y < H - 90;
      if (inPanelX && inPanelY) c = lerp(c, PANEL, 0.5);

      // thin gold horizontal rule across the middle
      if (y >= H / 2 - 2 && y <= H / 2 + 2 && x > 120 && x < W - 120) c = GOLD;

      // gold accent ticks (left + right of the rule)
      if (y >= H / 2 - 18 && y <= H / 2 + 18) {
        if ((x >= 120 && x <= 126) || (x >= W - 126 && x <= W - 120)) c = GOLD;
      }

      // top + bottom hairline frame in steel
      if ((y === 90 || y === H - 90) && inPanelX) c = STEEL;

      const i = (y * W + x) * 4;
      buf[i] = c[0];
      buf[i + 1] = c[1];
      buf[i + 2] = c[2];
      buf[i + 3] = 255;
    }
  }
  return buf;
}

// ── Minimal PNG encoder ──────────────────────────────────────────────────
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
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng(rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  // raw scanlines with filter byte 0
  const raw = Buffer.alloc(H * (W * 4 + 1));
  for (let y = 0; y < H; y++) {
    raw[y * (W * 4 + 1)] = 0;
    rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", idat), chunk("IEND", Buffer.alloc(0))]);
}

async function main() {
  await fs.mkdir(path.dirname(OUT), { recursive: true });
  const png = encodePng(render());
  await fs.writeFile(OUT, png);
  console.log(`[og] wrote ${OUT} (${W}x${H}, ${png.length} bytes)`);
}

main().catch((err) => {
  console.error("[og] failed:", err);
  process.exit(1);
});
