-- ============================================================================
-- Meal grouping + weight tracking
--
-- Safe to run more than once. Run after 0001_init.sql.
--
-- Same rules as 0001: RLS is the boundary, every zod bound has a CHECK behind
-- it, and ownership is decided by the database rather than asserted by the
-- client.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Meal grouping on food entries
-- ----------------------------------------------------------------------------

-- Nullable on purpose: entries logged before this migration have no meal, and
-- forcing a value would mean guessing one for historical rows.
alter table public.food_entries
  add column if not exists meal_type text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'food_entries_meal_type_valid'
  ) then
    alter table public.food_entries
      add constraint food_entries_meal_type_valid
      check (meal_type is null or meal_type in ('breakfast', 'lunch', 'dinner', 'snack'));
  end if;
end $$;

comment on column public.food_entries.meal_type is
  'Optional meal grouping. Null for entries logged before grouping existed.';

-- The day list groups by meal, so the index carries it.
create index if not exists food_entries_user_day_meal_idx
  on public.food_entries (user_id, consumed_at desc, meal_type);

-- ----------------------------------------------------------------------------
-- 2. Weight unit preference
--
-- Weights are stored in kilograms and converted for display. Storing the user's
-- preferred unit rather than their numbers in that unit keeps one canonical
-- representation — a mixed table would make every trend calculation a
-- conversion minefield.
-- ----------------------------------------------------------------------------

alter table public.profiles
  add column if not exists weight_unit text not null default 'lb';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_weight_unit_valid'
  ) then
    alter table public.profiles
      add constraint profiles_weight_unit_valid
      check (weight_unit in ('kg', 'lb'));
  end if;
end $$;

-- ----------------------------------------------------------------------------
-- 3. Weight entries
-- ----------------------------------------------------------------------------

create table if not exists public.weight_entries (
  id          uuid primary key default gen_random_uuid(),

  -- Same pattern as food_entries: defaulted server-side, and the RLS WITH CHECK
  -- below rejects a forged value.
  user_id     uuid not null default auth.uid()
                references auth.users (id) on delete cascade,

  weight_kg   numeric(6,2) not null,

  -- A date, not a timestamptz: a weigh-in belongs to a calendar day, and the
  -- exact instant is noise. This also makes the one-per-day rule expressible.
  recorded_on date not null default current_date,

  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- 20kg–500kg spans every plausible adult; anything outside is a typo.
  constraint weight_entries_range
    check (weight_kg >= 20 and weight_kg <= 500),

  -- No weighing yourself in the future.
  constraint weight_entries_not_future
    check (recorded_on <= current_date + 1),

  -- One weigh-in per day: a second entry replaces the first via upsert rather
  -- than silently accumulating duplicates that make the trend meaningless.
  constraint weight_entries_one_per_day
    unique (user_id, recorded_on)
);

comment on table public.weight_entries is
  'One weigh-in per user per day, stored in kilograms.';

create index if not exists weight_entries_user_date_idx
  on public.weight_entries (user_id, recorded_on desc);

drop trigger if exists weight_entries_set_updated_at on public.weight_entries;
create trigger weight_entries_set_updated_at
  before update on public.weight_entries
  for each row execute function public.set_updated_at();

alter table public.weight_entries enable row level security;
alter table public.weight_entries force row level security;

drop policy if exists "Users can read own weight"   on public.weight_entries;
drop policy if exists "Users can insert own weight" on public.weight_entries;
drop policy if exists "Users can update own weight" on public.weight_entries;
drop policy if exists "Users can delete own weight" on public.weight_entries;

create policy "Users can read own weight"
  on public.weight_entries for select to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own weight"
  on public.weight_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own weight"
  on public.weight_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own weight"
  on public.weight_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

-- Anonymous callers are blocked at the privilege layer as well as by RLS, so a
-- future policy mistake cannot quietly expose the table.
revoke all on public.weight_entries from anon;
grant select, insert, update, delete on public.weight_entries to authenticated;
