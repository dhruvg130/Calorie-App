import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import { GUIDANCE_DISCLAIMER, recoveryGuidance } from '@/lib/recoveryGuidance';
import { colors, radius, spacing } from '@/theme';

type RecoveryGuidanceCardProps = {
  recoveryScore: number;
  dailyGoal: number;
};

const BAND_COLOR = {
  green: colors.primary,
  yellow: colors.warning,
  red: colors.danger,
} as const;

const BAND_TINT = {
  green: colors.primaryLight,
  yellow: colors.warningLight,
  red: colors.dangerLight,
} as const;

/**
 * The recovery score turned into something actionable.
 *
 * A number on its own asks the user to know what 43% means. This says what to
 * do about it, which is the whole point of pulling the data in.
 */
export function RecoveryGuidanceCard({ recoveryScore, dailyGoal }: RecoveryGuidanceCardProps) {
  const guidance = recoveryGuidance(recoveryScore, dailyGoal);
  const accent = BAND_COLOR[guidance.band];

  return (
    <Card style={styles.card}>
      <View style={styles.headerRow}>
        <View style={[styles.scorePill, { backgroundColor: BAND_TINT[guidance.band] }]}>
          <Text variant="captionMedium" style={{ color: accent }}>
            {recoveryScore}%
          </Text>
        </View>
        <Text variant="bodyMedium">{guidance.headline}</Text>
      </View>

      <Text variant="body" color="secondary">
        {guidance.detail}
      </Text>

      <View style={styles.focusRow}>
        {guidance.focus.map((item) => (
          <View key={item} style={styles.chip}>
            <Text variant="caption" color="secondary">
              {item}
            </Text>
          </View>
        ))}
      </View>

      <Text variant="caption" color="tertiary">
        {GUIDANCE_DISCLAIMER}
      </Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  scorePill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  focusRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  chip: {
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.full,
  },
});
