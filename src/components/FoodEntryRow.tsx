import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import type { FoodEntry } from '@/api/entries';
import { formatTime } from '@/lib/date';
import { colors, radius, shadows, spacing } from '@/theme';

/** Each entry method gets its own glyph so the list shows provenance at a glance. */
const SOURCE_ICONS: Record<FoodEntry['source'], keyof typeof Ionicons.glyphMap> = {
  search: 'search',
  barcode: 'barcode-outline',
  photo: 'camera-outline',
  manual: 'create-outline',
};

type FoodEntryRowProps = {
  entry: FoodEntry;
  onPress: (entry: FoodEntry) => void;
};

export function FoodEntryRow({ entry, onPress }: FoodEntryRowProps) {
  const servingLabel = `${formatQuantity(entry.servingQuantity)} × ${entry.servingUnit}`;

  return (
    <Pressable
      onPress={() => onPress(entry)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${entry.name}, ${Math.round(entry.totalCalories)} calories`}
      accessibilityHint="Opens this entry to edit or delete it"
    >
      <View style={styles.iconTile}>
        <Ionicons name={SOURCE_ICONS[entry.source]} size={18} color={colors.primary} />
      </View>

      <View style={styles.details}>
        <Text variant="bodyMedium" numberOfLines={1}>
          {entry.name}
        </Text>
        <Text variant="caption" color="tertiary" numberOfLines={1}>
          {entry.brand ? `${entry.brand} · ` : ''}
          {servingLabel} · {formatTime(entry.consumedAt)}
        </Text>
      </View>

      <Text variant="subheading">{Math.round(entry.totalCalories).toLocaleString()}</Text>
    </Pressable>
  );
}

/** Trims trailing zeros so "1 × 100 g" does not read as "1.00 × 100 g". */
function formatQuantity(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(2)));
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
    ...shadows.sm,
  },
  pressed: {
    opacity: 0.7,
  },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: radius.md,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  details: {
    flex: 1,
    gap: 2,
  },
});
