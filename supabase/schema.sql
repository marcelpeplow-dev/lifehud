-- ============================================================
-- Life HUD — Database Schema
-- Run this in the Supabase SQL editor for your project.
-- ============================================================

-- Enable UUID generation
create extension if not exists "uuid-ossp";

-- ============================================================
-- USERS PROFILE (extends Supabase auth.users)
-- ============================================================
create table public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  display_name text,
  date_of_birth date,
  gender text check (gender in ('male', 'female', 'other', 'prefer_not_to_say')),
  height_cm numeric,
  weight_kg numeric,
  timezone text default 'America/New_York',
  onboarding_completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id)
  values (new.id);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- DEVICE CONNECTIONS (Terra)
-- ============================================================
create table public.device_connections (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  terra_user_id text not null,
  provider text not null,  -- 'FITBIT', 'APPLE', 'GARMIN', 'OURA', 'WHOOP'
  connected_at timestamptz default now(),
  last_sync_at timestamptz,
  is_active boolean default true
);

-- ============================================================
-- SLEEP DATA
-- ============================================================
create table public.sleep_records (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  bedtime timestamptz,
  wake_time timestamptz,
  duration_minutes integer,
  deep_sleep_minutes integer,
  rem_sleep_minutes integer,
  light_sleep_minutes integer,
  awake_minutes integer,
  sleep_score numeric,
  avg_heart_rate numeric,
  avg_hrv numeric,
  source text,
  raw_data jsonb,
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- ============================================================
-- WORKOUT DATA
-- ============================================================
create table public.workouts (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  started_at timestamptz,
  ended_at timestamptz,
  duration_minutes integer,
  workout_type text,
  activity_name text,
  calories_burned numeric,
  avg_heart_rate numeric,
  max_heart_rate numeric,
  distance_meters numeric,
  intensity_score numeric,
  source text,
  raw_data jsonb,
  created_at timestamptz default now()
);

-- ============================================================
-- DAILY METRICS
-- ============================================================
create table public.daily_metrics (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  steps integer,
  active_minutes integer,
  resting_heart_rate numeric,
  hrv_average numeric,
  calories_total numeric,
  calories_active numeric,
  stress_score numeric,
  recovery_score numeric,
  source text,
  raw_data jsonb,
  created_at timestamptz default now(),
  unique(user_id, date)
);

-- ============================================================
-- AI INSIGHTS
-- ============================================================
create table public.insights (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  category text not null check (category in ('sleep', 'fitness', 'recovery', 'correlation', 'goal', 'general')),
  title text not null,
  body text not null,
  data_points jsonb,
  priority integer default 0,
  is_read boolean default false,
  is_dismissed boolean default false,
  created_at timestamptz default now()
);

-- ============================================================
-- GOALS
-- ============================================================
create table public.goals (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  category text not null check (category in ('sleep', 'fitness', 'recovery', 'general')),
  metric_name text not null,
  target_value numeric not null,
  target_unit text not null,
  target_frequency text default 'weekly',
  current_value numeric default 0,
  start_date date default current_date,
  target_date date,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
alter table public.profiles enable row level security;
alter table public.device_connections enable row level security;
alter table public.sleep_records enable row level security;
alter table public.workouts enable row level security;
alter table public.daily_metrics enable row level security;
alter table public.insights enable row level security;
alter table public.goals enable row level security;

create policy "Users can view own profile" on public.profiles for select using (auth.uid() = id);
create policy "Users can update own profile" on public.profiles for update using (auth.uid() = id);

create policy "Users can view own devices" on public.device_connections for select using (auth.uid() = user_id);
create policy "Users can manage own devices" on public.device_connections for all using (auth.uid() = user_id);

create policy "Users can view own sleep" on public.sleep_records for select using (auth.uid() = user_id);
create policy "Service can insert sleep" on public.sleep_records for insert with check (true);

create policy "Users can view own workouts" on public.workouts for select using (auth.uid() = user_id);
create policy "Service can insert workouts" on public.workouts for insert with check (true);

create policy "Users can view own metrics" on public.daily_metrics for select using (auth.uid() = user_id);
create policy "Service can insert metrics" on public.daily_metrics for insert with check (true);

create policy "Users can view own insights" on public.insights for select using (auth.uid() = user_id);
create policy "Users can update own insights" on public.insights for update using (auth.uid() = user_id);
create policy "Service can insert insights" on public.insights for insert with check (true);

create policy "Users can manage own goals" on public.goals for all using (auth.uid() = user_id);

-- ============================================================
-- INDEXES
-- ============================================================
create index idx_sleep_user_date on public.sleep_records(user_id, date desc);
create index idx_workouts_user_date on public.workouts(user_id, date desc);
create index idx_daily_user_date on public.daily_metrics(user_id, date desc);
create index idx_insights_user_date on public.insights(user_id, date desc);
create index idx_goals_user_active on public.goals(user_id, is_active);
