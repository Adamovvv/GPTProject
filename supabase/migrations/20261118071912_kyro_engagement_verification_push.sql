alter table public.profiles
  add column if not exists is_verified boolean not null default false,
  add column if not exists verified_at timestamptz;

create or replace function private.kyro_sync_profile_verification()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles
     set is_verified = (new.email_confirmed_at is not null and new.email not like '%@auth.kyro.invalid'),
         verified_at = case when new.email_confirmed_at is not null and new.email not like '%@auth.kyro.invalid' then new.email_confirmed_at else null end
   where id = new.id;
  return new;
end;
$$;
drop trigger if exists kyro_sync_profile_verification on auth.users;
create trigger kyro_sync_profile_verification after insert or update of email, email_confirmed_at on auth.users
for each row execute function private.kyro_sync_profile_verification();

update public.profiles p
   set is_verified = (u.email_confirmed_at is not null and u.email not like '%@auth.kyro.invalid'),
       verified_at = case when u.email_confirmed_at is not null and u.email not like '%@auth.kyro.invalid' then u.email_confirmed_at else null end
  from auth.users u where u.id = p.id;

create table if not exists public.social_post_views (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  viewer_id uuid not null references auth.users(id) on delete cascade,
  session_id uuid not null,
  dwell_ms integer not null default 2000 check (dwell_ms between 2000 and 120000),
  source text not null default 'feed' check (source in ('feed','profile','dashboard','search','other')),
  viewed_at timestamptz not null default now(),
  constraint social_post_views_session_unique unique (post_id, viewer_id, session_id)
);
create index if not exists social_post_views_post_viewed_idx on public.social_post_views(post_id, viewed_at desc);
create index if not exists social_post_views_viewer_viewed_idx on public.social_post_views(viewer_id, viewed_at desc);
alter table public.social_post_views enable row level security;
revoke all on public.social_post_views from anon, authenticated;

create or replace function private.kyro_get_social_post_view_counts(p_post_ids uuid[])
returns table(post_id uuid, view_count bigint, unique_viewers bigint)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Authentication required'; end if;
  return query
    select requested.id, count(v.id)::bigint, count(distinct v.viewer_id)::bigint
      from unnest(coalesce(p_post_ids, array[]::uuid[])) as requested(id)
      left join public.social_post_views v on v.post_id = requested.id
     group by requested.id;
end;
$$;

create or replace function private.kyro_record_social_post_view(p_post_id uuid,p_session_id uuid,p_dwell_ms integer default 2000,p_source text default 'feed')
returns table(view_count bigint, unique_viewers bigint)
language plpgsql security definer set search_path = ''
as $$
declare v_user_id uuid := (select auth.uid());
begin
  if v_user_id is null then raise exception 'Authentication required'; end if;
  if p_session_id is null or p_dwell_ms < 2000 or p_dwell_ms > 120000 then raise exception 'Invalid view session'; end if;
  if not exists (select 1 from public.social_posts p where p.id=p_post_id and p.user_id<>v_user_id and p.moderation_status='visible') then
    return query select (select count(*)::bigint from public.social_post_views where post_id=p_post_id),(select count(distinct viewer_id)::bigint from public.social_post_views where post_id=p_post_id);
    return;
  end if;
  insert into public.social_post_views(post_id,viewer_id,session_id,dwell_ms,source)
  values(p_post_id,v_user_id,p_session_id,p_dwell_ms,case when p_source in ('feed','profile','dashboard','search') then p_source else 'other' end)
  on conflict(post_id,viewer_id,session_id) do update set dwell_ms=greatest(public.social_post_views.dwell_ms,excluded.dwell_ms);
  return query select count(*)::bigint,count(distinct viewer_id)::bigint from public.social_post_views where post_id=p_post_id;
end;
$$;

create or replace function public.get_social_post_view_counts(p_post_ids uuid[])
returns table(post_id uuid,view_count bigint,unique_viewers bigint)
language sql stable set search_path = ''
as $$ select * from private.kyro_get_social_post_view_counts(p_post_ids); $$;
create or replace function public.record_social_post_view(p_post_id uuid,p_session_id uuid,p_dwell_ms integer default 2000,p_source text default 'feed')
returns table(view_count bigint,unique_viewers bigint)
language sql set search_path = ''
as $$ select * from private.kyro_record_social_post_view(p_post_id,p_session_id,p_dwell_ms,p_source); $$;

grant usage on schema private to authenticated;
grant execute on function private.kyro_get_social_post_view_counts(uuid[]) to authenticated;
grant execute on function private.kyro_record_social_post_view(uuid,uuid,integer,text) to authenticated;
revoke all on function public.get_social_post_view_counts(uuid[]) from public,anon;
revoke all on function public.record_social_post_view(uuid,uuid,integer,text) from public,anon;
grant execute on function public.get_social_post_view_counts(uuid[]) to authenticated;
grant execute on function public.record_social_post_view(uuid,uuid,integer,text) to authenticated;

create table if not exists public.kyro_push_subscriptions(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 endpoint text not null unique,
 p256dh text not null,
 auth_secret text not null,
 created_at timestamptz not null default now(),
 last_seen_at timestamptz not null default now()
);
create index if not exists kyro_push_subscriptions_user_idx on public.kyro_push_subscriptions(user_id);
alter table public.kyro_push_subscriptions enable row level security;
drop policy if exists "Users manage own push subscriptions" on public.kyro_push_subscriptions;
create policy "Users manage own push subscriptions" on public.kyro_push_subscriptions for all to authenticated
using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
grant select,insert,update,delete on public.kyro_push_subscriptions to authenticated;

do $$
begin
 if exists(select 1 from pg_publication where pubname='supabase_realtime') and
    not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='kyro_notifications') then
   alter publication supabase_realtime add table public.kyro_notifications;
 end if;
end $$;
