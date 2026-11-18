create or replace function public.kyro_is_suspended(target_user uuid default auth.uid()) returns boolean language sql stable security definer set search_path=''
as $$ select case when target_user=(select auth.uid()) or public.kyro_has_role(array['owner','admin','moderator']) then exists(select 1 from public.kyro_user_suspensions s where s.user_id=target_user and (s.expires_at is null or s.expires_at>now())) else false end; $$;
create or replace function public.kyro_set_user_role(target_user uuid,new_role text) returns void language plpgsql security definer set search_path=''
as $$ declare actor_role text; target_role text; begin
 select role into actor_role from public.kyro_user_roles where user_id=(select auth.uid()); select role into target_role from public.kyro_user_roles where user_id=target_user;
 if actor_role not in ('owner','admin') then raise exception 'Недостаточно прав'; end if;
 if new_role not in ('owner','admin','moderator','user') then raise exception 'Некорректная роль'; end if;
 if actor_role='admin' and (new_role in ('owner','admin') or target_role in ('owner','admin')) then raise exception 'Администратор может управлять только обычными пользователями и модераторами'; end if;
 if target_user=(select auth.uid()) and new_role<>'owner' and actor_role='owner' then raise exception 'Владелец не может снять собственную роль'; end if;
 if target_user=(select auth.uid()) and new_role='user' then raise exception 'Нельзя снять собственную роль'; end if;
 if new_role='user' then delete from public.kyro_user_roles where user_id=target_user; else insert into public.kyro_user_roles(user_id,role,assigned_by) values(target_user,new_role,(select auth.uid())) on conflict(user_id) do update set role=excluded.role,assigned_by=excluded.assigned_by; end if;
end $$;
create or replace function public.kyro_set_user_suspension(target_user uuid,reason_text text,duration_hours integer) returns void language plpgsql security definer set search_path=''
as $$ declare actor_role text; target_role text; begin
 select role into actor_role from public.kyro_user_roles where user_id=(select auth.uid()); select role into target_role from public.kyro_user_roles where user_id=target_user;
 if actor_role not in ('owner','admin') then raise exception 'Недостаточно прав'; end if;
 if target_user=(select auth.uid()) then raise exception 'Нельзя заблокировать себя'; end if;
 if actor_role='admin' and target_role in ('owner','admin') then raise exception 'Администратор не может блокировать владельца или администратора'; end if;
 if duration_hours=0 then delete from public.kyro_user_suspensions where user_id=target_user; elsif duration_hours<0 or duration_hours>8760 then raise exception 'Некорректный срок блокировки';
 else insert into public.kyro_user_suspensions(user_id,reason,expires_at,created_by) values(target_user,coalesce(reason_text,''),now()+make_interval(hours=>duration_hours),(select auth.uid())) on conflict(user_id) do update set reason=excluded.reason,expires_at=excluded.expires_at,created_by=excluded.created_by,created_at=now(); end if;
end $$;
create or replace function public.kyro_create_notification() returns trigger language plpgsql security definer set search_path=''
as $$ declare recipient uuid; actor uuid; item_title text; item_body text; item_url text; kind_value text; begin
 if tg_table_name='social_follows' then actor:=new.follower_id; recipient:=new.following_id; kind_value:='follow'; item_title:='Новый подписчик'; item_body:='На вас подписался пользователь KYRO'; item_url:='/profile';
 elsif tg_table_name='social_likes' then actor:=new.user_id; select user_id into recipient from public.social_posts where id=new.post_id; kind_value:='like'; item_title:='Новая отметка «Нравится»'; item_body:='Кому-то понравилась ваша публикация'; item_url:='/social';
 elsif tg_table_name='social_comments' then actor:=new.user_id; select user_id into recipient from public.social_posts where id=new.post_id; kind_value:='comment'; item_title:='Новый комментарий'; item_body:=left(new.content,180); item_url:='/social'; else return new; end if;
 if recipient is not null and recipient<>actor then insert into public.kyro_notifications(user_id,actor_id,kind,title,body,target_url) values(recipient,actor,kind_value,item_title,item_body,item_url); end if; return new;
end $$;
revoke all on function public.kyro_create_notification() from public,anon,authenticated;
drop trigger if exists kyro_notify_follow on public.social_follows; create trigger kyro_notify_follow after insert on public.social_follows for each row execute function public.kyro_create_notification();
drop trigger if exists kyro_notify_like on public.social_likes; create trigger kyro_notify_like after insert on public.social_likes for each row execute function public.kyro_create_notification();
drop trigger if exists kyro_notify_comment on public.social_comments; create trigger kyro_notify_comment after insert on public.social_comments for each row execute function public.kyro_create_notification();