import { supabase } from '@/lib/supabase';
import type { FoodEntryRow } from '@/lib/database.types';
import { localDayRange } from '@/lib/date';
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
  barcode: string | null;
  imagePath: string | null;
  consumedAt: string;
};

/**
 * Must stay a single string literal — supabase-js parses it at the type level
 * to infer the row shape, and concatenation collapses that to an error type.
 */
const COLUMNS =
  'id, name, brand, calories_per_serving, serving_quantity, serving_unit, total_calories, protein_g, carbs_g, fat_g, source, barcode, image_path, consumed_at' as const;

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
  input: FoodEntryInput & { imagePath?: string | null },
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
