-- Prevent a user-created profile row from opting out of email verification.
create or replace function private.kyro_guard_email_verification_fields()
returns trigger language plpgsql set search_path = '' as $$
declare request_role text;
begin
 request_role := current_setting('request.jwt.claim.role', true);
 if coalesce(request_role,'') in ('service_role','postgres','supabase_admin') then
   return new;
 end if;

 if tg_op='INSERT' then
   if auth.uid() is not null and auth.uid()=new.id then
     new.email_verification_required := true;
     new.email_verified_at := null;
   end if;
   return new;
 end if;

 if auth.uid() is not null and (
   new.email_verified_at is distinct from old.email_verified_at
   or new.email_verification_required is distinct from old.email_verification_required
 ) then
   raise exception 'Email verification status is managed by KYRO';
 end if;
 return new;
end;
$$;
drop trigger if exists kyro_guard_email_verification_fields on public.profiles;
create trigger kyro_guard_email_verification_fields
before insert or update on public.profiles
for each row execute function private.kyro_guard_email_verification_fields();
