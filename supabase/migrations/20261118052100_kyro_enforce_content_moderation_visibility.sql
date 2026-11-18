drop policy if exists "Authenticated users can read posts" on public.social_posts;
create policy "Authenticated users can read visible posts" on public.social_posts for select to authenticated using (moderation_status='visible' or user_id=(select auth.uid()) or public.is_kyro_moderator());
drop policy if exists "Authenticated users can read comments" on public.social_comments;
create policy "Authenticated users can read visible comments" on public.social_comments for select to authenticated using (moderation_status='visible' or user_id=(select auth.uid()) or public.is_kyro_moderator());
create policy "Moderators delete social posts" on public.social_posts for delete to authenticated using (public.is_kyro_moderator());