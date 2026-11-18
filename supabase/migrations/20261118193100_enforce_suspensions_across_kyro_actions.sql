create or replace function private.kyro_enforce_active_account()
returns trigger language plpgsql security definer set search_path = '' as $$
declare actor_id uuid;
begin
 if tg_table_name='social_follows' then actor_id:=new.follower_id; else actor_id:=new.user_id; end if;
 if auth.uid() is distinct from actor_id then raise exception 'Invalid actor'; end if;
 if public.kyro_is_suspended(actor_id) then raise exception 'Аккаунт временно или навсегда заблокирован'; end if;
 return new;
end; $$;
drop trigger if exists kyro_active_comments on public.social_comments;
create trigger kyro_active_comments before insert or update on public.social_comments for each row execute function private.kyro_enforce_active_account();
drop trigger if exists kyro_active_follows on public.social_follows;
create trigger kyro_active_follows before insert or update on public.social_follows for each row execute function private.kyro_enforce_active_account();
drop trigger if exists kyro_active_likes on public.social_likes;
create trigger kyro_active_likes before insert or update on public.social_likes for each row execute function private.kyro_enforce_active_account();
drop trigger if exists kyro_active_market_listings on public.market_listings;
create trigger kyro_active_market_listings before insert or update on public.market_listings for each row execute function private.kyro_enforce_active_account();
drop trigger if exists kyro_active_events on public.kyro_events;
create trigger kyro_active_events before insert or update on public.kyro_events for each row execute function private.kyro_enforce_active_account();
drop policy if exists "Users can publish their own posts" on public.social_posts;
drop policy if exists "Active accounts only can create social posts" on public.social_posts;
create policy "Active accounts can publish own posts" on public.social_posts for insert to authenticated with check (user_id=(select auth.uid()) and not public.kyro_is_suspended((select auth.uid())));
drop policy if exists "Users can comment as themselves" on public.social_comments;
drop policy if exists "Active accounts only can create comments" on public.social_comments;
create policy "Active accounts can create own comments" on public.social_comments for insert to authenticated with check (user_id=(select auth.uid()) and not public.kyro_is_suspended((select auth.uid())));
drop policy if exists "Users can follow as themselves" on public.social_follows;
drop policy if exists "Active accounts only can follow" on public.social_follows;
create policy "Active accounts can follow as themselves" on public.social_follows for insert to authenticated with check (follower_id=(select auth.uid()) and not public.kyro_is_suspended((select auth.uid())));
drop policy if exists "Users can like as themselves" on public.social_likes;
drop policy if exists "Active accounts only can create likes" on public.social_likes;
create policy "Active accounts can like as themselves" on public.social_likes for insert to authenticated with check (user_id=(select auth.uid()) and not public.kyro_is_suspended((select auth.uid())));
revoke all on function private.kyro_enforce_active_account() from public;
