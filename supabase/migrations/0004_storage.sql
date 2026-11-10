-- File storage. A file's logical path is "<bucket>/<user id>/<file>"; inside a bucket the object name is "<user id>/<file>",
-- so the policies check that the first folder is the caller's own id.
-- artworks and videos are public to read; damage photos are private to the buyer, the order's artist and admins.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('artworks', 'artworks', true, 5242880, array['image/jpeg', 'image/png', 'image/webp']),
  ('videos', 'videos', true, 52428800, array['video/mp4', 'video/webm']),
  ('damage', 'damage', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;

create policy craftme_upload_artwork_media on storage.objects for insert to authenticated
  with check (bucket_id in ('artworks', 'videos') and public.is_artist() and (storage.foldername(name))[1] = auth.uid()::text);
create policy craftme_upload_damage on storage.objects for insert to authenticated
  with check (bucket_id = 'damage' and (storage.foldername(name))[1] = auth.uid()::text);

create policy craftme_read_public_media on storage.objects for select using (bucket_id in ('artworks', 'videos'));
create policy craftme_read_damage on storage.objects for select to authenticated using (
  bucket_id = 'damage' and (
    (storage.foldername(name))[1] = auth.uid()::text
    or public.is_admin()
    or exists (select 1 from public.damage_reports d where d.artist_id = auth.uid() and ('damage/' || name) = any (d.photos))));

create policy craftme_delete_own_media on storage.objects for delete to authenticated
  using (bucket_id in ('artworks', 'videos') and (storage.foldername(name))[1] = auth.uid()::text);
