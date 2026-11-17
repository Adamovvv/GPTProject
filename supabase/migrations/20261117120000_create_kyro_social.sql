-- KYRO Social: posts, likes, comments and follows.
-- All user-generated content is scoped by Supabase Auth and protected with RLS.

create table if not exists public.social_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 3000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.social_likes (
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table if not exists public.social_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  content text not null check (char_length(content) between 1 and 1200),
  created_at timestamptz not null default now()
);

create table if not exists public.social_follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint social_follows_no_self check (follower_id <> following_id)
);

create index if not exists social_posts_created_at_idx on public.social_posts (created_at desc);
create index if not exists social_posts_user_id_idx on public.social_posts (user_id, created_at desc);
create index if not exists social_comments_post_id_idx on public.social_comments (post_id, created_at asc);
create index if not exists social_follows_following_id_idx on public.social_follows (following_id);

alter table public.profiles enable row level security;
drop policy if exists "Authenticated users can view profiles" on public.profiles;
create policy "Authenticated users can view profiles"
  on public.profiles for select to authenticated using (true);

alter table public.social_posts enable row level security;
alter table public.social_likes enable row level security;
alter table public.social_comments enable row level security;
alter table public.social_follows enable row level security;

drop policy if exists "Authenticated users can read posts" on public.social_posts;
create policy "Authenticated users can read posts"
  on public.social_posts for select to authenticated using (true);
drop policy if exists "Users can publish their own posts" on public.social_posts;
create policy "Users can publish their own posts"
  on public.social_posts for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can edit their own posts" on public.social_posts;
create policy "Users can edit their own posts"
  on public.social_posts for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their own posts" on public.social_posts;
create policy "Users can delete their own posts"
  on public.social_posts for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Authenticated users can read likes" on public.social_likes;
create policy "Authenticated users can read likes"
  on public.social_likes for select to authenticated using (true);
drop policy if exists "Users can like as themselves" on public.social_likes;
create policy "Users can like as themselves"
  on public.social_likes for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can remove their own likes" on public.social_likes;
create policy "Users can remove their own likes"
  on public.social_likes for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Authenticated users can read comments" on public.social_comments;
create policy "Authenticated users can read comments"
  on public.social_comments for select to authenticated using (true);
drop policy if exists "Users can comment as themselves" on public.social_comments;
create policy "Users can comment as themselves"
  on public.social_comments for insert to authenticated with check ((select auth.uid()) = user_id);
drop policy if exists "Users can delete their own comments" on public.social_comments;
create policy "Users can delete their own comments"
  on public.social_comments for delete to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Authenticated users can read follows" on public.social_follows;
create policy "Authenticated users can read follows"
  on public.social_follows for select to authenticated using (true);
drop policy if exists "Users can follow as themselves" on public.social_follows;
create policy "Users can follow as themselves"
  on public.social_follows for insert to authenticated with check ((select auth.uid()) = follower_id);
drop policy if exists "Users can unfollow as themselves" on public.social_follows;
create policy "Users can unfollow as themselves"
  on public.social_follows for delete to authenticated using ((select auth.uid()) = follower_id);

grant select, insert, update, delete on public.social_posts to authenticated;
grant select, insert, delete on public.social_likes to authenticated;
grant select, insert, delete on public.social_comments to authenticated;
grant select, insert, delete on public.social_follows to authenticated;
