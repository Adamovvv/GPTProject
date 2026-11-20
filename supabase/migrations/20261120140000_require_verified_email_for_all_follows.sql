create or replace function private.kyro_require_verified_email()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
 required boolean;
 verified_at timestamptz;
begin
 if tg_table_name='social_posts' then
   if auth.uid() is null or auth.uid() is distinct from new.user_id then
     raise exception 'Invalid social action owner';
   end if;
   select p.email_verification_required,p.email_verified_at
     into required,verified_at
   from public.profiles p where p.id=auth.uid();
   if coalesce(required,false) and verified_at is null then
     raise exception using message='EMAIL_VERIFICATION_REQUIRED: подтвердите электронную почту в настройках, чтобы публиковать записи.';
   end if;
 else
   if auth.uid() is null or auth.uid() is distinct from new.follower_id then
     raise exception 'Invalid social action owner';
   end if;
   select p.email_verified_at into verified_at
   from public.profiles p where p.id=auth.uid();
   if verified_at is null then
     raise exception using message='EMAIL_VERIFICATION_REQUIRED: подтвердите электронную почту в настройках, чтобы подписываться.';
   end if;
 end if;
 return new;
end;
$function$;
