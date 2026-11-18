create or replace function public.kyro_reject_blocked_social_interaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_user uuid;
begin
  if tg_table_name = 'social_follows' then
    if auth.uid() is distinct from new.follower_id then
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

drop trigger if exists kyro_reject_blocked_follow on public.social_follows;
create trigger kyro_reject_blocked_follow
before insert on public.social_follows
for each row execute function public.kyro_reject_blocked_social_interaction();

drop trigger if exists kyro_reject_blocked_like on public.social_likes;
create trigger kyro_reject_blocked_like
before insert on public.social_likes
for each row execute function public.kyro_reject_blocked_social_interaction();

revoke all on function public.kyro_reject_blocked_social_interaction() from public;
