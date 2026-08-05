-- ============================================================================
-- Custom daily protein goal
--
-- Safe to run more than once. Run after 0004_whoop_auth_state.sql.
--
-- Same rules as the earlier migrations: RLS is the boundary, and every zod
-- bound in src/lib/validation.ts has a CHECK behind it here.
-- ============================================================================

-- Nullable on purpose, and null is meaningful: it means "work the target out
-- from my bodyweight and training", which is what the app did before this
-- column existed and what it still does for anyone who never sets a number.
-- A NOT NULL default would silently convert every existing user to a fixed
-- goal that happened to be right on the day of the migration.
alter table public.profiles
  add column if not exists daily_protein_goal integer;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'profiles_protein_goal_range'
  ) then
    alter table public.profiles
      add constraint profiles_protein_goal_range
      check (daily_protein_goal is null or daily_protein_goal between 20 and 400);
  end if;
end $$;

comment on column public.profiles.daily_protein_goal is
  'Grams of protein per day. Null means derive the target from bodyweight and strain.';
