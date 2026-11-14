-- Replace the Republic schema and its app data with a clean Telegram platform schema.
drop table if exists public.content_reports cascade;
drop table if exists public.post_likes cascade;
drop table if exists public.comments cascade;
drop table if exists public.issues cascade;
drop table if exists public.posts cascade;
drop table if exists public.profiles cascade;
drop function if exists public.handle_new_user() cascade;
delete from auth.users;

create table public.telegram_users (
  telegram_id bigint primary key,
  username text,
  first_name text not null default '',
  last_name text,
  language_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.finance_transactions (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.telegram_users(telegram_id) on delete cascade,
  kind text not null check (kind in ('income','expense')),
  amount numeric(14,2) not null check (amount > 0),
  currency text not null default 'EUR' check (currency ~ '^[A-Z]{3}$'),
  category text not null,
  note text,
  occurred_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create table public.planner_tasks (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint not null references public.telegram_users(telegram_id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  is_done boolean not null default false,
  due_at timestamptz,
  priority text not null default 'normal' check (priority in ('low','normal','high')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz
);
create index finance_transactions_user_date_idx on public.finance_transactions (telegram_id, occurred_at desc);
create index finance_transactions_user_kind_idx on public.finance_transactions (telegram_id, kind, occurred_at desc);
create index planner_tasks_user_created_idx on public.planner_tasks (telegram_id, is_done, created_at desc);
create index planner_tasks_due_idx on public.planner_tasks (due_at) where due_at is not null;
alter table public.telegram_users enable row level security;
alter table public.finance_transactions enable row level security;
alter table public.planner_tasks enable row level security;
revoke all on public.telegram_users, public.finance_transactions, public.planner_tasks from anon, authenticated;
grant all on public.telegram_users, public.finance_transactions, public.planner_tasks to service_role;
