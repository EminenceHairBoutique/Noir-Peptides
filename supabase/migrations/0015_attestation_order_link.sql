-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — 0015: link attestations to orders (defensible consent record)
--
-- The attestation_audit table (0003) already records, at consent time:
-- timestamp (created_at), IP (ip_address), user agent, version, the exact
-- attested statements (jsonb), and the legal name. Compliance (Task 4) also
-- wants each PURCHASE tied to the attestation that authorized it.
--
-- This adds an optional order linkage. At order creation the settlement
-- webhooks (Stripe + BTCPay) write a checkout-time attestation row stamped with
-- the order id + the user's stored attestation snapshot, so every order has a
-- timestamp + IP + order id + exact attested text on file.
--
-- Idempotent / additive. order_id is nullable: registration-time attestation
-- rows (no order yet) keep order_id NULL.
-- ════════════════════════════════════════════════════════════════════════

alter table public.attestation_audit
  add column if not exists order_id     text,
  add column if not exists context      text; -- 'registration' | 'checkout'

create index if not exists idx_attestation_audit_order on public.attestation_audit (order_id);
