alter table public.social_follows
  add constraint social_follows_no_self_follow
  check (follower_id <> following_id);
