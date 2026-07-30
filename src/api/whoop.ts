import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * The WHOOP integration's client half.
 *
 * Everything requiring the client secret — the code exchange, token refresh,
 * and the data fetch itself — happens in the `whoop` Edge Function. This file
 * only ever sees an authorization code (useless without the secret) and the
 * metrics that were already written to our own tables. No WHOOP access token
 * reaches the device.
 */

const AUTHORIZE_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';

/**
 * Must match the redirect registered in the WHOOP dashboard exactly — WHOOP
 * rejects anything else. Hardcoded rather than derived from `Linking.createURL`
 * because that produces a different value under Expo Go than in a real build,
 * and only one of them can be the registered one.
 */
export const WHOOP_REDIRECT_URI = 'calorietracker://whoop-callback';

const SCOPES = [
  'read:workout',
  'read:cycles',
  'read:recovery',
  'read:sleep',
  'read:body_measurement',
  // Without `offline` WHOOP issues no refresh token and the connection dies
  // roughly an hour later.
  'offline',
];

/** WHOOP is optional; a build without the client ID simply does not offer it. */
export const isWhoopConfigured = Boolean(env.whoopClientId);

export type WhoopConnection = {
  scope: string | null;
  connectedAt: string;
  lastSyncedAt: string | null;
  /** True once a token refresh has been rejected — the user must reconnect. */
  needsReauth: boolean;
};

export type WhoopDay = {
  day: string;
  /** Burn from logged workouts, in calories. Null when nothing was recorded. */
  workoutKcal: number | null;
  /** Whole-day burn including basal metabolism. Display only — see below. */
  cycleKcal: number | null;
  strain: number | null;
  recoveryScore: number | null;
  restingHr: number | null;
  hrvMs: number | null;
  sleepPerformance: number | null;
  sleepDurationMin: number | null;
};

const numberOrNull = (value: unknown): number | null => {
  if (value === null || value === undefined) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

export async function fetchWhoopConnection(): Promise<WhoopConnection | null> {
  const { data, error } = await supabase
    .from('whoop_connections')
    .select('scope, connected_at, last_synced_at, needs_reauth')
    .maybeSingle();

  if (error) throw error;
  if (!data) return null;

  return {
    scope: data.scope,
    connectedAt: data.connected_at,
    lastSyncedAt: data.last_synced_at,
    needsReauth: Boolean(data.needs_reauth),
  };
}

export async function fetchWhoopDays(limit = 90): Promise<WhoopDay[]> {
  const { data, error } = await supabase
    .from('whoop_daily')
    .select(
      'day, workout_kcal, cycle_kcal, strain, recovery_score, resting_hr, hrv_ms, sleep_performance, sleep_duration_min',
    )
    .order('day', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data ?? []).map((row) => ({
    day: row.day,
    workoutKcal: numberOrNull(row.workout_kcal),
    cycleKcal: numberOrNull(row.cycle_kcal),
    strain: numberOrNull(row.strain),
    recoveryScore: numberOrNull(row.recovery_score),
    restingHr: numberOrNull(row.resting_hr),
    hrvMs: numberOrNull(row.hrv_ms),
    sleepPerformance: numberOrNull(row.sleep_performance),
    sleepDurationMin: numberOrNull(row.sleep_duration_min),
  }));
}

type WhoopFunctionResponse = {
  connected?: boolean;
  days?: number;
  error?: string;
};

async function callWhoopFunction(body: Record<string, unknown>): Promise<WhoopFunctionResponse> {
  // `functions.invoke` attaches the caller's access token, which is what the
  // function resolves to a user id before touching anything.
  const { data, error } = await supabase.functions.invoke<WhoopFunctionResponse>('whoop', {
    body,
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);
  return data ?? {};
}

/**
 * Opens WHOOP's login, waits for the redirect back, and hands the resulting
 * code to the Edge Function.
 *
 * The `state` parameter is generated here and checked on return. Without it, a
 * malicious link into `calorietracker://whoop-callback` could deliver an
 * attacker's authorization code and quietly bind their WHOOP account to this
 * user's profile.
 */
export async function connectWhoop(): Promise<void> {
  const clientId = env.whoopClientId;
  if (!clientId) throw new Error('WHOOP is not configured in this build.');

  const state = Array.from(Crypto.getRandomBytes(16))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: WHOOP_REDIRECT_URI,
    response_type: 'code',
    scope: SCOPES.join(' '),
    state,
  });

  const result = await WebBrowser.openAuthSessionAsync(
    `${AUTHORIZE_URL}?${params}`,
    WHOOP_REDIRECT_URI,
  );

  if (result.type !== 'success') {
    // Cancelling is a normal outcome, not a failure worth an error message.
    throw new WhoopCancelled();
  }

  const returned = new URL(result.url);
  const returnedState = returned.searchParams.get('state');
  const code = returned.searchParams.get('code');
  const denied = returned.searchParams.get('error');

  if (denied) throw new Error('WHOOP access was declined.');

  // Constant-time comparison is unnecessary here — this is a freshness check
  // against a value we generated a moment ago, not a secret being verified.
  if (!returnedState || returnedState !== state) {
    throw new Error('That WHOOP sign-in could not be verified. Please try again.');
  }
  if (!code) throw new Error('WHOOP did not return an authorization code.');

  await callWhoopFunction({
    action: 'exchange',
    code,
    redirectUri: WHOOP_REDIRECT_URI,
  });
}

/** Thrown when the user backs out of the WHOOP browser sheet. */
export class WhoopCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'WhoopCancelled';
  }
}

export async function syncWhoop(days = 14): Promise<number> {
  const result = await callWhoopFunction({ action: 'sync', days });
  return result.days ?? 0;
}

export async function disconnectWhoop(): Promise<void> {
  await callWhoopFunction({ action: 'disconnect' });
}

// ---------------------------------------------------------------------------
// Derived values
// ---------------------------------------------------------------------------

export type RecoveryBand = 'green' | 'yellow' | 'red';

/** WHOOP's own thresholds, so the colours here match the colours in their app. */
export function recoveryBand(score: number): RecoveryBand {
  if (score >= 67) return 'green';
  if (score >= 34) return 'yellow';
  return 'red';
}

/**
 * Calories earned from training on a given day.
 *
 * Workout burn only — deliberately not `cycleKcal`, which is the whole day's
 * expenditure including basal metabolism. A daily calorie goal already accounts
 * for baseline metabolism, so adding the cycle figure would double-count it and
 * inflate the target by roughly an entire BMR.
 */
export function earnedCalories(day: WhoopDay | undefined): number {
  if (!day || day.workoutKcal === null) return 0;
  return Math.max(0, Math.round(day.workoutKcal));
}
