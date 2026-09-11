/*
  scripts/test-category-visibility.mjs   (Sept-11 T7)
  Category soft-launch visibility. Proves:
    - the pure helpers hide exactly the flagged categories and their products;
    - the static mirror's *Visible* getters exclude a hidden category while
      the full getters (seed generators, db:verify counts) still include it;
    - NO category ships hidden;
    - migration 0034 is additive, defaults false, and writes no rows;
    - the admin PATCH whitelists only the boolean flag and keys categories by
      slug; the storefront data layer filters product reads but the admin/
      Label Studio authoritative read does not.

  Run: node scripts/test-category-visibility.mjs   (wired into npm run test:unit)
*/
import { readFileSync } from "node:fs";
import { isHiddenCategory, hiddenCategorySlugs, visibleCategories, visibleProducts } from "../src/lib/catalogVisibility.js";
import {
  categories,
  getCategories,
  getAllProducts,
  getVisibleCategories,
  getVisibleProducts,
  getVisibleProductsInCategory,
  hiddenCategorySlugs as staticHiddenSlugs,
} from "../src/data/tier1Catalog.js";

let failures = 0;
const ok = (cond, msg) => {
  if (cond) console.log(`  ✓ ${msg}`);
  else {
    failures++;
    console.error(`  ✗ ${msg}`);
  }
};
const read = (rel) => readFileSync(new URL(rel, import.meta.url), "utf8");

console.log("pure helpers:");
ok(isHiddenCategory({ soft_launch_hidden: true }) === true, "DB flag true → hidden");
ok(isHiddenCategory({ softLaunchHidden: true }) === true, "static mirror flag true → hidden");
ok(isHiddenCategory({ soft_launch_hidden: false }) === false, "false → visible");
ok(isHiddenCategory({}) === false && isHiddenCategory(null) === false, "absent / null → visible (pre-0034 rows are all visible)");
ok(isHiddenCategory({ soft_launch_hidden: "true" }) === false, 'the string "true" is not the boolean true → visible (no accidental hiding)');
{
  const cats = [{ slug: "a" }, { slug: "b", soft_launch_hidden: true }, { slug: "c", softLaunchHidden: true }];
  ok([...hiddenCategorySlugs(cats)].join(",") === "b,c", "hiddenCategorySlugs collects both flag spellings");
  ok(visibleCategories(cats).map((c) => c.slug).join(",") === "a", "visibleCategories keeps only unflagged");
  const prods = [{ slug: "p1", category_slug: "a" }, { slug: "p2", category_slug: "b" }, { slug: "p3", category_slug: "c" }];
  ok(visibleProducts(prods, hiddenCategorySlugs(cats)).map((p) => p.slug).join(",") === "p1", "visibleProducts drops products of hidden categories");
  ok(visibleProducts(prods, ["b"]).length === 2, "accepts an array of slugs too");
  ok(visibleProducts(null, new Set()).length === 0 && visibleCategories(undefined).length === 0, "null input → empty, never throws");
}

console.log("\nstatic mirror — nothing is hidden in the shipped catalog:");
ok(staticHiddenSlugs().size === 0, "no category ships with softLaunchHidden");
ok(getCategories().every((c) => c.softLaunchHidden === false), "getCategories() exposes softLaunchHidden=false on every category");
ok(getVisibleCategories().length === getCategories().length, "visible categories === all categories today");
ok(getVisibleProducts().length === getAllProducts().length, "visible products === all products today");

console.log("\nstatic mirror — hiding one category (temporary mutation, restored):");
{
  const target = categories[0];
  const before = { cats: getCategories().length, prods: getAllProducts().length, inCat: getVisibleProductsInCategory(target.slug).length };
  target.softLaunchHidden = true;
  try {
    ok(staticHiddenSlugs().has(target.slug), `hiddenCategorySlugs() reports ${target.slug}`);
    ok(getVisibleCategories().length === before.cats - 1, "visible categories drop by one");
    ok(!getVisibleCategories().some((c) => c.slug === target.slug), "the hidden category is absent from the visible list");
    ok(getVisibleProducts().length === before.prods - target.products.length, `visible products drop by the category's ${target.products.length}`);
    ok(getVisibleProductsInCategory(target.slug).length === 0 && before.inCat === target.products.length, "visible-in-category is empty for a hidden category");
    ok(getCategories().length === before.cats && getAllProducts().length === before.prods, "FULL getters still include it (seed + db:verify counts are unaffected)");
  } finally {
    delete target.softLaunchHidden;
  }
  ok(staticHiddenSlugs().size === 0, "restored: nothing hidden");
}

console.log("\nmigration 0034 (static):");
{
  const mig = read("../supabase/migrations/0034_category_soft_launch_hidden.sql");
  const exec = mig.replace(/--[^\n]*/g, "");
  ok(/add column if not exists soft_launch_hidden boolean not null default false/.test(exec), "adds soft_launch_hidden boolean NOT NULL DEFAULT false, idempotently");
  ok(!/drop column|drop table|truncate|delete from/i.test(exec), "STRICTLY ADDITIVE");
  ok(!/insert into|^\s*update /im.test(exec), "writes NO rows — does not hide any category");
  ok(/create index if not exists idx_product_categories_visible/.test(exec), "partial index on the visible set");
}

console.log("\nadmin + data layer (static guards):");
{
  const api = read("../api/admin/catalog.js");
  ok(/kind === "category"/.test(api) && /typeof body\.soft_launch_hidden !== "boolean"/.test(api), "PATCH accepts kind:category with a boolean soft_launch_hidden only");
  ok(/const keyCol = kind === "category" \? "slug" : "id"/.test(api), "categories are keyed by slug");
  ok(/loadCategories\(\)/.test(api) && /42703/.test(api), "GET returns categories with pre-0034 fallback");
  const cat = read("../src/lib/catalog.js");
  ok(/rows\.filter\(\(c\) => !isHiddenCategory\(c\)\)/.test(cat), "getCategories() (storefront) filters hidden");
  ok((cat.match(/await getHiddenCategorySlugs\(\)/g) || []).length >= 4, "getProducts / getProduct / getFeaturedProducts / getLabSupplies consult the hidden set");
  ok(/hidden\.has\(found\.category_slug\) \? null : normalizeProduct\(found\)/.test(cat), "getProduct() returns null for a hidden product (PDP → not-found)");
  {
    const auth = cat.slice(cat.indexOf("export async function getProductsAuthoritative"));
    const body = auth.slice(0, auth.indexOf("\n}\n") + 3);
    ok(!/getHiddenCategorySlugs|visibleProducts/.test(body), "getProductsAuthoritative (admin / Label Studio) is NOT filtered");
  }
  const seo = read("../scripts/generate-static-seo.mjs");
  ok(/getVisibleCategories\(\)/.test(seo) && /getVisibleProducts\(\)/.test(seo) && /getVisibleProductsInCategory\(/.test(seo), "prerenderer builds shop/category/product/related from the VISIBLE views");
  ok(/hiddenRoutes\.push/.test(seo) && /hiddenCategories: \[\.\.\.hiddenSlugs\]\.sort\(\)/.test(seo), "prerenderer emits 404 bodies for hidden paths and records them in build meta");
  const pdp = read("../src/pages/ProductDetail.jsx");
  ok(/<SEO title="Material Not Found"[^>]*noindex=\{true\}/.test(pdp), "PDP not-found state is noindex");
  const adminUi = read("../src/pages/AdminHome.jsx");
  ok(/function CategoryRow/.test(adminUi) && /kind: "category"/.test(adminUi), "Control Room has the toggle");
  ok(/categories\.some\(\(c\) => "soft_launch_hidden" in c\)/.test(adminUi), "toggle hides itself until the migration is applied");
}

if (failures) {
  console.error(`\n${failures} category-visibility check(s) FAILED`);
  process.exit(1);
}
console.log("\nAll category-visibility checks passed.");
