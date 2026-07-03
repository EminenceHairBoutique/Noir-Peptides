-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — 0016: generic payment-provider columns on orders
--
-- The orders table (0004) keyed idempotency on stripe_session_id. With the
-- payment-provider abstraction (Task 5) any rail (Stripe, BTCPay, a future
-- high-risk card / ACH processor) creates orders, so idempotency must be
-- provider-agnostic.
--
--   payment_provider — 'stripe' | 'btcpay' | 'card' | 'ach' | …
--   provider_ref     — the provider's idempotency key (Stripe session id,
--                      BTCPay invoice id, …). UNIQUE so a retried webhook can
--                      never double-fulfill an order.
--
-- Idempotent / additive. Backfills existing Stripe orders.
-- ════════════════════════════════════════════════════════════════════════

alter table public.orders add column if not exists payment_provider text default 'stripe';
alter table public.orders add column if not exists provider_ref     text;

-- Backfill existing rows from the Stripe session id.
update public.orders
  set provider_ref = stripe_session_id
  where provider_ref is null and stripe_session_id is not null;

-- One order per provider reference (idempotent fulfillment across retries).
create unique index if not exists orders_provider_ref_key
  on public.orders (provider_ref)
  where provider_ref is not null;
