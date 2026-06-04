-- ════════════════════════════════════════════════════════════════════════
-- Noir Peptides — 0008: AI suite + semantic search (ADDITIVE / IDEMPOTENT)
--
-- Persistence for the Checkpoint 3 AI endpoints plus the pgvector store for
-- semantic search. Embeddings are produced by an external provider (Voyage AI)
-- — Anthropic has no first-party embeddings API. The embedding dimension here
-- (1024) matches Voyage's voyage-3 family; change it only alongside the
-- ingestion job if you switch models.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. pgvector ──────────────────────────────────────────────────────────
create extension if not exists vector;

-- ── 2. ai_conversations ──────────────────────────────────────────────────
create table if not exists public.ai_conversations (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references auth.users (id) on delete set null,
  feature    text not null,            -- research_assistant | coa_analyzer | ...
  messages   jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_ai_conversations_user on public.ai_conversations (user_id);

-- ── 3. ai_feedback ───────────────────────────────────────────────────────
create table if not exists public.ai_feedback (
  id              bigint generated always as identity primary key,
  conversation_id uuid references public.ai_conversations (id) on delete cascade,
  user_id         uuid references auth.users (id) on delete set null,
  rating          smallint check (rating between -1 and 1),
  comment         text,
  created_at      timestamptz not null default now()
);
create index if not exists idx_ai_feedback_conversation on public.ai_feedback (conversation_id);

-- ── 4. embeddings (semantic search store) ────────────────────────────────
create table if not exists public.embeddings (
  id           bigint generated always as identity primary key,
  content_type text not null,          -- compound | article | coa | faq
  ref_id       text not null,          -- source row id / slug
  content      text not null,          -- the chunk that was embedded
  embedding    vector(1024),
  metadata     jsonb default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  unique (content_type, ref_id)
);
-- Approximate-nearest-neighbour index for cosine distance.
create index if not exists idx_embeddings_vector
  on public.embeddings using ivfflat (embedding vector_cosine_ops) with (lists = 100);
create index if not exists idx_embeddings_type on public.embeddings (content_type);

-- ── 5. RLS ───────────────────────────────────────────────────────────────
alter table public.ai_conversations enable row level security;
alter table public.ai_feedback      enable row level security;
alter table public.embeddings       enable row level security;

do $$
begin
  -- ai_conversations: owner read/insert/update; admins read all.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_conversations' and policyname='ai_conv_select_own') then
    create policy "ai_conv_select_own" on public.ai_conversations
      for select using (user_id = auth.uid() or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_conversations' and policyname='ai_conv_insert_own') then
    create policy "ai_conv_insert_own" on public.ai_conversations
      for insert with check (user_id = auth.uid());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_conversations' and policyname='ai_conv_update_own') then
    create policy "ai_conv_update_own" on public.ai_conversations
      for update using (user_id = auth.uid()) with check (user_id = auth.uid());
  end if;

  -- ai_feedback: owner insert/read; admins read all.
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_feedback' and policyname='ai_feedback_select_own') then
    create policy "ai_feedback_select_own" on public.ai_feedback
      for select using (user_id = auth.uid() or public.is_admin());
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='ai_feedback' and policyname='ai_feedback_insert_own') then
    create policy "ai_feedback_insert_own" on public.ai_feedback
      for insert with check (user_id = auth.uid());
  end if;

  -- embeddings: server-only (no anon/authenticated policies). Semantic search
  -- runs through the service role; clients never query this table directly.
end $$;
