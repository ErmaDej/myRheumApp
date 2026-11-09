-- Future clinic edition, safe by construction.
--
-- This migration does NOT broaden access for the single-patient deployment.
-- A clinician can read a patient's record only when:
--   1. the clinician is a member of the organisation that holds the consent;
--   2. the patient has granted an active, unrevoked consent;
--   3. the consent either names the clinician or is org-wide (grantee is null).
-- Writing additionally requires read-write scope and a writing role.
--
-- Membership changes are service-role only, so a clinician cannot promote
-- themselves into another organisation.

begin;

create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'clinician', 'coordinator', 'viewer')),
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table if not exists public.patient_consents (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  patient_id uuid not null references auth.users (id) on delete cascade,
  granted_to_user_id uuid references auth.users (id) on delete cascade,
  scope text not null default 'read' check (scope in ('read', 'read-write')),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  note text
);

create unique index if not exists patient_consents_active_unique
  on public.patient_consents (org_id, patient_id, coalesce(granted_to_user_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where revoked_at is null;

create table if not exists public.audit_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid,
  org_id uuid references public.organizations (id) on delete set null,
  patient_id uuid,
  action text not null,
  entity text,
  at timestamptz not null default now()
);

create index if not exists memberships_user_idx on public.memberships (user_id);
create index if not exists memberships_org_idx on public.memberships (org_id);
create index if not exists consents_patient_idx on public.patient_consents (patient_id) where revoked_at is null;
create index if not exists consents_org_idx on public.patient_consents (org_id) where revoked_at is null;
create index if not exists audit_patient_time_idx on public.audit_events (patient_id, at desc);
create index if not exists audit_org_time_idx on public.audit_events (org_id, at desc);

/* ------------------------------------------------------------------ */
/*                          helper functions                          */
/* ------------------------------------------------------------------ */

create or replace function public.has_active_consent(p_patient uuid, p_required text default 'read')
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.patient_consents c
    join public.memberships m on m.org_id = c.org_id
    where c.patient_id = p_patient
      and c.revoked_at is null
      and m.user_id = (select auth.uid())
      and (c.granted_to_user_id is null or c.granted_to_user_id = (select auth.uid()))
      and (
        p_required = 'read'
        or (c.scope = 'read-write' and m.role in ('owner', 'clinician', 'coordinator'))
      )
  );
$$;

create or replace function public.is_org_member(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org and m.user_id = (select auth.uid())
  );
$$;

create or replace function public.is_org_auditor(p_org uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = p_org
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'clinician')
  );
$$;

/* ------------------------------------------------------------------ */
/*                         RLS configuration                          */
/* ------------------------------------------------------------------ */

alter table public.organizations enable row level security;
alter table public.memberships enable row level security;
alter table public.patient_consents enable row level security;
alter table public.audit_events enable row level security;

-- Organisations are visible to their members.
drop policy if exists "organizations_member_select" on public.organizations;
create policy "organizations_member_select" on public.organizations
  for select to authenticated using (public.is_org_member(id));

-- A member can see their own membership; owners can see every membership.
drop policy if exists "memberships_self_select" on public.memberships;
create policy "memberships_self_select" on public.memberships
  for select to authenticated using (user_id = (select auth.uid()) or public.is_org_auditor(org_id));

-- Membership writes are service-role only. No insert/update/delete policies
-- exist for authenticated users, so self-promotion is impossible.

-- Patients manage their own consents.
drop policy if exists "consents_patient_select" on public.patient_consents;
create policy "consents_patient_select" on public.patient_consents
  for select to authenticated using (patient_id = (select auth.uid()));

drop policy if exists "consents_patient_insert" on public.patient_consents;
create policy "consents_patient_insert" on public.patient_consents
  for insert to authenticated with check (patient_id = (select auth.uid()));

drop policy if exists "consents_patient_update" on public.patient_consents;
create policy "consents_patient_update" on public.patient_consents
  for update to authenticated
  using (patient_id = (select auth.uid()))
  with check (patient_id = (select auth.uid()));

drop policy if exists "consents_patient_delete" on public.patient_consents;
create policy "consents_patient_delete" on public.patient_consents
  for delete to authenticated using (patient_id = (select auth.uid()));

-- Clinicians can read the consent that names them (or an org-wide consent).
drop policy if exists "consents_clinician_select" on public.patient_consents;
create policy "consents_clinician_select" on public.patient_consents
  for select to authenticated using (
    revoked_at is null
    and public.is_org_member(org_id)
    and (granted_to_user_id is null or granted_to_user_id = (select auth.uid()))
  );

-- Audit trail: the patient sees their own events; auditors see their org.
drop policy if exists "audit_patient_select" on public.audit_events;
create policy "audit_patient_select" on public.audit_events
  for select to authenticated using (patient_id = (select auth.uid()));

drop policy if exists "audit_org_select" on public.audit_events;
create policy "audit_org_select" on public.audit_events
  for select to authenticated using (org_id is not null and public.is_org_auditor(org_id));

-- No INSERT/UPDATE/DELETE policies for authenticated: audit rows are written
-- only by the security-definer trigger below.

/* ------------------------------------------------------------------ */
/*                    clinician read / write policies                 */
/* ------------------------------------------------------------------ */

do $$
declare
  target text;
begin
  foreach target in array array[
    'symptom_entries', 'questionnaire_assessments', 'medication_plans',
    'medication_events', 'lab_results', 'medical_documents',
    'appointments', 'progress_photos', 'reminder_preferences'
  ]
  loop
    execute format('drop policy if exists "clinician_read" on public.%I', target);
    execute format(
      'create policy "clinician_read" on public.%I for select to authenticated using (public.has_active_consent(patient_id, ''read''))',
      target
    );

    execute format('drop policy if exists "clinician_write_insert" on public.%I', target);
    execute format(
      'create policy "clinician_write_insert" on public.%I for insert to authenticated with check (public.has_active_consent(patient_id, ''write''))',
      target
    );

    execute format('drop policy if exists "clinician_write_update" on public.%I', target);
    execute format(
      'create policy "clinician_write_update" on public.%I for update to authenticated using (public.has_active_consent(patient_id, ''write'')) with check (public.has_active_consent(patient_id, ''write''))',
      target
    );

    execute format('drop policy if exists "clinician_write_delete" on public.%I', target);
    execute format(
      'create policy "clinician_write_delete" on public.%I for delete to authenticated using (public.has_active_consent(patient_id, ''write''))',
      target
    );
  end loop;
end;
$$;

-- Appointment tasks follow the appointment's consent.
drop policy if exists "clinician_tasks_read" on public.appointment_tasks;
create policy "clinician_tasks_read" on public.appointment_tasks
  for select to authenticated using (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and public.has_active_consent(a.patient_id, 'read')
    )
  );

drop policy if exists "clinician_tasks_write" on public.appointment_tasks;
create policy "clinician_tasks_write" on public.appointment_tasks
  for all to authenticated using (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and public.has_active_consent(a.patient_id, 'write')
    )
  ) with check (
    exists (
      select 1 from public.appointments a
      where a.id = appointment_id and public.has_active_consent(a.patient_id, 'write')
    )
  );

/* ------------------------------------------------------------------ */
/*                           audit trigger                            */
/* ------------------------------------------------------------------ */

create or replace function public.log_audit_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
begin
  if tg_op = 'DELETE' then
    pid := old.patient_id;
  else
    pid := new.patient_id;
  end if;

  insert into public.audit_events (actor_id, patient_id, action, entity)
  values (auth.uid(), pid, lower(tg_op) || ':' || tg_table_name, tg_table_name);

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

do $$
declare
  target text;
begin
  foreach target in array array[
    'symptom_entries', 'questionnaire_assessments', 'medication_plans',
    'medication_events', 'lab_results', 'medical_documents',
    'appointments', 'progress_photos'
  ]
  loop
    execute format('drop trigger if exists audit_row_change on public.%I', target);
    execute format(
      'create trigger audit_row_change after insert or update or delete on public.%I for each row execute function public.log_audit_event()',
      target
    );
  end loop;
end;
$$;

/* ------------------------------------------------------------------ */
/*                              grants                                */
/* ------------------------------------------------------------------ */

revoke all on public.organizations, public.memberships, public.patient_consents, public.audit_events from anon;
grant select on public.organizations, public.memberships, public.patient_consents, public.audit_events to authenticated;
grant insert, update, delete on public.patient_consents to authenticated;
-- memberships are intentionally not writable by authenticated users.

commit;
