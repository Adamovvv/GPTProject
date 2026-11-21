alter table public.social_comments
  add column if not exists parent_comment_id uuid
  references public.social_comments(id) on delete cascade;

create index if not exists social_comments_post_parent_created_idx
  on public.social_comments(post_id, parent_comment_id, created_at);

create or replace function public.kyro_validate_comment_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  parent_post uuid;
begin
  if new.parent_comment_id is null then
    return new;
  end if;

  if new.parent_comment_id = new.id then
    raise exception 'Комментарий не может быть ответом самому себе';
  end if;

  select c.post_id
    into parent_post
    from public.social_comments c
   where c.id = new.parent_comment_id
     and c.moderation_status = 'visible';

  if parent_post is null or parent_post <> new.post_id then
    raise exception 'Родительский комментарий не найден для этой публикации';
  end if;

  return new;
end;
$$;

drop trigger if exists kyro_validate_comment_parent on public.social_comments;
create trigger kyro_validate_comment_parent
before insert or update of parent_comment_id, post_id
on public.social_comments
for each row execute function public.kyro_validate_comment_parent();

grant execute on function public.kyro_validate_comment_parent() to authenticated;
