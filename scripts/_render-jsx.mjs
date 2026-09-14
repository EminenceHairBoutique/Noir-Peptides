// scripts/_render-jsx.mjs — bundle storefront components for react-dom/server
// tests (opt cycle 12). esbuild with the automatic JSX runtime; the
// Supabase-backed readers are stubbed so nothing touches a network; React,
// the router and lucide stay external (resolved from node_modules at import).
import { build } from "esbuild";
import path from "node:path";
import fs from "node:fs";

// opts.realCoas: bundle src/lib/coas.js for real (only the Supabase client is
// stubbed) — for tests of the certificate helpers themselves.
export async function bundleComponents(entrySource, tag = "render", opts = {}) {
  const outfile = path.join(process.cwd(), `.render-test-${tag}-${Date.now()}.mjs`);
  const entry = path.join(process.cwd(), `scripts/_render-entry-${tag}.tmp.mjs`);
  fs.writeFileSync(entry, entrySource);
  try {
    await build({
      entryPoints: [entry], bundle: true, format: "esm", platform: "node", outfile, logLevel: "silent",
      jsx: "automatic",
      define: { "import.meta.env": "{}" },
      external: ["react", "react-dom", "react-router", "react-router-dom", "lucide-react"],
      plugins: [{ name: "stubs", setup(b) {
        if (!opts.realCoas) b.onResolve({ filter: /(^|\/)lib\/coas(\.js)?$/ }, () => ({ path: "coas-stub", namespace: "stub" }));
        b.onResolve({ filter: /supabaseClient(\.js)?$/ }, () => ({ path: "sb-stub", namespace: "stub" }));
        b.onLoad({ filter: /.*/, namespace: "stub" }, (a) => ({
          contents: a.path === "coas-stub"
            ? "export const getLatestCoaMap = () => Promise.resolve({}); export const getSeedLatestCoaMap = () => ({}); export const getSeedCoas = () => []; export const getSeedCoasForProduct = () => []; export const getAllCoas = async () => []; export const getCoasForProduct = async () => []; export const lookupByLot = async () => null; export const getBatchTests = async () => [];"
            : "export const supabase = null;",
          loader: "js",
        }));
      } }],
    });
    return await import(`file://${outfile}`);
  } finally {
    fs.rmSync(entry, { force: true });
    fs.rmSync(outfile, { force: true });
  }
}
