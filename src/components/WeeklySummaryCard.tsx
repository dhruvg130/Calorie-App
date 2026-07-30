import { StyleSheet, View } from 'react-native';

import { Card, Text } from '@/components/ui';
import type { WeeklyMetric, WeeklySummary } from '@/lib/weeklySummary';
import type { WeightUnit } from '@/lib/database.types';
import { colors, spacing } from '@/theme';

type WeeklySummaryCardProps = {
  summary: WeeklySummary;
  unit: WeightUnit;
};

/**
 * The week at a glance.
 *
 * Each figure shows how many days it came from. A seven-day average built on
 * two days is not the same claim as one built on seven, and the user is the one
 * who should get to judge that — so the denominator is on the card rather than
 * buried in a tooltip nobody opens.
 */
export function WeeklySummaryCard({ summary, unit }: WeeklySummaryCardProps) {
  const { strain, calories, protein, recovery, weightChange, observation } = summary;

  const hasAnything =
    strain.days > 0 || calories.days > 0 || recovery.days > 0 || weightChange !== null;

  if (!hasAnything) {
    return (
      <Card style={styles.card}>
        <Text variant="overline" color="secondary">
          This week
        </Text>
        <Text variant="body" color="secondary">
          Nothing logged in the last seven days yet. Log food and wear your WHOOP and this fills in.
        </Text>
      </Card>
    );
  }

  return (
    <Card style={styles.card}>
      <Text variant="overline" color="secondary">
        This week
      </Text>

      <View style={styles.grid}>
        <Metric label="Avg strain" metric={strain} format={(v) => v.toFixed(1)} />
        <Metric
          label="Avg calories"
          metric={calories}
          format={(v) => Math.round(v).toLocaleString()}
        />
        <Metric label="Avg protein" metric={protein} format={(v) => `${Math.round(v)} g`} />
        <Metric label="Avg recovery" metric={recovery} format={(v) => `${Math.round(v)}%`} />

        <View style={styles.metric}>
          <Text variant="caption" color="tertiary">
            Weight
          </Text>
          <Text
            variant="bodyMedium"
            color={weightChange !== null && weightChange > 0 ? 'over' : 'default'}
          >
            {weightChange === null
              ? '—'
              : `${weightChange > 0 ? '+' : weightChange < 0 ? '−' : ''}${Math.abs(weightChange).toFixed(1)} ${unit}`}
          </Text>
        </View>
      </View>

      {observation ? (
        <View style={styles.observation}>
          <Text variant="body" color="secondary">
            {observation}
          </Text>
        </View>
      ) : (
        <Text variant="caption" color="tertiary">
          A few more logged days and this will start spotting patterns.
        </Text>
      )}
    </Card>
  );
}

function Metric({
  label,
  metric,
  format,
}: {
  label: string;
  metric: WeeklyMetric;
  format: (value: number) => string;
}) {
  return (
    <View style={styles.metric}>
      <Text variant="caption" color="tertiary">
        {label}
      </Text>
      <Text variant="bodyMedium">{metric.average === null ? '—' : format(metric.average)}</Text>
      {metric.days > 0 ? (
        <Text variant="caption" color="tertiary">
          {metric.days} {metric.days === 1 ? 'day' : 'days'}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.lg,
  },
  metric: {
    width: '33.33%',
    gap: 2,
  },
  observation: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.md,
  },
});
