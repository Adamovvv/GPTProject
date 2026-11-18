create or replace function private.kyro_set_user_suspension(target_user uuid, reason_text text, duration_hours integer)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_role text; target_role text;
begin
 select role into actor_role from public.kyro_user_roles where user_id=(select auth.uid());
 select role into target_role from public.kyro_user_roles where user_id=target_user;
 if coalesce(actor_role,'') not in ('owner','admin') then raise exception 'Недостаточно прав'; end if;
 if target_user=(select auth.uid()) then raise exception 'Нельзя заблокировать себя'; end if;
 if actor_role='admin' and target_role in ('owner','admin') then raise exception 'Администратор не может блокировать владельца или администратора'; end if;
 if duration_hours=0 then
   delete from public.kyro_user_suspensions where user_id=target_user;
 elsif duration_hours=-1 then
   insert into public.kyro_user_suspensions(user_id,reason,expires_at,created_by)
   values(target_user,coalesce(reason_text,''),null,(select auth.uid()))
   on conflict(user_id) do update set reason=excluded.reason,expires_at=null,created_by=excluded.created_by,created_at=now();
 elsif duration_hours<1 or duration_hours>8760 then raise exception 'Некорректный срок блокировки';
 else
   insert into public.kyro_user_suspensions(user_id,reason,expires_at,created_by)
   values(target_user,coalesce(reason_text,''),now()+make_interval(hours=>duration_hours),(select auth.uid()))
   on conflict(user_id) do update set reason=excluded.reason,expires_at=excluded.expires_at,created_by=excluded.created_by,created_at=now();
 end if;
end; $$;

create or replace function public.kyro_admin_activity_stats()
returns table(day date, users bigint, posts bigint)
language plpgsql security definer set search_path = '' as $$
begin
 if auth.uid() is null or not public.is_kyro_moderator() then raise exception 'Not authorized'; end if;
 return query
 select d::date,
 (select count(*) from public.profiles p where p.created_at>=d and p.created_at<d+interval '1 day'),
 (select count(*) from public.social_posts sp where sp.created_at>=d and sp.created_at<d+interval '1 day')
 from generate_series(current_date-6,current_date,interval '1 day') d;
end; $$;
revoke all on function public.kyro_admin_activity_stats() from public;
grant execute on function public.kyro_admin_activity_stats() to authenticated;

create or replace function private.kyro_guard_social_post_spam()
returns trigger language plpgsql security definer set search_path = '' as $$
declare recent_count integer; daily_count integer; duplicate_count integer; actor_role text;
begin
 if auth.uid() is null or auth.uid() is distinct from new.user_id then raise exception 'Invalid post author'; end if;
 select role into actor_role from public.kyro_user_roles where user_id=new.user_id;
 if coalesce(actor_role,'') in ('owner','admin','moderator') then return new; end if;
 if exists(select 1 from public.kyro_user_suspensions s where s.user_id=new.user_id and (s.expires_at is null or s.expires_at>now())) then raise exception 'Аккаунт заблокирован и не может публиковать записи'; end if;
 perform pg_advisory_xact_lock(hashtextextended(new.user_id::text,0));
 select count(*) into recent_count from public.social_posts p where p.user_id=new.user_id and p.created_at>now()-interval '10 minutes';
 if recent_count>=4 then raise exception 'Слишком часто публикуете. Подождите 10 минут.'; end if;
 select count(*) into daily_count from public.social_posts p where p.user_id=new.user_id and p.created_at>now()-interval '24 hours';
 if daily_count>=15 then raise exception 'Достигнут дневной лимит публикаций. Попробуйте завтра.'; end if;
 select count(*) into duplicate_count from public.social_posts p where p.user_id=new.user_id and p.created_at>now()-interval '24 hours'
 and regexp_replace(lower(trim(p.content)), '\\s+', ' ', 'g')=regexp_replace(lower(trim(new.content)), '\\s+', ' ', 'g');
 if duplicate_count>0 then raise exception 'Похожая публикация уже была размещена за последние 24 часа'; end if;
 return new;
end; $$;
drop trigger if exists kyro_guard_social_post_spam on public.social_posts;
create trigger kyro_guard_social_post_spam before insert on public.social_posts for each row execute function private.kyro_guard_social_post_spam();
revoke all on function private.kyro_guard_social_post_spam() from public;
