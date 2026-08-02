-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — 0029: fulfillment fields on orders
--
-- The ship-it loop: the Control Room's order detail records the tracking
-- link/carrier when an order ships, the customer's status email and account
-- history surface it, and shipped_at gives an auditable fulfillment
-- timestamp. tracking_url was previously accepted by the status endpoint but
-- only ever emailed — never stored — so it vanished after send.
--
-- Idempotent / additive. No data changed. RLS untouched: customers already
-- read only their own orders (orders_select_own), which now includes these
-- columns; writes remain service-role only.
-- ════════════════════════════════════════════════════════════════════════

alter table public.orders add column if not exists tracking_url      text;
alter table public.orders add column if not exists tracking_carrier  text;
alter table public.orders add column if not exists shipped_at        timestamptz;
alter table public.orders add column if not exists fulfillment_notes text;

comment on column public.orders.tracking_url is
  'Carrier tracking link entered at ship time; shown in the status email and the customer''s order history.';
