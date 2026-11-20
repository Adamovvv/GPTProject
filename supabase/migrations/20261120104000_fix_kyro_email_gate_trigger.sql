-- Keep trigger record-field access relation-specific for both social tables.
create or replace function private.kyro_require_verified_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare required boolean; verified_at timestamptz;
begin
 if tg_table_name='social_posts' then
   if auth.uid() is null or auth.uid() is distinct from new.user_id then
     raise exception 'Invalid social action owner';
   end if;
 else
   if auth.uid() is null or auth.uid() is distinct from new.follower_id then
     raise exception 'Invalid social action owner';
   end if;
 end if;

 select p.email_verification_required,p.email_verified_at
 into required,verified_at
 from public.profiles p
 where p.id=auth.uid();
 if coalesce(required,false) and verified_at is null then
   raise exception using message='EMAIL_VERIFICATION_REQUIRED: подтвердите электронную почту в профиле, чтобы публиковать записи и подписываться.';
 end if;
 return new;
end;
$$;
revoke all on function private.kyro_require_verified_email() from public;
