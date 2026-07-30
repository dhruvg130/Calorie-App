import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, ProgressBar, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

export type Macros = { proteinG: number; carbsG: number; fatG: number };

type CalorieSummaryCardProps = {
  consumed: number;
  goal: number;
  remaining: number;
  progress: number;
  isOver: boolean;
  macros: Macros;
  onEditGoal: () => void;
  /**
   * Calories burned in training, from WHOOP. Shown as its own line and
   * deliberately NOT added to `goal` or `remaining`: wearable burn estimates run
   * high, and silently raising the target would eat the deficit the goal exists
   * to create. The number is here to be looked at, not to move the maths.
   */
  earned?: number;
};

const formatNumber = (value: number) => value.toLocaleString();

export function CalorieSummaryCard({
  consumed,
  goal,
  remaining,
  progress,
  isOver,
  macros,
  onEditGoal,
  earned = 0,
}: CalorieSummaryCardProps) {
  // Sources report macros inconsistently, so a day can have calories but no
  // macro data. Showing three zeroes would look like a bug; hide the row.
  const hasMacros = macros.proteinG > 0 || macros.carbsG > 0 || macros.fatG > 0;
  return (
    <Card elevation="md" style={styles.card}>
      <View style={styles.headerRow}>
        <Text variant="overline" color="secondary">
          {isOver ? 'Over by' : 'Remaining'}
        </Text>

        <Pressable
          onPress={onEditGoal}
          hitSlop={10}
          style={styles.goalPill}
          accessibilityRole="button"
          accessibilityLabel={`Daily goal ${goal} calories. Tap to change.`}
        >
          <Text variant="captionMedium" color="secondary">
            Goal {formatNumber(goal)}
          </Text>
          <Ionicons name="chevron-forward" size={13} color={colors.textTertiary} />
        </Pressable>
      </View>

      <View style={styles.figureRow}>
        <Text variant="display" color={isOver ? 'over' : 'default'}>
          {formatNumber(Math.abs(remaining))}
        </Text>
        <Text variant="body" color="secondary" style={styles.unit}>
          cal
        </Text>
      </View>

      <ProgressBar
        progress={progress}
        accessibilityLabel={`${formatNumber(consumed)} of ${formatNumber(goal)} calories consumed`}
      />

      <View style={styles.statsRow}>
        <Stat label="Eaten" value={formatNumber(consumed)} />
        <View style={styles.divider} />
        <Stat label="Goal" value={formatNumber(goal)} />
        {earned > 0 ? (
          <>
            <View style={styles.divider} />
            <Stat label="Burned" value={formatNumber(Math.round(earned))} />
          </>
        ) : null}
      </View>

      {hasMacros ? (
        <View style={styles.macroRow}>
          <Macro label="Protein" grams={macros.proteinG} />
          <Macro label="Carbs" grams={macros.carbsG} />
          <Macro label="Fat" grams={macros.fatG} />
        </View>
      ) : null}
    </Card>
  );
}

function Macro({ label, grams }: { label: string; grams: number }) {
  return (
    <View style={styles.macro}>
      <Text variant="caption" color="tertiary">
        {label}
      </Text>
      <Text variant="bodyMedium">{Math.round(grams)}g</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="caption" color="tertiary">
        {label}
      </Text>
      <Text variant="subheading">{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.lg,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
    borderRadius: radius.full,
  },
  figureRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: -spacing.sm,
  },
  unit: {
    marginBottom: spacing.xs,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.lg,
    marginTop: -spacing.xs,
  },
  macro: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stat: {
    flex: 1,
    gap: 2,
  },
  divider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
    marginHorizontal: spacing.lg,
  },
});
