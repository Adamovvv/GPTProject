drop policy if exists "Users can read own post view events" on public.social_post_views;
create policy "Users can read own post view events"
on public.social_post_views for select to authenticated
using ((select auth.uid())=viewer_id);
create index if not exists kyro_verification_requests_reviewed_by_idx
on public.kyro_verification_requests(reviewed_by);
