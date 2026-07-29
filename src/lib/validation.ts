import { z } from 'zod';

/**
 * Every bound below is duplicated as a Postgres CHECK constraint in
 * `supabase/migrations/0001_init.sql`. The zod schema exists for fast, helpful
 * feedback in the UI; the constraint is the actual enforcement, because a
 * client-side rule is only a suggestion to anyone holding the anon key.
 * If you change a limit here, change it there too.
 */
export const LIMITS = {
  nameMax: 200,
  brandMax: 120,
  servingUnitMax: 60,
  caloriesPerServingMax: 10_000,
  servingQuantityMin: 0.01,
  servingQuantityMax: 100,
  macroMax: 5_000,
  goalMin: 500,
  goalMax: 10_000,
  weightKgMin: 20,
  weightKgMax: 500,
  passwordMin: 8,
  passwordMax: 72, // bcrypt truncates beyond 72 bytes; reject rather than silently cut
} as const;

/**
 * Collapses runs of whitespace and strips control characters (including the
 * bidi overrides that can be used to make a name render deceptively). Applied
 * to every free-text field before it reaches the database.
 */
/** C0 controls, DEL, and C1 controls. */
const INVISIBLE_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;
/** Zero-width chars, directionality marks, bidi overrides/isolates, and BOM. */
const BIDI_AND_ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2066-\u2069\uFEFF]/g;

function sanitizeText(value: string): string {
  return value
    .replace(INVISIBLE_CHARS, '')
    .replace(BIDI_AND_ZERO_WIDTH, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const cleanString = (max: number) =>
  z.string().transform(sanitizeText).pipe(z.string().min(1).max(max));

const optionalCleanString = (max: number) =>
  z
    .string()
    .transform(sanitizeText)
    .pipe(z.string().max(max))
    .transform((value) => (value.length === 0 ? null : value))
    .nullable();

/**
 * Rejects NaN and ±Infinity, which `Number('')`/`parseFloat` happily produce
 * from text input and which Postgres numeric columns will not accept.
 */
const finiteNumber = z.number().refine(Number.isFinite, 'Enter a valid number');

const roundTo2 = (value: number) => Math.round(value * 100) / 100;

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export const emailSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.email('Enter a valid email address').max(254));

export const passwordSchema = z
  .string()
  .min(LIMITS.passwordMin, `Password must be at least ${LIMITS.passwordMin} characters`)
  .max(LIMITS.passwordMax, 'Password is too long')
  .refine((value) => /[A-Za-z]/.test(value) && /[0-9]/.test(value), {
    message: 'Password must include at least one letter and one number',
  });

export const signInSchema = z.object({
  email: emailSchema,
  // Sign-in must not re-run signup strength rules: an account created under an
  // older policy still needs to be able to log in.
  password: z.string().min(1, 'Enter your password'),
});

export const signUpSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
});

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;

// ---------------------------------------------------------------------------
// Food entries
// ---------------------------------------------------------------------------

const macroSchema = finiteNumber
  .min(0, 'Cannot be negative')
  .max(LIMITS.macroMax)
  .transform(roundTo2)
  .nullable();

export const foodEntrySchema = z.object({
  name: cleanString(LIMITS.nameMax),
  brand: optionalCleanString(LIMITS.brandMax).default(null),
  caloriesPerServing: finiteNumber
    .min(0, 'Calories cannot be negative')
    .max(LIMITS.caloriesPerServingMax, 'That is more calories than one serving can hold')
    .transform(roundTo2),
  servingQuantity: finiteNumber
    .gt(0, 'Serving size must be greater than zero')
    .max(LIMITS.servingQuantityMax, `Serving size must be ${LIMITS.servingQuantityMax} or less`)
    .transform(roundTo2),
  servingUnit: cleanString(LIMITS.servingUnitMax),
  proteinG: macroSchema.default(null),
  carbsG: macroSchema.default(null),
  fatG: macroSchema.default(null),
  source: z.enum(['search', 'barcode', 'photo', 'manual']),
  barcode: z
    .string()
    .regex(/^[0-9]{6,14}$/, 'Invalid barcode')
    .nullable()
    .default(null),
  consumedAt: z.date().default(() => new Date()),
});

export type FoodEntryInput = z.infer<typeof foodEntrySchema>;

/** Kilograms. Mirrors the weight_entries_range CHECK constraint. */
export const weightSchema = z
  .number()
  .refine(Number.isFinite, 'Enter a valid weight')
  .min(LIMITS.weightKgMin, 'That weight seems too low')
  .max(LIMITS.weightKgMax, 'That weight seems too high')
  .transform((value) => Math.round(value * 100) / 100);

export const dailyGoalSchema = z
  .number()
  .int('Enter a whole number')
  .min(LIMITS.goalMin, `Goal must be at least ${LIMITS.goalMin} calories`)
  .max(LIMITS.goalMax, `Goal must be ${LIMITS.goalMax} calories or less`);

/**
 * Text inputs hand back strings; this turns one into a number without the
 * footguns of `Number('')` (0) or `parseFloat('12abc')` (12).
 */
export function parseNumericInput(raw: string): number | null {
  const trimmed = raw.trim().replace(',', '.');
  if (trimmed === '' || !/^\d*\.?\d*$/.test(trimmed)) return null;
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : null;
}

/** First error message for a field, or undefined when the field is valid. */
export function firstIssue(error: z.ZodError, path: string): string | undefined {
  return error.issues.find((issue) => issue.path[0] === path)?.message;
}
