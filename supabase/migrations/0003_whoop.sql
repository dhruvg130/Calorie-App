-- ============================================================================
-- WHOOP integration
--
-- Safe to run more than once. Run after 0002_meals_and_weight.sql.
--
-- Same rules as before: RLS is the boundary, and ownership is decided by the
-- database rather than asserted by the client.
--
-- THE ONE NEW IDEA HERE: a table with RLS and no policies at all.
--
-- WHOOP does not support PKCE, so refreshing an access token requires the
-- client secret. That means the app can never hold these tokens — if a WHOOP
-- access token reached the bundle, anyone who extracted it could read that
-- user's health data directly from WHOOP, with no Supabase involvement at all.
--
-- So `whoop_tokens` is readable by nobody. RLS is enabled with zero policies,
-- which denies every row to every end-user role, and the table grants are
-- revoked on top of that — two independent barriers, either of which alone
-- would be sufficient. The Edge Function reaches it only because the service
-- role bypasses RLS.
--
-- What the app IS allowed to see — whether a connection exists, and the metrics
-- themselves — lives in separate tables under ordinary RLS.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Token storage, readable by no user
-- ----------------------------------------------------------------------------

create table if not exists public.whoop_tokens (
  user_id       uuid primary key
                  references auth.users (id) on delete cascade,

  -- WHOOP's own identifier for the account, so a reconnect to a *different*
  -- WHOOP account is detectable rather than silently mixing two people's data.
  whoop_user_id text,

  access_token  text not null,
  refresh_token text not null,

  -- When the access token dies. The function refreshes ahead of this rather
  -- than waiting for a 401.
  expires_at    timestamptz not null,

  scope         text,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

comment on table public.whoop_tokens is
  'WHOOP OAuth tokens. No RLS policies exist — Edge Function (service role) only.';

alter table public.whoop_tokens enable row level security;

-- Deliberately no policies whatsoever. RLS with zero policies denies every row,
-- and the grants below remove the privilege independently. The service role
-- bypasses RLS, so the Edge Function still works.
--
-- If you ever find yourself adding a policy here, stop: it means something in
-- the app is trying to read tokens it must not have.
revoke all on public.whoop_tokens from anon, authenticated;

drop trigger if exists whoop_tokens_set_updated_at on public.whoop_tokens;
create trigger whoop_tokens_set_updated_at
  before update on public.whoop_tokens
  for each row execute function public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Connection status — what the app is allowed to know
--
-- Everything here is safe for the client to read: that a connection exists,
-- what it may access, and when it last synced. No credentials.
-- ----------------------------------------------------------------------------

create table if not exists public.whoop_connections (
  user_id        uuid primary key
                   references auth.users (id) on delete cascade,

  scope          text,
  connected_at   timestamptz not null default now(),
  last_synced_at timestamptz,

  -- Surfaced so the app can say "reconnect WHOOP" instead of failing silently
  -- when a refresh token has been revoked from WHOOP's side.
  needs_reauth   boolean not null default false,

  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

comment on table public.whoop_connections is
  'Client-visible WHOOP connection status. Tokens live in whoop_tokens, which denies all access.';

drop trigger if exists whoop_connections_set_updated_at on public.whoop_connections;
create trigger whoop_connections_set_updated_at
  before update on public.whoop_connections
  for each row execute function public.set_updated_at();

alter table public.whoop_connections enable row level security;
alter table public.whoop_connections force row level security;

drop policy if exists "Users can read own whoop connection"   on public.whoop_connections;
drop policy if exists "Users can delete own whoop connection" on public.whoop_connections;

create policy "Users can read own whoop connection"
  on public.whoop_connections for select to authenticated
  using ((select auth.uid()) = user_id);

-- Disconnecting is a user action, so deletion is theirs. Insert and update are
-- absent on purpose: only the Edge Function establishes or refreshes a
-- connection, and it does so as the service role.
create policy "Users can delete own whoop connection"
  on public.whoop_connections for delete to authenticated
  using ((select auth.uid()) = user_id);

revoke all on public.whoop_connections from anon;
grant select, delete on public.whoop_connections to authenticated;

-- ----------------------------------------------------------------------------
-- 3. Daily metrics
--
-- One row per user per day, mirroring weight_entries: a `date`, not a
-- timestamptz, because these are daily summaries and the exact instant is
-- noise. The unique constraint makes re-syncing a day an upsert rather than a
-- duplicate.
-- ----------------------------------------------------------------------------

create table if not exists public.whoop_daily (
  id                 uuid primary key default gen_random_uuid(),

  user_id            uuid not null
                       references auth.users (id) on delete cascade,

  day                date not null,

  -- Burn from logged workouts only. WHOOP reports kilojoules; this is stored as
  -- calories, converted once at the edge, exactly as weights are stored in
  -- kilograms and converted for display.
  workout_kcal       numeric(8,2),

  -- Whole-day burn, basal metabolism included. Stored for display, and
  -- deliberately NOT the number that feeds any calorie budget: a daily goal
  -- already accounts for baseline metabolism, so adding this would double-count
  -- it and inflate the target by roughly the user's entire BMR.
  cycle_kcal         numeric(8,2),

  strain             numeric(5,2),
  recovery_score     smallint,
  resting_hr         smallint,
  hrv_ms             numeric(6,2),
  sleep_performance  smallint,
  sleep_duration_min integer,

  synced_at          timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint whoop_daily_one_per_day
    unique (user_id, day),

  -- Bounds are sanity checks on someone else's API, not on our own UI. A wild
  -- value here would distort every chart it touches.
  constraint whoop_daily_workout_kcal_range
    check (workout_kcal is null or (workout_kcal >= 0 and workout_kcal <= 20000)),

  constraint whoop_daily_cycle_kcal_range
    check (cycle_kcal is null or (cycle_kcal >= 0 and cycle_kcal <= 20000)),

  constraint whoop_daily_strain_range
    check (strain is null or (strain >= 0 and strain <= 21)),

  constraint whoop_daily_recovery_range
    check (recovery_score is null or (recovery_score between 0 and 100)),

  constraint whoop_daily_resting_hr_range
    check (resting_hr is null or (resting_hr between 20 and 200)),

  constraint whoop_daily_hrv_range
    check (hrv_ms is null or (hrv_ms >= 0 and hrv_ms <= 500)),

  constraint whoop_daily_sleep_performance_range
    check (sleep_performance is null or (sleep_performance between 0 and 100)),

  constraint whoop_daily_sleep_duration_range
    check (sleep_duration_min is null or (sleep_duration_min between 0 and 1440)),

  constraint whoop_daily_not_future
    check (day <= current_date + 1)
);

comment on table public.whoop_daily is
  'One row per user per day of WHOOP metrics. Written only by the Edge Function.';

create index if not exists whoop_daily_user_day_idx
  on public.whoop_daily (user_id, day desc);

drop trigger if exists whoop_daily_set_updated_at on public.whoop_daily;
create trigger whoop_daily_set_updated_at
  before update on public.whoop_daily
  for each row execute function public.set_updated_at();

alter table public.whoop_daily enable row level security;
alter table public.whoop_daily force row level security;

drop policy if exists "Users can read own whoop metrics"   on public.whoop_daily;
drop policy if exists "Users can delete own whoop metrics" on public.whoop_daily;

create policy "Users can read own whoop metrics"
  on public.whoop_daily for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can delete own whoop metrics"
  on public.whoop_daily for delete to authenticated
  using ((select auth.uid()) = user_id);

-- No insert or update for end users: this table mirrors WHOOP, and a client
-- that could write to it could fabricate a training day.
revoke all on public.whoop_daily from anon;
grant select, delete on public.whoop_daily to authenticated;
