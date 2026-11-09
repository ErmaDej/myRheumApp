-- myRheumApp core schema
-- Every patient-owned table uses a uuid primary key, an explicit owner and
-- timestamps. Run on a development project first and take a backup before
-- applying to a project that already contains records.

begin;

create extension if not exists pgcrypto;

/* ------------------------------------------------------------------ */
/*                             profiles                               */
/* ------------------------------------------------------------------ */

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  name text not null default 'Patient',
  timezone text not null default 'Africa/Addis_Ababa',
  units text not null default 'metric' check (units in ('metric', 'imperial')),
  consent_given boolean not null default false,
  onboarding_complete boolean not null default false,
  diagnosis text,
  diagnosis_date timestamptz,
  baseline_date timestamptz,
  treatment_started_on timestamptz,
  clinic text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

/* ------------------------------------------------------------------ */
/*                         patient records                            */
/* ------------------------------------------------------------------ */

create table if not exists public.symptom_entries (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  recorded_at timestamptz not null default now(),
  pain numeric(3, 1) check (pain is null or (pain >= 0 and pain <= 10)),
  stiffness_minutes integer check (stiffness_minutes is null or (stiffness_minutes >= 0 and stiffness_minutes <= 1440)),
  fatigue numeric(3, 1) check (fatigue is null or (fatigue >= 0 and fatigue <= 10)),
  sleep_quality numeric(3, 1) check (sleep_quality is null or (sleep_quality >= 0 and sleep_quality <= 10)),
  functional_difficulty numeric(3, 1) check (functional_difficulty is null or (functional_difficulty >= 0 and functional_difficulty <= 10)),
  mood numeric(3, 1) check (mood is null or (mood >= 0 and mood <= 10)),
  triggers text not null default '',
  notes text not null default '',
  side_effects text not null default '',
  provenance text not null default 'patient' check (provenance in ('patient', 'imported', 'clinician')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questionnaire_assessments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  instrument text not null check (instrument in ('BASDAI', 'BASFI', 'ASDAS')),
  answers jsonb not null default '{}'::jsonb,
  crp numeric(10, 3) check (crp is null or crp >= 0),
  score numeric(8, 4) not null,
  algorithm_version text not null,
  assessed_at timestamptz not null default now(),
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.medication_plans (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  ingredient text,
  dose text not null,
  route text not null default 'Oral',
  frequency text not null,
  times text[] not null default '{}'::text[],
  start_date date not null,
  end_date date,
  prescriber text,
  status text not null default 'active' check (status in ('active', 'paused', 'completed', 'discontinued')),
  notes text,
  reminder_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medication_events (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  plan_id uuid not null references public.medication_plans (id) on delete cascade,
  scheduled_for timestamptz not null,
  status text not null default 'pending' check (status in ('taken', 'skipped', 'uncertain', 'pending')),
  recorded_at timestamptz,
  note text,
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.lab_results (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  test_name text not null,
  value_numeric numeric(18, 6),
  value_text text not null,
  unit text not null,
  reference_low numeric(18, 6),
  reference_high numeric(18, 6),
  reference_text text,
  collected_at timestamptz not null,
  laboratory text,
  source text not null default 'patient' check (source in ('patient', 'imported', 'clinician')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.medical_documents (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  category text not null check (category in ('diagnosis', 'note', 'imaging', 'prescription', 'lab-report', 'referral', 'other')),
  occurred_on timestamptz not null,
  clinician text,
  body text,
  storage_path text,
  source text not null default 'patient' check (source in ('patient', 'imported', 'clinician')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  starts_at timestamptz not null,
  timezone text not null default 'Africa/Addis_Ababa',
  clinician text,
  location text,
  kind text not null default 'follow-up' check (kind in ('follow-up', 'initial', 'review', 'infusion', 'other')),
  status text not null default 'scheduled' check (status in ('scheduled', 'completed', 'cancelled', 'rescheduled')),
  notes text,
  questions text[] not null default '{}'::text[],
  reminder_days_before integer not null default 1 check (reminder_days_before >= 0 and reminder_days_before <= 30),
  reminder_sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.appointment_tasks (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  patient_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  done boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.progress_photos (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  taken_on timestamptz not null,
  view text not null default 'front' check (view in ('front', 'side', 'back', 'other')),
  storage_path text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.reminder_preferences (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('medication', 'appointment', 'check-in')),
  enabled boolean not null default false,
  quiet_hours_start time not null default '22:00',
  quiet_hours_end time not null default '07:00',
  discreet_lock_screen boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (patient_id, kind)
);

-- Queue used by the scheduled reminder Edge Function. Content is deliberately
-- non-descriptive so lock-screen text never names a medicine or diagnosis.
create table if not exists public.notification_queue (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  kind text not null check (kind in ('medication', 'appointment', 'check-in')),
  scheduled_for timestamptz not null,
  title text not null default 'Health reminder',
  body text not null default 'You have a scheduled health reminder.',
  dedupe_key text not null unique,
  status text not null default 'pending' check (status in ('pending', 'sent', 'cancelled')),
  created_at timestamptz not null default now()
);

/* ------------------------------------------------------------------ */
/*                         indexes                                    */
/* ------------------------------------------------------------------ */

create index if not exists symptom_entries_patient_time_idx on public.symptom_entries (patient_id, recorded_at desc);
create index if not exists assessments_patient_time_idx on public.questionnaire_assessments (patient_id, instrument, assessed_at desc);
create index if not exists medication_plans_patient_idx on public.medication_plans (patient_id, status);
create index if not exists medication_events_patient_time_idx on public.medication_events (patient_id, scheduled_for desc);
create index if not exists medication_events_due_idx on public.medication_events (scheduled_for) where status = 'pending' and reminder_sent_at is null;
create index if not exists lab_results_patient_test_time_idx on public.lab_results (patient_id, test_name, collected_at desc);
create index if not exists medical_documents_patient_time_idx on public.medical_documents (patient_id, occurred_on desc);
create index if not exists appointments_patient_time_idx on public.appointments (patient_id, starts_at desc);
create index if not exists appointment_tasks_appointment_idx on public.appointment_tasks (appointment_id);
create index if not exists progress_photos_patient_time_idx on public.progress_photos (patient_id, taken_on desc);
create index if not exists notification_queue_pending_idx on public.notification_queue (status, scheduled_for);

/* ------------------------------------------------------------------ */
/*                        updated_at trigger                          */
/* ------------------------------------------------------------------ */

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

do $$
declare
  target text;
begin
  foreach target in array array[
    'profiles', 'symptom_entries', 'medication_plans', 'lab_results',
    'medical_documents', 'appointments', 'reminder_preferences'
  ]
  loop
    execute format('drop trigger if exists set_updated_at on public.%I', target);
    execute format(
      'create trigger set_updated_at before update on public.%I for each row execute function public.touch_updated_at()',
      target
    );
  end loop;
end;
$$;

commit;
