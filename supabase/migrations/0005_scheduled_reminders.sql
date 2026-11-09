-- Scheduled reminder dispatch.
--
-- The Edge Function does the work; this migration only makes the schedule
-- reproducible instead of being a manual SQL-editor step. Everything is guarded so
-- a database without pg_cron / pg_net / Vault still migrates cleanly.
--
-- Configure once per environment (Vault is preferred; database settings work too):
--   select vault.create_secret('<secret>', 'myrheum_cron_secret');
--   select vault.create_secret('https://<project-ref>.supabase.co', 'myrheum_functions_url');
-- or
--   alter database postgres set myrheum.cron_secret = '<secret>';
--   alter database postgres set myrheum.functions_url = 'https://<project-ref>.supabase.co';
--
-- Until a secret is configured the job runs and exits without making a request, so a
-- forgotten secret can never spam or break the scheduler.

begin;

do $$
begin
  create extension if not exists pg_cron;
exception when others then
  raise notice 'pg_cron unavailable (%); reminders will not be scheduled', sqlerrm;
end $$;

do $$
begin
  create extension if not exists pg_net with schema extensions;
exception when others then
  begin
    create extension if not exists pg_net;
  exception when others then
    raise notice 'pg_net unavailable (%); reminders will not be dispatched', sqlerrm;
  end;
end $$;

/* Resolve a configuration value from a database setting or Supabase Vault. */
create or replace function public.reminder_config(p_key text)
returns text
language plpgsql
stable
security definer
set search_path = public, extensions
as $$
declare
  value text;
begin
  value := nullif(current_setting('myrheum.' || p_key, true), '');
  if value is not null then
    return value;
  end if;

  if to_regclass('vault.decrypted_secrets') is not null then
    begin
      execute format(
        'select decrypted_secret from vault.decrypted_secrets where name = %L limit 1',
        'myrheum_' || p_key
      )
      into value;
    exception when others then
      value := null;
    end;
  end if;

  return nullif(value, '');
end;
$$;

revoke all on function public.reminder_config(text) from public, anon, authenticated;

/*
 * Invokes the send-reminders Edge Function with the shared cron secret.
 * Returns the pg_net request id, or null when the function is not configured.
 * `http://kong:8000` is the local Supabase gateway, so `supabase db reset`
 * produces a working schedule without any manual setup.
 */
create or replace function public.dispatch_due_reminders()
returns bigint
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  base_url text := coalesce(public.reminder_config('functions_url'), 'http://kong:8000');
  cron_secret text := public.reminder_config('cron_secret');
  request_id bigint;
begin
  if cron_secret is null then
    raise notice 'myrheum.cron_secret is not configured; skipping reminder dispatch';
    return null;
  end if;

  if to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is null then
    raise notice 'pg_net is unavailable; skipping reminder dispatch';
    return null;
  end if;

  select net.http_post(
    url := rtrim(base_url, '/') || '/functions/v1/send-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', cron_secret
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 15000
  )
  into request_id;

  return request_id;
end;
$$;

revoke all on function public.dispatch_due_reminders() from public, anon, authenticated;

/* Schedule every five minutes, replacing any previous definition. */
do $$
begin
  if to_regprocedure('cron.schedule(text,text,text)') is null then
    raise notice 'pg_cron is not installed; reminder job not scheduled';
    return;
  end if;

  -- Existing definitions are removed through the API: direct writes to cron.job are
  -- not permitted for the migration role on every platform.
  begin
    perform cron.unschedule('myrheum-send-reminders');
  exception when others then
    null;
  end;

  perform cron.schedule(
    'myrheum-send-reminders',
    '*/5 * * * *',
    'select public.dispatch_due_reminders();'
  );
exception when others then
  raise notice 'Could not schedule reminders (%); set them up manually', sqlerrm;
end $$;

commit;
