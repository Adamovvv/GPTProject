create table if not exists public.kyro_user_roles (
 user_id uuid primary key references auth.users(id) on delete cascade,
 role text not null check (role in ('owner','admin','moderator')),
 assigned_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.kyro_user_roles enable row level security;
create table if not exists public.kyro_user_suspensions (
 user_id uuid primary key references auth.users(id) on delete cascade,
 reason text not null default '',
 expires_at timestamptz,
 created_by uuid references auth.users(id),
 created_at timestamptz not null default now()
);
alter table public.kyro_user_suspensions enable row level security;
create table if not exists public.kyro_notifications (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 actor_id uuid references auth.users(id) on delete set null,
 kind text not null,title text not null,body text not null default '',target_url text,
 read_at timestamptz,created_at timestamptz not null default now()
);
alter table public.kyro_notifications enable row level security;
create index if not exists kyro_notifications_user_created_idx on public.kyro_notifications(user_id,created_at desc);
create table if not exists public.kyro_interests (
 user_id uuid not null references auth.users(id) on delete cascade,
 interest text not null,created_at timestamptz not null default now(),primary key(user_id,interest)
);
alter table public.kyro_interests enable row level security;
create table if not exists public.market_listings (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 title text not null,description text not null default '',category text not null default 'Другое',price numeric(12,2),
 status text not null default 'published' check(status in ('draft','published','archived','removed')),
 moderation_status text not null default 'visible' check(moderation_status in ('visible','hidden','pending')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.market_listings enable row level security;
create table if not exists public.kyro_events (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 title text not null,description text not null default '',location text not null default '',starts_at timestamptz,
 status text not null default 'published' check(status in ('draft','published','cancelled','archived')),
 moderation_status text not null default 'visible' check(moderation_status in ('visible','hidden','pending')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.kyro_events enable row level security;
alter table public.social_posts add column if not exists moderation_status text not null default 'visible' check(moderation_status in ('visible','hidden','pending'));
alter table public.social_comments add column if not exists moderation_status text not null default 'visible' check(moderation_status in ('visible','hidden','pending'));
create index if not exists market_listings_search_idx on public.market_listings using gin (to_tsvector('simple',coalesce(title,'')||' '||coalesce(description,'')));
create index if not exists kyro_events_search_idx on public.kyro_events using gin (to_tsvector('simple',coalesce(title,'')||' '||coalesce(description,'')));
create or replace function public.kyro_has_role(required_roles text[]) returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.kyro_user_roles r where r.user_id=(select auth.uid()) and r.role=any(required_roles)); $$;
revoke all on function public.kyro_has_role(text[]) from public,anon;
grant execute on function public.kyro_has_role(text[]) to authenticated;
create or replace function public.is_kyro_admin() returns boolean language sql stable security definer set search_path=''
as $$ select public.kyro_has_role(array['owner','admin']); $$;
create or replace function public.is_kyro_moderator() returns boolean language sql stable security definer set search_path=''
as $$ select public.kyro_has_role(array['owner','admin','moderator']); $$;
create or replace function public.kyro_is_suspended(target_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.kyro_user_suspensions s where s.user_id=target_user and (s.expires_at is null or s.expires_at>now())); $$;
revoke all on function public.kyro_is_suspended(uuid) from public,anon;
grant execute on function public.kyro_is_suspended(uuid) to authenticated;
create or replace function public.kyro_set_user_role(target_user uuid,new_role text) returns void language plpgsql security definer set search_path=''
as $$ declare actor_role text; begin
 select role into actor_role from public.kyro_user_roles where user_id=(select auth.uid());
 if actor_role not in ('owner','admin') then raise exception 'Недостаточно прав'; end if;
 if new_role not in ('owner','admin','moderator','user') then raise exception 'Некорректная роль'; end if;
 if actor_role='admin' and new_role in ('owner','admin') then raise exception 'Администратор может назначать только модераторов'; end if;
 if target_user=(select auth.uid()) and new_role='user' then raise exception 'Нельзя снять собственную роль'; end if;
 if new_role='user' then delete from public.kyro_user_roles where user_id=target_user;
 else insert into public.kyro_user_roles(user_id,role,assigned_by) values(target_user,new_role,(select auth.uid())) on conflict(user_id) do update set role=excluded.role,assigned_by=excluded.assigned_by; end if;
end $$;
revoke all on function public.kyro_set_user_role(uuid,text) from public,anon;
grant execute on function public.kyro_set_user_role(uuid,text) to authenticated;
create or replace function public.kyro_set_user_suspension(target_user uuid,reason_text text,duration_hours integer) returns void language plpgsql security definer set search_path=''
as $$ begin
 if not public.kyro_has_role(array['owner','admin']) then raise exception 'Недостаточно прав'; end if;
 if target_user=(select auth.uid()) then raise exception 'Нельзя заблокировать себя'; end if;
 if duration_hours=0 then delete from public.kyro_user_suspensions where user_id=target_user;
 elsif duration_hours<0 or duration_hours>8760 then raise exception 'Некорректный срок блокировки';
 else insert into public.kyro_user_suspensions(user_id,reason,expires_at,created_by) values(target_user,coalesce(reason_text,''),now()+make_interval(hours=>duration_hours),(select auth.uid())) on conflict(user_id) do update set reason=excluded.reason,expires_at=excluded.expires_at,created_by=excluded.created_by,created_at=now(); end if;
end $$;
revoke all on function public.kyro_set_user_suspension(uuid,text,integer) from public,anon;
grant execute on function public.kyro_set_user_suspension(uuid,text,integer) to authenticated;
create policy "Users read own role" on public.kyro_user_roles for select to authenticated using(user_id=(select auth.uid()) or public.is_kyro_moderator());
create policy "Users read own suspension" on public.kyro_user_suspensions for select to authenticated using(user_id=(select auth.uid()) or public.is_kyro_moderator());
create policy "Users read own notifications" on public.kyro_notifications for select to authenticated using(user_id=(select auth.uid()));
create policy "Users update own notifications" on public.kyro_notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "Users manage own interests" on public.kyro_interests for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "Public read visible market listings" on public.market_listings for select to authenticated using((status='published' and moderation_status='visible') or user_id=(select auth.uid()) or public.is_kyro_moderator());
create policy "Users create own market listings" on public.market_listings for insert to authenticated with check(user_id=(select auth.uid()) and not public.kyro_is_suspended((select auth.uid())));
create policy "Users update own or moderators manage market listings" on public.market_listings for update to authenticated using(user_id=(select auth.uid()) or public.is_kyro_moderator()) with check(user_id=(select auth.uid()) or public.is_kyro_moderator());
create policy "Users delete own or moderators market listings" on public.market_listings for delete to authenticated using(user_id=(select auth.uid()) or public.is_kyro_moderator());
create policy "Public read visible events" on public.kyro_events for select to authenticated using((status='published' and moderation_status='visible') or user_id=(select auth.uid()) or public.is_kyro_moderator());
create policy "Users create own events" on public.kyro_events for insert to authenticated with check(user_id=(select auth.uid()) and not public.kyro_is_suspended((select auth.uid())));
create policy "Users update own or moderators manage events" on public.kyro_events for update to authenticated using(user_id=(select auth.uid()) or public.is_kyro_moderator()) with check(user_id=(select auth.uid()) or public.is_kyro_moderator());
create policy "Users delete own or moderators events" on public.kyro_events for delete to authenticated using(user_id=(select auth.uid()) or public.is_kyro_moderator());
create policy "Moderators update comment visibility" on public.social_comments for update to authenticated using(public.is_kyro_moderator()) with check(public.is_kyro_moderator());
create policy "Moderators update post visibility" on public.social_posts for update to authenticated using(public.is_kyro_moderator()) with check(public.is_kyro_moderator());
create policy "Moderators delete comments" on public.social_comments for delete to authenticated using(public.is_kyro_moderator());
create policy "Moderators manage listings" on public.market_listings for all to authenticated using(public.is_kyro_moderator()) with check(public.is_kyro_moderator());
create policy "Moderators manage events" on public.kyro_events for all to authenticated using(public.is_kyro_moderator()) with check(public.is_kyro_moderator());
insert into public.kyro_user_roles(user_id,role) values ('25b414ed-7262-4b7a-b719-a05156fb65ae','owner'),('c342c8da-d945-4625-b8a1-dad48892430e','admin') on conflict(user_id) do update set role=excluded.role;