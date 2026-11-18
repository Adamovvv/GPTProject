create or replace function public.kyro_set_user_role(target_user uuid,new_role text)
returns void language plpgsql security definer set search_path=''
as $$ declare actor_role text; target_role text; begin
 select role into actor_role from public.kyro_user_roles where user_id=(select auth.uid());
 select role into target_role from public.kyro_user_roles where user_id=target_user;
 if coalesce(actor_role,'') not in ('owner','admin') then raise exception 'Недостаточно прав'; end if;
 if new_role not in ('owner','admin','moderator','user') then raise exception 'Некорректная роль'; end if;
 if actor_role='admin' and (new_role in ('owner','admin') or target_role in ('owner','admin')) then raise exception 'Администратор может управлять только обычными пользователями и модераторами'; end if;
 if target_user=(select auth.uid()) and new_role<>'owner' and actor_role='owner' then raise exception 'Владелец не может снять собственную роль'; end if;
 if target_user=(select auth.uid()) and new_role='user' then raise exception 'Нельзя снять собственную роль'; end if;
 if new_role='user' then delete from public.kyro_user_roles where user_id=target_user;
 else insert into public.kyro_user_roles(user_id,role,assigned_by) values(target_user,new_role,(select auth.uid())) on conflict(user_id) do update set role=excluded.role,assigned_by=excluded.assigned_by; end if;
end $$;
