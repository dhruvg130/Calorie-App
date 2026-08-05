import { Ionicons } from '@expo/vector-icons';
import { Pressable, View } from 'react-native';

import { Card, ProgressBar, Text } from '@/components/ui';
import type { ProteinTarget } from '@/lib/proteinTarget';
import { useColors } from '@/providers/ThemeProvider';
import { makeStyles, radius, spacing } from '@/theme';

type ProteinCardProps = {
  /** Grams eaten so far on the selected day. */
  consumed: number;
  /**
   * The target derived from bodyweight and strain, or null when there is no
   * weight to scale from.
   */
  target: ProteinTarget | null;
  /** A goal the user set by hand. Takes precedence over `target` when present. */
  customGrams?: number | null;
  onEditGoal: () => void;
};

/**
 * Protein against a target that moves with the day's training — unless the
 * user has set their own number, which then wins.
 *
 * Shown separately from the calorie card rather than as a fourth macro chip:
 * the macro row reports what was eaten, whereas this is a target to hit, and
 * conflating the two would make the other two macros look like goals too.
 */
export function ProteinCard({ consumed, target, customGrams, onEditGoal }: ProteinCardProps) {
  const colors = useColors();
  const styles = useStyles();

  const isCustom = typeof customGrams === 'number';
  const grams = isCustom ? customGrams : target?.grams;

  // Nothing to show against: no stored goal and no weight to derive one from.
  if (typeof grams !== 'number' || grams <= 0) return null;

  const eaten = Math.round(consumed);
  const remaining = Math.max(0, grams - eaten);
  const met = eaten >= grams;

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text variant="overline" color="secondary">
          Protein
        </Text>

        <Pressable
          onPress={onEditGoal}
          hitSlop={10}
          style={styles.goalPill}
          accessibilityRole="button"
          accessibilityLabel={`Protein goal ${grams} grams. Tap to change.`}
        >
          <Text variant="caption" color="secondary">
            {isCustom ? 'Your goal' : `${target?.basis} · ${target?.gPerKg} g/kg`}
          </Text>
          <Ionicons name="chevron-forward" size={13} color={colors.textTertiary} />
        </Pressable>
      </View>

      <View style={styles.figureRow}>
        <Text variant="subheading">{eaten}</Text>
        <Text variant="body" color="secondary">
          / {grams} g
        </Text>
      </View>

      <ProgressBar
        progress={eaten / grams}
        accessibilityLabel={`${eaten} of ${grams} grams of protein`}
      />

      <Text variant="caption" color={met ? 'primary' : 'tertiary'}>
        {met ? 'Target met.' : `${remaining} g to go.`}
      </Text>
    </Card>
  );
}

const useStyles = makeStyles((colors) => ({
  card: {
    gap: spacing.sm,
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
    gap: spacing.xs,
  },
}));
