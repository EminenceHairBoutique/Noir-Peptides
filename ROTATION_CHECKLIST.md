# Credential Rotation Checklist

Rotation — not deletion — is what neutralizes an exposed credential. Order:
most-privileged first. **Status from this audit: no secret was found leaked**
in `dist/` or git history — this list is precautionary + the standing set to
rotate on any suspected exposure or staff change.

| Order | Credential | Rotate because / where | Found exposed? |
| --- | --- | --- | --- |
| 1 | `SUPABASE_SERVICE_ROLE_KEY` | Bypasses all RLS; highest blast radius. Supabase → Settings → API → roll. | No — server-only, not in bundle [VERIFIED] |
| 2 | `STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` | Money movement. Rotate together; update the webhook endpoint secret. | No [VERIFIED] |
| 3 | `BTCPAY_API_KEY` + `BTCPAY_WEBHOOK_SECRET` | Crypto rail. | No |
| 4 | `RESEND_API_KEY` | Can send mail as your domain. | No |
| 5 | `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY` | Metered spend. | No |
| 6 | `SUPABASE_ANON_KEY` (`VITE_`) | Public by design — rotate ONLY after B1 (the RLS escalation) is fixed, else you're rotating a key whose real problem is policy, not secrecy. | Public (intended) |

## Do BEFORE rotating the anon key (order matters)

1. **Apply `scripts/proposed-fix-profiles-rls.sql`** (fixes the escalation the
   public key otherwise enables). Validated: blocks `role→admin`, allows
   ordinary self-edits.
2. **Run the live RLS probe** (below). Must return `[]` for all three.

## Live RLS probe — run yourself (sandbox can't reach the project)

```bash
REF=<your-project-ref>; ANON=<your-anon-key>
for t in profiles orders attestation_audit; do
  echo "== $t =="
  curl -s "https://$REF.supabase.co/rest/v1/$t?select=*&limit=1" \
    -H "apikey: $ANON" -H "Authorization: Bearer $ANON"
done
# EXPECT: [] for every table. Any object with data = world-readable PII = STOP.
```

```sql
-- Dump the live policies for the sensitive tables and eyeball the UPDATE ones:
select tablename, policyname, cmd, qual as using_expr, with_check
from pg_policies
where schemaname='public'
  and tablename in ('profiles','orders','attestation_audit')
order by tablename, cmd;
-- RED FLAG: any UPDATE policy on profiles whose with_check does NOT pin `role`.
```

## Repo / identity de-linking (report-only)

The GitHub org `EminenceHairBoutique` and commit authorship tie this
research-materials store to an unrelated named brand + a real identity. If that
linkage is unwanted: move the repo to a dedicated org, scrub the
name/description/homepage, and squash-author future history under a project
identity. (Cannot be done from here.)
