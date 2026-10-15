
-- Roles
create type public.app_role as enum ('admin', 'charity_admin', 'volunteer');

-- Profiles (public read for signed-in users, owner writes)
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '',
  headline text not null default '',
  city text not null default '',
  avatar_url text,
  causes text[] not null default '{}',
  skills text[] not null default '{}',
  availability jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;
alter table public.profiles enable row level security;
create policy "Signed-in users read profiles" on public.profiles for select to authenticated using (true);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);
create policy "Users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

-- user_roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users read own roles" on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));

-- Feature flags (kill switches)
create table public.feature_flags (
  key text primary key,
  label text not null,
  enabled boolean not null default true,
  updated_at timestamptz not null default now()
);
grant select on public.feature_flags to authenticated;
grant all on public.feature_flags to service_role;
alter table public.feature_flags enable row level security;
create policy "Signed-in read flags" on public.feature_flags for select to authenticated using (true);
create policy "Admins update flags" on public.feature_flags for update to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

insert into public.feature_flags (key, label) values
  ('marketplace', 'Opportunity marketplace'),
  ('profile', 'Volunteer profile'),
  ('learn', 'Trainings'),
  ('booking', 'Booking'),
  ('chat', 'Shift chat'),
  ('org', 'Charity dashboard'),
  ('ai', 'AI (all features)');

-- Audit log (admins read; written by server/triggers)
create table public.audit_log (
  id bigint generated always as identity primary key,
  user_id uuid,
  action text not null,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
grant select on public.audit_log to authenticated;
grant all on public.audit_log to service_role;
alter table public.audit_log enable row level security;
create policy "Admins read audit" on public.audit_log for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- AI usage (admins read; server writes)
create table public.ai_usage (
  id bigint generated always as identity primary key,
  user_id uuid,
  feature text not null,
  tokens integer not null default 0,
  cost_usd numeric(10,5) not null default 0,
  fallback boolean not null default false,
  reason text,
  created_at timestamptz not null default now()
);
grant select on public.ai_usage to authenticated;
grant all on public.ai_usage to service_role;
alter table public.ai_usage enable row level security;
create policy "Admins read ai usage" on public.ai_usage for select to authenticated using (public.has_role(auth.uid(), 'admin'));

-- AI budget (server only)
create table public.ai_budget (
  day date primary key default current_date,
  cap_usd numeric(10,4) not null default 1.0,
  reserved_usd numeric(10,5) not null default 0,
  spent_usd numeric(10,5) not null default 0
);
grant all on public.ai_budget to service_role;
alter table public.ai_budget enable row level security;

-- Rate limits (server only)
create table public.rate_limits (
  bucket text not null,
  subject text not null,
  window_start timestamptz not null,
  count integer not null default 0,
  primary key (bucket, subject, window_start)
);
grant all on public.rate_limits to service_role;
alter table public.rate_limits enable row level security;

-- Signup: profile + roles (first non-demo user becomes admin) + audit
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  is_demo boolean := new.email like '%@demo.kindred.app';
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));

  insert into public.user_roles (user_id, role) values (new.id, 'volunteer');

  if not is_demo and not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles (user_id, role) values (new.id, 'admin');
    insert into public.audit_log (user_id, action, detail) values (new.id, 'role_change', jsonb_build_object('role','admin','reason','first user'));
  end if;

  insert into public.audit_log (user_id, action, detail) values (new.id, 'sign_up', '{}'::jsonb);
  return new;
end; $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Audit kill-switch flips
create or replace function public.audit_flag_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  new.updated_at := now();
  if new.enabled is distinct from old.enabled then
    insert into public.audit_log (user_id, action, detail)
    values (auth.uid(), 'kill_switch', jsonb_build_object('key', new.key, 'enabled', new.enabled));
  end if;
  return new;
end; $$;
create trigger on_flag_change before update on public.feature_flags
  for each row execute function public.audit_flag_change();
