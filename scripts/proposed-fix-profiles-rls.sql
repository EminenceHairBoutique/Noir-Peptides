-- ════════════════════════════════════════════════════════════════════════
-- SECURITY FIX — profiles self-write privilege escalation  (AUDIT_REPORT C1)
--
-- THE BUG. The shipped policy (migration 0024 line 170; manual-seed-rls.sql
-- line 79) is:
--     for update using (id = auth.uid()) with check (id = auth.uid())
-- WITH CHECK validates WHICH ROW you may write, never WHICH COLUMNS. So any
-- logged-in user can update their own profile row and change any column in
-- it. The anon key is public (it ships in the JS bundle), so the attack is a
-- single REST call with the attacker's own login — no app code involved.
--
-- PROVEN IN SCRATCH POSTGRES 16 (tests/audit/profiles-escalation.test.mjs):
--     update profiles set role='admin' where id = auth.uid();   -->  SUCCEEDS
--
-- BLAST RADIUS — four column groups, each trusted server-side:
--   role                      -> requireAdmin (api/_utils/auth.js:101)   full admin takeover
--   loyalty_points            -> lib/rewards.js:98 "source of truth"     free money at checkout
--   attestation_completed_at  -> checkout gate + is_attested() RLS       bypasses the RUO/legal wall
--   account_tier/partner_*    -> requirePartner (auth.js:132)            wholesale pricing
--
-- THE FIX. The client NEVER updates profiles — verified: src/ contains only
-- SELECTs against the table; every write goes through an /api endpoint on the
-- service role, which bypasses RLS. So the UPDATE grant to anon/authenticated
-- is pure attack surface and is removed. A hardened policy is kept underneath
-- as defence-in-depth in case UPDATE is ever re-granted.
--
-- NOT INCLUDED (and why): an earlier draft of this file used
--     revoke update (role) on public.profiles from authenticated;
-- That is a NO-OP when a table-level UPDATE grant exists — empirically
-- confirmed: escalation still succeeded. Column-level REVOKE cannot subtract
-- from a table-level GRANT. Do not reintroduce it.
--
-- SAFE: changes privileges and one policy. Touches no rows. Reversible
-- (rollback at the bottom). service_role is untouched, so every server
-- endpoint keeps working exactly as before.
-- ════════════════════════════════════════════════════════════════════════

begin;

-- ── 1. BEFORE: capture current state so you can see the change ───────────
select 'BEFORE' as stage, grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema='public' and table_name='profiles' and privilege_type='UPDATE'
 order by grantee;

-- ── 2. PRIMARY FIX: remove the UPDATE grant from the public-facing roles ──
-- service_role and postgres keep theirs (every legitimate write path).
revoke update on public.profiles from anon;
revoke update on public.profiles from authenticated;

-- ── 3. DEFENCE IN DEPTH: harden the policy itself ────────────────────────
-- If UPDATE is ever re-granted (e.g. adding an "edit my profile" feature),
-- this still pins every privilege-bearing column to its stored value: a user
-- may change ordinary fields but can never escalate themselves.
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

-- ── 4. AFTER: verify. anon/authenticated must NOT appear in this result ──
select 'AFTER' as stage, grantee, privilege_type
  from information_schema.role_table_grants
 where table_schema='public' and table_name='profiles' and privilege_type='UPDATE'
 order by grantee;

commit;

-- ════════════════════════════════════════════════════════════════════════
-- ROLLBACK (only if a legitimate flow breaks — nothing in the current app
-- updates profiles from the client, so this should not be needed):
--     grant update on public.profiles to authenticated;
-- The hardened policy from §3 stays in force and still blocks escalation.
-- ════════════════════════════════════════════════════════════════════════
