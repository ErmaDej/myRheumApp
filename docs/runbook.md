# Runbook - myRheumApp

## Overview

myRheumApp is a personal rheumatology tracking Progressive Web App (PWA) that runs offline-first with optional Supabase sync. This runbook documents deployment, maintenance, and troubleshooting procedures.

## Environment Status

| Piece | Where | Status |
|------|-------|--------|
| Frontend (PWA) | https://myrheumapp.vercel.app (Vercel project `myrheumapp`) | deployed |
| Database | Supabase project `zmfrtizptjhugxghzypk`, region `eu-west-2` | migrations `0001`-`0005` applied |
| Reminder Edge Function | `send-reminders` | deployed with cron job |

Vercel environment variables (Production, Preview, Development):
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## Database

The direct host (`db.<ref>.supabase.co`) is IPv6-only, and many networks have no IPv6 route. Use the shared IPv4 pooler instead:

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

Verified after the last push: 5 migrations recorded, 16 public tables with RLS enabled on all of them, 108 policies, `pg_cron` and `pg_net` installed, the `myrheum-send-reminders` job registered, and both private storage buckets present.

## Reminder function

The reminder Edge Function is deployed and the cron job is active. It sends reminders every 5 minutes.

```bash
# To redeploy the function:
supabase functions deploy send-reminders --no-verify-jwt --project-ref zmfrtizptjhugxghzypk

# To update the cron secret:
supabase secrets set CRON_SECRET="<generated>" --project-ref zmfrtizptjhugxghzypk

# Verify the job is running:
sql> select jobname, schedule, active from cron.job;
sql> select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
sql> select status_code, left(content, 160) from net._http_response order by id desc limit 5;
```

The script `scripts/deploy-reminders.sh` performs all steps in one go; it reads `SUPABASE_ACCESS_TOKEN` from the environment and never echoes the secret.

## Rotation required

Database passwords and Vercel tokens should be rotated periodically. Never commit secrets to the repository.

- Supabase: reset the database password, then update the connection strings you use.
- Vercel: revoke the old token and issue a new one.
- The GitHub PAT in `~/.git-credentials` was printed to a terminal by its helper; rotate it if that terminal output was shared.

## Offline-first data

- Every mutation is written to an observable in-memory store and persisted to Dexie (IndexedDB) immediately; the UI is never blocked on the network.
- A durable outbox queues mutations when Supabase is configured. Failed uploads stay queued with an attempt count; nothing is silently dropped.
- Sensitive photographs are deliberately never queued or uploaded in this build.
- Revoke/clear local data from Settings; the policy is documented in the UI.

## Testing

```bash
npm test                 # 79 unit/integration tests
npm run test:e2e         # builds, serves preview, runs desktop + mobile Chromium
./scripts/db-test.sh     # migrations + RLS isolation + reminder workflow (needs Docker)
```

Coverage includes clinical algorithms, timezone/DST conversion, ICS folding, CSV formula injection, reminder quiet hours, store/outbox behaviour, clinic permission boundaries and axe audits of login/dashboard.

## Backup / export drill

- In-app: **Reports** → JSON backup, symptom/lab/dose CSVs, PDF summary.
- Verify and archive an export:
  ```bash
  node scripts/backup.mjs path/to/myrheum-backup-YYYY-MM-DD.json
  ```
  The script validates the schema, writes CSV copies and a SHA-256 manifest, and refuses malformed input. Encrypt archives at rest and store them away from the device.