create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Житель',
  username text unique,
  city text,
  bio text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_length check (username is null or char_length(username) between 3 and 24),
  constraint profiles_display_name_length check (char_length(display_name) between 1 and 60)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  city text,
  category text not null default 'Общее',
  body text not null check (char_length(body) between 1 and 3000),
  image_url text,
  status text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 1200),
  created_at timestamptz not null default now()
);

create table public.post_likes (
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.issues (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles(id) on delete cascade,
  city text not null,
  address text,
  category text not null default 'Инфраструктура',
  title text not null check (char_length(title) between 4 and 120),
  description text not null check (char_length(description) between 10 and 2000),
  status text not null default 'new' check (status in ('new','reviewing','in_progress','resolved','rejected')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  reason text not null,
  created_at timestamptz not null default now(),
  constraint report_target_check check ((post_id is not null and comment_id is null) or (post_id is null and comment_id is not null))
);

create index posts_created_at_idx on public.posts(created_at desc);
create index posts_city_idx on public.posts(city);
create index comments_post_created_idx on public.comments(post_id, created_at);
create index issues_created_at_idx on public.issues(created_at desc);
create index issues_city_idx on public.issues(city);

create function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'display_name',''), split_part(coalesce(new.email,''),'@',1), 'Житель'))
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

alter table public.profiles enable row level security;
alter table public.posts enable row level security;
alter table public.comments enable row level security;
alter table public.post_likes enable row level security;
alter table public.issues enable row level security;
alter table public.content_reports enable row level security;

create policy "Profiles are public" on public.profiles for select to anon, authenticated using (true);
create policy "Users create own profile" on public.profiles for insert to authenticated with check ((select auth.uid()) = id);
create policy "Users update own profile" on public.profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Published posts are public" on public.posts for select to anon, authenticated using (status = 'published' or author_id = (select auth.uid()));
create policy "Authenticated users create posts" on public.posts for insert to authenticated with check (author_id = (select auth.uid()) and status = 'published');
create policy "Authors update own posts" on public.posts for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()));
create policy "Authors delete own posts" on public.posts for delete to authenticated using (author_id = (select auth.uid()));

create policy "Comments are public" on public.comments for select to anon, authenticated using (true);
create policy "Authenticated users comment" on public.comments for insert to authenticated with check (author_id = (select auth.uid()));
create policy "Authors delete own comments" on public.comments for delete to authenticated using (author_id = (select auth.uid()));

create policy "Likes are visible" on public.post_likes for select to anon, authenticated using (true);
create policy "Users like as themselves" on public.post_likes for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users remove own likes" on public.post_likes for delete to authenticated using (user_id = (select auth.uid()));

create policy "Issues are public" on public.issues for select to anon, authenticated using (true);
create policy "Residents report issues" on public.issues for insert to authenticated with check (author_id = (select auth.uid()) and status = 'new');
create policy "Authors update own issues" on public.issues for update to authenticated using (author_id = (select auth.uid())) with check (author_id = (select auth.uid()) and status = 'new');

create policy "Users submit reports" on public.content_reports for insert to authenticated with check (reporter_id = (select auth.uid()));
create policy "Users view own reports" on public.content_reports for select to authenticated using (reporter_id = (select auth.uid()));

grant select on public.profiles, public.posts, public.comments, public.post_likes, public.issues to anon, authenticated;
grant insert, update on public.profiles to authenticated;
grant insert, update, delete on public.posts to authenticated;
grant insert, delete on public.comments to authenticated;
grant insert, delete on public.post_likes to authenticated;
grant insert, update on public.issues to authenticated;
grant insert, select on public.content_reports to authenticated;
