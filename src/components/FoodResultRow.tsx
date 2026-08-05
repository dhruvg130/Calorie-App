import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { useColors } from '@/providers/ThemeProvider';
import type { NutritionItem } from '@/services/nutrition';
import { makeStyles, radius, shadows, spacing } from '@/theme';

type FoodResultRowProps = {
  item: NutritionItem;
  onPress: (item: NutritionItem) => void;
};

export function FoodResultRow({ item, onPress }: FoodResultRowProps) {
  const colors = useColors();
  const styles = useStyles();

  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${item.name}, ${Math.round(item.caloriesPerServing)} calories per ${item.servingUnit}`}
    >
      <View style={styles.details}>
        <Text variant="bodyMedium" numberOfLines={2}>
          {item.name}
        </Text>
        <Text variant="caption" color="tertiary" numberOfLines={1}>
          {item.brand ? `${item.brand} · ` : ''}
          {item.servingUnit}
        </Text>
      </View>

      <View style={styles.trailing}>
        <Text variant="subheading">{Math.round(item.caloriesPerServing).toLocaleString()}</Text>
        <Ionicons name="add-circle-outline" size={20} color={colors.primary} />
      </View>
    </Pressable>
  );
}

const useStyles = makeStyles((colors) => ({
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
  details: {
    flex: 1,
    gap: 2,
  },
  trailing: {
    alignItems: 'center',
    gap: spacing.xs,
  },
}));
