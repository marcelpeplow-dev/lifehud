-- ============================================================
-- Fitbit OAuth Integration — user_integrations table
-- Run this in the Supabase SQL editor.
-- ============================================================

create table public.user_integrations (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  provider text not null,  -- 'fitbit'
  access_token text not null,
  refresh_token text not null,
  token_expires_at timestamptz not null,
  scopes text,  -- comma-separated scopes granted
  provider_user_id text,  -- Fitbit user ID
  last_sync_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, provider)
);

-- RLS
alter table public.user_integrations enable row level security;

create policy "Users can view own integrations"
  on public.user_integrations for select
  using (auth.uid() = user_id);

create policy "Users can delete own integrations"
  on public.user_integrations for delete
  using (auth.uid() = user_id);

create policy "Service can manage integrations"
  on public.user_integrations for all
  with check (true);

-- Index
create index idx_integrations_user_provider on public.user_integrations(user_id, provider);
create index idx_integrations_provider_expires on public.user_integrations(provider, token_expires_at);
