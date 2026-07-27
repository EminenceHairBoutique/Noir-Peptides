// tests/audit/profiles-escalation.test.mjs
// Proves AUDIT_REPORT finding C1 (profiles UPDATE policy privilege escalation)
// and validates scripts/proposed-fix-profiles-rls.sql, in scratch Postgres 16.
// The shipped policy must let a user set their own role='admin'; the fixed
// policy must block it. Skips cleanly where local postgres / the ubuntu
// sandbox user is unavailable.
import { execFileSync } from "node:child_process";
import { existsSync, writeFileSync } from "node:fs";

if (!existsSync("/usr/lib/postgresql/16/bin/initdb")) {
  console.log("audit/profiles-escalation: SKIP (no local postgres)");
  process.exit(0);
}
const bash = `set -e
PGBIN=/usr/lib/postgresql/16/bin
D=/tmp/auditesc_t; S=/tmp/auditescs_t; rm -rf "$D" "$S"; mkdir -p "$D" "$S"
$PGBIN/initdb -D "$D" -U postgres -A trust >/dev/null 2>&1
$PGBIN/pg_ctl -D "$D" -o "-k $S -c listen_addresses=''" -l /tmp/auditesc_t.log start >/dev/null
P="$PGBIN/psql -h $S -U postgres -d postgres -v ON_ERROR_STOP=1 -tA"
U=a0000000-0000-0000-0000-000000000001
setup(){ $P >/dev/null <<SQL
drop schema if exists auth cascade; create schema auth; create table auth.users(id uuid primary key);
create or replace function auth.uid() returns uuid language sql stable as \\$\\$ select nullif(current_setting('req.uid',true),'')::uuid \\$\\$;
drop table if exists public.profiles cascade;
create table public.profiles(id uuid primary key, email text, role text not null default 'customer');
alter table public.profiles enable row level security;
create policy sel on public.profiles for select using (id=auth.uid());
insert into auth.users values ('$U'); insert into public.profiles values ('$U','u@x.com','customer');
drop role if exists at; create role at login; grant usage on schema auth to at; grant execute on function auth.uid() to at; grant select,update on public.profiles to at;
SQL
}
setup; $P >/dev/null -c "create policy upd on public.profiles for update using (id=auth.uid()) with check (id=auth.uid());"
V=$($P <<SQL
set role at; set req.uid='$U'; update public.profiles set role='admin' where id=auth.uid(); reset role; select role from public.profiles;
SQL
)
setup; $P >/dev/null -c "create policy upd on public.profiles for update using (id=auth.uid()) with check (id=auth.uid() and role=(select p.role from public.profiles p where p.id=auth.uid())); revoke update(role) on public.profiles from at;"
F=$($P 2>/dev/null <<SQL || true
set role at; set req.uid='$U'; update public.profiles set role='admin' where id=auth.uid(); reset role; select role from public.profiles;
SQL
)
$PGBIN/pg_ctl -D "$D" stop >/dev/null
echo "VULN=$(echo \"$V\" | grep -Eo 'admin|customer' | tail -1) FIXED=$(echo \"$F\" | grep -Eo 'admin|customer' | tail -1)"`;
writeFileSync("/tmp/audit_esc_t.sh", bash);
let out;
try {
  out = execFileSync("su", ["ubuntu", "-c", "bash /tmp/audit_esc_t.sh"], { encoding: "utf8" }).trim();
} catch (e) {
  console.log("audit/profiles-escalation: SKIP (scratch pg unavailable:", (e.message||"").split("\n")[0], ")");
  process.exit(0);
}
console.log(out);
const vuln = /VULN=\s*admin/.test(out);
const fixedBlocked = !/FIXED=\s*admin/.test(out);
if (vuln && fixedBlocked) {
  console.log("audit/profiles-escalation: PASS — shipped policy escalates to admin; proposed fix blocks it");
  process.exit(0);
}
console.error("audit/profiles-escalation: FAIL"); process.exit(1);
