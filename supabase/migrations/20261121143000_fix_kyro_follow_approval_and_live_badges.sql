-- Permit only the profile owner to materialize the exact accepted follow request.
create or replace function private.kyro_enforce_active_account()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor_id uuid;
begin
  if tg_table_name = 'social_follows' then
    if auth.uid() = new.follower_id then
      actor_id := new.follower_id;
    elsif auth.uid() = new.following_id
      and exists (
        select 1
        from public.kyro_follow_requests r
        where r.requester_id = new.follower_id
          and r.target_id = new.following_id
          and r.status = 'accepted'
      ) then
      actor_id := new.following_id;
    else
      raise exception 'Invalid actor';
    end if;

    if public.kyro_is_suspended(new.follower_id)
       or public.kyro_is_suspended(new.following_id) then
      raise exception 'Аккаунт временно или навсегда заблокирован';
    end if;
    return new;
  end if;

  actor_id := new.user_id;
  if auth.uid() is distinct from actor_id then
    raise exception 'Invalid actor';
  end if;
  if public.kyro_is_suspended(actor_id) then
    raise exception 'Аккаунт временно или навсегда заблокирован';
  end if;
  return new;
end;
$$;

create or replace function public.kyro_reject_blocked_social_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user uuid;
  approved_by_target boolean := false;
begin
  if tg_table_name = 'social_follows' then
    approved_by_target :=
      auth.uid() = new.following_id
      and exists (
        select 1
        from public.kyro_follow_requests r
        where r.requester_id = new.follower_id
          and r.target_id = new.following_id
          and r.status = 'accepted'
      );

    if auth.uid() is distinct from new.follower_id and not approved_by_target then
      raise exception 'Invalid follower';
    end if;

    if exists (
      select 1 from public.kyro_user_blocks b
      where (b.blocker_id = new.follower_id and b.blocked_id = new.following_id)
         or (b.blocker_id = new.following_id and b.blocked_id = new.follower_id)
    ) then
      raise exception 'Interaction is not allowed because one user has blocked the other';
    end if;
  elsif tg_table_name = 'social_likes' then
    if auth.uid() is distinct from new.user_id then
      raise exception 'Invalid user';
    end if;
    select p.user_id into target_user from public.social_posts p where p.id = new.post_id;
    if target_user is not null and exists (
      select 1 from public.kyro_user_blocks b
      where (b.blocker_id = new.user_id and b.blocked_id = target_user)
         or (b.blocker_id = target_user and b.blocked_id = new.user_id)
    ) then
      raise exception 'Interaction is not allowed because one user has blocked the other';
    end if;
  end if;
  return new;
end;
$$;

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

  if p_accept and (
    public.kyro_is_suspended(v_request.requester_id)
    or public.kyro_is_suspended(v_request.target_id)
    or exists (
      select 1 from public.kyro_user_blocks b
      where (b.blocker_id = v_request.requester_id and b.blocked_id = v_request.target_id)
         or (b.blocker_id = v_request.target_id and b.blocked_id = v_request.requester_id)
    )
  ) then
    raise exception 'FOLLOW_NOT_ALLOWED';
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
      '/notifications?request_id=' || new.id::text
    );
  end if;
  return new;
end;
$$;

alter publication supabase_realtime add table public.kyro_messages;
alter publication supabase_realtime add table public.kyro_conversations;
