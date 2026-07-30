import type { WeightUnit } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { dailyGoalSchema } from '@/lib/validation';

export const DEFAULT_DAILY_GOAL = 2000;

export type Profile = {
  id: string;
  dailyCalorieGoal: number;
  weightUnit: WeightUnit;
};

/** US-centric default; the DB column defaults to the same value. */
export const DEFAULT_WEIGHT_UNIT: WeightUnit = 'lb';

/**
 * A `profiles` row is created by a database trigger at sign-up. If it is
 * somehow absent (trigger added after an account existed, for example), fall
 * back to the default rather than blocking the Home screen — the goal is a
 * preference, not something worth an error state over.
 */
export async function fetchProfile(userId: string): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, daily_calorie_goal, weight_unit')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw error;

  if (!data) {
    return { id: userId, dailyCalorieGoal: DEFAULT_DAILY_GOAL, weightUnit: DEFAULT_WEIGHT_UNIT };
  }

  return {
    id: data.id,
    dailyCalorieGoal: data.daily_calorie_goal,
    weightUnit: data.weight_unit,
  };
}

export async function updateDailyGoal(userId: string, goal: number): Promise<Profile> {
  const validated = dailyGoalSchema.parse(goal);

  // Upsert rather than update so a missing row self-heals on first edit.
  // RLS still requires id === auth.uid(); this cannot touch anyone else's row.
  const { data, error } = await supabase
    .from('profiles')
    .upsert({ id: userId, daily_calorie_goal: validated }, { onConflict: 'id' })
    .select('id, daily_calorie_goal, weight_unit')
    .single();

  if (error) throw error;
  return {
    id: data.id,
    dailyCalorieGoal: data.daily_calorie_goal,
    weightUnit: data.weight_unit,
  };
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
    .select('id, daily_calorie_goal, weight_unit')
    .single();

  if (error) throw error;
  return {
    id: data.id,
    dailyCalorieGoal: data.daily_calorie_goal,
    weightUnit: data.weight_unit,
  };
}
