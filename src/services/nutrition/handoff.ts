import { z } from 'zod';

import type { NutritionItem } from './types';

/**
 * Carries a chosen food from search/scan/photo to the confirm screen.
 *
 * It travels as a JSON route parameter rather than module state so the confirm
 * screen stays a pure function of its route — surviving remounts, back
 * navigation and Fast Refresh. Because a route param is untrusted input by the
 * time we read it back, it is re-validated rather than cast.
 */
const handoffSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(200),
  brand: z.string().max(120).nullable(),
  caloriesPerServing: z.number().min(0).max(10_000),
  servingQuantity: z.number().gt(0).max(100),
  servingUnit: z.string().min(1).max(60),
  proteinG: z.number().min(0).nullable(),
  carbsG: z.number().min(0).nullable(),
  fatG: z.number().min(0).nullable(),
  source: z.enum(['search', 'barcode', 'photo', 'manual']),
  barcode: z
    .string()
    .regex(/^[0-9]{6,14}$/)
    .nullable()
    .optional(),
});

export type HandoffItem = z.infer<typeof handoffSchema>;

export function encodeHandoff(item: NutritionItem | HandoffItem): string {
  return JSON.stringify(item);
}

/** Returns null for anything malformed, so the screen can show a clean error. */
export function decodeHandoff(raw: string | string[] | undefined): HandoffItem | null {
  if (typeof raw !== 'string' || raw.length === 0) return null;

  try {
    const parsed = handoffSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
