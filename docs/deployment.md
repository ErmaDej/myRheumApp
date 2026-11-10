# Deployment

## Current environments

| Piece | Where | Status |
| --- | --- | --- |
| Frontend (PWA) | https://myrheumapp.vercel.app (Vercel project `myrheumapp`) | deployed |
| Database | Supabase project `zmfrtizptjhugxghzypk`, region `eu-west-2` | migrations `0001`–`0005` applied |
| Reminder Edge Function | `send-reminders` | **not deployed** — needs a Management API token (see below) |

Vercel environment variables (Production, Preview, Development):
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

## Database

The direct host (`db.<ref>.supabase.co`) is IPv6-only, and many networks have no IPv6
route. Use the shared IPv4 pooler instead:

```bash
# session mode, port 5432, user is "postgres.<project-ref>"
psql "host=aws-0-eu-west-2.pooler.supabase.com port=5432 dbname=postgres \
  user=postgres.<ref> sslmode=require"
```

Apply migrations from the repository:

```bash
supabase db push --include-all \
  --db-url "postgresql://postgres.<ref>:<password>@aws-0-eu-west-2.pooler.supabase.com:5432/postgres"
```

Verified after the last push: 5 migrations recorded, 16 public tables with RLS enabled on
all of them, 108 policies, `pg_cron` and `pg_net` installed, the
`myrheum-send-reminders` job registered, and both private storage buckets present.

## Reminder function

The CLI session used for this work cannot manage that project (403 from the Management
API), so the function still has to be deployed by an account with access — either run the
two commands or set `SUPABASE_ACCESS_TOKEN` and use the script.

```bash
supabase functions deploy send-reminders --no-verify-jwt --project-ref zmfrtizptjhugxghzypk
supabase secrets set CRON_SECRET="<generated>" --project-ref zmfrtizptjhugxghzypk
```

Then give `pg_cron` the same secret and the project URL, otherwise the job is a no-op:

```sql
select vault.create_secret('<generated>', 'myrheum_cron_secret');
select vault.create_secret('https://zmfrtizptjhugxghzypk.supabase.co', 'myrheum_functions_url');
```

`scripts/deploy-reminders.sh` performs all four steps in one go; it reads
`SUPABASE_ACCESS_TOKEN` from the environment and never echoes the secret.

Check it afterwards:

```sql
select jobname, schedule, active from cron.job;
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
select status_code, left(content, 160) from net._http_response order by id desc limit 5;
```

## Rotation required

`sampleAssetsnRes/master-prompt.md` was written with the database password and a Vercel
token in plaintext. Both were kept out of git (the raw folder is ignored and the sanitised
copy is `docs/specification.md`), but they should still be rotated:

- Supabase: reset the database password, then update the connection strings you use.
- Vercel: revoke the old token and issue a new one.
- The GitHub PAT in `~/.git-credentials` was printed to a terminal by its helper; rotate it
  if that terminal output was shared.
