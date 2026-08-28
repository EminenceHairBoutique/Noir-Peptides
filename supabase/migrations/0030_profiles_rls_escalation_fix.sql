-- ════════════════════════════════════════════════════════════════════════
-- 0030 — profiles self-write privilege escalation fix  (AUDIT_REPORT C1)
--
-- Formalizes scripts/proposed-fix-profiles-rls.sql as a real migration.
-- Idempotent: safe to run against a database where the fix was already
-- hand-applied, and safe to re-run any number of times.
--
-- THE BUG. The policy shipped by 0024 (and RE-CREATED by 0026) is:
--     for update using (id = auth.uid()) with check (id = auth.uid())
-- WITH CHECK validates WHICH ROW you may write, never WHICH COLUMNS. Any
-- logged-in user can therefore update their own profile row and change ANY
-- column in it via the public REST API (the anon key ships in the JS
-- bundle) — proven in scratch Postgres 16:
--     update profiles set role='admin' where id = auth.uid();  -->  SUCCEEDS
--
-- BLAST RADIUS — four column groups, each trusted server-side:
--   role                      -> requireAdmin (api/_utils/auth.js)   full admin takeover
--   loyalty_points            -> lib/rewards.js "source of truth"    free money at checkout
--   attestation_completed_at  -> checkout gate + is_attested() RLS   bypasses the RUO/legal wall
--   account_tier/partner_*    -> requirePartner (auth.js)            wholesale pricing
--
-- ⚠ ORDERING HAZARD. Migration 0026 (admin-access repair) re-grants UPDATE
-- on profiles to `authenticated` and re-creates the weak policy as part of
-- its repair block. THIS migration must therefore always run AFTER 0026 —
-- which the numbering guarantees on a fresh apply. If 0026 is ever re-run
-- by hand on the live database, RE-RUN THIS MIGRATION immediately after,
-- then run `npm run verify:rls`.
--
-- THE FIX. The client NEVER updates profiles (verified: src/ contains only
-- SELECTs; every write goes through /api on the service role, which
-- bypasses RLS). So the UPDATE grant to anon/authenticated is pure attack
-- surface and is removed. A hardened policy is kept underneath as
-- defence-in-depth in case UPDATE is ever re-granted.
--
-- NOT INCLUDED (and why): column-level `revoke update (role)` is a NO-OP
-- when a table-level UPDATE grant exists — empirically confirmed: the
-- escalation still succeeded. Column-level REVOKE cannot subtract from a
-- table-level GRANT. Do not reintroduce it.
--
-- SAFE: changes privileges and one policy. Touches no rows. service_role
-- and postgres are untouched, so every server endpoint keeps working.
-- ════════════════════════════════════════════════════════════════════════

-- ── 1. PRIMARY FIX: remove the UPDATE grant from the public-facing roles ──
-- Role-guarded (repo pattern from 0026) so this also applies cleanly on a
-- vanilla Postgres without Supabase's roles (CI's fresh-PG16 check).
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke update on public.profiles from anon;
  end if;
  if exists (select 1 from pg_roles where rolname = 'authenticated') then
    revoke update on public.profiles from authenticated;
  end if;
end $$;

-- ── 2. DEFENCE IN DEPTH: harden the policy itself ────────────────────────
-- If UPDATE is ever re-granted (e.g. adding an "edit my profile" feature),
-- this still pins every privilege-bearing column to its stored value: a
-- user may change ordinary fields but can never escalate themselves.
drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update
  using (id = auth.uid())
  with check (
    id = auth.uid()
    and role                     is not distinct from (select p.role                     from public.profiles p where p.id = auth.uid())
    and account_tier             is not distinct from (select p.account_tier             from public.profiles p where p.id = auth.uid())
    and partner_status           is not distinct from (select p.partner_status           from public.profiles p where p.id = auth.uid())
    and loyalty_points           is not distinct from (select p.loyalty_points           from public.profiles p where p.id = auth.uid())
    and attestation_completed_at is not distinct from (select p.attestation_completed_at from public.profiles p where p.id = auth.uid())
  );

-- ════════════════════════════════════════════════════════════════════════
-- ROLLBACK (only if a legitimate flow breaks — nothing in the current app
-- updates profiles from the client, so this should not be needed):
--
--   grant update on public.profiles to authenticated;
--
-- The hardened policy above stays in force and still blocks escalation.
-- ════════════════════════════════════════════════════════════════════════
