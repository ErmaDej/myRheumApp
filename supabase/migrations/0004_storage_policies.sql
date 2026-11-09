-- Private object storage. Files are stored under "<patient uuid>/<file>".
-- Buckets are not public; URLs must be short-lived signed URLs.
-- Policies enforce ownership on the server, not just in the UI.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('medical-documents', 'medical-documents', false, 26214400, array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']),
  ('progress-photos', 'progress-photos', false, 15728640, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Owner-only access to medical documents.
drop policy if exists "documents_owner_select" on storage.objects;
create policy "documents_owner_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "documents_owner_insert" on storage.objects;
create policy "documents_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "documents_owner_update" on storage.objects;
create policy "documents_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "documents_owner_delete" on storage.objects;
create policy "documents_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'medical-documents'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

-- Clinicians with an active consent may read documents for that patient.
drop policy if exists "documents_clinician_read" on storage.objects;
create policy "documents_clinician_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'medical-documents'
    and public.has_active_consent(((storage.foldername(name))[1])::uuid, 'read')
  );

-- Photographs: owner only, plus clinician read with consent. No clinician write.
drop policy if exists "photos_owner_select" on storage.objects;
create policy "photos_owner_select" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "photos_owner_insert" on storage.objects;
create policy "photos_owner_insert" on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "photos_owner_update" on storage.objects;
create policy "photos_owner_update" on storage.objects
  for update to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "photos_owner_delete" on storage.objects;
create policy "photos_owner_delete" on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'progress-photos'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

drop policy if exists "photos_clinician_read" on storage.objects;
create policy "photos_clinician_read" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'progress-photos'
    and public.has_active_consent(((storage.foldername(name))[1])::uuid, 'read')
  );

commit;
