drop policy "public read photos" on storage.objects;
create policy "auth read photos" on storage.objects for select to authenticated using (bucket_id = 'photos');