-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — 0027 (PROPOSED — do not run until the owner approves):
-- label_configs.product_id ON DELETE CASCADE → RESTRICT
--
-- WHY: label configs are RUO compliance artifacts (approval trail, lot data,
-- verification codes). With CASCADE, deleting a product row — including via
-- any future cleanup/seed script — silently destroys its entire label
-- history. RESTRICT makes the deletion fail loudly instead; a product with
-- labels must have its labels archived/deleted deliberately first.
--
-- variant_id keeps ON DELETE SET NULL (a label degrades gracefully to
-- product-level when a variant is retired — no history is lost).
--
-- Data-safe: changes a constraint rule only; deletes nothing. Idempotent.
-- ════════════════════════════════════════════════════════════════════════

alter table public.label_configs
  drop constraint if exists label_configs_product_id_fkey;

alter table public.label_configs
  add constraint label_configs_product_id_fkey
  foreign key (product_id) references public.products (id) on delete restrict;
