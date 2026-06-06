-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — 0011: product reviews (ADDITIVE / IDEMPOTENT)
--
-- Claim-safe reviews: quality, packaging, COA, shipping, service — NEVER human
-- results or efficacy (enforced server-side in api/reviews.js). Writes go
-- through the service role after screening; clients can only READ published
-- reviews (attested) and their own.
-- ════════════════════════════════════════════════════════════════════════

create table if not exists public.product_reviews (
  id                bigint generated always as identity primary key,
  product_id        text not null references public.products (id) on delete cascade,
  user_id           uuid not null references auth.users (id) on delete cascade,
  rating            smallint not null check (rating between 1 and 5),
  aspect            text,   -- quality | packaging | coa | shipping | service
  title             text,
  body              text,
  verified_purchase boolean not null default false,
  status            text not null default 'published', -- published | hidden
  created_at        timestamptz not null default now(),
  unique (product_id, user_id)
);
create index if not exists idx_reviews_product on public.product_reviews (product_id, status);

alter table public.product_reviews enable row level security;

do $$
begin
  -- Read: published reviews (attested users) or your own or admin.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='product_reviews' and policyname='reviews_read') then
    create policy "reviews_read" on public.product_reviews
      for select using (
        (status = 'published' and public.is_attested())
        or user_id = auth.uid()
        or public.is_admin()
      );
  end if;
  -- No client insert/update policy: reviews are written by the server (service
  -- role) only, after claim-safe screening + verified-purchase checks.
end $$;
