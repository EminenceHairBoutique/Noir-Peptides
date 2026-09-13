-- 0036_products_code_name.sql   (opt cycle 9 — addendum C7)
-- An optional storefront display name per product. When set, the shop, the
-- product page, the cart and the checkout summary render it instead of the
-- substance name; certificates, safety data sheets and order records keep the
-- substance name. Nullable, no default, set on nothing: counsel's "code-name"
-- option becomes a Control Room data entry instead of a deploy.
-- Strictly additive and idempotent. Writes no rows.

alter table public.products add column if not exists code_name text;

comment on column public.products.code_name is
  'Optional storefront display name (shop, PDP, cart, checkout). NULL = show name. Admin-entered public text: held to the copy rules at the API.';

alter table public.products drop constraint if exists products_code_name_len;
alter table public.products add constraint products_code_name_len
  check (code_name is null or char_length(btrim(code_name)) between 1 and 80);
