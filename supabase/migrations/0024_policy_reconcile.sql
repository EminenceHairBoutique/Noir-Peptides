-- supabase/migrations/0024_policy_reconcile.sql
-- Fix the empty-catalog regression after 0023. Production had RLS DISABLED on
-- the catalog tables with STALE policies (old attestation-gated definitions)
-- under the canonical policy names. 0023 correctly enabled RLS, but its
-- policy creation was guarded by NAME ONLY - the stale definitions stayed
-- and, once enforced, blocked anonymous catalog reads ("0 materials").
--
-- DETERMINISTIC fix: drop and recreate EVERY policy from the golden schema
-- (all migrations applied to fresh Postgres 16), so the end state matches the
-- code exactly regardless of what stale definitions exist. Idempotent; RLS
-- enables included. All app writes flow through service-role /api endpoints
-- (verified: no direct client-side writes), so write paths are unaffected.
-- GENERATED - do not hand-edit.

set check_function_bodies = off;

alter table public.ai_conversations enable row level security;
alter table public.ai_feedback enable row level security;
alter table public.ai_flags enable row level security;
alter table public.api_usage enable row level security;
alter table public.attestation_audit enable row level security;
alter table public.audit_logs enable row level security;
alter table public.back_in_stock_subscriptions enable row level security;
alter table public.coas enable row level security;
alter table public.contact_requests enable row level security;
alter table public.discount_redemptions enable row level security;
alter table public.discounts enable row level security;
alter table public.email_subscribers enable row level security;
alter table public.label_config_history enable row level security;
alter table public.label_configs enable row level security;
alter table public.loyalty_ledger enable row level security;
alter table public.order_items enable row level security;
alter table public.orders enable row level security;
alter table public.partner_applications enable row level security;
alter table public.price_tiers enable row level security;
alter table public.product_categories enable row level security;
alter table public.product_reviews enable row level security;
alter table public.product_variants enable row level security;
alter table public.products enable row level security;
alter table public.profiles enable row level security;
alter table public.rate_limits enable row level security;
alter table public.referral_codes enable row level security;
alter table public.referral_rewards enable row level security;
alter table public.research_articles enable row level security;
alter table public.shipping_addresses enable row level security;
alter table public.support_tickets enable row level security;
alter table public.wishlist_items enable row level security;
alter table public.embeddings enable row level security;

drop policy if exists "ai_conv_insert_own" on public.ai_conversations;
create policy "ai_conv_insert_own" on public.ai_conversations  for insert  with check ((user_id = auth.uid()));

drop policy if exists "ai_conv_select_own" on public.ai_conversations;
create policy "ai_conv_select_own" on public.ai_conversations  for select  using (((user_id = auth.uid()) OR is_admin()));

drop policy if exists "ai_conv_update_own" on public.ai_conversations;
create policy "ai_conv_update_own" on public.ai_conversations  for update  using ((user_id = auth.uid()))  with check ((user_id = auth.uid()));

drop policy if exists "ai_feedback_insert_own" on public.ai_feedback;
create policy "ai_feedback_insert_own" on public.ai_feedback  for insert  with check ((user_id = auth.uid()));

drop policy if exists "ai_feedback_select_own" on public.ai_feedback;
create policy "ai_feedback_select_own" on public.ai_feedback  for select  using (((user_id = auth.uid()) OR is_admin()));

drop policy if exists "ai_flags_admin_read" on public.ai_flags;
create policy "ai_flags_admin_read" on public.ai_flags  for select  using (is_admin());

drop policy if exists "ai_flags_admin_update" on public.ai_flags;
create policy "ai_flags_admin_update" on public.ai_flags  for update  using (is_admin())  with check (is_admin());

drop policy if exists "api_usage_admin_read" on public.api_usage;
create policy "api_usage_admin_read" on public.api_usage  for select  using (is_admin());

drop policy if exists "audit_insert_own" on public.attestation_audit;
create policy "audit_insert_own" on public.attestation_audit  for insert  with check ((user_id = auth.uid()));

drop policy if exists "audit_select_own" on public.attestation_audit;
create policy "audit_select_own" on public.attestation_audit  for select  using (((user_id = auth.uid()) OR is_admin()));

drop policy if exists "audit_logs_admin_read" on public.audit_logs;
create policy "audit_logs_admin_read" on public.audit_logs  for select  using (is_admin());

drop policy if exists "bis_select_own" on public.back_in_stock_subscriptions;
create policy "bis_select_own" on public.back_in_stock_subscriptions  for select  using (((user_id = auth.uid()) OR is_admin()));

drop policy if exists "coas_admin_write" on public.coas;
create policy "coas_admin_write" on public.coas  for all  using (is_admin())  with check (is_admin());

drop policy if exists "coas_attested_read" on public.coas;
create policy "coas_attested_read" on public.coas  for select  using ((is_attested() OR is_admin()));

drop policy if exists "coas_public_read" on public.coas;
create policy "coas_public_read" on public.coas  for select  using ((is_published IS NOT FALSE));

drop policy if exists "contact_admin_read" on public.contact_requests;
create policy "contact_admin_read" on public.contact_requests  for select  using (is_admin());

drop policy if exists "disc_redemptions_select_own" on public.discount_redemptions;
create policy "disc_redemptions_select_own" on public.discount_redemptions  for select  using (((user_id = auth.uid()) OR is_admin()));

drop policy if exists "discounts_public_read" on public.discounts;
create policy "discounts_public_read" on public.discounts  for select  using (((is_public = true) AND (active = true)));

drop policy if exists "email_subscribers_admin_read" on public.email_subscribers;
create policy "email_subscribers_admin_read" on public.email_subscribers  for select  using (is_admin());

drop policy if exists "label_history_admin_read" on public.label_config_history;
create policy "label_history_admin_read" on public.label_config_history  for select  using (is_admin());

drop policy if exists "label_configs_admin_all" on public.label_configs;
create policy "label_configs_admin_all" on public.label_configs  for all  using (is_admin())  with check (is_admin());

drop policy if exists "loyalty_select_own" on public.loyalty_ledger;
create policy "loyalty_select_own" on public.loyalty_ledger  for select  using (((user_id = auth.uid()) OR is_admin()));

drop policy if exists "order_items_select_via_order" on public.order_items;
create policy "order_items_select_via_order" on public.order_items  for select  using ((EXISTS ( SELECT 1
   FROM orders o
  WHERE ((o.id = order_items.order_id) AND ((o.user_id = auth.uid()) OR is_admin())))));

drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders  for select  using (((user_id = auth.uid()) OR is_admin()));

drop policy if exists "partner_apps_select_own" on public.partner_applications;
create policy "partner_apps_select_own" on public.partner_applications  for select  using (((user_id = auth.uid()) OR is_admin()));

drop policy if exists "tiers_admin_write" on public.price_tiers;
create policy "tiers_admin_write" on public.price_tiers  for all  using (is_admin())  with check (is_admin());

drop policy if exists "tiers_attested_read" on public.price_tiers;
create policy "tiers_attested_read" on public.price_tiers  for select  using ((is_attested() OR is_admin()));

drop policy if exists "tiers_public_read" on public.price_tiers;
create policy "tiers_public_read" on public.price_tiers  for select  using (true);

drop policy if exists "categories_attested_read" on public.product_categories;
create policy "categories_attested_read" on public.product_categories  for select  using ((is_attested() OR is_admin()));

drop policy if exists "categories_public_read" on public.product_categories;
create policy "categories_public_read" on public.product_categories  for select  using (true);

drop policy if exists "reviews_read" on public.product_reviews;
create policy "reviews_read" on public.product_reviews  for select  using ((((status = 'published'::text) AND is_attested()) OR (user_id = auth.uid()) OR is_admin()));

drop policy if exists "variants_admin_write" on public.product_variants;
create policy "variants_admin_write" on public.product_variants  for all  using (is_admin())  with check (is_admin());

drop policy if exists "variants_attested_read" on public.product_variants;
create policy "variants_attested_read" on public.product_variants  for select  using ((is_attested() OR is_admin()));

drop policy if exists "variants_public_read" on public.product_variants;
create policy "variants_public_read" on public.product_variants  for select  using (true);

drop policy if exists "products_admin_write" on public.products;
create policy "products_admin_write" on public.products  for all  using (is_admin())  with check (is_admin());

drop policy if exists "products_attested_read" on public.products;
create policy "products_attested_read" on public.products  for select  using ((is_attested() OR is_admin()));

drop policy if exists "products_public_read" on public.products;
create policy "products_public_read" on public.products  for select  using (true);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles  for insert  with check ((id = auth.uid()));

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles  for select  using (((id = auth.uid()) OR is_admin()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles  for update  using ((id = auth.uid()))  with check ((id = auth.uid()));

drop policy if exists "referral_codes_select_own" on public.referral_codes;
create policy "referral_codes_select_own" on public.referral_codes  for select  using (((user_id = auth.uid()) OR is_admin()));

drop policy if exists "referral_rewards_select_own" on public.referral_rewards;
create policy "referral_rewards_select_own" on public.referral_rewards  for select  using (((referrer_id = auth.uid()) OR is_admin()));

drop policy if exists "research_articles_admin_write" on public.research_articles;
create policy "research_articles_admin_write" on public.research_articles  for all  using (is_admin())  with check (is_admin());

drop policy if exists "research_articles_public_read" on public.research_articles;
create policy "research_articles_public_read" on public.research_articles  for select  using (((published = true) OR is_admin()));

drop policy if exists "ship_addr_delete_own" on public.shipping_addresses;
create policy "ship_addr_delete_own" on public.shipping_addresses  for delete  using ((user_id = auth.uid()));

drop policy if exists "ship_addr_insert_own" on public.shipping_addresses;
create policy "ship_addr_insert_own" on public.shipping_addresses  for insert  with check ((user_id = auth.uid()));

drop policy if exists "ship_addr_select_own" on public.shipping_addresses;
create policy "ship_addr_select_own" on public.shipping_addresses  for select  using (((user_id = auth.uid()) OR is_admin()));

drop policy if exists "ship_addr_update_own" on public.shipping_addresses;
create policy "ship_addr_update_own" on public.shipping_addresses  for update  using ((user_id = auth.uid()))  with check ((user_id = auth.uid()));

drop policy if exists "support_insert_own" on public.support_tickets;
create policy "support_insert_own" on public.support_tickets  for insert  with check ((user_id = auth.uid()));

drop policy if exists "support_select_own" on public.support_tickets;
create policy "support_select_own" on public.support_tickets  for select  using (((user_id = auth.uid()) OR is_admin()));

drop policy if exists "wishlist_delete_own" on public.wishlist_items;
create policy "wishlist_delete_own" on public.wishlist_items  for delete  using ((user_id = auth.uid()));

drop policy if exists "wishlist_insert_own" on public.wishlist_items;
create policy "wishlist_insert_own" on public.wishlist_items  for insert  with check ((user_id = auth.uid()));

drop policy if exists "wishlist_select_own" on public.wishlist_items;
create policy "wishlist_select_own" on public.wishlist_items  for select  using ((user_id = auth.uid()));

