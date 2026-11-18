create table if not exists public.kyro_user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint kyro_user_blocks_no_self check (blocker_id <> blocked_id)
);
alter table public.kyro_user_blocks enable row level security;
drop policy if exists "Users can view their own blocks" on public.kyro_user_blocks;
create policy "Users can view their own blocks" on public.kyro_user_blocks
for select to authenticated using (auth.uid() = blocker_id or auth.uid() = blocked_id);
drop policy if exists "Users can block others" on public.kyro_user_blocks;
create policy "Users can block others" on public.kyro_user_blocks
for insert to authenticated with check (auth.uid() = blocker_id and blocker_id <> blocked_id);
drop policy if exists "Users can unblock others" on public.kyro_user_blocks;
create policy "Users can unblock others" on public.kyro_user_blocks
for delete to authenticated using (auth.uid() = blocker_id);

create or replace function public.kyro_set_user_verification(target_user uuid, verified boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null or not public.is_kyro_moderator() then
    raise exception 'Not authorized';
  end if;
  update public.profiles set is_verified = verified where id = target_user;
  if not found then raise exception 'Profile not found'; end if;
end;
$$;
revoke all on function public.kyro_set_user_verification(uuid, boolean) from public;
grant execute on function public.kyro_set_user_verification(uuid, boolean) to authenticated;
