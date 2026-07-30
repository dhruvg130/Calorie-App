// Supabase Edge Function (Deno) — the entire WHOOP integration's server side.
//
// WHY THIS EXISTS
// WHOOP does not support PKCE: exchanging an authorization code, and every
// later token refresh, requires the client secret. A secret in a React Native
// bundle is not a secret, so all three of those operations happen here.
//
// Just as importantly, the WHOOP *access token* never reaches the app either.
// It would be a bearer credential for the user's health data, usable against
// api.prod.whoop.com with no Supabase involvement at all. Tokens are written to
// `whoop_tokens`, a table with RLS enabled and no policies, reachable only by
// the service role — see 0003_whoop.sql.
//
// WHY IT RE-VERIFIES THE CALLER
// Same reasoning as usda-search: `verify_jwt = true` only proves the request
// carries a JWT signed by this project, and the anon key is such a JWT, shipped
// in every copy of the app. So the token is resolved to a real user, and every
// database write below is scoped to that resolved id — never to a user id taken
// from the request body.
//
// Deploy:
//   npx supabase secrets set WHOOP_CLIENT_SECRET=...
//   npx supabase functions deploy whoop

import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';

const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';
const WHOOP_API = 'https://api.prod.whoop.com/developer';

/** Refresh this long before expiry rather than waiting for a 401 mid-sync. */
const REFRESH_MARGIN_MS = 60_000;

/** WHOOP reports energy in kilojoules. */
const KJ_PER_KCAL = 4.184;

/** WHOOP caps collection endpoints at 25 records per page. */
const PAGE_LIMIT = 25;

/** Ceiling on pages per collection, so a bad next_token cannot loop forever. */
const MAX_PAGES = 20;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/** Generic messages only — never echo WHOOP's errors to the client. */
function fail(status: number, message: string): Response {
  return json({ error: message }, status);
}

// ---------------------------------------------------------------------------
// WHOOP payload shapes. Only the fields actually used are declared; everything
// is optional because this is someone else's API and a missing field must
// degrade to null rather than throw.
// ---------------------------------------------------------------------------

type ScoreState = 'SCORED' | 'PENDING_SCORE' | 'UNSCORABLE';

type WhoopRecord = {
  id?: number | string;
  start?: string;
  end?: string;
  created_at?: string;
  timezone_offset?: string;
  /**
   * Recovery only. A recovery describes the cycle it belongs to and carries no
   * start or offset of its own, so it is bucketed via the cycle it names.
   */
  cycle_id?: number | string;
  score_state?: ScoreState;
  score?: {
    strain?: number;
    kilojoule?: number;
    recovery_score?: number;
    resting_heart_rate?: number;
    hrv_rmssd_milli?: number;
    sleep_performance_percentage?: number;
    stage_summary?: {
      total_light_sleep_time_milli?: number;
      total_slow_wave_sleep_time_milli?: number;
      total_rem_sleep_time_milli?: number;
    };
  };
};

type Collection = { records?: WhoopRecord[]; next_token?: string };

type DailyRow = {
  user_id: string;
  day: string;
  workout_kcal: number | null;
  cycle_kcal: number | null;
  strain: number | null;
  recovery_score: number | null;
  resting_hr: number | null;
  hrv_ms: number | null;
  sleep_performance: number | null;
  sleep_duration_min: number | null;
  synced_at: string;
};

// ---------------------------------------------------------------------------
// Day bucketing
//
// A workout at 11pm belongs to that day, not to the next one in UTC. WHOOP
// stamps every record with the offset in force where the user was, so the
// record itself carries what is needed — no stored timezone, and it stays
// correct when they travel.
// ---------------------------------------------------------------------------

function offsetMinutes(offset: string | undefined): number {
  if (!offset) return 0;
  const match = /^([+-])(\d{2}):?(\d{2})$/.exec(offset.trim());
  if (!match) return 0;
  const [, sign, hours, minutes] = match;
  const total = Number(hours) * 60 + Number(minutes);
  return sign === '-' ? -total : total;
}

function localDay(iso: string | undefined, offset: string | undefined): string | null {
  if (!iso) return null;
  const instant = new Date(iso).getTime();
  if (!Number.isFinite(instant)) return null;
  // Shift the instant into the user's local wall clock, then read the UTC
  // calendar date of the shifted value.
  return new Date(instant + offsetMinutes(offset) * 60_000).toISOString().slice(0, 10);
}

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Null unless finite and within bounds — the DB CHECKs would reject the rest. */
function bounded(value: unknown, min: number, max: number): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null;
  if (value < min || value > max) return null;
  return value;
}

const kjToKcal = (kj: number) => kj / KJ_PER_KCAL;

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

type TokenRow = {
  access_token: string;
  refresh_token: string;
  expires_at: string;
};

type WhoopTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

async function requestToken(body: URLSearchParams): Promise<WhoopTokenResponse | null> {
  let response: Response;
  try {
    response = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error('WHOOP token request failed', error);
    return null;
  }

  if (!response.ok) {
    // Status only. The body can echo the client secret back in some error
    // shapes, and this lands in logs.
    console.error('WHOOP token endpoint responded with status', response.status);
    return null;
  }

  const data = (await response.json()) as WhoopTokenResponse;
  if (!data.access_token || !data.refresh_token) {
    console.error('WHOOP token response was missing tokens');
    return null;
  }
  return data;
}

function expiryFrom(expiresIn: number | undefined): string {
  const seconds = typeof expiresIn === 'number' && Number.isFinite(expiresIn) ? expiresIn : 3600;
  return new Date(Date.now() + seconds * 1000).toISOString();
}

/**
 * A valid access token for this user, refreshing first if it is close to
 * expiry.
 *
 * WHOOP invalidates the old refresh token the moment a new one is issued, so
 * the new pair is persisted before it is used for anything. Returns null when
 * the connection can no longer be recovered, having flagged it for re-auth so
 * the app can prompt instead of failing quietly forever.
 */
async function validAccessToken(
  admin: SupabaseClient,
  userId: string,
  clientId: string,
  clientSecret: string,
): Promise<string | null> {
  const { data, error } = await admin
    .from('whoop_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .maybeSingle<TokenRow>();

  if (error) {
    console.error('Failed to read WHOOP tokens', error.message);
    return null;
  }
  if (!data) return null;

  const expiresAt = new Date(data.expires_at).getTime();
  if (Number.isFinite(expiresAt) && expiresAt - Date.now() > REFRESH_MARGIN_MS) {
    return data.access_token;
  }

  const refreshed = await requestToken(
    new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: data.refresh_token,
      client_id: clientId,
      client_secret: clientSecret,
      // WHOOP only returns a new refresh token when `offline` is requested
      // again; without it the next refresh would have nothing to use.
      scope: 'offline',
    }),
  );

  if (!refreshed) {
    await admin
      .from('whoop_connections')
      .update({ needs_reauth: true })
      .eq('user_id', userId);
    return null;
  }

  const { error: saveError } = await admin
    .from('whoop_tokens')
    .update({
      access_token: refreshed.access_token,
      refresh_token: refreshed.refresh_token,
      expires_at: expiryFrom(refreshed.expires_in),
    })
    .eq('user_id', userId);

  if (saveError) {
    console.error('Failed to persist refreshed WHOOP tokens', saveError.message);
    return null;
  }

  return refreshed.access_token!;
}

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

async function fetchCollection(
  path: string,
  accessToken: string,
  start: string,
  end: string,
): Promise<WhoopRecord[]> {
  const records: WhoopRecord[] = [];
  let nextToken: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({ start, end, limit: String(PAGE_LIMIT) });
    if (nextToken) params.set('nextToken', nextToken);

    let response: Response;
    try {
      response = await fetch(`${WHOOP_API}${path}?${params}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        signal: AbortSignal.timeout(15_000),
      });
    } catch (error) {
      console.error(`WHOOP ${path} request failed`, error);
      break;
    }

    if (!response.ok) {
      console.error(`WHOOP ${path} responded with status`, response.status);
      break;
    }

    const page_ = (await response.json()) as Collection;
    records.push(...(page_.records ?? []));

    nextToken = page_.next_token;
    if (!nextToken) break;
  }

  return records;
}

/** Mutable accumulator, one per calendar day. */
type DayBucket = Omit<DailyRow, 'user_id' | 'synced_at'>;

function bucketFor(days: Map<string, DayBucket>, day: string): DayBucket {
  const existing = days.get(day);
  if (existing) return existing;

  const created: DayBucket = {
    day,
    workout_kcal: null,
    cycle_kcal: null,
    strain: null,
    recovery_score: null,
    resting_hr: null,
    hrv_ms: null,
    sleep_performance: null,
    sleep_duration_min: null,
  };
  days.set(day, created);
  return created;
}

/** Only scored records carry meaningful numbers; pending ones are placeholders. */
const isScored = (record: WhoopRecord) => record.score_state === 'SCORED' && Boolean(record.score);

// ---------------------------------------------------------------------------
// Actions
// ---------------------------------------------------------------------------

async function handleExchange(
  admin: SupabaseClient,
  userId: string,
  clientId: string,
  clientSecret: string,
  code: string,
  redirectUri: string,
): Promise<Response> {
  const tokens = await requestToken(
    new URLSearchParams({
      grant_type: 'authorization_code',
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
    }),
  );

  if (!tokens) return fail(502, 'Could not connect to WHOOP. Please try again.');

  const expiresAt = expiryFrom(tokens.expires_in);

  const { error: tokenError } = await admin.from('whoop_tokens').upsert(
    {
      user_id: userId,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
      scope: tokens.scope ?? null,
    },
    { onConflict: 'user_id' },
  );

  if (tokenError) {
    console.error('Failed to store WHOOP tokens', tokenError.message);
    return fail(500, 'Could not connect to WHOOP. Please try again.');
  }

  const { error: connectionError } = await admin.from('whoop_connections').upsert(
    {
      user_id: userId,
      scope: tokens.scope ?? null,
      connected_at: new Date().toISOString(),
      needs_reauth: false,
    },
    { onConflict: 'user_id' },
  );

  if (connectionError) {
    console.error('Failed to store WHOOP connection', connectionError.message);
    return fail(500, 'Could not connect to WHOOP. Please try again.');
  }

  return json({ connected: true });
}

async function handleSync(
  admin: SupabaseClient,
  userId: string,
  clientId: string,
  clientSecret: string,
  days: number,
): Promise<Response> {
  const accessToken = await validAccessToken(admin, userId, clientId, clientSecret);
  if (!accessToken) {
    return fail(409, 'Your WHOOP connection needs to be renewed.');
  }

  const end = new Date();
  const start = new Date(end.getTime() - days * 24 * 60 * 60 * 1000);
  const startIso = start.toISOString();
  const endIso = end.toISOString();

  const [workouts, cycles, recoveries, sleeps] = await Promise.all([
    fetchCollection('/v2/activity/workout', accessToken, startIso, endIso),
    fetchCollection('/v2/cycle', accessToken, startIso, endIso),
    fetchCollection('/v2/recovery', accessToken, startIso, endIso),
    fetchCollection('/v2/activity/sleep', accessToken, startIso, endIso),
  ]);

  const buckets = new Map<string, DayBucket>();

  // Workouts accumulate: several sessions in one day sum into that day's burn.
  for (const workout of workouts) {
    if (!isScored(workout)) continue;
    const day = localDay(workout.start, workout.timezone_offset);
    if (!day) continue;

    const kj = bounded(workout.score?.kilojoule, 0, 100_000);
    if (kj === null) continue;

    const bucket = bucketFor(buckets, day);
    bucket.workout_kcal = round2((bucket.workout_kcal ?? 0) + kjToKcal(kj));
  }

  // Cycles, recovery and sleep are one-per-day summaries, so they assign rather
  // than accumulate. Records arrive newest-first, so an earlier write for a day
  // is the more recent record and is left alone.
  // Built while walking cycles so recoveries, which reference a cycle rather
  // than a time, can be placed on the same day as the cycle they scored.
  const dayByCycleId = new Map<string, string>();

  for (const cycle of cycles) {
    if (!isScored(cycle)) continue;
    const day = localDay(cycle.start, cycle.timezone_offset);
    if (!day) continue;

    if (cycle.id !== undefined) dayByCycleId.set(String(cycle.id), day);

    const bucket = bucketFor(buckets, day);
    if (bucket.cycle_kcal === null) {
      const kj = bounded(cycle.score?.kilojoule, 0, 100_000);
      if (kj !== null) bucket.cycle_kcal = round2(kjToKcal(kj));
    }
    if (bucket.strain === null) {
      bucket.strain = bounded(cycle.score?.strain, 0, 21);
    }
  }

  for (const recovery of recoveries) {
    if (!isScored(recovery)) continue;

    // Prefer the cycle's own day, which already accounts for the user's offset.
    // `created_at` is a UTC fallback for a recovery whose cycle fell outside the
    // requested window — slightly wrong at the edges beats discarding the score.
    const day =
      (recovery.cycle_id !== undefined
        ? dayByCycleId.get(String(recovery.cycle_id))
        : undefined) ?? localDay(recovery.created_at, undefined);
    if (!day) continue;

    const bucket = bucketFor(buckets, day);
    if (bucket.recovery_score === null) {
      bucket.recovery_score = bounded(recovery.score?.recovery_score, 0, 100);
    }
    if (bucket.resting_hr === null) {
      bucket.resting_hr = bounded(recovery.score?.resting_heart_rate, 20, 200);
    }
    if (bucket.hrv_ms === null) {
      const hrv = bounded(recovery.score?.hrv_rmssd_milli, 0, 500);
      bucket.hrv_ms = hrv === null ? null : round2(hrv);
    }
  }

  for (const sleep of sleeps) {
    if (!isScored(sleep)) continue;
    const day = localDay(sleep.end, sleep.timezone_offset);
    if (!day) continue;

    const bucket = bucketFor(buckets, day);
    if (bucket.sleep_performance === null) {
      bucket.sleep_performance = bounded(sleep.score?.sleep_performance_percentage, 0, 100);
    }
    if (bucket.sleep_duration_min === null) {
      const stages = sleep.score?.stage_summary;
      const asleepMilli =
        (stages?.total_light_sleep_time_milli ?? 0) +
        (stages?.total_slow_wave_sleep_time_milli ?? 0) +
        (stages?.total_rem_sleep_time_milli ?? 0);
      bucket.sleep_duration_min =
        asleepMilli > 0 ? bounded(Math.round(asleepMilli / 60_000), 0, 1440) : null;
    }
  }

  if (buckets.size === 0) {
    await admin
      .from('whoop_connections')
      .update({ last_synced_at: new Date().toISOString() })
      .eq('user_id', userId);
    return json({ days: 0 });
  }

  const syncedAt = new Date().toISOString();

  // Clamped to the CHECK constraint's ceiling rather than left to fail. An
  // upsert is all-or-nothing: one implausible day from WHOOP would otherwise
  // reject every other day in the batch along with it.
  const clampKcal = (value: number | null) =>
    value === null ? null : Math.min(Math.max(value, 0), 20_000);

  const rows: DailyRow[] = [...buckets.values()].map((bucket) => ({
    ...bucket,
    workout_kcal: clampKcal(bucket.workout_kcal),
    cycle_kcal: clampKcal(bucket.cycle_kcal),
    user_id: userId,
    synced_at: syncedAt,
  }));

  const { error: upsertError } = await admin
    .from('whoop_daily')
    .upsert(rows, { onConflict: 'user_id,day' });

  if (upsertError) {
    console.error('Failed to store WHOOP metrics', upsertError.message);
    return fail(500, 'Could not save your WHOOP data.');
  }

  await admin
    .from('whoop_connections')
    .update({ last_synced_at: syncedAt, needs_reauth: false })
    .eq('user_id', userId);

  return json({ days: rows.length });
}

/**
 * Disconnecting removes the synced metrics as well as the tokens. The privacy
 * policy says disconnecting deletes the WHOOP data we hold, and leaving the
 * rows behind would make that untrue.
 */
async function handleDisconnect(admin: SupabaseClient, userId: string): Promise<Response> {
  const { error: tokenError } = await admin.from('whoop_tokens').delete().eq('user_id', userId);
  if (tokenError) {
    console.error('Failed to delete WHOOP tokens', tokenError.message);
    return fail(500, 'Could not disconnect WHOOP.');
  }

  await admin.from('whoop_daily').delete().eq('user_id', userId);
  await admin.from('whoop_connections').delete().eq('user_id', userId);

  return json({ connected: false });
}

// ---------------------------------------------------------------------------

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return fail(405, 'Method not allowed');
  }

  const clientId = Deno.env.get('WHOOP_CLIENT_ID');
  const clientSecret = Deno.env.get('WHOOP_CLIENT_SECRET');
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!clientId || !clientSecret || !supabaseUrl || !anonKey || !serviceRoleKey) {
    console.error('whoop is missing required environment configuration');
    return fail(500, 'WHOOP is not configured.');
  }

  // ---- Authenticate the caller ------------------------------------------
  const authHeader = req.headers.get('Authorization') ?? '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!token) return fail(401, 'Authentication required.');

  const caller = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: userData, error: userError } = await caller.auth.getUser(token);
  if (userError || !userData?.user) {
    return fail(401, 'Authentication required.');
  }

  // Every write below uses this id. Nothing user-scoped is ever read from the
  // request body, so a caller cannot act on another account by asking to.
  const userId = userData.user.id;

  // Service role: required to touch whoop_tokens, which denies every other role.
  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ---- Validate input ----------------------------------------------------
  let payload: unknown;
  try {
    payload = await req.json();
  } catch {
    return fail(400, 'Invalid request.');
  }

  const body = (payload ?? {}) as {
    action?: unknown;
    code?: unknown;
    redirectUri?: unknown;
    days?: unknown;
  };
  const action = typeof body.action === 'string' ? body.action : '';

  switch (action) {
    case 'exchange': {
      const code = typeof body.code === 'string' ? body.code.trim() : '';
      const redirectUri = typeof body.redirectUri === 'string' ? body.redirectUri.trim() : '';
      if (!code || !redirectUri) return fail(400, 'Invalid request.');
      return handleExchange(admin, userId, clientId, clientSecret, code, redirectUri);
    }

    case 'sync': {
      const requested = typeof body.days === 'number' ? Math.trunc(body.days) : 14;
      // 25 records per page against a hard page cap; a year would silently
      // truncate rather than fail, so the window is bounded here instead.
      const days = Math.min(Math.max(requested || 14, 1), 60);
      return handleSync(admin, userId, clientId, clientSecret, days);
    }

    case 'disconnect':
      return handleDisconnect(admin, userId);

    default:
      return fail(400, 'Invalid request.');
  }
});
