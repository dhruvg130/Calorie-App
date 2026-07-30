import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { Banner, Button, Card, Input, Text } from '@/components/ui';
import {
  LIMITS,
  firstIssue,
  foodEntrySchema,
  parseNumericInput,
} from '@/lib/validation';
import { colors, radius, spacing } from '@/theme';

export type ServingFormValues = {
  name: string;
  caloriesPerServing: number;
  servingQuantity: number;
  servingUnit: string;
};

type ServingFormProps = {
  initial: ServingFormValues & { brand?: string | null };
  submitLabel: string;
  submitting: boolean;
  formError?: string | null;
  onSubmit: (values: ServingFormValues) => void;
  footer?: React.ReactNode;
};

/** Steps that feel natural for "how much of this did I eat". */
const QUANTITY_STEPS = [0.5, 1, 1.5, 2];

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
  const [name, setName] = useState(initial.name);
  const [calories, setCalories] = useState(String(initial.caloriesPerServing));
  const [quantity, setQuantity] = useState(String(initial.servingQuantity));
  const [unit, setUnit] = useState(initial.servingUnit);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});

  const parsedCalories = parseNumericInput(calories);
  const parsedQuantity = parseNumericInput(quantity);

  // Recomputed on every keystroke so the number the user sees is the number
  // that will be saved — the database computes the same product.
  const total = useMemo(() => {
    if (parsedCalories === null || parsedQuantity === null) return null;
    return Math.round(parsedCalories * parsedQuantity);
  }, [parsedCalories, parsedQuantity]);

  const handleSubmit = () => {
    if (submitting) return;

    const candidate = {
      name,
      caloriesPerServing: parsedCalories ?? Number.NaN,
      servingQuantity: parsedQuantity ?? Number.NaN,
      servingUnit: unit,
      source: 'manual' as const,
    };

    const parsed = foodEntrySchema.safeParse(candidate);
    if (!parsed.success) {
      setErrors({
        name: firstIssue(parsed.error, 'name'),
        caloriesPerServing: firstIssue(parsed.error, 'caloriesPerServing'),
        servingQuantity: firstIssue(parsed.error, 'servingQuantity'),
        servingUnit: firstIssue(parsed.error, 'servingUnit'),
      });
      return;
    }

    setErrors({});
    onSubmit({
      name: parsed.data.name,
      caloriesPerServing: parsed.data.caloriesPerServing,
      servingQuantity: parsed.data.servingQuantity,
      servingUnit: parsed.data.servingUnit,
    });
  };

  return (
    <View style={styles.container}>
      <Card elevation="md" style={styles.totalCard}>
        <Text variant="overline" color="secondary">
          Total
        </Text>
        <View style={styles.totalRow}>
          <Text variant="display">{total === null ? '—' : total.toLocaleString()}</Text>
          <Text variant="body" color="secondary" style={styles.totalUnit}>
            cal
          </Text>
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
          Servings
        </Text>

        <View style={styles.chipRow}>
          {QUANTITY_STEPS.map((step) => {
            const active = parsedQuantity === step;
            return (
              <Pressable
                key={step}
                onPress={() => setQuantity(String(step))}
                disabled={submitting}
                style={[styles.chip, active && styles.chipActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                accessibilityLabel={`${step} servings`}
              >
                <Text variant="captionMedium" color={active ? 'inverse' : 'secondary'}>
                  {step}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.pairRow}>
          <Input
            containerStyle={styles.pairItem}
            label="Amount"
            value={quantity}
            onChangeText={setQuantity}
            error={errors.servingQuantity}
            keyboardType="decimal-pad"
            editable={!submitting}
            maxLength={6}
          />
          <Input
            containerStyle={styles.pairItem}
            label="Serving"
            value={unit}
            onChangeText={setUnit}
            error={errors.servingUnit}
            maxLength={LIMITS.servingUnitMax}
            editable={!submitting}
            placeholder="100 g"
          />
        </View>
      </View>

      <Input
        label="Calories per serving"
        value={calories}
        onChangeText={setCalories}
        error={errors.caloriesPerServing}
        keyboardType="decimal-pad"
        editable={!submitting}
        maxLength={7}
        right={<Ionicons name="flame-outline" size={18} color={colors.textTertiary} />}
      />

      {formError ? <Banner message={formError} /> : null}

      <Button label={submitLabel} onPress={handleSubmit} loading={submitting} />

      {footer}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  totalCard: {
    gap: spacing.xs,
  },
  totalRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
  },
  totalUnit: {
    marginBottom: spacing.xs,
  },
  quantitySection: {
    gap: spacing.sm,
  },
  quantityLabel: {
    marginLeft: spacing.xs,
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
  pairRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  pairItem: {
    flex: 1,
  },
});
