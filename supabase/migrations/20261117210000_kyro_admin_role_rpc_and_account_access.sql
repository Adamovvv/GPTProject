-- Admin access is checked against Supabase-managed app metadata on the server.
update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"role":"admin"}'::jsonb
where id in (
  '25b414ed-7262-4b7a-b719-a05156fb65ae',
  'c342c8da-d945-4625-b8a1-dad48892430e'
);

create or replace function public.is_kyro_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from auth.users
    where id = (select auth.uid())
      and raw_app_meta_data ->> 'role' = 'admin'
  );
$$;

revoke all on function public.is_kyro_admin() from public, anon;
grant execute on function public.is_kyro_admin() to authenticated;

drop policy if exists "Admins can read all profiles" on public.profiles;
drop policy if exists "Admins can read all social posts" on public.social_posts;
drop policy if exists "Admins can delete social posts" on public.social_posts;

create policy "Admins can read all profiles"
on public.profiles for select to authenticated
using (public.is_kyro_admin());

create policy "Admins can read all social posts"
on public.social_posts for select to authenticated
using (public.is_kyro_admin());

create policy "Admins can delete social posts"
on public.social_posts for delete to authenticated
using (public.is_kyro_admin());
