create schema if not exists private;
revoke all on schema private from public,anon;
grant usage on schema private to authenticated;
create or replace function private.kyro_has_role(required_roles text[])
returns boolean language sql stable security definer set search_path=''
as $$ select exists(select 1 from public.kyro_user_roles r where r.user_id=(select auth.uid()) and r.role=any(required_roles)); $$;
create or replace function private.kyro_is_suspended(target_user uuid)
returns boolean language sql stable security definer set search_path=''
as $$ select case when target_user=(select auth.uid()) or private.kyro_has_role(array['owner','admin','moderator']) then exists(select 1 from public.kyro_user_suspensions s where s.user_id=target_user and (s.expires_at is null or s.expires_at>now())) else false end; $$;
create or replace function private.kyro_set_user_role(target_user uuid,new_role text)
returns void language plpgsql security definer set search_path=''
as $$ declare actor_role text; target_role text; begin
 select role into actor_role from public.kyro_user_roles where user_id=(select auth.uid()); select role into target_role from public.kyro_user_roles where user_id=target_user;
 if coalesce(actor_role,'') not in ('owner','admin') then raise exception 'Недостаточно прав'; end if;
 if new_role not in ('owner','admin','moderator','user') then raise exception 'Некорректная роль'; end if;
 if actor_role='admin' and (new_role in ('owner','admin') or target_role in ('owner','admin')) then raise exception 'Администратор может управлять только обычными пользователями и модераторами'; end if;
 if target_user=(select auth.uid()) and new_role<>'owner' and actor_role='owner' then raise exception 'Владелец не может снять собственную роль'; end if;
 if target_user=(select auth.uid()) and new_role='user' then raise exception 'Нельзя снять собственную роль'; end if;
 if new_role='user' then delete from public.kyro_user_roles where user_id=target_user; else insert into public.kyro_user_roles(user_id,role,assigned_by) values(target_user,new_role,(select auth.uid())) on conflict(user_id) do update set role=excluded.role,assigned_by=excluded.assigned_by; end if;
end $$;
create or replace function private.kyro_set_user_suspension(target_user uuid,reason_text text,duration_hours integer)
returns void language plpgsql security definer set search_path=''
as $$ declare actor_role text; target_role text; begin
 select role into actor_role from public.kyro_user_roles where user_id=(select auth.uid()); select role into target_role from public.kyro_user_roles where user_id=target_user;
 if coalesce(actor_role,'') not in ('owner','admin') then raise exception 'Недостаточно прав'; end if;
 if target_user=(select auth.uid()) then raise exception 'Нельзя заблокировать себя'; end if;
 if actor_role='admin' and target_role in ('owner','admin') then raise exception 'Администратор не может блокировать владельца или администратора'; end if;
 if duration_hours=0 then delete from public.kyro_user_suspensions where user_id=target_user; elsif duration_hours<0 or duration_hours>8760 then raise exception 'Некорректный срок блокировки';
 else insert into public.kyro_user_suspensions(user_id,reason,expires_at,created_by) values(target_user,coalesce(reason_text,''),now()+make_interval(hours=>duration_hours),(select auth.uid())) on conflict(user_id) do update set reason=excluded.reason,expires_at=excluded.expires_at,created_by=excluded.created_by,created_at=now(); end if;
end $$;
grant execute on function private.kyro_has_role(text[]) to authenticated;
grant execute on function private.kyro_is_suspended(uuid) to authenticated;
grant execute on function private.kyro_set_user_role(uuid,text) to authenticated;
grant execute on function private.kyro_set_user_suspension(uuid,text,integer) to authenticated;
create or replace function public.is_kyro_admin() returns boolean language sql stable set search_path=''
as $$ select private.kyro_has_role(array['owner','admin']); $$;
create or replace function public.is_kyro_moderator() returns boolean language sql stable set search_path=''
as $$ select private.kyro_has_role(array['owner','admin','moderator']); $$;
create or replace function public.kyro_is_suspended(target_user uuid default auth.uid()) returns boolean language sql stable set search_path=''
as $$ select private.kyro_is_suspended(target_user); $$;
create or replace function public.kyro_set_user_role(target_user uuid,new_role text) returns void language sql set search_path=''
as $$ select private.kyro_set_user_role(target_user,new_role); $$;
create or replace function public.kyro_set_user_suspension(target_user uuid,reason_text text,duration_hours integer) returns void language sql set search_path=''
as $$ select private.kyro_set_user_suspension(target_user,reason_text,duration_hours); $$;
revoke all on function public.kyro_has_role(text[]) from public,anon,authenticated;
drop function public.kyro_has_role(text[]);
revoke all on function public.is_kyro_admin() from public,anon;
revoke all on function public.is_kyro_moderator() from public,anon;
revoke all on function public.kyro_is_suspended(uuid) from public,anon;
revoke all on function public.kyro_set_user_role(uuid,text) from public,anon;
revoke all on function public.kyro_set_user_suspension(uuid,text,integer) from public,anon;
grant execute on function public.is_kyro_admin() to authenticated;
grant execute on function public.is_kyro_moderator() to authenticated;
grant execute on function public.kyro_is_suspended(uuid) to authenticated;
grant execute on function public.kyro_set_user_role(uuid,text) to authenticated;
grant execute on function public.kyro_set_user_suspension(uuid,text,integer) to authenticated;