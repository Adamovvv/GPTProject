-- Enforce publication cadence at the database boundary, including direct API inserts.
create or replace function private.kyro_guard_social_post_spam()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
 recent_count integer;
 daily_count integer;
 duplicate_count integer;
 actor_role text;
 last_post_at timestamptz;
begin
 if auth.uid() is null or auth.uid() is distinct from new.user_id then
   raise exception 'Invalid post author';
 end if;

 select role into actor_role from public.kyro_user_roles where user_id=new.user_id;
 -- Owner/admin operational accounts remain exempt; moderators follow the same limits as members.
 if coalesce(actor_role,'') in ('owner','admin') then return new; end if;

 if exists(
   select 1 from public.kyro_user_suspensions s
   where s.user_id=new.user_id and (s.expires_at is null or s.expires_at>now())
 ) then
   raise exception 'Аккаунт заблокирован и не может публиковать записи';
 end if;

 -- Serialize concurrent inserts per account to prevent parallel requests bypassing counters.
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));

 select max(p.created_at) into last_post_at
 from public.social_posts p
 where p.user_id=new.user_id;
 if last_post_at is not null and last_post_at>now()-interval '30 seconds' then
   raise exception 'Между публикациями должно пройти не менее 30 секунд.';
 end if;

 select count(*) into recent_count
 from public.social_posts p
 where p.user_id=new.user_id and p.created_at>now()-interval '10 minutes';
 if recent_count>=3 then
   raise exception 'Лимит: не более 3 публикаций за 10 минут. Попробуйте позже.';
 end if;

 select count(*) into daily_count
 from public.social_posts p
 where p.user_id=new.user_id and p.created_at>now()-interval '24 hours';
 if daily_count>=10 then
   raise exception 'Достигнут дневной лимит: 10 публикаций за 24 часа.';
 end if;

 select count(*) into duplicate_count
 from public.social_posts p
 where p.user_id=new.user_id
   and p.created_at>now()-interval '24 hours'
   and regexp_replace(lower(trim(p.content)), '\s+', ' ', 'g')
       =regexp_replace(lower(trim(new.content)), '\s+', ' ', 'g');
 if duplicate_count>0 then
   raise exception 'Похожая публикация уже была размещена за последние 24 часа.';
 end if;

 return new;
end;
$$;

revoke all on function private.kyro_guard_social_post_spam() from public;
drop trigger if exists kyro_guard_social_post_spam on public.social_posts;
create trigger kyro_guard_social_post_spam
before insert on public.social_posts
for each row execute function private.kyro_guard_social_post_spam();
