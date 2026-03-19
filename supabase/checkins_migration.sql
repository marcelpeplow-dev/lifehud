-- ============================================================
-- Life HUD — Daily Check-ins Migration
-- Run this in the Supabase SQL editor.
-- ============================================================

-- New table: daily_checkins
create table public.daily_checkins (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  date date not null,
  mood integer not null check (mood between 1 and 10),
  energy integer not null check (energy between 1 and 10),
  stress integer not null check (stress between 1 and 10),
  notes text check (char_length(notes) <= 500),
  created_at timestamptz default now(),
  unique(user_id, date)
);

alter table public.daily_checkins enable row level security;

create policy "Users can manage own checkins"
  on public.daily_checkins for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_checkins_user_date on public.daily_checkins(user_id, date desc);

-- Expand insights category to include 'wellbeing'
alter table public.insights
  drop constraint if exists insights_category_check;

alter table public.insights
  add constraint insights_category_check
  check (category in ('sleep', 'fitness', 'recovery', 'correlation', 'goal', 'general', 'wellbeing'));
