import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import type { MealType } from '@/lib/database.types';
import { colors, radius, spacing } from '@/theme';

export const MEAL_TYPES: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

export const MEAL_LABELS: Record<MealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
};

/** Best guess from the clock, so the common case needs no tap at all. */
export function suggestMealType(date: Date = new Date()): MealType {
  const hour = date.getHours();
  if (hour < 11) return 'breakfast';
  if (hour < 15) return 'lunch';
  if (hour < 21) return 'dinner';
  return 'snack';
}

type MealTypePickerProps = {
  value: MealType | null;
  onChange: (value: MealType | null) => void;
  label?: string;
};

export function MealTypePicker({ value, onChange, label = 'Meal' }: MealTypePickerProps) {
  return (
    <View style={styles.container}>
      <Text variant="captionMedium" color="secondary" style={styles.label}>
        {label}
      </Text>

      <View style={styles.row}>
        {MEAL_TYPES.map((meal) => {
          const selected = value === meal;
          return (
            <Pressable
              key={meal}
              // Tapping the selected chip clears it — a meal is optional, and
              // there would otherwise be no way back to "unset".
              onPress={() => onChange(selected ? null : meal)}
              style={[styles.chip, selected && styles.chipSelected]}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              accessibilityLabel={MEAL_LABELS[meal]}
            >
              <Text
                variant="captionMedium"
                color={selected ? 'inverse' : 'secondary'}
                numberOfLines={1}
              >
                {MEAL_LABELS[meal]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xs,
  },
  label: {
    marginLeft: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  chip: {
    flex: 1,
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
});
