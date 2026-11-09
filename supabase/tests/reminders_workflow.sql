-- End-to-end reminder workflow test.
--
-- Requires the local stack to be running (database + Edge Function):
--
--   supabase start
--   supabase db reset
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 \
--        -v secret=local-dev-cron-secret -f supabase/tests/reminders_workflow.sql
--
-- It proves the scheduled path: pg_cron entry -> dispatch_due_reminders() -> pg_net ->
-- send-reminders Edge Function -> notification_queue, including deduplication, the
-- 401 path, and quiet-hours suppression.

-- Not wrapped in one transaction on purpose: pg_net only flushes queued requests when
-- the surrounding transaction commits, so dispatching inside BEGIN would never send.
set client_min_messages = warning;

create schema if not exists apptest;

create or replace function apptest.expect(p_actual bigint, p_expected bigint, p_label text)
returns void
language plpgsql
as $$
begin
  if p_actual is distinct from p_expected then
    raise exception 'FAIL %: expected %, got %', p_label, p_expected, p_actual;
  end if;
  raise notice 'PASS %', p_label;
end;
$$;

-- Waits for the pg_net response of a request id (bounded, so a hung worker fails loudly).
create or replace function apptest.await_response(p_request bigint)
returns table (status_code integer, content text)
language plpgsql
as $$
declare
  -- now() is frozen inside a transaction, so the deadline must use clock_timestamp().
  deadline timestamptz := clock_timestamp() + interval '20 seconds';
begin
  loop
    return query
      select r.status_code, r.content
      from net._http_response r
      where r.id = p_request;
    if found then return; end if;
    if clock_timestamp() > deadline then
      raise exception 'Timed out waiting for pg_net response %', p_request;
    end if;
    perform pg_sleep(0.5);
  end loop;
end;
$$;

revoke all on schema apptest from public;

/* ------------------------------ fixtures ------------------------------ */

\set patient '77777777-7777-7777-7777-777777777777'
\set plan    '88888888-8888-8888-8888-888888888888'
\set event   '99999999-9999-9999-9999-999999999999'

delete from auth.users where id = :'patient';

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values (:'patient', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
        'reminder@example.test', '', now(), now(), now());

insert into public.profiles (id, email, name, timezone)
values (:'patient', 'reminder@example.test', 'Reminder Test', 'Africa/Addis_Ababa')
on conflict (id) do update set timezone = excluded.timezone;

insert into public.reminder_preferences (patient_id, kind, enabled, quiet_hours_start, quiet_hours_end)
values (:'patient', 'medication', true, '00:00', '00:00')
on conflict (patient_id, kind) do update set enabled = true, quiet_hours_start = '00:00', quiet_hours_end = '00:00';

insert into public.medication_plans (id, patient_id, name, dose, frequency, times, start_date, status, reminder_enabled)
values (:'plan', :'patient', 'Test medicine', '5 mg', 'twice daily', array['08:00','20:00'], current_date, 'active', true)
on conflict (id) do update set status = 'active', reminder_enabled = true;

insert into public.medication_events (id, patient_id, plan_id, scheduled_for, status, reminder_sent_at)
values (:'event', :'patient', :'plan', now(), 'pending', null)
on conflict (id) do update set scheduled_for = now(), status = 'pending', reminder_sent_at = null;

delete from public.notification_queue where patient_id = :'patient';

/* --------------------- wrong secret must be rejected -------------------- */

select set_config('myrheum.cron_secret', 'definitely-not-the-secret', false);

create temp table bad_dispatch as
select public.dispatch_due_reminders() as request_id;

select apptest.expect(
  (select (apptest.await_response(request_id)).status_code::bigint from bad_dispatch),
  401, 'wrong cron secret is rejected');

/* ------------------------- real dispatch queues one ------------------- */

select set_config('myrheum.cron_secret', :'secret', false);

create temp table good_dispatch as
select public.dispatch_due_reminders() as request_id;

create temp table good_response as
select (apptest.await_response(request_id)).* from good_dispatch;

select apptest.expect(
  (select status_code::bigint from good_response),
  200, 'dispatch returns 200');

select apptest.expect(
  (select count(*) from public.notification_queue where patient_id = :'patient' and status = 'pending'),
  1, 'one reminder queued');

select apptest.expect(
  (select count(*) from public.notification_queue
   where patient_id = :'patient' and body = 'You have a scheduled health reminder.'),
  1, 'queued text stays discreet');

select apptest.expect(
  (select count(*) from public.medication_events where id = :'event' and reminder_sent_at is not null),
  1, 'dose marked as reminded');

/* ------------------------- retry must not duplicate ------------------- */

create temp table retry_dispatch as
select public.dispatch_due_reminders() as request_id;

create temp table retry_response as
select (apptest.await_response(request_id)).* from retry_dispatch;

select apptest.expect(
  (select status_code::bigint from retry_response),
  200, 'retry dispatch returns 200');

select apptest.expect(
  (select count(*) from public.notification_queue where patient_id = :'patient'),
  1, 'retry does not duplicate the reminder');

/* --------------------- quiet hours suppress the reminder ---------------- */

update public.medication_events
set status = 'pending', reminder_sent_at = null, scheduled_for = now()
where id = :'event';
delete from public.notification_queue where patient_id = :'patient';

-- A window that certainly covers "now" in the patient's zone.
update public.reminder_preferences
set quiet_hours_start = '00:00', quiet_hours_end = '23:59'
where patient_id = :'patient' and kind = 'medication';

create temp table quiet_dispatch as
select public.dispatch_due_reminders() as request_id;

create temp table quiet_response as
select (apptest.await_response(request_id)).* from quiet_dispatch;

select apptest.expect(
  (select status_code::bigint from quiet_response),
  200, 'quiet-hours dispatch returns 200');

select apptest.expect(
  (select count(*) from public.notification_queue where patient_id = :'patient'),
  0, 'quiet hours suppress the reminder');

select apptest.expect(
  (select count(*) from public.medication_events where id = :'event' and reminder_sent_at is null),
  1, 'suppressed dose stays unsent for a later run');

\echo 'All reminder workflow checks passed.'
