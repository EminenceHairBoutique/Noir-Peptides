/*
  scripts/generate-sw-precache.mjs
  Post-build step (wired into npm run build, after vite build): rewrites
  dist/sw.js so the service worker precaches the built app shell.

  - Collects dist/assets/*.{js,css} but SKIPS chunks over 300 KB (the 3D
    vendor bundle et al.) — those runtime-cache on first use instead of
    costing every installer megabytes up front. Skips are logged: silent
    truncation would read as "precached everything".
  - Includes the PWA icons so an installed app has its artwork offline.
  - The cache version is a hash of the precache list, so a deploy with
    unchanged assets keeps its caches and any asset change rolls them.
*/
import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

const DIST = path.join(process.cwd(), "dist");
const SW = path.join(DIST, "sw.js");
const MAX_PRECACHE_BYTES = 300 * 1024;

const assets = [];
const skipped = [];
for (const name of (await fs.readdir(path.join(DIST, "assets"))).sort()) {
  if (!/\.(js|css)$/.test(name)) continue;
  const { size } = await fs.stat(path.join(DIST, "assets", name));
  if (size > MAX_PRECACHE_BYTES) {
    skipped.push(`${name} (${Math.round(size / 1024)} KB)`);
    continue;
  }
  assets.push(`/assets/${name}`);
}
for (const icon of ["icon-192.png", "icon-512.png", "icon-maskable-512.png", "apple-touch-icon.png"]) {
  assets.push(`/assets/pwa/${icon}`);
}

const version = crypto.createHash("sha256").update(assets.join("\n")).digest("hex").slice(0, 12);

const src = await fs.readFile(SW, "utf8");
const marker = "const NP = self.__NP_PRECACHE__ || { version: \"dev\", assets: [] };";
if (!src.includes(marker)) {
  console.error("sw-precache: marker line not found in dist/sw.js — template drifted");
  process.exit(1);
}
const injected = src.replace(
  marker,
  `const NP = { version: ${JSON.stringify(version)}, assets: ${JSON.stringify(assets)} };`
);
await fs.writeFile(SW, injected);

console.log(`sw-precache: v${version}, ${assets.length} precached`);
if (skipped.length) console.log(`sw-precache: runtime-cached instead (over ${MAX_PRECACHE_BYTES / 1024} KB): ${skipped.join(", ")}`);
