import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import { Banner, Button, Card, Input, Text } from '@/components/ui';
import { MealTypePicker, suggestMealType } from '@/components/MealTypePicker';
import type { MealType } from '@/lib/database.types';
import {
  LIMITS,
  firstIssue,
  foodEntrySchema,
  parseNumericInput,
} from '@/lib/validation';
import { useColors } from '@/providers/ThemeProvider';
import { makeStyles, radius, spacing, typography } from '@/theme';

export type ServingFormValues = {
  name: string;
  caloriesPerServing: number;
  servingQuantity: number;
  servingUnit: string;
  /**
   * Grams per serving, or null when left blank. Null is not zero: it means the
   * protein is unknown, which is why a day with no macro data hides the macro
   * row rather than showing three convincing zeroes.
   */
  proteinG: number | null;
  /** Null when the user clears the suggestion — grouping is optional. */
  mealType: MealType | null;
};

type ServingFormProps = {
  /**
   * `mealType` is optional here: the form suggests one from the time of day,
   * so callers creating a new entry do not have to pick a starting value.
   */
  initial: Omit<ServingFormValues, 'mealType' | 'proteinG'> & {
    brand?: string | null;
    mealType?: MealType | null;
    /** Protein per serving, when the source reported one. Editable. */
    proteinG?: number | null;
  };
  submitLabel: string;
  submitting: boolean;
  formError?: string | null;
  onSubmit: (values: ServingFormValues) => void;
  footer?: React.ReactNode;
};

/** Half a serving is the smallest amount the stepper will go to. */
const MIN_QUANTITY = 0.5;

/**
 * True when a serving is a *thing* ("1 bar", "egg", "slice") rather than a
 * measurement ("100 g", "240 ml").
 *
 * The distinction is what makes one control work for both: you eat one protein
 * bar and three eggs, so those step by whole units, whereas an amount measured
 * out in grams is more naturally nudged by halves.
 *
 * Only the unit *on its own* counts as measured — "1 bar (60 g)" is still a
 * bar, and stepping it by half-grams-of-bar would be nonsense.
 */
const MEASURED_UNIT =
  /^\s*\d*\.?\d*\s*(g|gram|grams|kg|mg|ml|l|liter|litre|litres|liters|oz|ounce|ounces|fl\s?oz|lb|lbs|pound|pounds)\s*$/i;

function isWholeItem(unit: string): boolean {
  return !MEASURED_UNIT.test(unit);
}

/** Trims trailing zeros so the stepper reads "2", not "2.00". */
function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

const clampQuantity = (value: number) =>
  Math.min(Math.max(value, MIN_QUANTITY), LIMITS.servingQuantityMax);

/**
 * The single place a food's serving is adjusted and confirmed. Used by the
 * post-lookup confirm screen and by the edit screen, so the validation, the
 * live total, and the layout cannot drift apart between the two.
 */
export function ServingForm({
  initial,
  submitLabel,
  submitting,
  formError,
  onSubmit,
  footer,
}: ServingFormProps) {
  const colors = useColors();
  const styles = useStyles();

  const [name, setName] = useState(initial.name);
  const [calories, setCalories] = useState(String(initial.caloriesPerServing));
  const [quantity, setQuantity] = useState(String(initial.servingQuantity));
  const [unit, setUnit] = useState(initial.servingUnit);
  // Blank rather than "0" when the source reported nothing, so an untouched
  // field saves as "unknown" instead of as a measured zero.
  const [protein, setProtein] = useState(
    typeof initial.proteinG === 'number' ? String(initial.proteinG) : '',
  );
  // Seeded from the time of day so the common case needs no interaction; the
  // picker is still there when the guess is wrong.
  const [mealType, setMealType] = useState<MealType | null>(
    () => initial.mealType ?? suggestMealType(),
  );
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const parsedCalories = parseNumericInput(calories);
  const parsedQuantity = parseNumericInput(quantity);
  const parsedProtein = parseNumericInput(protein);

  // Recomputed on every keystroke so the number the user sees is the number
  // that will be saved — the database computes the same product.
  const total = useMemo(() => {
    if (parsedCalories === null || parsedQuantity === null) return null;
    return Math.round(parsedCalories * parsedQuantity);
  }, [parsedCalories, parsedQuantity]);

  // Protein is stored per serving and scaled by the multiplier everywhere else
  // in the app, so it is scaled the same way here.
  const totalProtein = useMemo(() => {
    if (parsedProtein === null || parsedQuantity === null) return null;
    return Math.round(parsedProtein * parsedQuantity);
  }, [parsedProtein, parsedQuantity]);

  const wholeItem = isWholeItem(unit);
  const step = wholeItem ? 1 : 0.5;
  // Whole items get a "half" option up front, because half a bar is a real
  // thing to eat; measured amounts climb in halves anyway.
  const presets = wholeItem ? [0.5, 1, 2, 3] : [0.5, 1, 1.5, 2];

  const current = parsedQuantity ?? 1;
  const atMinimum = parsedQuantity !== null && parsedQuantity <= MIN_QUANTITY;

  const nudge = (direction: 1 | -1) => {
    if (submitting) return;
    if (parsedQuantity === null) {
      setQuantity('1');
      return;
    }

    // Below one serving the step drops to a half in both modes, so "one bar"
    // can become "half a bar" without a detour through the keyboard.
    const next =
      direction === 1
        ? current < 1
          ? 1
          : current + step
        : current <= 1
          ? current - 0.5
          : current - step;

    setQuantity(formatQuantity(clampQuantity(next)));
  };

  const handleSubmit = () => {
    if (submitting) return;

    // Blank protein is legitimate — it means "unknown". Text that is not a
    // number is not, and must not be quietly stored as unknown either.
    const proteinText = protein.trim();
    if (proteinText !== '' && parsedProtein === null) {
      setErrors({ proteinG: 'Enter a number, or leave it blank' });
      return;
    }

    const candidate = {
      name,
      caloriesPerServing: parsedCalories ?? Number.NaN,
      servingQuantity: parsedQuantity ?? Number.NaN,
      servingUnit: unit,
      proteinG: proteinText === '' ? null : parsedProtein,
      source: 'manual' as const,
    };

    const parsed = foodEntrySchema.safeParse(candidate);
    if (!parsed.success) {
      setErrors({
        name: firstIssue(parsed.error, 'name'),
        caloriesPerServing: firstIssue(parsed.error, 'caloriesPerServing'),
        servingQuantity: firstIssue(parsed.error, 'servingQuantity'),
        servingUnit: firstIssue(parsed.error, 'servingUnit'),
        proteinG: firstIssue(parsed.error, 'proteinG'),
      });
      return;
    }

    setErrors({});
    onSubmit({
      name: parsed.data.name,
      caloriesPerServing: parsed.data.caloriesPerServing,
      servingQuantity: parsed.data.servingQuantity,
      servingUnit: parsed.data.servingUnit,
      proteinG: parsed.data.proteinG,
      mealType,
    });
  };

  return (
    <View style={styles.container}>
      <Card elevation="md" style={styles.totalCard}>
        <Text variant="overline" color="secondary">
          Total
        </Text>
        <View style={styles.totalRow}>
          <View style={styles.totalFigure}>
            <Text variant="display">{total === null ? '—' : total.toLocaleString()}</Text>
            <Text variant="body" color="secondary" style={styles.totalUnit}>
              cal
            </Text>
          </View>

          {/* Hidden rather than shown as zero when the source reported no
              protein — a zero would read as a measurement. */}
          {totalProtein !== null ? (
            <View style={styles.proteinPill}>
              <Text variant="subheading">{totalProtein.toLocaleString()} g</Text>
              <Text variant="caption" color="secondary">
                protein
              </Text>
            </View>
          ) : null}
        </View>
        {initial.brand ? (
          <Text variant="caption" color="tertiary">
            {initial.brand}
          </Text>
        ) : null}
      </Card>

      <Input
        label="Food"
        value={name}
        onChangeText={setName}
        error={errors.name}
        maxLength={LIMITS.nameMax}
        editable={!submitting}
        autoCapitalize="sentences"
      />

      <View style={styles.quantitySection}>
        <Text variant="captionMedium" color="secondary" style={styles.quantityLabel}>
          How much did you eat?
        </Text>

        <View style={styles.stepper}>
          <Pressable
            onPress={() => nudge(-1)}
            disabled={submitting || atMinimum}
            hitSlop={6}
            style={[styles.stepButton, (submitting || atMinimum) && styles.stepButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="Fewer servings"
          >
            <Ionicons name="remove" size={22} color={colors.text} />
          </Pressable>

          <View style={styles.stepperValue}>
            {/* Typed directly as well as stepped, so an odd amount like 1.75
                does not need the buttons tapped at it. */}
            <TextInput
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="decimal-pad"
              editable={!submitting}
              maxLength={6}
              selectTextOnFocus
              style={styles.stepperInput}
              selectionColor={colors.primary}
              accessibilityLabel="Number of servings"
            />
            <Text variant="caption" color="tertiary" numberOfLines={1}>
              × {unit.trim() === '' ? 'serving' : unit}
            </Text>
          </View>

          <Pressable
            onPress={() => nudge(1)}
            disabled={submitting}
            hitSlop={6}
            style={[styles.stepButton, submitting && styles.stepButtonDisabled]}
            accessibilityRole="button"
            accessibilityLabel="More servings"
          >
            <Ionicons name="add" size={22} color={colors.text} />
          </Pressable>
        </View>

        {errors.servingQuantity ? (
          <Text variant="caption" color="danger" style={styles.quantityLabel}>
            {errors.servingQuantity}
          </Text>
        ) : null}

        <View style={styles.chipRow}>
          {presets.map((preset) => {
            const active = parsedQuantity === preset;
            return (
              <Pressable
                key={preset}
                onPress={() => setQuantity(formatQuantity(preset))}
                disabled={submitting}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${preset} servings`}
              >
                <Text variant="captionMedium" color={active ? 'inverse' : 'secondary'}>
                  {preset === 0.5 ? '½' : formatQuantity(preset)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Input
          label="One serving is"
          value={unit}
          onChangeText={setUnit}
          error={errors.servingUnit}
          maxLength={LIMITS.servingUnitMax}
          editable={!submitting}
          placeholder="1 bar, 1 egg, 100 g…"
          hint={
            errors.servingUnit
              ? undefined
              : 'Whatever one of these is — a bar, an egg, or a weight.'
          }
        />
      </View>

      <View style={styles.perServingSection}>
        <Text variant="captionMedium" color="secondary" style={styles.quantityLabel}>
          Per serving
        </Text>

        <View style={styles.pairRow}>
          <Input
            containerStyle={styles.pairItem}
            label="Calories"
            value={calories}
            onChangeText={setCalories}
            error={errors.caloriesPerServing}
            keyboardType="decimal-pad"
            editable={!submitting}
            maxLength={7}
            right={<Ionicons name="flame-outline" size={18} color={colors.textTertiary} />}
          />
          <Input
            containerStyle={styles.pairItem}
            label="Protein (g)"
            value={protein}
            onChangeText={setProtein}
            error={errors.proteinG}
            keyboardType="decimal-pad"
            editable={!submitting}
            maxLength={5}
            placeholder="Optional"
          />
        </View>
      </View>

      <MealTypePicker value={mealType} onChange={setMealType} />

      {formError ? <Banner message={formError} /> : null}

      <View style={styles.submit}>
        <Button label={submitLabel} onPress={handleSubmit} loading={submitting} />
      </View>

      {footer}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    gap: spacing.lg,
  },
  totalCard: {
    gap: spacing.xs,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  totalFigure: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  totalUnit: {
    marginBottom: spacing.xs,
  },
  proteinPill: {
    alignItems: 'flex-end',
    backgroundColor: colors.surfaceMuted,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  quantitySection: {
    gap: spacing.sm,
  },
  quantityLabel: {
    marginLeft: spacing.xs,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: spacing.xs,
  },
  stepButton: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
  },
  stepButtonDisabled: {
    opacity: 0.4,
  },
  stepperValue: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  stepperInput: {
    minWidth: 72,
    textAlign: 'center',
    color: colors.text,
    fontFamily: typography.heading.fontFamily,
    fontSize: typography.heading.fontSize,
    lineHeight: typography.heading.lineHeight,
    fontWeight: '700',
    paddingVertical: 0,
  },
  perServingSection: {
    gap: spacing.sm,
  },
  pairRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  pairItem: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  submit: {
    // The action gets room of its own — with only the container's gap it sat
    // as close to the meal chips as they sit to each other.
    marginTop: spacing.md,
    marginBottom: spacing.sm,
  },
}));
