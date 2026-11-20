create table if not exists public.kyro_communities (
 id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (char_length(trim(name)) between 3 and 80),
 slug text not null unique check (slug ~ '^[a-z0-9-]{3,48}$'),
 description text not null default '' check (char_length(description) <= 1000),
 category text not null default 'Общее', created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table if not exists public.kyro_community_members (
 community_id uuid not null references public.kyro_communities(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 role text not null default 'member' check (role in ('owner','moderator','member')),
 joined_at timestamptz not null default now(), primary key (community_id,user_id)
);
create table if not exists public.kyro_community_posts (
 id uuid primary key default gen_random_uuid(), community_id uuid not null references public.kyro_communities(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 content text not null check (char_length(trim(content)) between 1 and 2000),
 created_at timestamptz not null default now(), moderation_status text not null default 'visible'
);
create index if not exists kyro_communities_created_idx on public.kyro_communities(created_at desc);
create index if not exists kyro_community_posts_feed_idx on public.kyro_community_posts(community_id,created_at desc);
alter table public.kyro_communities enable row level security;
alter table public.kyro_community_members enable row level security;
alter table public.kyro_community_posts enable row level security;
grant select,insert,update,delete on public.kyro_communities to authenticated;
grant select,insert,update,delete on public.kyro_community_members to authenticated;
grant select,insert,delete on public.kyro_community_posts to authenticated;
drop policy if exists "Communities visible to authenticated" on public.kyro_communities;
create policy "Communities visible to authenticated" on public.kyro_communities for select to authenticated using (true);
drop policy if exists "Verified users create communities" on public.kyro_communities;
create policy "Verified users create communities" on public.kyro_communities for insert to authenticated with check (owner_id = (select auth.uid()) and not public.kyro_is_suspended((select auth.uid())));
drop policy if exists "Owners update communities" on public.kyro_communities;
create policy "Owners update communities" on public.kyro_communities for update to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()));
drop policy if exists "Owners delete communities" on public.kyro_communities;
create policy "Owners delete communities" on public.kyro_communities for delete to authenticated using (owner_id = (select auth.uid()));
drop policy if exists "Members visible to authenticated" on public.kyro_community_members;
create policy "Members visible to authenticated" on public.kyro_community_members for select to authenticated using (true);
drop policy if exists "Users join communities" on public.kyro_community_members;
create policy "Users join communities" on public.kyro_community_members for insert to authenticated with check (user_id = (select auth.uid()) and role = 'member' and not public.kyro_is_suspended((select auth.uid())));
drop policy if exists "Users leave communities" on public.kyro_community_members;
create policy "Users leave communities" on public.kyro_community_members for delete to authenticated using (user_id = (select auth.uid()) and role <> 'owner');
drop policy if exists "Community posts visible" on public.kyro_community_posts;
create policy "Community posts visible" on public.kyro_community_posts for select to authenticated using (moderation_status = 'visible' or user_id = (select auth.uid()) or public.is_kyro_moderator());
drop policy if exists "Members create community posts" on public.kyro_community_posts;
create policy "Members create community posts" on public.kyro_community_posts for insert to authenticated with check (user_id = (select auth.uid()) and exists(select 1 from public.kyro_community_members m where m.community_id = kyro_community_posts.community_id and m.user_id = (select auth.uid())) and not public.kyro_is_suspended((select auth.uid())));
drop policy if exists "Authors delete own community posts" on public.kyro_community_posts;
create policy "Authors delete own community posts" on public.kyro_community_posts for delete to authenticated using (user_id = (select auth.uid()) or public.is_kyro_moderator());
create or replace function private.kyro_require_verified_email_for_market_and_communities()
returns trigger language plpgsql security definer set search_path = public, private, auth as $$
declare uid uuid; created_today integer;
begin
 if tg_table_name='kyro_communities' then
   uid := new.owner_id;
   select count(*) into created_today from public.kyro_communities c where c.owner_id=uid and c.created_at > now()-interval '24 hours';
   if created_today >= 3 then raise exception 'Можно создать не более 3 сообществ за 24 часа'; end if;
 elsif tg_table_name='market_listings' then
   uid := new.user_id;
   select count(*) into created_today from public.market_listings m where m.user_id=uid and m.created_at > now()-interval '24 hours';
   if created_today >= 10 then raise exception 'Можно опубликовать не более 10 товаров за 24 часа'; end if;
 elsif tg_table_name='kyro_community_posts' or tg_table_name='kyro_community_members' then
   uid := new.user_id;
   if tg_table_name='kyro_community_posts' then
     select count(*) into created_today from public.kyro_community_posts p where p.user_id=uid and p.created_at > now()-interval '24 hours';
     if created_today >= 15 then raise exception 'Можно опубликовать не более 15 сообщений в сообществах за 24 часа'; end if;
   end if;
 else raise exception 'Unsupported table'; end if;
 if exists(select 1 from public.profiles p where p.id=uid and p.email_verification_required and p.email_verified_at is null) then
   raise exception 'Подтвердите email, чтобы создавать сообщества, писать в них и публиковать товары в маркете';
 end if;
 return new;
end $$;
drop trigger if exists kyro_require_verified_email_community on public.kyro_communities;
create trigger kyro_require_verified_email_community before insert on public.kyro_communities for each row execute function private.kyro_require_verified_email_for_market_and_communities();
drop trigger if exists kyro_require_verified_email_market on public.market_listings;
create trigger kyro_require_verified_email_market before insert on public.market_listings for each row execute function private.kyro_require_verified_email_for_market_and_communities();
drop trigger if exists kyro_require_verified_email_community_post on public.kyro_community_posts;
create trigger kyro_require_verified_email_community_post before insert on public.kyro_community_posts for each row execute function private.kyro_require_verified_email_for_market_and_communities();
drop trigger if exists kyro_require_verified_email_community_member on public.kyro_community_members;
create trigger kyro_require_verified_email_community_member before insert on public.kyro_community_members for each row execute function private.kyro_require_verified_email_for_market_and_communities();
drop trigger if exists kyro_require_verified_email_community_post on public.kyro_community_posts;
create trigger kyro_require_verified_email_community_post before insert on public.kyro_community_posts for each row execute function private.kyro_require_verified_email_for_market_and_communities();
create or replace function private.kyro_add_community_owner_member()
returns trigger language plpgsql security definer set search_path = public, private as $$
begin insert into public.kyro_community_members(community_id,user_id,role) values(new.id,new.owner_id,'owner') on conflict do nothing; return new; end $$;
drop trigger if exists kyro_add_community_owner_member on public.kyro_communities;
create trigger kyro_add_community_owner_member after insert on public.kyro_communities for each row execute function private.kyro_add_community_owner_member();
