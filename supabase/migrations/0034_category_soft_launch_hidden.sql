-- ════════════════════════════════════════════════════════════════════════
-- 0034 — Category soft-launch visibility flag
--
-- Sept-11 launch hardening, Task 7. Lets the owner keep a whole research
-- category dark at launch without deleting or un-publishing anything:
--
--   update public.product_categories set soft_launch_hidden = true
--    where slug = '<category-slug>';
--
-- When true, the category and every product in it are excluded from /shop,
-- the category pages, related-product rails, the sitemap and the prerender;
-- a direct product URL renders the 404 page (noindex). The Control Room
-- catalog tab toggles it. src/data/tier1Catalog.js carries a mirrored
-- `softLaunchHidden` field so the static-catalog fallback path can never
-- disagree with the database.
--
-- STRICTLY ADDITIVE: one boolean column, NOT NULL DEFAULT false, so every
-- existing row is visible exactly as before. No row is written. THIS
-- MIGRATION DOES NOT HIDE ANY CATEGORY — that is an owner decision made in
-- the Control Room or with the UPDATE above.
--
-- Idempotent. Rollback (comment only):
--   alter table public.product_categories drop column if exists soft_launch_hidden;
-- ════════════════════════════════════════════════════════════════════════

alter table public.product_categories
  add column if not exists soft_launch_hidden boolean not null default false;

-- The storefront lists categories by sort_order and now also filters on this
-- flag; a partial index keeps the visible-set query cheap as the catalogue grows.
create index if not exists idx_product_categories_visible
  on public.product_categories (sort_order)
  where soft_launch_hidden = false;
