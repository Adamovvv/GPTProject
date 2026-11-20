create or replace function private.kyro_require_verified_email_for_market_and_communities()
returns trigger language plpgsql security definer set search_path = public, private, auth as $$
declare uid uuid; created_today integer;
begin
 if tg_table_name='kyro_communities' then
   uid := new.owner_id;
   select count(*) into created_today from public.kyro_communities c where c.owner_id=uid and c.created_at > now()-interval '24 hours';
   if created_today >= 3 then raise exception 'Можно создать не более 3 сообществ за 24 часа'; end if;
 elsif tg_table_name='market_listings' then
   uid := new.user_id;
   select count(*) into created_today from public.market_listings m where m.user_id=uid and m.created_at > now()-interval '24 hours';
   if created_today >= 10 then raise exception 'Можно опубликовать не более 10 товаров за 24 часа'; end if;
 elsif tg_table_name='kyro_community_posts' or tg_table_name='kyro_community_members' then
   uid := new.user_id;
   if tg_table_name='kyro_community_posts' then
     select count(*) into created_today from public.kyro_community_posts p where p.user_id=uid and p.created_at > now()-interval '24 hours';
     if created_today >= 15 then raise exception 'Можно опубликовать не более 15 сообщений в сообществах за 24 часа'; end if;
   end if;
 else raise exception 'Unsupported table'; end if;
 if not exists(select 1 from public.profiles p where p.id=uid and p.email_verified_at is not null) then
   raise exception 'Подтвердите email, чтобы создавать сообщества, вступать в них, писать и публиковать товары в маркете';
 end if;
 return new;
end $$;