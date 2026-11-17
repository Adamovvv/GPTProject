create table if not exists public.kyro_auth_rate_limits (
  bucket_hash text primary key check (bucket_hash ~ '^[a-f0-9]{64}$'),
  window_started_at timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0)
);

alter table public.kyro_auth_rate_limits enable row level security;
revoke all on table public.kyro_auth_rate_limits from public, anon, authenticated;

create or replace function public.kyro_consume_auth_attempt(
  p_bucket_hash text,
  p_limit integer default 8,
  p_window_seconds integer default 900
) returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_attempts integer;
  v_window_started_at timestamptz;
begin
  if p_limit < 1 or p_window_seconds < 1 then
    raise exception 'Invalid rate limit configuration';
  end if;

  insert into public.kyro_auth_rate_limits (bucket_hash, window_started_at, attempts)
  values (p_bucket_hash, now(), 1)
  on conflict (bucket_hash) do update
    set attempts = case
          when public.kyro_auth_rate_limits.window_started_at < now() - make_interval(secs => p_window_seconds)
            then 1
          else public.kyro_auth_rate_limits.attempts + 1
        end,
        window_started_at = case
          when public.kyro_auth_rate_limits.window_started_at < now() - make_interval(secs => p_window_seconds)
            then now()
          else public.kyro_auth_rate_limits.window_started_at
        end
  returning attempts, window_started_at into v_attempts, v_window_started_at;

  return v_attempts <= p_limit;
end;
$$;

revoke all on function public.kyro_consume_auth_attempt(text, integer, integer) from public, anon, authenticated;
grant execute on function public.kyro_consume_auth_attempt(text, integer, integer) to service_role;
