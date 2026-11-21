create table if not exists public.social_comment_likes (
  comment_id uuid not null references public.social_comments(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (comment_id, user_id)
);

alter table public.social_comment_likes enable row level security;
grant select, insert, delete on public.social_comment_likes to authenticated;

drop policy if exists "Authenticated users read comment likes" on public.social_comment_likes;
create policy "Authenticated users read comment likes"
on public.social_comment_likes for select to authenticated using (true);

drop policy if exists "Users like comments as themselves" on public.social_comment_likes;
create policy "Users like comments as themselves"
on public.social_comment_likes for insert to authenticated
with check (
  user_id = (select auth.uid())
  and not public.kyro_is_suspended((select auth.uid()))
);

drop policy if exists "Users remove own comment likes" on public.social_comment_likes;
create policy "Users remove own comment likes"
on public.social_comment_likes for delete to authenticated
using (user_id = (select auth.uid()));

create index if not exists social_comment_likes_comment_idx
on public.social_comment_likes(comment_id);
