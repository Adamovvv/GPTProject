alter table public.profiles
  drop constraint if exists profiles_bio_max_150;
alter table public.profiles
  add constraint profiles_bio_max_150 check (char_length(bio) <= 150);

alter table public.market_listings
  add column if not exists image_urls text[] not null default '{}';

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('avatars', 'avatars', true, 5242880, array['image/jpeg','image/png','image/webp']),
  ('market-images', 'market-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "KYRO users upload own avatars" on storage.objects;
create policy "KYRO users upload own avatars"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

drop policy if exists "KYRO users upload own market images" on storage.objects;
create policy "KYRO users upload own market images"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'market-images'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
