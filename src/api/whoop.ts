import * as WebBrowser from 'expo-web-browser';

import { env } from '@/lib/env';
import { supabase } from '@/lib/supabase';

/**
 * The WHOOP integration's client half.
 *
 * This file never sees a WHOOP token, and never sees an authorization code
 * either. WHOOP redirects the browser to an Edge Function, which does the whole
 * exchange server-side; the app simply notices afterwards that a connection
 * exists.
 *
 * That indirection is what lets this work in Expo Go. A custom scheme like
 * `calorietracker://` cannot be delivered to a project running inside Expo Go,
 * so an https callback the server owns sidesteps the need for a native build
 * entirely — and is no less secure, since the code is worthless without the
 * client secret that only the function holds.
 */

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
  authorizeUrl?: string;
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

/** Thrown when the browser closed without a connection being established. */
export class WhoopCancelled extends Error {
  constructor() {
    super('cancelled');
    this.name = 'WhoopCancelled';
  }
}

const POLL_INTERVAL_MS = 1_000;
const POLL_TIMEOUT_MS = 20_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Opens WHOOP's login and waits for the server to report a connection.
 *
 * There is no redirect back into the app to wait on — the browser lands on our
 * own callback, which finishes everything before rendering its "you can close
 * this" page. So by the time the user dismisses the browser the work is
 * normally already done, and the first poll succeeds. The loop exists for the
 * case where they are quicker than the round trip.
 */
export async function connectWhoop(): Promise<void> {
  if (!env.whoopClientId) throw new Error('WHOOP is not configured in this build.');

  const { authorizeUrl } = await callWhoopFunction({ action: 'start' });
  if (!authorizeUrl) throw new Error('Could not start the WHOOP connection.');

  // `openBrowserAsync`, not `openAuthSessionAsync`: the latter exists to
  // intercept a redirect back into the app, which is exactly what no longer
  // happens here. It would also add an OS consent prompt for nothing.
  await WebBrowser.openBrowserAsync(authorizeUrl);

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const connection = await fetchWhoopConnection();
    if (connection && !connection.needsReauth) return;
    await sleep(POLL_INTERVAL_MS);
  }

  // Backing out before finishing is a normal outcome, not an error to shout
  // about — the caller treats this as a silent no-op.
  throw new WhoopCancelled();
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
