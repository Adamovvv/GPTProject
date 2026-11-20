create or replace function private.kyro_require_verified_email_for_social_like()
returns trigger
language plpgsql
security definer
set search_path = public, private, auth
as $$
begin
  if not exists (
    select 1 from public.profiles p
    where p.id = new.user_id
      and p.email_verified_at is not null
  ) then
    raise exception 'Подтвердите email, чтобы ставить отметки «Нравится»'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists kyro_require_verified_email_social_like on public.social_likes;
create trigger kyro_require_verified_email_social_like
before insert on public.social_likes
for each row execute function private.kyro_require_verified_email_for_social_like();
