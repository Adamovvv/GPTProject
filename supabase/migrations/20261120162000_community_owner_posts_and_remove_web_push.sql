drop policy if exists "Members create community posts" on public.kyro_community_posts;
drop policy if exists "Community creator creates posts" on public.kyro_community_posts;
create policy "Community creator creates posts"
on public.kyro_community_posts
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.kyro_communities c
    where c.id = kyro_community_posts.community_id
      and c.owner_id = (select auth.uid())
  )
  and not public.kyro_is_suspended((select auth.uid()))
);
drop table if exists public.kyro_push_subscriptions cascade;
