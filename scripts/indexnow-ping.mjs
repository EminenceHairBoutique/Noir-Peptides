/*
  scripts/indexnow-ping.mjs
  Pings IndexNow (Bing/Yandex/etc.) with the public, indexable URLs after a
  deploy. Env-gated and a no-op without INDEXNOW_KEY, so it never breaks a build.

  Setup (one-time):
    1. Generate a key (any 8–128 hex chars), set INDEXNOW_KEY in the env.
    2. Host the key file at https://<domain>/<INDEXNOW_KEY>.txt containing the
       key (this script writes it into dist/ during build when the key is set).
  Run (post-deploy): node scripts/indexnow-ping.mjs
*/
import fs from "node:fs/promises";
import path from "node:path";
import { researchArticles } from "../src/data/research.js";

const KEY = process.env.INDEXNOW_KEY;
const SITE_URL = String(process.env.VITE_SITE_URL || process.env.SITE_URL || "")
  .replace(/\/+$/, "");

const PUBLIC_PATHS = [
  "/",
  "/research",
  "/calculator",
  "/deals",
  "/legal/research-use-policy",
  "/legal/fda-disclaimer",
  "/legal/terms",
  "/legal/privacy",
  "/legal/shipping",
  ...researchArticles.map((a) => `/research/${a.slug}`),
];

async function main() {
  if (!KEY) {
    console.log("[indexnow] INDEXNOW_KEY not set — skipping.");
    return;
  }
  if (!SITE_URL || /localhost|127\.0\.0\.1/i.test(SITE_URL)) {
    console.log("[indexnow] VITE_SITE_URL missing/local — skipping.");
    return;
  }

  // Drop the key verification file into dist (served at /<key>.txt).
  try {
    await fs.mkdir(path.join(process.cwd(), "dist"), { recursive: true });
    await fs.writeFile(path.join(process.cwd(), "dist", `${KEY}.txt`), KEY, "utf8");
  } catch {
    /* dist may not exist when run standalone */
  }

  const host = new URL(SITE_URL).host;
  const body = {
    host,
    key: KEY,
    keyLocation: `${SITE_URL}/${KEY}.txt`,
    urlList: PUBLIC_PATHS.map((p) => `${SITE_URL}${p === "/" ? "/" : p}`),
  };

  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    console.log(`[indexnow] submitted ${body.urlList.length} URLs — HTTP ${res.status}`);
  } catch (err) {
    console.warn("[indexnow] ping failed:", err?.message || err);
  }
}

main();
