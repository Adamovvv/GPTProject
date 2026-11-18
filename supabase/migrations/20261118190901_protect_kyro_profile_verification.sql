create or replace function public.kyro_guard_profile_verification()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.is_verified is distinct from old.is_verified
     and current_user not in ('postgres', 'supabase_admin', 'service_role') then
    raise exception 'Only KYRO moderators can change verification status';
  end if;
  return new;
end;
$$;

drop trigger if exists kyro_guard_profile_verification on public.profiles;
create trigger kyro_guard_profile_verification
before update of is_verified on public.profiles
for each row execute function public.kyro_guard_profile_verification();

revoke all on function public.kyro_guard_profile_verification() from public;
