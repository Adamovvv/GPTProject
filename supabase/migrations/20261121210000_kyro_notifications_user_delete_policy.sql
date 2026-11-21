drop policy if exists "Users delete own notifications" on public.kyro_notifications;
create policy "Users delete own notifications" on public.kyro_notifications
for delete to authenticated
using ((select auth.uid()) = user_id);
