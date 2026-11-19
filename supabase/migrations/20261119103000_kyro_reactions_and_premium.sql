create table if not exists public.social_post_reactions (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.social_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction text not null check (reaction in ('like','love','support','funny','fire')),
  created_at timestamptz not null default now(),
  unique(post_id,user_id)
);
create index if not exists social_post_reactions_post_id_idx on public.social_post_reactions(post_id);
create index if not exists social_post_reactions_user_id_idx on public.social_post_reactions(user_id);
alter table public.social_post_reactions enable row level security;
drop policy if exists "Anyone can read post reactions" on public.social_post_reactions;
create policy "Anyone can read post reactions" on public.social_post_reactions for select to authenticated using (true);
drop policy if exists "Users manage own post reactions" on public.social_post_reactions;
create policy "Users manage own post reactions" on public.social_post_reactions for insert to authenticated with check (auth.uid() = user_id);
drop policy if exists "Users update own post reactions" on public.social_post_reactions;
create policy "Users update own post reactions" on public.social_post_reactions for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Users delete own post reactions" on public.social_post_reactions;
create policy "Users delete own post reactions" on public.social_post_reactions for delete to authenticated using (auth.uid() = user_id);
grant select,insert,update,delete on public.social_post_reactions to authenticated;

create table if not exists public.kyro_premium_memberships (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null check (plan in ('monthly','annual','founder')),
  status text not null default 'active' check (status in ('active','cancelled','expired')),
  started_at timestamptz not null default now(),
  expires_at timestamptz,
  granted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.kyro_premium_memberships enable row level security;
drop policy if exists "Users can view own premium membership" on public.kyro_premium_memberships;
create policy "Users can view own premium membership" on public.kyro_premium_memberships for select to authenticated using (auth.uid() = user_id);
grant select on public.kyro_premium_memberships to authenticated;

create or replace function public.kyro_admin_set_premium(target_user uuid, plan_name text, duration_days integer)
returns void language plpgsql security definer set search_path = '' as $$
declare actor_role text;
begin
 select role into actor_role from public.kyro_user_roles where user_id=(select auth.uid());
 if coalesce(actor_role,'') not in ('owner','admin') then raise exception 'Недостаточно прав'; end if;
 if plan_name not in ('monthly','annual','founder') then raise exception 'Некорректный план'; end if;
 if duration_days=0 then
   delete from public.kyro_premium_memberships where user_id=target_user;
 elsif duration_days<1 or duration_days>3650 then raise exception 'Некорректный срок';
 else
   insert into public.kyro_premium_memberships(user_id,plan,status,started_at,expires_at,granted_by)
   values(target_user,plan_name,'active',now(),now()+make_interval(days=>duration_days),(select auth.uid()))
   on conflict(user_id) do update set plan=excluded.plan,status='active',started_at=now(),expires_at=excluded.expires_at,granted_by=excluded.granted_by,created_at=now();
 end if;
end; $$;
revoke all on function public.kyro_admin_set_premium(uuid,text,integer) from public;
grant execute on function public.kyro_admin_set_premium(uuid,text,integer) to authenticated;
