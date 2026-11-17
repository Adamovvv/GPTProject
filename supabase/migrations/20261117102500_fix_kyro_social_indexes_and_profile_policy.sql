-- Keep profile reads under one authenticated policy and index social foreign keys.
drop policy if exists "Users can view their own profile" on public.profiles;

create index if not exists social_comments_user_id_idx on public.social_comments (user_id);
create index if not exists social_likes_user_id_idx on public.social_likes (user_id);
