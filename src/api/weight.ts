import type { WeightUnit } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';
import { weightSchema } from '@/lib/validation';

export type WeightEntry = {
  id: string;
  weightKg: number;
  /** `YYYY-MM-DD` — a weigh-in belongs to a calendar day, not an instant. */
  recordedOn: string;
};

const KG_PER_LB = 0.45359237;

export const toKg = (value: number, unit: WeightUnit): number =>
  unit === 'kg' ? value : value * KG_PER_LB;

export const fromKg = (kg: number, unit: WeightUnit): number =>
  unit === 'kg' ? kg : kg / KG_PER_LB;

/**
 * Weights are stored in kilograms and converted at the edges. Storing the
 * user's preferred unit rather than their numbers in that unit keeps one
 * canonical representation — a mixed table would turn every trend calculation
 * into a conversion minefield.
 */
export async function fetchWeightEntries(limit = 90): Promise<WeightEntry[]> {
  const { data, error } = await supabase
    .from('weight_entries')
    .select('id, weight_kg, recorded_on')
    .order('recorded_on', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return data.map((row) => ({
    id: row.id,
    weightKg: typeof row.weight_kg === 'number' ? row.weight_kg : Number(row.weight_kg),
    recordedOn: row.recorded_on,
  }));
}

/**
 * Upsert rather than insert: the table has a one-per-day unique constraint, so
 * re-weighing corrects the day instead of failing or stacking duplicates that
 * would skew the trend.
 *
 * `user_id` is not sent — it defaults to `auth.uid()` and RLS rejects a forged
 * value, exactly as with food entries.
 */
export async function saveWeight(
  value: number,
  unit: WeightUnit,
  recordedOn: string,
): Promise<WeightEntry> {
  const kg = weightSchema.parse(toKg(value, unit));

  const { data, error } = await supabase
    .from('weight_entries')
    .upsert({ weight_kg: kg, recorded_on: recordedOn }, { onConflict: 'user_id,recorded_on' })
    .select('id, weight_kg, recorded_on')
    .single();

  if (error) throw error;

  return {
    id: data.id,
    weightKg: typeof data.weight_kg === 'number' ? data.weight_kg : Number(data.weight_kg),
    recordedOn: data.recorded_on,
  };
}

export async function deleteWeight(id: string): Promise<void> {
  const { error } = await supabase.from('weight_entries').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Change over the period, and a 7-point moving average.
 *
 * Daily weight is dominated by water and food in transit — a raw day-to-day
 * delta is mostly noise. Smoothing is what makes a trend legible.
 */
export function weightTrend(entries: WeightEntry[]): {
  latest: WeightEntry | null;
  changeKg: number | null;
  smoothed: { recordedOn: string; weightKg: number }[];
} {
  if (entries.length === 0) return { latest: null, changeKg: null, smoothed: [] };

  // Oldest first for the rolling window.
  const ordered = [...entries].reverse();

  const smoothed = ordered.map((entry, index) => {
    const window = ordered.slice(Math.max(0, index - 6), index + 1);
    const mean = window.reduce((sum, e) => sum + e.weightKg, 0) / window.length;
    return { recordedOn: entry.recordedOn, weightKg: mean };
  });

  const first = ordered[0]!;
  const last = ordered[ordered.length - 1]!;

  return {
    latest: last,
    changeKg: ordered.length > 1 ? last.weightKg - first.weightKg : null,
    smoothed,
  };
}
