-- PDF logbooks too large for one request (a LogTen logbook of a whole career): the app uploads the file to the
-- pilot's own folder of a private bucket, the import function reads it once with the service key and deletes it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('imports', 'imports', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;

drop policy if exists "imports: own uploads" on storage.objects;
create policy "imports: own uploads" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'imports' and (storage.foldername(name))[1] = auth.uid()::text);
