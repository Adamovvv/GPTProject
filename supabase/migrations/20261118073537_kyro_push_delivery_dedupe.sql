create table if not exists public.kyro_push_deliveries(
 notification_id uuid primary key references public.kyro_notifications(id) on delete cascade,
 dispatched_at timestamptz not null default now()
);
alter table public.kyro_push_deliveries enable row level security;
revoke all on public.kyro_push_deliveries from anon,authenticated;
drop policy if exists "Service role manages push delivery claims" on public.kyro_push_deliveries;
create policy "Service role manages push delivery claims" on public.kyro_push_deliveries for all to service_role using(true) with check(true);
grant select,insert,update,delete on public.kyro_push_deliveries to service_role;

create or replace function private.kyro_claim_push_delivery(p_notification_id uuid)
returns boolean language plpgsql security definer set search_path=''
as $$
begin
 if current_setting('request.jwt.claim.role',true) is distinct from 'service_role' then raise exception 'Service role required'; end if;
 insert into public.kyro_push_deliveries(notification_id) values(p_notification_id) on conflict(notification_id) do nothing;
 return found;
end;
$$;
create or replace function public.kyro_claim_push_delivery(p_notification_id uuid)
returns boolean language sql security definer set search_path=''
as $$ select private.kyro_claim_push_delivery(p_notification_id); $$;
revoke all on function public.kyro_claim_push_delivery(uuid) from public,anon,authenticated;
grant execute on function public.kyro_claim_push_delivery(uuid) to service_role;
