-- ════════════════════════════════════════════════════════════════════════
-- PROPOSED — do NOT apply without owner approval (Stage 4 checkout compliance)
--
-- Per-order research-use compliance record for the two-step checkout. This is
-- the legal paper trail: the three RUO certifications (with exact server text
-- + version), the research entity/protocol, the shipping snapshot, and the
-- SERVER-captured IP / user-agent / timestamp. It EXTENDS — does not replace —
-- the existing profiles/attestation_audit infrastructure.
--
-- Written by api/checkout-compliance.js via the service role (which bypasses
-- RLS). RLS below locks direct client access: a user reads only their own
-- rows; NO client insert policy (only the server writes). Guest rows
-- (user_id NULL) are readable only by admins/service role.
--
-- Idempotent / additive. Touches no existing table's data.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.order_attestations (
  id                bigint generated always as identity primary key,
  order_id          text,                       -- linked at fulfillment (order_number)
  user_id           uuid references auth.users (id) on delete set null,  -- NULL = guest
  email             text not null,
  contact_name      text,
  research_entity   text not null,
  research_protocol text not null,
  shipping_method   text,
  shipping_address  jsonb,
  billing_address   jsonb,
  version           text not null,
  statements        jsonb not null,             -- [{id,text,agreed:true}, ...]
  ip_address        text,                       -- server-captured
  user_agent        text,                       -- server-captured
  context           text default 'checkout',
  created_at        timestamptz not null default now()
);

create index if not exists idx_order_attest_order on public.order_attestations (order_id);
create index if not exists idx_order_attest_user  on public.order_attestations (user_id);
create index if not exists idx_order_attest_email on public.order_attestations (lower(email));

alter table public.order_attestations enable row level security;

do $$
begin
  -- Read own rows (admins via is_admin()); guest rows are admin-only.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='order_attestations' and policyname='order_attest_select_own') then
    if exists (select 1 from pg_proc where proname='is_admin' and pronamespace='public'::regnamespace) then
      create policy "order_attest_select_own" on public.order_attestations
        for select using (user_id = auth.uid() or public.is_admin());
    else
      create policy "order_attest_select_own" on public.order_attestations
        for select using (user_id = auth.uid());
    end if;
  end if;
  -- NO insert/update/delete policy: only the service role (server) writes.
end $$;

-- Optional linkage column on orders so admin order views can join the record.
alter table public.orders add column if not exists compliance_id bigint;

comment on table public.order_attestations is
  'Per-order RUO compliance record (research entity/protocol + 3 certifications + server IP/UA/timestamp). Written server-side only.';
