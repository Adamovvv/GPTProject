-- Optional contact email with verified-email gates for newly registered KYRO accounts.
alter table public.profiles
  add column if not exists email_verification_required boolean not null default false,
  add column if not exists email_verified_at timestamptz;

create table if not exists public.kyro_user_emails (
  user_id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  last_sent_at timestamptz,
  daily_window_started_at timestamptz,
  daily_send_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists kyro_user_emails_email_unique on public.kyro_user_emails (lower(email));
alter table public.kyro_user_emails enable row level security;
revoke all on public.kyro_user_emails from anon, authenticated;
grant all on public.kyro_user_emails to service_role;

create or replace function private.kyro_guard_email_verification_fields()
returns trigger language plpgsql set search_path = '' as $$
declare request_role text;
begin
 request_role := current_setting('request.jwt.claim.role', true);
 if coalesce(request_role,'') in ('service_role','postgres','supabase_admin') then
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
before update on public.profiles
for each row execute function private.kyro_guard_email_verification_fields();

create or replace function private.kyro_require_verified_email()
returns trigger language plpgsql security definer set search_path = '' as $$
declare required boolean; verified_at timestamptz;
begin
 if auth.uid() is null or auth.uid() is distinct from
   (case when tg_table_name='social_posts' then new.user_id else new.follower_id end) then
   raise exception 'Invalid social action owner';
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
drop trigger if exists kyro_require_verified_email_post on public.social_posts;
create trigger kyro_require_verified_email_post
before insert on public.social_posts
for each row execute function private.kyro_require_verified_email();
drop trigger if exists kyro_require_verified_email_follow on public.social_follows;
create trigger kyro_require_verified_email_follow
before insert on public.social_follows
for each row execute function private.kyro_require_verified_email();
