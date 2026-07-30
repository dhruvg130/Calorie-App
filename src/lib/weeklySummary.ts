import type { DayNutrition } from '@/api/entries';
import type { WhoopDay } from '@/api/whoop';
import { fromKg, type WeightEntry } from '@/api/weight';
import type { WeightUnit } from '@/lib/database.types';
import { localDayKey } from '@/lib/date';

/**
 * A week reduced to a handful of averages, plus at most one observation.
 *
 * THE RULE THIS FOLLOWS
 *
 * Every number here is an average of days that actually have data, and each
 * carries how many days that was. A "weekly average" computed over two logged
 * days is not a weekly average, and presenting it as one invites the user to
 * draw a conclusion the data cannot support — so the count travels with the
 * figure rather than being hidden.
 *
 * The observation at the end is held to a higher bar still: it only appears
 * when there are enough days for the comparison to mean anything, and it
 * describes what happened rather than prescribing what to do.
 */

export type WeeklyMetric = {
  average: number | null;
  /** How many of the seven days contributed. */
  days: number;
};

export type WeeklySummary = {
  strain: WeeklyMetric;
  calories: WeeklyMetric;
  protein: WeeklyMetric;
  recovery: WeeklyMetric;
  /** Change across the week in the user's display unit, or null. */
  weightChange: number | null;
  /** One plain-language observation, or null when the data cannot support one. */
  observation: string | null;
};

/** Below this, an average is too thin to describe a week. */
const MIN_DAYS_FOR_OBSERVATION = 4;

function average(values: number[]): WeeklyMetric {
  if (values.length === 0) return { average: null, days: 0 };
  const sum = values.reduce((total, value) => total + value, 0);
  return { average: sum / values.length, days: values.length };
}

export function weeklySummary(
  week: Date[],
  whoopDays: WhoopDay[] | undefined,
  nutrition: DayNutrition | undefined,
  weightEntries: WeightEntry[] | undefined,
  unit: WeightUnit,
): WeeklySummary {
  const whoopByDay = new Map((whoopDays ?? []).map((d) => [d.day, d]));
  const weightByDay = new Map((weightEntries ?? []).map((e) => [e.recordedOn, e.weightKg]));

  const strains: number[] = [];
  const calories: number[] = [];
  const proteins: number[] = [];
  const recoveries: number[] = [];
  const weights: { key: string; value: number }[] = [];

  for (const date of week) {
    const key = localDayKey(date);

    const whoop = whoopByDay.get(key);
    if (typeof whoop?.strain === 'number') strains.push(whoop.strain);
    if (typeof whoop?.recoveryScore === 'number') recoveries.push(whoop.recoveryScore);

    const eaten = nutrition?.[key];
    // A day with nothing logged is an absent day, not a zero-calorie one.
    if (eaten && eaten.calories > 0) {
      calories.push(eaten.calories);
      proteins.push(eaten.proteinG);
    }

    const kg = weightByDay.get(key);
    if (typeof kg === 'number') weights.push({ key, value: fromKg(kg, unit) });
  }

  const weightChange =
    weights.length >= 2 ? weights[weights.length - 1]!.value - weights[0]!.value : null;

  const summary: WeeklySummary = {
    strain: average(strains),
    calories: average(calories),
    protein: average(proteins),
    recovery: average(recoveries),
    weightChange,
    observation: null,
  };

  summary.observation = observationFor(week, whoopByDay, nutrition, summary);

  return summary;
}

/**
 * At most one observation, and only one worth reading.
 *
 * Checked in order of how actionable they are. Each requires enough days to be
 * more than coincidence, and none tells the user to eat less — the same rule
 * the recovery guidance follows, for the same reason.
 */
function observationFor(
  week: Date[],
  whoopByDay: Map<string, WhoopDay>,
  nutrition: DayNutrition | undefined,
  summary: WeeklySummary,
): string | null {
  const paired: { strain: number; calories: number }[] = [];

  for (const date of week) {
    const key = localDayKey(date);
    const strain = whoopByDay.get(key)?.strain;
    const eaten = nutrition?.[key];
    if (typeof strain === 'number' && eaten && eaten.calories > 0) {
      paired.push({ strain, calories: eaten.calories });
    }
  }

  if (paired.length < MIN_DAYS_FOR_OBSERVATION) return null;

  // Did the hardest days coincide with the lightest eating? Split at the
  // median strain rather than a fixed threshold, so this works for anyone's
  // training load rather than only for heavy trainers.
  const sortedByStrain = [...paired].sort((a, b) => a.strain - b.strain);
  const midpoint = Math.floor(sortedByStrain.length / 2);
  const easier = sortedByStrain.slice(0, midpoint);
  const harder = sortedByStrain.slice(sortedByStrain.length - midpoint);

  if (easier.length > 0 && harder.length > 0) {
    const easierAvg = easier.reduce((s, d) => s + d.calories, 0) / easier.length;
    const harderAvg = harder.reduce((s, d) => s + d.calories, 0) / harder.length;

    // 150 kcal is about the smallest gap that is not just logging noise.
    if (easierAvg - harderAvg > 150) {
      return `Your harder days averaged ${Math.round(easierAvg - harderAvg).toLocaleString()} calories less than your easier ones. Eating a little more on training days tends to support recovery better than the reverse.`;
    }

    if (harderAvg - easierAvg > 150) {
      return `You ate more on your harder days than your easier ones — roughly ${Math.round(harderAvg - easierAvg).toLocaleString()} calories more. That is the direction you would generally want.`;
    }
  }

  if (summary.recovery.average !== null && summary.recovery.days >= MIN_DAYS_FOR_OBSERVATION) {
    if (summary.recovery.average >= 67) {
      return 'Recovery held in the green most of the week, so whatever you did is working.';
    }
    if (summary.recovery.average < 34) {
      return 'Recovery sat low for most of the week. Sleep and fuelling are the usual places to look before training load.';
    }
  }

  return 'Calories stayed fairly even across easy and hard days this week.';
}
