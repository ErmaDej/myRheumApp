-- Report panels, private attachments and import batches.
--
-- Preliminary (paper or PDF) reports are first-class objects:
--   * lab_panels group the individual results that came from one venepuncture;
--   * attachments record the original PDF/scan in the private medical-documents
--     bucket, optionally linked to a panel or a medical document;
--   * import_batches record where a set of records came from (manual entry,
--     a PDF report, or the local "preliminary tests" folder import).
--
-- Every row stays owned by the patient, and a clinician only sees panels,
-- attachments and batches through an active consent — same rules as the
-- clinical tables added in 0001–0003.

begin;

/* ------------------------------------------------------------------ */
/*                            lab panels                              */
/* ------------------------------------------------------------------ */

create table if not exists public.lab_panels (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  collected_at timestamptz not null,
  laboratory text,
  source text not null default 'patient' check (source in ('patient', 'imported', 'clinician')),
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Individual results can now point back at the report they came from.
alter table public.lab_results
  add column if not exists panel_id uuid references public.lab_panels (id) on delete set null;

create index if not exists lab_panels_patient_time_idx
  on public.lab_panels (patient_id, collected_at desc);
create index if not exists lab_results_panel_idx
  on public.lab_results (panel_id);

/* ------------------------------------------------------------------ */
/*                            import batches                          */
/* ------------------------------------------------------------------ */

create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  label text not null,
  source text not null default 'manual' check (source in ('manual', 'myTestRes', 'pdf', 'csv')),
  status text not null default 'complete' check (status in ('draft', 'partial', 'complete', 'failed')),
  item_count integer not null default 0 check (item_count >= 0),
  summary jsonb not null default '{}'::jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists import_batches_patient_time_idx
  on public.import_batches (patient_id, created_at desc);

/* ------------------------------------------------------------------ */
/*                             attachments                            */
/* ------------------------------------------------------------------ */

create table if not exists public.attachments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references auth.users (id) on delete cascade,
  document_id uuid references public.medical_documents (id) on delete cascade,
  lab_panel_id uuid references public.lab_panels (id) on delete set null,
  import_batch_id uuid references public.import_batches (id) on delete set null,
  storage_bucket text not null default 'medical-documents',
  storage_path text not null,
  file_name text not null,
  mime_type text not null,
  byte_size bigint check (byte_size is null or byte_size >= 0),
  sha256 text check (sha256 is null or sha256 ~ '^[0-9a-f]{64}$'),
  kind text not null default 'other'
    check (kind in ('lab-report', 'imaging', 'prescription', 'referral', 'photo', 'other')),
  captured_on date,
  notes text,
  created_at timestamptz not null default now(),
  -- A file may only live under the owner's folder in a private bucket.
  constraint attachments_owner_folder
    check (storage_bucket in ('medical-documents', 'progress-photos')
           and storage_path like patient_id::text || '/%'),
  constraint attachments_unique_object unique (storage_bucket, storage_path)
);

create index if not exists attachments_patient_time_idx
  on public.attachments (patient_id, created_at desc);
create index if not exists attachments_document_idx
  on public.attachments (document_id);
create index if not exists attachments_panel_idx
  on public.attachments (lab_panel_id);

/* ------------------------------------------------------------------ */
/*                       updated_at / audit triggers                  */
/* ------------------------------------------------------------------ */

drop trigger if exists set_updated_at on public.lab_panels;
create trigger set_updated_at before update on public.lab_panels
  for each row execute function public.touch_updated_at();

do $$
declare
  target text;
begin
  foreach target in array array['lab_panels', 'attachments', 'import_batches']
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
/*                                RLS                                 */
/* ------------------------------------------------------------------ */

alter table public.lab_panels enable row level security;
alter table public.lab_panels force row level security;
alter table public.attachments enable row level security;
alter table public.attachments force row level security;
alter table public.import_batches enable row level security;
alter table public.import_batches force row level security;

do $$
declare
  target text;
begin
  foreach target in array array['lab_panels', 'attachments', 'import_batches']
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

-- A result may only join a panel that belongs to the same patient, and an
-- attachment may only reference a panel/document owned by that patient.
drop policy if exists "lab_results_own_panel" on public.lab_results;
create policy "lab_results_own_panel" on public.lab_results
  as restrictive for insert to authenticated
  with check (
    panel_id is null
    or exists (
      select 1 from public.lab_panels p
      where p.id = panel_id and p.patient_id = (select auth.uid())
    )
  );

drop policy if exists "lab_results_own_panel_update" on public.lab_results;
create policy "lab_results_own_panel_update" on public.lab_results
  as restrictive for update to authenticated
  using (
    panel_id is null
    or exists (
      select 1 from public.lab_panels p
      where p.id = panel_id and p.patient_id = (select auth.uid())
    )
  );

drop policy if exists "attachments_own_links" on public.attachments;
create policy "attachments_own_links" on public.attachments
  as restrictive for insert to authenticated
  with check (
    (document_id is null or exists (
      select 1 from public.medical_documents d
      where d.id = document_id and d.patient_id = (select auth.uid())
    ))
    and (lab_panel_id is null or exists (
      select 1 from public.lab_panels p
      where p.id = lab_panel_id and p.patient_id = (select auth.uid())
    ))
    and (import_batch_id is null or exists (
      select 1 from public.import_batches b
      where b.id = import_batch_id and b.patient_id = (select auth.uid())
    ))
  );

/* ------------------------------------------------------------------ */
/*                              grants                                */
/* ------------------------------------------------------------------ */

revoke all on public.lab_panels, public.attachments, public.import_batches from anon;
grant select, insert, update, delete on public.lab_panels, public.attachments, public.import_batches to authenticated;

commit;
