import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, View } from 'react-native';

import { Card, ProgressBar, Text } from '@/components/ui';
import { colors, radius, spacing } from '@/theme';

type CalorieSummaryCardProps = {
  consumed: number;
  goal: number;
  remaining: number;
  progress: number;
  isOver: boolean;
  onEditGoal: () => void;
};

const formatNumber = (value: number) => value.toLocaleString();

export function CalorieSummaryCard({
  consumed,
  goal,
  remaining,
  progress,
  isOver,
  onEditGoal,
}: CalorieSummaryCardProps) {
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
      </View>
    </Card>
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
