import { supabase } from '@/lib/supabase';
import type { FoodEntryRow, MealType } from '@/lib/database.types';
import { localDayKey, localDayRange, rangeForDays } from '@/lib/date';
import { foodEntrySchema, type FoodEntryInput } from '@/lib/validation';

/** Camel-cased view of a row, so screens never touch snake_case column names. */
export type FoodEntry = {
  id: string;
  name: string;
  brand: string | null;
  caloriesPerServing: number;
  servingQuantity: number;
  servingUnit: string;
  totalCalories: number;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
  source: FoodEntryRow['source'];
  mealType: MealType | null;
  barcode: string | null;
  imagePath: string | null;
  consumedAt: string;
};

/**
 * Must stay a single string literal — supabase-js parses it at the type level
 * to infer the row shape, and concatenation collapses that to an error type.
 */
const COLUMNS =
  'id, name, brand, calories_per_serving, serving_quantity, serving_unit, total_calories, protein_g, carbs_g, fat_g, source, meal_type, barcode, image_path, consumed_at' as const;

/** The subset of a row that `COLUMNS` actually selects. */
type SelectedRow = Pick<
  FoodEntryRow,
  | 'id'
  | 'name'
  | 'brand'
  | 'calories_per_serving'
  | 'serving_quantity'
  | 'serving_unit'
  | 'total_calories'
  | 'protein_g'
  | 'carbs_g'
  | 'fat_g'
  | 'source'
  | 'meal_type'
  | 'barcode'
  | 'image_path'
  | 'consumed_at'
>;

/**
 * Postgres `numeric` arrives as a string from PostgREST when it exceeds the
 * safe float range, and as a number otherwise. Normalising here keeps the
 * arithmetic in the UI honest.
 */
function toNumber(value: number | string): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toNullableNumber(value: number | string | null): number | null {
  return value === null ? null : toNumber(value);
}

function mapRow(row: SelectedRow): FoodEntry {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    caloriesPerServing: toNumber(row.calories_per_serving),
    servingQuantity: toNumber(row.serving_quantity),
    servingUnit: row.serving_unit,
    totalCalories: toNumber(row.total_calories),
    proteinG: toNullableNumber(row.protein_g),
    carbsG: toNullableNumber(row.carbs_g),
    fatG: toNullableNumber(row.fat_g),
    source: row.source,
    mealType: row.meal_type,
    barcode: row.barcode,
    imagePath: row.image_path,
    consumedAt: row.consumed_at,
  };
}

/**
 * Entries for one local calendar day.
 *
 * Note there is no `.eq('user_id', …)` filter: RLS scopes the result to the
 * caller. Adding one would imply the client is what enforces isolation, which
 * it is not — and it would silently return nothing if it ever disagreed with
 * the session.
 */
export async function fetchEntriesForDay(date: Date = new Date()): Promise<FoodEntry[]> {
  const { from, to } = localDayRange(date);

  const { data, error } = await supabase
    .from('food_entries')
    .select(COLUMNS)
    .gte('consumed_at', from)
    .lt('consumed_at', to)
    .order('consumed_at', { ascending: false });

  if (error) throw error;
  return data.map(mapRow);
}

export async function fetchEntry(id: string): Promise<FoodEntry> {
  const { data, error } = await supabase
    .from('food_entries')
    .select(COLUMNS)
    .eq('id', id)
    .single();

  if (error) throw error;
  return mapRow(data);
}

/**
 * `user_id` is deliberately not sent. The column defaults to `auth.uid()` and
 * the RLS INSERT policy rejects any value that disagrees with the session, so
 * ownership is decided by the database rather than asserted by the client.
 *
 * `total_calories` is likewise absent — it is a generated column.
 */
export async function createEntry(
  input: FoodEntryInput & { imagePath?: string | null; mealType?: MealType | null },
): Promise<FoodEntry> {
  const validated = foodEntrySchema.parse(input);

  const { data, error } = await supabase
    .from('food_entries')
    .insert({
      name: validated.name,
      brand: validated.brand,
      calories_per_serving: validated.caloriesPerServing,
      serving_quantity: validated.servingQuantity,
      serving_unit: validated.servingUnit,
      protein_g: validated.proteinG,
      carbs_g: validated.carbsG,
      fat_g: validated.fatG,
      source: validated.source,
      meal_type: input.mealType ?? null,
      barcode: validated.barcode,
      image_path: input.imagePath ?? null,
      consumed_at: validated.consumedAt.toISOString(),
    })
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(data);
}

export type UpdateEntryInput = {
  name: string;
  caloriesPerServing: number;
  servingQuantity: number;
  servingUnit: string;
  mealType?: MealType | null;
};

export async function updateEntry(id: string, input: UpdateEntryInput): Promise<FoodEntry> {
  // Re-validate on edit with the same schema used on create; `source` and
  // `barcode` are not editable, so they are filled with valid placeholders that
  // the update below never sends.
  const validated = foodEntrySchema.parse({ ...input, source: 'manual' });

  const { data, error } = await supabase
    .from('food_entries')
    .update({
      name: validated.name,
      calories_per_serving: validated.caloriesPerServing,
      serving_quantity: validated.servingQuantity,
      serving_unit: validated.servingUnit,
      ...(input.mealType === undefined ? {} : { meal_type: input.mealType }),
    })
    .eq('id', id)
    .select(COLUMNS)
    .single();

  if (error) throw error;
  return mapRow(data);
}

export async function deleteEntry(id: string): Promise<void> {
  const { error } = await supabase.from('food_entries').delete().eq('id', id);
  if (error) throw error;
}

/** Calories logged per local day, keyed by `YYYY-MM-DD`. */
export type DayTotals = Record<string, number>;

/**
 * Totals for every day in a range, used to draw the calendar's goal rings.
 *
 * Fetches only the two columns needed and aggregates on the device rather than
 * adding a Postgres RPC: a visible month is at most a few hundred rows, the
 * (user_id, consumed_at) index already serves this shape, and grouping here
 * keeps day boundaries in the device's timezone — which is how the rest of the
 * app defines a day. A SQL `date_trunc` would group in UTC and disagree with
 * the Home screen near midnight.
 *
 * RLS scopes the rows to the caller, so there is no user_id filter.
 */
export async function fetchDayTotals(days: Date[]): Promise<DayTotals> {
  if (days.length === 0) return {};

  const { from, to } = rangeForDays(days);

  const { data, error } = await supabase
    .from('food_entries')
    .select('consumed_at, total_calories')
    .gte('consumed_at', from)
    .lt('consumed_at', to);

  if (error) throw error;

  const totals: DayTotals = {};
  for (const row of data) {
    const key = localDayKey(new Date(row.consumed_at));
    totals[key] = (totals[key] ?? 0) + toNumber(row.total_calories);
  }
  return totals;
}

/** Calories and protein logged per local day, keyed by `YYYY-MM-DD`. */
export type DayNutrition = Record<string, { calories: number; proteinG: number }>;

/**
 * Like `fetchDayTotals`, but carrying protein as well.
 *
 * Kept separate rather than widened into `fetchDayTotals` because that one
 * feeds the calendar's rings on every month change and has no use for macros —
 * there is no reason to pull two extra columns on the hot path to serve the
 * weekly summary.
 *
 * Protein is stored per serving, so it is scaled by the serving multiplier
 * here, exactly as `useDayTotals` does. Entries whose source reported no
 * protein contribute nothing rather than zero.
 */
export async function fetchDayNutrition(days: Date[]): Promise<DayNutrition> {
  if (days.length === 0) return {};

  const { from, to } = rangeForDays(days);

  const { data, error } = await supabase
    .from('food_entries')
    .select('consumed_at, total_calories, protein_g, serving_quantity')
    .gte('consumed_at', from)
    .lt('consumed_at', to);

  if (error) throw error;

  const totals: DayNutrition = {};
  for (const row of data) {
    const key = localDayKey(new Date(row.consumed_at));
    const bucket = totals[key] ?? { calories: 0, proteinG: 0 };

    bucket.calories += toNumber(row.total_calories);

    const perServing = toNullableNumber(row.protein_g);
    if (perServing !== null) {
      bucket.proteinG += perServing * toNumber(row.serving_quantity);
    }

    totals[key] = bucket;
  }
  return totals;
}

/**
 * Distinct foods the user has logged before, most recent first.
 *
 * People eat the same twenty things, so this turns the common case from
 * "search, scroll, pick, adjust, save" into one tap.
 *
 * Deduplication happens on the device rather than with a Postgres
 * `distinct on`: PostgREST cannot express that, and the alternative is an RPC
 * for what a single indexed scan plus a Map already answers. We over-fetch a
 * fixed window and collapse it, which is bounded work.
 *
 * The key is name+brand+calories rather than name alone, so "Greek yogurt,
 * 61 kcal" and "Greek yogurt, 120 kcal" stay distinct — they are genuinely
 * different foods to log.
 */
export async function fetchRecentFoods(limit = 20): Promise<FoodEntry[]> {
  const { data, error } = await supabase
    .from('food_entries')
    .select(COLUMNS)
    .order('consumed_at', { ascending: false })
    // Enough history to find `limit` distinct foods without unbounded reads.
    .limit(200);

  if (error) throw error;

  const seen = new Set<string>();
  const distinct: FoodEntry[] = [];

  for (const row of data) {
    const entry = mapRow(row);
    const key = `${entry.name.toLowerCase()}|${(entry.brand ?? '').toLowerCase()}|${entry.caloriesPerServing}`;
    if (seen.has(key)) continue;
    seen.add(key);
    distinct.push(entry);
    if (distinct.length >= limit) break;
  }

  return distinct;
}
