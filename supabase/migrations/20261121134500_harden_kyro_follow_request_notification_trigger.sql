create or replace function public.kyro_notify_follow_request()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor_name text;
begin
  if new.status = 'pending'
     and (tg_op = 'INSERT' or (tg_op = 'UPDATE' and old.status is distinct from 'pending')) then
    select coalesce(nullif(full_name, ''), nullif(username, ''), 'Пользователь KYRO')
      into v_actor_name
    from public.profiles
    where id = new.requester_id;

    insert into public.kyro_notifications(user_id, actor_id, kind, title, body, target_url)
    values (
      new.target_id,
      new.requester_id,
      'follow_request',
      'Новый запрос на подписку',
      coalesce(v_actor_name, 'Пользователь KYRO') || ' хочет подписаться на ваш профиль.',
      '/profile?requests=1'
    );
  end if;
  return new;
end;
$$;