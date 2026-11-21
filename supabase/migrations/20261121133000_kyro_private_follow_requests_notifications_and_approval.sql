-- Securely approve or reject follow requests and notify the profile owner.
drop trigger if exists kyro_accept_follow_request on public.kyro_follow_requests;
drop function if exists public.kyro_accept_follow_request();

create or replace function public.kyro_respond_follow_request(p_request_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_request public.kyro_follow_requests%rowtype;
begin
  if auth.uid() is null then
    raise exception 'AUTHENTICATION_REQUIRED';
  end if;

  select * into v_request
  from public.kyro_follow_requests
  where id = p_request_id
  for update;

  if not found or v_request.target_id <> auth.uid() then
    raise exception 'FOLLOW_REQUEST_NOT_FOUND';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'FOLLOW_REQUEST_NOT_PENDING';
  end if;

  update public.kyro_follow_requests
  set status = case when p_accept then 'accepted' else 'rejected' end,
      updated_at = now()
  where id = p_request_id;

  if p_accept then
    insert into public.social_follows(follower_id, following_id)
    values (v_request.requester_id, v_request.target_id)
    on conflict do nothing;
  end if;
end;
$$;

revoke all on function public.kyro_respond_follow_request(uuid, boolean) from public, anon;
grant execute on function public.kyro_respond_follow_request(uuid, boolean) to authenticated;

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
     and (tg_op = 'INSERT' or old.status is distinct from 'pending') then
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

revoke all on function public.kyro_notify_follow_request() from public, anon, authenticated;
drop trigger if exists kyro_notify_follow_request on public.kyro_follow_requests;
create trigger kyro_notify_follow_request
after insert or update of status on public.kyro_follow_requests
for each row execute function public.kyro_notify_follow_request();
