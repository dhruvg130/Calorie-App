-- ============================================================================
-- Calorie Tracker — initial schema
--
-- Safe to run more than once: every statement is guarded.
-- Run in the Supabase dashboard SQL Editor, or via `npx supabase db push`.
--
-- Design notes worth knowing before you edit this file:
--
--  * Row Level Security is the security boundary. The mobile app ships with the
--    anon key embedded in its bundle, so anyone can craft arbitrary PostgREST
--    requests. Nothing below trusts the client to send the right user_id.
--
--  * `total_calories` is a GENERATED column. The client sends the parts and
--    Postgres computes the product, so a tampered request cannot log 50 000
--    calories as "1 apple" — or, more usefully, cannot drift out of sync.
--
--  * Every CHECK here mirrors a zod rule in src/lib/validation.ts. The zod rule
--    is for fast feedback; this one is the enforcement.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Shared helpers
-- ----------------------------------------------------------------------------

-- `set search_path = ''` prevents a malicious object in a user-writable schema
-- from shadowing something this function calls. All references are schema
-- qualified as a result.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ----------------------------------------------------------------------------
-- profiles — one row per user, holding their daily calorie goal
-- ----------------------------------------------------------------------------

create table if not exists public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  daily_calorie_goal integer not null default 2000,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),

  constraint profiles_goal_range
    check (daily_calorie_goal between 500 and 10000)
);

comment on table public.profiles is
  'Per-user settings. Created automatically by the on_auth_user_created trigger.';

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
-- Force RLS so it applies even to the table owner, closing the gap where a
-- SECURITY DEFINER function owned by that role would otherwise see every row.
alter table public.profiles force row level security;

drop policy if exists "Users can read own profile"   on public.profiles;
drop policy if exists "Users can insert own profile" on public.profiles;
drop policy if exists "Users can update own profile" on public.profiles;

create policy "Users can read own profile"
  on public.profiles for select to authenticated
  using ((select auth.uid()) = id);

create policy "Users can insert own profile"
  on public.profiles for insert to authenticated
  with check ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Deliberately no DELETE policy: a signed-in user has no reason to delete their
-- settings row, and the FK cascade removes it when the account is deleted.
-- Least privilege — grant the operations the app needs, nothing more.

-- ----------------------------------------------------------------------------
-- Auto-provision a profile whenever a user signs up
-- ----------------------------------------------------------------------------

-- SECURITY DEFINER because the insert happens inside GoTrue's transaction,
-- where auth.uid() is not yet the new user.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- A SECURITY DEFINER function should never be directly callable by clients.
revoke all on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ----------------------------------------------------------------------------
-- food_entries — the logged meals
-- ----------------------------------------------------------------------------

create table if not exists public.food_entries (
  id                   uuid primary key default gen_random_uuid(),

  -- Defaulting to auth.uid() means a client that omits user_id still gets the
  -- correct owner, and the INSERT policy below rejects one that lies about it.
  user_id              uuid not null default auth.uid()
                         references auth.users (id) on delete cascade,

  name                 text not null,
  brand                text,
  calories_per_serving numeric(8,2) not null,
  serving_quantity     numeric(8,2) not null,
  serving_unit         text not null,

  -- Computed by Postgres, never sent by the client.
  total_calories       numeric(12,2) not null
                         generated always as (calories_per_serving * serving_quantity) stored,

  protein_g            numeric(8,2),
  carbs_g              numeric(8,2),
  fat_g                numeric(8,2),

  source               text not null,
  barcode              text,
  image_path           text,

  consumed_at          timestamptz not null default now(),
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),

  constraint food_entries_name_length
    check (char_length(name) between 1 and 200),

  constraint food_entries_brand_length
    check (brand is null or char_length(brand) between 1 and 120),

  constraint food_entries_calories_range
    check (calories_per_serving >= 0 and calories_per_serving <= 10000),

  constraint food_entries_serving_range
    check (serving_quantity > 0 and serving_quantity <= 100),

  constraint food_entries_unit_length
    check (char_length(serving_unit) between 1 and 60),

  constraint food_entries_protein_range
    check (protein_g is null or (protein_g >= 0 and protein_g <= 5000)),

  constraint food_entries_carbs_range
    check (carbs_g is null or (carbs_g >= 0 and carbs_g <= 5000)),

  constraint food_entries_fat_range
    check (fat_g is null or (fat_g >= 0 and fat_g <= 5000)),

  constraint food_entries_source_valid
    check (source in ('search', 'barcode', 'photo', 'manual')),

  constraint food_entries_barcode_format
    check (barcode is null or barcode ~ '^[0-9]{6,14}$'),

  -- Storage objects live at `<user_id>/<filename>`. Pinning the prefix here
  -- means a row can never point at another user's image, independently of the
  -- storage policies that also enforce it.
  constraint food_entries_image_path_scoped
    check (image_path is null or image_path like (user_id::text || '/%'))
);

comment on table public.food_entries is
  'One row per logged food. total_calories is generated and cannot be set by clients.';

create index if not exists food_entries_user_consumed_idx
  on public.food_entries (user_id, consumed_at desc);

drop trigger if exists food_entries_set_updated_at on public.food_entries;
create trigger food_entries_set_updated_at
  before update on public.food_entries
  for each row execute function public.set_updated_at();

-- `now()` is not immutable, so this cannot be a CHECK constraint. A trigger
-- gives the same server-side guarantee: no logging meals far in the future,
-- and none before this app could plausibly have existed.
create or replace function public.validate_food_entry()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.consumed_at > now() + interval '1 day' then
    raise exception 'consumed_at is too far in the future'
      using errcode = '23514';
  end if;

  if new.consumed_at < timestamptz '2020-01-01' then
    raise exception 'consumed_at is implausibly old'
      using errcode = '23514';
  end if;

  return new;
end;
$$;

drop trigger if exists food_entries_validate on public.food_entries;
create trigger food_entries_validate
  before insert or update on public.food_entries
  for each row execute function public.validate_food_entry();

alter table public.food_entries enable row level security;
alter table public.food_entries force row level security;

drop policy if exists "Users can read own entries"   on public.food_entries;
drop policy if exists "Users can insert own entries" on public.food_entries;
drop policy if exists "Users can update own entries" on public.food_entries;
drop policy if exists "Users can delete own entries" on public.food_entries;

create policy "Users can read own entries"
  on public.food_entries for select to authenticated
  using ((select auth.uid()) = user_id);

-- WITH CHECK is what stops a forged user_id in the request body.
create policy "Users can insert own entries"
  on public.food_entries for insert to authenticated
  with check ((select auth.uid()) = user_id);

-- USING gates which rows may be targeted; WITH CHECK stops an update from
-- reassigning a row to somebody else. Both are required.
create policy "Users can update own entries"
  on public.food_entries for update to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

create policy "Users can delete own entries"
  on public.food_entries for delete to authenticated
  using ((select auth.uid()) = user_id);

-- ----------------------------------------------------------------------------
-- Privileges
--
-- RLS already blocks anonymous access (no policy targets `anon`), but revoking
-- the table grants as well means an accidental future policy cannot quietly
-- open these tables to signed-out callers.
-- ----------------------------------------------------------------------------

revoke all on public.profiles     from anon;
revoke all on public.food_entries from anon;

grant select, insert, update on public.profiles to authenticated;
grant select, insert, update, delete on public.food_entries to authenticated;

-- The client must not be able to write the generated column even by accident.
revoke insert (total_calories), update (total_calories)
  on public.food_entries from authenticated;

-- ----------------------------------------------------------------------------
-- Storage — meal photos
-- ----------------------------------------------------------------------------

-- private bucket + a 5 MB ceiling + an image-only MIME allowlist, all enforced
-- by the storage API rather than by the client that uploads.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'meal-images',
  'meal-images',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Users can read own meal images"   on storage.objects;
drop policy if exists "Users can upload own meal images" on storage.objects;
drop policy if exists "Users can update own meal images" on storage.objects;
drop policy if exists "Users can delete own meal images" on storage.objects;

-- `storage.foldername(name)` splits the object path; element 1 is the first
-- folder. Requiring it to equal the caller's uid scopes every user to their own
-- directory, so a guessed path into someone else's folder is rejected.
create policy "Users can read own meal images"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'meal-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can upload own meal images"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'meal-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can update own meal images"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'meal-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  )
  with check (
    bucket_id = 'meal-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy "Users can delete own meal images"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'meal-images'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
