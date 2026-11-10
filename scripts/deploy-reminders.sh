#!/usr/bin/env bash
# Deploys the reminder Edge Function and wires the pg_cron job to it.
#
#   SUPABASE_ACCESS_TOKEN=... ./scripts/deploy-reminders.sh
#
# The token must belong to an account with access to the project; the CLI's stored
# session for this project returns 403. The cron secret is generated here, never echoed,
# and written to Vault — the same value is used for the function environment.
set -euo pipefail

cd "$(dirname "$0")/.."

PROJECT_REF="${PROJECT_REF:-zmfrtizptjhugxghzypk}"
PROJECT_URL="${PROJECT_URL:-https://${PROJECT_REF}.supabase.co}"
DB_HOST="${DB_HOST:-aws-0-eu-west-2.pooler.supabase.com}"
DB_URL="${DB_URL:-}"

if [[ -z "${SUPABASE_ACCESS_TOKEN:-}" ]]; then
  echo "SUPABASE_ACCESS_TOKEN is required (Supabase dashboard → Account → Access Tokens)." >&2
  exit 1
fi

if [[ -z "$DB_URL" ]]; then
  echo "DB_URL is required, e.g." >&2
  echo "  postgresql://postgres.${PROJECT_REF}:<password>@${DB_HOST}:5432/postgres" >&2
  exit 1
fi

SECRET="$(openssl rand -hex 32)"

echo "==> Deploying send-reminders"
supabase functions deploy send-reminders --no-verify-jwt --project-ref "$PROJECT_REF"

echo "==> Storing the function secret"
supabase secrets set "CRON_SECRET=${SECRET}" --project-ref "$PROJECT_REF"

echo "==> Pointing pg_cron at the function"
psql "$DB_URL" -v ON_ERROR_STOP=1 -q <<SQL
select vault.create_secret('${SECRET}', 'myrheum_cron_secret', 'myRheumApp reminder dispatch');
select vault.create_secret('${PROJECT_URL}', 'myrheum_functions_url', 'myRheumApp functions base URL');
select public.dispatch_due_reminders() as smoke_test_request_id;
SQL

echo "==> Done. The job runs every five minutes; verify with:"
echo "    select status_code, left(content, 160) from net._http_response order by id desc limit 3;"
