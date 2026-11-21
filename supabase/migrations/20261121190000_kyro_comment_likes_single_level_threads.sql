create table if not exists public.social_comment_likes (
  comment_id uuid not null references public.social_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id,user_id)
);

alter table public.social_comment_likes enable row level security;

drop policy if exists "Authenticated users read comment likes" on public.social_comment_likes;
create policy "Authenticated users read comment likes"
on public.social_comment_likes for select to authenticated
using (exists (
  select 1 from public.social_comments c
  where c.id = comment_id and c.moderation_status = 'visible'
));

drop policy if exists "Active users like comments" on public.social_comment_likes;
create policy "Active users like comments"
on public.social_comment_likes for insert to authenticated
with check (
  user_id = (select auth.uid())
  and not public.kyro_is_suspended((select auth.uid()))
  and exists (
    select 1 from public.social_comments c
    where c.id = comment_id and c.moderation_status = 'visible'
  )
);

drop policy if exists "Users remove own comment likes" on public.social_comment_likes;
create policy "Users remove own comment likes"
on public.social_comment_likes for delete to authenticated
using (user_id = (select auth.uid()));

create index if not exists social_comment_likes_user_id_idx
on public.social_comment_likes(user_id);

create or replace function public.kyro_enforce_single_comment_thread()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_post uuid;
  parent_parent uuid;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  select c.post_id, c.parent_comment_id
    into parent_post, parent_parent
    from public.social_comments c
   where c.id = new.parent_comment_id;

  if parent_post is null or parent_post <> new.post_id then
    raise exception 'Ответ должен относиться к той же публикации';
  end if;

  if parent_parent is not null then
    raise exception 'Ответы можно добавлять только в исходную ветку комментария';
  end if;

  return new;
end;
$$;

drop trigger if exists kyro_enforce_single_comment_thread on public.social_comments;
create trigger kyro_enforce_single_comment_thread
before insert or update of parent_comment_id, post_id
on public.social_comments
for each row execute function public.kyro_enforce_single_comment_thread();

revoke all on function public.kyro_enforce_single_comment_thread() from public;
