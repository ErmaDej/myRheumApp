-- Clinic-edition isolation test (runs against a real Postgres with RLS enabled).
--
--   supabase db reset
--   psql "postgresql://postgres:postgres@127.0.0.1:54322/postgres" -v ON_ERROR_STOP=1 \
--        -f supabase/tests/clinic_isolation.sql
--
-- Every check raises an exception on failure, so a non-zero exit means isolation
-- is broken. The script is idempotent: it truncates its own fixtures first.

set client_min_messages = warning;

-- One transaction so SET LOCAL role / request.jwt.claims behave as they do in PostgREST.
begin;

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

-- Runs a query as an authenticated user with the given JWT subject, then restores the
-- session role. Invoker rights (not SECURITY DEFINER) are required: Postgres refuses to
-- switch roles inside a definer function, and the whole point is to exercise RLS.
create or replace function apptest.count_as(p_uid uuid, p_sql text)
returns bigint
language plpgsql
set search_path = public, auth
as $$
declare
  result bigint;
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
  set local role authenticated;
  begin
    execute p_sql into result;
  exception
    -- A policy violation on INSERT/UPDATE surfaces as insufficient_privilege.
    when insufficient_privilege then result := 0;
  end;
  reset role;
  return coalesce(result, 0);
end;
$$;

revoke all on schema apptest from public;

/* ------------------------------ fixtures ------------------------------ */

-- Fixed ids keep the test re-runnable and make failures readable.
\set orgA   '11111111-1111-1111-1111-111111111111'
\set orgB   '22222222-2222-2222-2222-222222222222'
\set patA   '33333333-3333-3333-3333-333333333333'
\set clinA  '44444444-4444-4444-4444-444444444444'
\set clinB  '55555555-5555-5555-5555-555555555555'
\set viewer '66666666-6666-6666-6666-666666666666'

delete from auth.users where id in (:'patA', :'clinA', :'clinB', :'viewer');
delete from public.organizations where id in (:'orgA', :'orgB');

insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
values
  (:'patA',   '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'patient@example.test',  '', now(), now(), now()),
  (:'clinA',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'clin-a@example.test',   '', now(), now(), now()),
  (:'clinB',  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'clin-b@example.test',   '', now(), now(), now()),
  (:'viewer', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'viewer@example.test',   '', now(), now(), now());

insert into public.organizations (id, name) values (:'orgA', 'Clinic A'), (:'orgB', 'Clinic B');

insert into public.memberships (org_id, user_id, role) values
  (:'orgA', :'clinA',  'clinician'),
  (:'orgB', :'clinB',  'clinician'),
  (:'orgA', :'viewer', 'viewer');

insert into public.symptom_entries (patient_id, pain, notes)
values (:'patA', 5, 'isolation fixture');

-- Consent is written by the patient themselves, as the app does.
select apptest.expect(
  apptest.count_as(:'patA', $$
    with ins as (
      insert into public.patient_consents (org_id, patient_id, scope)
      values ('11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', 'read-write')
      returning 1
    ) select count(*) from ins
  $$),
  1, 'patient can grant consent to an organisation');

/* ------------------------------- checks ------------------------------- */

select apptest.expect(
  apptest.count_as(:'patA', 'select count(*) from public.symptom_entries'),
  1, 'patient reads own entries');

select apptest.expect(
  apptest.count_as(:'clinA', 'select count(*) from public.symptom_entries'),
  1, 'org-wide consent lets org clinician read');

select apptest.expect(
  apptest.count_as(:'clinB', 'select count(*) from public.symptom_entries'),
  0, 'clinician from a different org sees nothing');

select apptest.expect(
  apptest.count_as(:'viewer', 'select count(*) from public.symptom_entries'),
  1, 'viewer in the consenting org can read');

select apptest.expect(
  apptest.count_as(:'viewer', $$
    with ins as (
      insert into public.symptom_entries (patient_id, pain)
      values ('33333333-3333-3333-3333-333333333333', 1) returning 1
    ) select count(*) from ins
  $$),
  0, 'read-only viewer cannot write');

select apptest.expect(
  apptest.count_as(:'clinA', $$
    with ins as (
      insert into public.symptom_entries (patient_id, pain)
      values ('33333333-3333-3333-3333-333333333333', 2) returning 1
    ) select count(*) from ins
  $$),
  1, 'clinician with read-write consent can write');

select apptest.expect(
  apptest.count_as(:'clinB', $$
    with ins as (
      insert into public.symptom_entries (patient_id, pain)
      values ('33333333-3333-3333-3333-333333333333', 3) returning 1
    ) select count(*) from ins
  $$),
  0, 'foreign clinician cannot write');

select apptest.expect(
  apptest.count_as(:'clinB', 'select count(*) from public.memberships'),
  1, 'membership listing is limited to own membership');

select apptest.expect(
  apptest.count_as(:'clinB', 'select count(*) from public.organizations'),
  1, 'clinician only sees their own organisation');

-- Revoking consent must immediately end clinician access.
update public.patient_consents set revoked_at = now()
where patient_id = :'patA' and org_id = :'orgA';

select apptest.expect(
  apptest.count_as(:'clinA', 'select count(*) from public.symptom_entries'),
  0, 'revoked consent removes clinician read access');

-- A clinician cannot promote themselves: no INSERT policy exists on memberships.
select apptest.expect(
  apptest.count_as(:'clinB', $$
    with ins as (
      insert into public.memberships (org_id, user_id, role)
      values ('11111111-1111-1111-1111-111111111111', '55555555-5555-5555-5555-555555555555', 'owner') returning 1
    ) select count(*) from ins
  $$),
  0, 'clinician cannot self-promote into another org');

select apptest.expect(
  (select count(*) from public.memberships where user_id = :'clinB' and org_id = :'orgA'),
  0, 'no cross-org membership row was created');

commit;

\echo 'All clinic isolation checks passed.'
