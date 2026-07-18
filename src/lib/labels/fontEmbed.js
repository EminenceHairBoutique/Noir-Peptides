// src/lib/labels/fontEmbed.js
// BROWSER-ONLY. Builds a <style>@font-face…</style> prefix whose sources are
// base64 data: URIs, for embedding INSIDE label SVGs before rasterization.
//
// Why: an SVG drawn via `new Image(blobURL)` runs in restricted mode and will
// not load ANY external resource — not even same-origin /fonts URLs — so text
// would fall back to system fonts in the rasterized texture/PNG. Inlining the
// woff2 as data URIs is the only reliable way to keep brand typography in the
// exported artwork and the 3D texture. (~102 KB of fonts, fetched same-origin
// once per session and memoized.)

const FONT_FILES = [
  { family: "Syne", file: "/fonts/syne-var.woff2", weight: "700 800" },
  { family: "DM Sans", file: "/fonts/dm-sans-var.woff2", weight: "400 600" },
  { family: "IBM Plex Mono", file: "/fonts/ibm-plex-mono-400.woff2", weight: "400" },
  { family: "IBM Plex Mono", file: "/fonts/ibm-plex-mono-500.woff2", weight: "500" },
  { family: "IBM Plex Mono", file: "/fonts/ibm-plex-mono-600.woff2", weight: "600" },
];

function bufToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

// Embedded-font SVG prefix cache — assembled once per session.
let _prefixPromise = null;

/** Resolve the `<style>` block of data-URI @font-face rules. */
export function getFontEmbedPrefix() {
  if (_prefixPromise) return _prefixPromise;
  _prefixPromise = (async () => {
    const faces = await Promise.all(
      FONT_FILES.map(async (f) => {
        try {
          const res = await fetch(f.file);
          if (!res.ok) return "";
          const b64 = bufToBase64(await res.arrayBuffer());
          return `@font-face{font-family:'${f.family}';font-weight:${f.weight};font-style:normal;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
        } catch {
          return ""; // degrade: raster falls back to system fonts
        }
      })
    );
    return `<style>${faces.join("")}</style>`;
  })();
  return _prefixPromise;
}
