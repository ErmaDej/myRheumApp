# send-reminders

Scheduled, service-role Edge Function that turns due medication doses and appointment
lead-times into **discreet** queued notifications.

## What it does

1. Authenticates the caller with a constant-time comparison of `x-cron-secret`.
2. Reads `reminder_preferences` where `enabled = true`.
3. Finds pending medication events inside the reminder window whose plan is active and
   has reminders enabled.
4. Finds scheduled appointments whose `starts_at - reminder_days_before` has arrived.
5. Skips anything inside the patient's local quiet hours (timezone-aware, midnight-wrap).
6. Upserts rows into `notification_queue` using `dedupe_key` (`dose:<id>` /
   `appointment:<id>`) so retries and overlapping cron runs cannot duplicate a reminder.
7. Marks `reminder_sent_at` only after the queue write succeeds.

The queued title/body are intentionally generic:
`Health reminder` / `You have a scheduled health reminder.` They never contain a medicine
name or diagnosis, so a lock-screen preview cannot leak clinical information.

## Deploy

```bash
supabase functions deploy send-reminders --no-verify-jwt
supabase secrets set CRON_SECRET="$(openssl rand -hex 32)"
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are injected by the platform. Do not put the
service-role key in the client or repository.

## Schedule with pg_cron + pg_net

The schedule is part of the schema: `supabase/migrations/0005_scheduled_reminders.sql`
enables `pg_cron`/`pg_net`, creates `public.dispatch_due_reminders()`, and registers the
`myrheum-send-reminders` job (every five minutes) idempotently. Nothing needs to be pasted
into the SQL editor.

The job needs the shared secret and the project URL. Store them in Vault:

```sql
select vault.create_secret('<CRON_SECRET>', 'myrheum_cron_secret');
select vault.create_secret('https://<project-ref>.supabase.co', 'myrheum_functions_url');
```

`alter database postgres set myrheum.cron_secret = '<CRON_SECRET>'` (and
`myrheum.functions_url`) work too. Without a secret the function returns early with a
notice, so a half-configured environment never sends anything.

Inspect the schedule and its history:

```sql
select jobname, schedule, active from cron.job;
select status, return_message, start_time from cron.job_run_details order by start_time desc limit 5;
select status_code, left(content, 200) from net._http_response order by id desc limit 5;
```

Locally the URL defaults to `http://kong:8000`, so `supabase db reset` produces a working
schedule against the local Edge Runtime.

## Delivery

This function queues notifications; it does not claim delivery. A later push worker should
read `notification_queue` (`status = 'pending'`), send discreet web-push messages to
`push_subscriptions`, and mark rows `sent`. Delivery is always best-effort: the UI must keep
telling patients that reminders can be delayed and are not a safety-critical mechanism.

## Manual test

```bash
curl -X POST "$SUPABASE_URL/functions/v1/send-reminders" \
  -H "x-cron-secret: $CRON_SECRET" \
  -H "Content-Type: application/json" -d '{}'
```

Expected response includes `medicationRemindersQueued`, `appointmentRemindersQueued` and a
`checkedAt` timestamp.

The automated equivalent is `supabase/tests/reminders_workflow.sql` (run it through
`./scripts/db-test.sh`). It seeds a due dose, dispatches through `pg_net`, and asserts the
200 response, the queued discreet notification, retry deduplication, the 401 rejection and
quiet-hours suppression.
