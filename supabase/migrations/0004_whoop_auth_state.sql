-- ============================================================================
-- WHOOP OAuth: pending authorization state
--
-- Safe to run more than once. Run after 0003_whoop.sql.
--
-- WHY THIS TABLE EXISTS
--
-- WHOOP redirects the browser to a public callback URL rather than back into
-- the app, so that callback arrives with no session: no JWT, no cookies,
-- nothing identifying the user. All it carries is `code` and `state`.
--
-- So `state` has to be what identifies the user, and that makes it a
-- credential. It is generated server-side (never by the client, which could
-- choose a predictable one), stored here against the user who started the flow,
-- and consumed on first use. A replayed or guessed state binds nobody's WHOOP
-- account to anybody's profile, because:
--
--   * it is 32 random bytes, so it cannot be guessed;
--   * `consumed_at` makes it single-use, so a captured callback URL cannot be
--     replayed;
--   * `expires_at` closes the window to ten minutes.
--
-- Like whoop_tokens, no end-user role can read a row: RLS is on with no
-- policies, and the grants are revoked.
-- ============================================================================

create table if not exists public.whoop_auth_states (
  state       text primary key,

  user_id     uuid not null
                references auth.users (id) on delete cascade,

  -- Echoed back to WHOOP at exchange time, which requires the redirect_uri to
  -- match the one used at authorization exactly.
  redirect_uri text not null,

  expires_at  timestamptz not null,
  consumed_at timestamptz,

  created_at  timestamptz not null default now()
);

comment on table public.whoop_auth_states is
  'Short-lived OAuth state, mapping a random value to the user who began the flow.';

-- The callback looks rows up by primary key, so no extra index is needed. This
-- one supports the expiry sweep below.
create index if not exists whoop_auth_states_expires_idx
  on public.whoop_auth_states (expires_at);

alter table public.whoop_auth_states enable row level security;

-- Deliberately no policies, exactly as with whoop_tokens. A client that could
-- read this table could impersonate another user's pending authorization.
revoke all on public.whoop_auth_states from anon, authenticated;

-- ----------------------------------------------------------------------------
-- Housekeeping
--
-- Consumed and expired rows have no further purpose. Called opportunistically
-- by the Edge Function rather than scheduled, which keeps the table small
-- without depending on pg_cron being enabled.
-- ----------------------------------------------------------------------------

create or replace function public.prune_whoop_auth_states()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.whoop_auth_states
  where expires_at < now() - interval '1 hour';
$$;

revoke all on function public.prune_whoop_auth_states() from public, anon, authenticated;
