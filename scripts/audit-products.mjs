#!/usr/bin/env node
/**
 * scripts/audit-products.mjs
 *
 * Product Image Integrity Audit Script
 * ------------------------------------
 * Scans products.js entries and verifies that every referenced image path
 * exists in the /public directory. Outputs a report of:
 *   - Missing images (path listed in products.js but not found on disk)
 *   - Unused images (found in /public/assets/wigs but not referenced in products.js)
 *   - Products with no images
 *   - Products with missing required fields (id, slug, name, type)
 *
 * Usage:
 *   node scripts/audit-products.mjs
 *   node scripts/audit-products.mjs --json  (machine-readable output)
 */

import { readFileSync, existsSync, readdirSync, statSync } from "fs";
import { resolve, join, relative } from "path";
import { pathToFileURL } from "url";

const ROOT = resolve(import.meta.dirname, "..");
const PUBLIC_DIR = join(ROOT, "public");
const isJson = process.argv.includes("--json");

// ---------------------------------------------------------------------------
// Load products
// ---------------------------------------------------------------------------

let products;
try {
  // products.js uses ESM exports
  const mod = await import(pathToFileURL(join(ROOT, "src/data/products.js")));
  products = mod.products || mod.default?.products || [];
} catch (e) {
  console.error("Failed to import products.js:", e.message);
  process.exit(1);
}

if (!Array.isArray(products) || products.length === 0) {
  console.error("No products found.");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Collect all image paths referenced in products.js
// ---------------------------------------------------------------------------

const referencedPaths = new Set();
for (const p of products) {
  if (Array.isArray(p.images)) {
    for (const img of p.images) {
      referencedPaths.add(String(img));
    }
  }
}

// ---------------------------------------------------------------------------
// Check each referenced path exists in /public
// ---------------------------------------------------------------------------

const missingImages = [];
for (const imgPath of referencedPaths) {
  // Strip leading slash and resolve against /public
  const normalized = imgPath.startsWith("/") ? imgPath.slice(1) : imgPath;
  const fullPath = join(PUBLIC_DIR, normalized);
  if (!existsSync(fullPath)) {
    missingImages.push(imgPath);
  }
}

// ---------------------------------------------------------------------------
// Find all webp/jpg/png/gif images in /public/assets/wigs (and root public)
// ---------------------------------------------------------------------------

function walkPublic(dir, found = []) {
  try {
    for (const entry of readdirSync(dir)) {
      const fullPath = join(dir, entry);
      const st = statSync(fullPath);
      if (st.isDirectory()) {
        walkPublic(fullPath, found);
      } else if (/\.(webp|jpg|jpeg|png|gif|svg)$/i.test(entry)) {
        found.push("/" + relative(PUBLIC_DIR, fullPath));
      }
    }
  } catch { /* skip inaccessible dirs */ }
  return found;
}

const allPublicImages = walkPublic(PUBLIC_DIR);

const unusedImages = allPublicImages.filter(
  (img) => !referencedPaths.has(img)
);

// ---------------------------------------------------------------------------
// Check products for missing required fields
// ---------------------------------------------------------------------------

const REQUIRED_FIELDS = ["id", "slug", "name", "type"];
const productsWithIssues = [];

for (const p of products) {
  const issues = [];
  for (const field of REQUIRED_FIELDS) {
    if (!p[field]) issues.push(`missing "${field}"`);
  }
  if (!p.images || p.images.length === 0) {
    issues.push("no images");
  }
  if (issues.length > 0) {
    productsWithIssues.push({ id: p.id || "(no id)", slug: p.slug, issues });
  }
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const report = {
  summary: {
    totalProducts: products.length,
    totalReferencedImages: referencedPaths.size,
    missingImageCount: missingImages.length,
    unusedImageCount: unusedImages.length,
    productsWithIssuesCount: productsWithIssues.length,
  },
  missingImages,
  unusedImages,
  productsWithIssues,
};

if (isJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const { summary } = report;
  console.log("\n╔═══════════════════════════════════════════════════════╗");
  console.log("║         Eminence Hair — Product Image Audit           ║");
  console.log("╚═══════════════════════════════════════════════════════╝\n");

  console.log(`Total products:           ${summary.totalProducts}`);
  console.log(`Referenced image paths:   ${summary.totalReferencedImages}`);
  console.log(`Missing images:           ${summary.missingImageCount}`);
  console.log(`Unused public images:     ${summary.unusedImageCount}`);
  console.log(`Products with issues:     ${summary.productsWithIssuesCount}`);

  if (missingImages.length > 0) {
    console.log("\n── MISSING IMAGES (in products.js but not on disk) ──────");
    missingImages.forEach((p) => console.log("  ✗ " + p));
  } else {
    console.log("\n✓ All referenced images found on disk.");
  }

  if (productsWithIssues.length > 0) {
    console.log("\n── PRODUCTS WITH FIELD ISSUES ───────────────────────────");
    productsWithIssues.forEach((p) => {
      console.log(`  • ${p.id} (${p.slug || "no slug"}): ${p.issues.join(", ")}`);
    });
  } else {
    console.log("✓ All products have required fields.");
  }

  if (unusedImages.length > 0) {
    console.log(
      `\n── UNUSED PUBLIC IMAGES (${unusedImages.length} total, first 20) ─────`
    );
    unusedImages.slice(0, 20).forEach((p) => console.log("  · " + p));
    if (unusedImages.length > 20) {
      console.log(`  … and ${unusedImages.length - 20} more.`);
    }
  }

  console.log("\n── TODO (if images are missing) ─────────────────────────");
  console.log("  1. Add correct image files to /public matching the paths above.");
  console.log("  2. Update products.js to use new image paths.");
  console.log("  3. Re-run: node scripts/audit-products.mjs\n");

  if (missingImages.length > 0) {
    process.exit(1); // Non-zero exit signals CI failure
  }
}
