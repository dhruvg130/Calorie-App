import { StyleSheet, View } from 'react-native';

import { Card, ProgressBar, Text } from '@/components/ui';
import type { ProteinTarget } from '@/lib/proteinTarget';
import { spacing } from '@/theme';

type ProteinCardProps = {
  /** Grams eaten so far on the selected day. */
  consumed: number;
  target: ProteinTarget;
};

/**
 * Protein against a target that moves with the day's training.
 *
 * Shown separately from the calorie card rather than as a fourth macro chip:
 * the macro row reports what was eaten, whereas this is a target to hit, and
 * conflating the two would make the other two macros look like goals too.
 */
export function ProteinCard({ consumed, target }: ProteinCardProps) {
  const eaten = Math.round(consumed);
  const remaining = Math.max(0, target.grams - eaten);
  const met = eaten >= target.grams;

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <Text variant="overline" color="secondary">
          Protein
        </Text>
        <Text variant="caption" color="tertiary">
          {target.basis} · {target.gPerKg} g/kg
        </Text>
      </View>

      <View style={styles.figureRow}>
        <Text variant="subheading">{eaten}</Text>
        <Text variant="body" color="secondary">
          / {target.grams} g
        </Text>
      </View>

      <ProgressBar
        progress={target.grams > 0 ? eaten / target.grams : 0}
        accessibilityLabel={`${eaten} of ${target.grams} grams of protein`}
      />

      <Text variant="caption" color={met ? 'primary' : 'tertiary'}>
        {met ? 'Target met.' : `${remaining} g to go.`}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  figureRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
});
