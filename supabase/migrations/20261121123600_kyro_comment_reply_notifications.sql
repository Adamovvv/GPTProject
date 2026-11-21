create or replace function public.kyro_create_notification()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  recipient uuid;
  actor uuid;
  item_title text;
  item_body text;
  item_url text;
  kind_value text;
begin
  if tg_table_name = 'social_follows' then
    actor := new.follower_id;
    recipient := new.following_id;
    kind_value := 'follow';
    item_title := 'Новый подписчик';
    item_body := 'На вас подписался пользователь KYRO';
    item_url := '/profile';
  elsif tg_table_name = 'social_likes' then
    actor := new.user_id;
    select user_id into recipient from public.social_posts where id = new.post_id;
    kind_value := 'like';
    item_title := 'Новая отметка «Нравится»';
    item_body := 'Кому-то понравилась ваша публикация';
    item_url := '/social';
  elsif tg_table_name = 'social_comments' then
    actor := new.user_id;
    if new.parent_comment_id is not null then
      select user_id into recipient
        from public.social_comments
       where id = new.parent_comment_id;
      kind_value := 'comment_reply';
      item_title := 'Новый ответ на комментарий';
    else
      select user_id into recipient
        from public.social_posts
       where id = new.post_id;
      kind_value := 'comment';
      item_title := 'Новый комментарий';
    end if;
    item_body := left(new.content, 180);
    item_url := '/social';
  else
    return new;
  end if;

  if recipient is not null and recipient <> actor then
    insert into public.kyro_notifications(user_id, actor_id, kind, title, body, target_url)
    values (recipient, actor, kind_value, item_title, item_body, item_url);
  end if;

  return new;
end;
$function$;

revoke all on function public.kyro_create_notification() from public;
