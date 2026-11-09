#!/usr/bin/env bash
# Applies every migration to a clean local database and runs the SQL test suites.
#
#   ./scripts/db-test.sh                  # reset + run both suites
#   SEED_SECRET=... ./scripts/db-test.sh  # use a non-default local cron secret
#
# Requires Docker and the Supabase CLI, and `supabase start` must have been run:
# the reminder suite calls the Edge Function end to end through pg_net.
set -euo pipefail

cd "$(dirname "$0")/.."

SECRET="${SEED_SECRET:-local-dev-cron-secret}"
PROJECT_ID="$(sed -n 's/^project_id = "\(.*\)"/\1/p' supabase/config.toml)"
CONTAINER="supabase_db_${PROJECT_ID}"
PSQL=(docker exec -i "$CONTAINER" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q)

if ! docker ps --format '{{.Names}}' | grep -qx "$CONTAINER"; then
  echo "Database container '$CONTAINER' is not running. Start the stack with: supabase start" >&2
  exit 1
fi

echo "==> Applying migrations to a clean database"
supabase db reset

echo "==> Clinic-edition isolation (RLS)"
"${PSQL[@]}" < supabase/tests/clinic_isolation.sql

echo "==> Reminder workflow (pg_cron -> pg_net -> Edge Function)"
"${PSQL[@]}" -v secret="$SECRET" < supabase/tests/reminders_workflow.sql

echo "All database tests passed."
