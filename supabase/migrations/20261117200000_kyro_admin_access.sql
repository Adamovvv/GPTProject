-- KYRO admin access is derived from Supabase-managed app_metadata (not user-editable profile metadata).
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where id = '25b414ed-7262-4b7a-b719-a05156fb65ae';

create policy "Admins can read all profiles"
on public.profiles for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can read all social posts"
on public.social_posts for select to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

create policy "Admins can delete social posts"
on public.social_posts for delete to authenticated
using ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
