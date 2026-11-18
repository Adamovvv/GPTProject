create table if not exists public.kyro_verification_requests(
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references public.profiles(id) on delete cascade,
 note text not null default '' check (char_length(note)<=500),
 status text not null default 'pending' check (status in ('pending','approved','rejected')),
 reviewed_by uuid references public.profiles(id) on delete set null,
 reviewed_at timestamptz,
 created_at timestamptz not null default now()
);
create unique index if not exists kyro_verification_one_pending_per_user on public.kyro_verification_requests(user_id) where status='pending';
create index if not exists kyro_verification_status_created_idx on public.kyro_verification_requests(status,created_at desc);
alter table public.kyro_verification_requests enable row level security;
drop policy if exists "Users can read own verification requests" on public.kyro_verification_requests;
create policy "Users can read own verification requests" on public.kyro_verification_requests for select to authenticated
using ((select auth.uid())=user_id or (select private.kyro_has_role(array['owner','admin','moderator'])));
drop policy if exists "Users can request own verification" on public.kyro_verification_requests;
create policy "Users can request own verification" on public.kyro_verification_requests for insert to authenticated
with check ((select auth.uid())=user_id and status='pending' and reviewed_by is null and reviewed_at is null);
grant select,insert on public.kyro_verification_requests to authenticated;

create or replace function private.kyro_review_verification_request(p_request_id uuid,p_approved boolean)
returns void language plpgsql security definer set search_path=''
as $$
declare v_user_id uuid;
begin
 if (select auth.uid()) is null or not private.kyro_has_role(array['owner','admin']) then raise exception 'Insufficient permissions'; end if;
 select user_id into v_user_id from public.kyro_verification_requests where id=p_request_id and status='pending' for update;
 if v_user_id is null then raise exception 'Pending verification request not found'; end if;
 update public.kyro_verification_requests set status=case when p_approved then 'approved' else 'rejected' end,reviewed_by=(select auth.uid()),reviewed_at=now() where id=p_request_id;
 update public.profiles set is_verified=p_approved,verified_at=case when p_approved then now() else null end where id=v_user_id;
end;
$$;
create or replace function public.kyro_review_verification_request(p_request_id uuid,p_approved boolean)
returns void language sql set search_path=''
as $$ select private.kyro_review_verification_request(p_request_id,p_approved); $$;
grant usage on schema private to authenticated;
grant execute on function private.kyro_review_verification_request(uuid,boolean) to authenticated;
revoke all on function public.kyro_review_verification_request(uuid,boolean) from public,anon;
grant execute on function public.kyro_review_verification_request(uuid,boolean) to authenticated;
