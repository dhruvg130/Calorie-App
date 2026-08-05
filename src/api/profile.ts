import type { WeightUnit } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { dailyGoalSchema, proteinGoalSchema } from '@/lib/validation';

export const DEFAULT_DAILY_GOAL = 2000;

export type Profile = {
  id: string;
  dailyCalorieGoal: number;
  /** Grams. Null means "work it out from bodyweight and training". */
  dailyProteinGoal: number | null;
  weightUnit: WeightUnit;
};

/** US-centric default; the DB column defaults to the same value. */
export const DEFAULT_WEIGHT_UNIT: WeightUnit = 'lb';

const COLUMNS = 'id, daily_calorie_goal, daily_protein_goal, weight_unit' as const;

/** PostgREST's code for "column does not exist". */
const UNDEFINED_COLUMN = '42703';

type ProfileShape = {
  id: string;
  daily_calorie_goal: number;
  daily_protein_goal?: number | null;
  weight_unit: WeightUnit;
};

function mapProfile(row: ProfileShape): Profile {
  return {
    id: row.id,
    dailyCalorieGoal: row.daily_calorie_goal,
    dailyProteinGoal: row.daily_protein_goal ?? null,
    weightUnit: row.weight_unit,
  };
}

/**
 * A `profiles` row is created by a database trigger at sign-up. If it is
 * somehow absent (trigger added after an account existed, for example), fall
 * back to the default rather than blocking the Home screen — the goal is a
 * preference, not something worth an error state over.
 *
 * The protein column arrived in migration 0005. A build running against a
 * database that has not had it applied yet re-reads without it rather than
 * failing the whole profile: losing one optional preference is recoverable,
 * losing the calorie goal and the weight unit is not.
 */
export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select(COLUMNS)
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    if (error.code === UNDEFINED_COLUMN) return fetchProfileWithoutProteinGoal(userId);
    throw error;
  }

  if (!data) {
    return {
      id: userId,
      dailyCalorieGoal: DEFAULT_DAILY_GOAL,
      dailyProteinGoal: null,
      weightUnit: DEFAULT_WEIGHT_UNIT,
    };
  }

  return mapProfile(data);
}

async function fetchProfileWithoutProteinGoal(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, daily_calorie_goal, weight_unit')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return {
      id: userId,
      dailyCalorieGoal: DEFAULT_DAILY_GOAL,
      dailyProteinGoal: null,
      weightUnit: DEFAULT_WEIGHT_UNIT,
    };
  }

  return mapProfile(data);
}

export async function updateDailyGoal(userId: string, goal: number): Promise<Profile> {
  const validated = dailyGoalSchema.parse(goal);

  // Upsert rather than update so a missing row self-heals on first edit.
  // RLS still requires id === auth.uid(); this cannot touch anyone else's row.
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, daily_calorie_goal: validated }, { onConflict: 'id' })
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return mapProfile(data);
}

/**
 * Sets — or with `null`, clears — the custom protein goal.
 *
 * Clearing is a first-class action rather than "set it to zero": with no
 * number stored, the app goes back to scaling the target off bodyweight and
 * the day's strain, which is a genuinely different behaviour from a goal of 0.
 */
export async function updateProteinGoal(
  userId: string,
  goal: number | null,
): Promise<Profile> {
  const validated = goal === null ? null : proteinGoalSchema.parse(goal);

  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, daily_protein_goal: validated }, { onConflict: 'id' })
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return mapProfile(data);
}

/**
 * Changes only how weights are *displayed*. Stored values stay in kilograms, so
 * switching units never rewrites history or introduces rounding drift into
 * past weigh-ins.
 */
export async function updateWeightUnit(userId: string, unit: WeightUnit): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, weight_unit: unit }, { onConflict: 'id' })
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return mapProfile(data);
}
