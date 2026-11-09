-- Row Level Security for myRheumApp.
-- Every exposed table is protected. Policies are permissive and scoped to the
-- authenticated user; the service role is used only by trusted server code.

begin;

-- Automatically create a profile for a new auth user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Enable RLS everywhere.
do $$
declare
  target text;
begin
  foreach target in array array[
    'profiles', 'symptom_entries', 'questionnaire_assessments',
    'medication_plans', 'medication_events', 'lab_results',
    'medical_documents', 'appointments', 'appointment_tasks',
    'progress_photos', 'reminder_preferences', 'notification_queue'
  ]
  loop
    execute format('alter table public.%I enable row level security', target);
    execute format('alter table public.%I force row level security', target);
  end loop;
end;
$$;

/* ---------------------------- profiles ---------------------------- */

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own" on public.profiles
  for insert to authenticated with check (id = (select auth.uid()));

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

/* ----------------------- generic owner tables ---------------------- */

do $$
declare
  target text;
begin
  foreach target in array array[
    'symptom_entries', 'questionnaire_assessments', 'medication_plans',
    'medication_events', 'lab_results', 'medical_documents',
    'appointments', 'appointment_tasks', 'progress_photos',
    'reminder_preferences', 'notification_queue'
  ]
  loop
    execute format('drop policy if exists "owner_select" on public.%I', target);
    execute format(
      'create policy "owner_select" on public.%I for select to authenticated using (patient_id = (select auth.uid()))',
      target
    );

    execute format('drop policy if exists "owner_insert" on public.%I', target);
    execute format(
      'create policy "owner_insert" on public.%I for insert to authenticated with check (patient_id = (select auth.uid()))',
      target
    );

    execute format('drop policy if exists "owner_update" on public.%I', target);
    execute format(
      'create policy "owner_update" on public.%I for update to authenticated using (patient_id = (select auth.uid())) with check (patient_id = (select auth.uid()))',
      target
    );

    execute format('drop policy if exists "owner_delete" on public.%I', target);
    execute format(
      'create policy "owner_delete" on public.%I for delete to authenticated using (patient_id = (select auth.uid()))',
      target
    );
  end loop;
end;
$$;

-- A medication event may only reference the owner's own plan.
drop policy if exists "medication_events_own_plan" on public.medication_events;
create policy "medication_events_own_plan" on public.medication_events
  as restrictive for insert to authenticated
  with check (
    exists (
      select 1 from public.medication_plans p
      where p.id = plan_id and p.patient_id = (select auth.uid())
    )
  );

drop policy if exists "medication_events_own_plan_update" on public.medication_events;
create policy "medication_events_own_plan_update" on public.medication_events
  as restrictive for update to authenticated
  using (
    exists (
      select 1 from public.medication_plans p
      where p.id = plan_id and p.patient_id = (select auth.uid())
    )
  );

-- An appointment task must belong to an appointment owned by the same patient.
drop policy if exists "appointment_tasks_own_appointment" on public.appointment_tasks;
create policy "appointment_tasks_own_appointment" on public.appointment_tasks
  as restrictive for insert to authenticated
  with check (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and a.patient_id = (select auth.uid())
    )
  );

-- Notification queue is written by the service role. Patients may read and
-- cancel their own queued items, but cannot write arbitrary rows.
drop policy if exists "notification_queue_no_patient_insert" on public.notification_queue;
create policy "notification_queue_no_patient_insert" on public.notification_queue
  as restrictive for insert to authenticated
  with check (false);

-- Grant table privileges only to authenticated users; anon can read nothing.
do $$
declare
  target text;
begin
  foreach target in array array[
    'profiles', 'symptom_entries', 'questionnaire_assessments',
    'medication_plans', 'medication_events', 'lab_results',
    'medical_documents', 'appointments', 'appointment_tasks',
    'progress_photos', 'reminder_preferences'
  ]
  loop
    execute format('revoke all on public.%I from anon', target);
    execute format('grant select, insert, update, delete on public.%I to authenticated', target);
  end loop;
end;
$$;

revoke all on public.notification_queue from anon, authenticated;
grant select, update on public.notification_queue to authenticated;

commit;
