alter table public.profiles add column if not exists pinned_post_id uuid;
alter table public.profiles add column if not exists is_private boolean not null default false;

create table if not exists public.kyro_profile_settings (
 user_id uuid primary key references auth.users(id) on delete cascade,
 is_private boolean not null default false,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table public.kyro_profile_settings enable row level security;
drop policy if exists "Users read own profile settings" on public.kyro_profile_settings;
create policy "Users read own profile settings" on public.kyro_profile_settings for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists "Users insert own profile settings" on public.kyro_profile_settings;
create policy "Users insert own profile settings" on public.kyro_profile_settings for insert to authenticated with check (user_id=(select auth.uid()));
drop policy if exists "Users update own profile settings" on public.kyro_profile_settings;
create policy "Users update own profile settings" on public.kyro_profile_settings for update to authenticated using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

create table if not exists public.kyro_follow_requests (
 id uuid primary key default gen_random_uuid(),
 requester_id uuid not null references auth.users(id) on delete cascade,
 target_id uuid not null references auth.users(id) on delete cascade,
 status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint kyro_follow_requests_not_self check (requester_id <> target_id),
 constraint kyro_follow_requests_pair_unique unique(requester_id,target_id)
);
alter table public.kyro_follow_requests enable row level security;
drop policy if exists "Users read own follow requests" on public.kyro_follow_requests;
create policy "Users read own follow requests" on public.kyro_follow_requests for select to authenticated using (requester_id=(select auth.uid()) or target_id=(select auth.uid()));
drop policy if exists "Users create own follow requests" on public.kyro_follow_requests;
create policy "Users create own follow requests" on public.kyro_follow_requests for insert to authenticated with check (requester_id=(select auth.uid()) and status='pending' and not public.kyro_is_suspended((select auth.uid())));
drop policy if exists "Targets update follow requests" on public.kyro_follow_requests;
create policy "Targets update follow requests" on public.kyro_follow_requests for update to authenticated using (target_id=(select auth.uid()) and status='pending') with check (target_id=(select auth.uid()) and status in ('accepted','rejected'));

create or replace function public.kyro_guard_profile_pin()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if new.pinned_post_id is not null and not exists (select 1 from public.social_posts p where p.id=new.pinned_post_id and p.user_id=new.id)
 then raise exception 'Можно закрепить только собственную публикацию'; end if;
 return new;
end; $$;
drop trigger if exists kyro_guard_profile_pin on public.profiles;
create trigger kyro_guard_profile_pin before insert or update of pinned_post_id on public.profiles for each row execute function public.kyro_guard_profile_pin();

create or replace function public.kyro_guard_private_follow()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
 if exists(select 1 from public.profiles p where p.id=new.following_id and p.is_private)
 and not exists(select 1 from public.kyro_follow_requests r where r.requester_id=new.follower_id and r.target_id=new.following_id and r.status='accepted')
 then raise exception 'PRIVATE_PROFILE_APPROVAL_REQUIRED'; end if;
 return new;
end; $$;
drop trigger if exists kyro_guard_private_follow on public.social_follows;
create trigger kyro_guard_private_follow before insert on public.social_follows for each row execute function public.kyro_guard_private_follow();

create or replace function public.kyro_accept_follow_request()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status='accepted' and old.status='pending' then
  if auth.uid() is distinct from new.target_id then raise exception 'NOT_REQUEST_TARGET'; end if;
  insert into public.social_follows(follower_id,following_id) values(new.requester_id,new.target_id) on conflict do nothing;
 end if;
 return new;
end; $$;
revoke all on function public.kyro_accept_follow_request() from public,anon,authenticated;
drop trigger if exists kyro_accept_follow_request on public.kyro_follow_requests;
create trigger kyro_accept_follow_request after update of status on public.kyro_follow_requests for each row execute function public.kyro_accept_follow_request();

drop policy if exists "Authenticated users can read visible posts" on public.social_posts;
create policy "Authenticated users can read visible posts" on public.social_posts for select to authenticated using (
 (moderation_status='visible' and (user_id=(select auth.uid()) or not coalesce((select p.is_private from public.profiles p where p.id=social_posts.user_id),false)
  or exists(select 1 from public.social_follows f where f.follower_id=(select auth.uid()) and f.following_id=social_posts.user_id)))
 or user_id=(select auth.uid()) or public.is_kyro_moderator()
);
drop policy if exists "Public read visible market listings" on public.market_listings;
create policy "Public read visible market listings" on public.market_listings for select to authenticated using (
 ((status='published' and moderation_status='visible') and (user_id=(select auth.uid()) or not coalesce((select p.is_private from public.profiles p where p.id=market_listings.user_id),false)
  or exists(select 1 from public.social_follows f where f.follower_id=(select auth.uid()) and f.following_id=market_listings.user_id)))
 or user_id=(select auth.uid()) or public.is_kyro_moderator()
);

create table if not exists public.kyro_conversations (
 id uuid primary key default gen_random_uuid(),
 user_a uuid not null references auth.users(id) on delete cascade,
 user_b uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint kyro_conversations_order check(user_a < user_b),
 constraint kyro_conversations_unique_pair unique(user_a,user_b),
 constraint kyro_conversations_not_self check(user_a <> user_b)
);
create table if not exists public.kyro_messages (
 id uuid primary key default gen_random_uuid(),
 conversation_id uuid not null references public.kyro_conversations(id) on delete cascade,
 sender_id uuid not null references auth.users(id) on delete cascade,
 body text not null check(char_length(trim(body)) between 1 and 5000),
 created_at timestamptz not null default now(),
 read_at timestamptz
);
create index if not exists kyro_messages_conversation_created_idx on public.kyro_messages(conversation_id,created_at);
alter table public.kyro_conversations enable row level security;
alter table public.kyro_messages enable row level security;
drop policy if exists "Participants read conversations" on public.kyro_conversations;
create policy "Participants read conversations" on public.kyro_conversations for select to authenticated using ((select auth.uid()) in (user_a,user_b));
drop policy if exists "Participants create conversations" on public.kyro_conversations;
create policy "Participants create conversations" on public.kyro_conversations for insert to authenticated with check ((select auth.uid()) in (user_a,user_b) and not exists (
 select 1 from public.kyro_user_blocks b where (b.blocker_id=user_a and b.blocked_id=user_b) or (b.blocker_id=user_b and b.blocked_id=user_a)));
drop policy if exists "Participants read messages" on public.kyro_messages;
create policy "Participants read messages" on public.kyro_messages for select to authenticated using (
 exists(select 1 from public.kyro_conversations c where c.id=conversation_id and (select auth.uid()) in (c.user_a,c.user_b)));
drop policy if exists "Participants send messages" on public.kyro_messages;
create policy "Participants send messages" on public.kyro_messages for insert to authenticated with check (
 sender_id=(select auth.uid()) and char_length(trim(body)) between 1 and 5000 and exists(
  select 1 from public.kyro_conversations c where c.id=conversation_id and (select auth.uid()) in (c.user_a,c.user_b)
  and not exists(select 1 from public.kyro_user_blocks b where (b.blocker_id=c.user_a and b.blocked_id=c.user_b) or (b.blocker_id=c.user_b and b.blocked_id=c.user_a))));
drop policy if exists "Recipients mark messages read" on public.kyro_messages;
create policy "Recipients mark messages read" on public.kyro_messages for update to authenticated using (
 exists(select 1 from public.kyro_conversations c where c.id=conversation_id and (select auth.uid()) in (c.user_a,c.user_b) and sender_id<>(select auth.uid())))
 with check (exists(select 1 from public.kyro_conversations c where c.id=conversation_id and (select auth.uid()) in (c.user_a,c.user_b)));
grant select,insert,update on public.kyro_profile_settings,public.kyro_follow_requests,public.kyro_conversations,public.kyro_messages to authenticated;
grant delete on public.kyro_messages to authenticated;
