import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';

import type { DayTotals } from '@/api/entries';
import { fromKg, type WeightEntry } from '@/api/weight';
import type { WhoopDay } from '@/api/whoop';
import { Text } from '@/components/ui';
import { addDays, localDayKey } from '@/lib/date';
import type { WeightUnit } from '@/lib/database.types';
import { colors, radius, spacing } from '@/theme';

type CombinedTrendChartProps = {
  weightEntries: WeightEntry[] | undefined;
  whoopDays: WhoopDay[] | undefined;
  calorieTotals: DayTotals | undefined;
  unit: WeightUnit;
  days?: number;
};

const PADDING = { top: 10, right: 6, bottom: 18, left: 6 };
const WIDTH = 320;
const HEIGHT = 170;

const SERIES_COLOR = {
  strain: colors.primary,
  calories: colors.warning,
  weight: colors.textSecondary,
} as const;

type Point = { t: number; v: number };

/**
 * Strain, calories and weight on one time axis.
 *
 * THE SCALING PROBLEM
 *
 * These three quantities share no units and no magnitude — strain tops out at
 * 21, calories run to a few thousand, weight sits near 80. Plotted against one
 * axis, strain and weight would be flat lines along the bottom.
 *
 * So each series is normalised against its own range, and the y-axis carries no
 * labels at all. That is deliberate: the chart answers "do these move together,
 * and when", not "what was the value" — the numbers for that are in the legend
 * and on the other tabs. An axis labelled for one series would silently imply
 * the other two share it.
 */
export function CombinedTrendChart({
  weightEntries,
  whoopDays,
  calorieTotals,
  unit,
  days = 30,
}: CombinedTrendChartProps) {
  const series = useMemo(() => {
    const today = new Date();
    // Oldest first, so the lines read left to right.
    const window = Array.from({ length: days }, (_, i) => addDays(today, -(days - 1 - i)));

    const weightByDay = new Map((weightEntries ?? []).map((e) => [e.recordedOn, e.weightKg]));
    const whoopByDay = new Map((whoopDays ?? []).map((d) => [d.day, d]));

    const strain: Point[] = [];
    const calories: Point[] = [];
    const weight: Point[] = [];

    for (const date of window) {
      const key = localDayKey(date);
      const t = date.getTime();

      const whoop = whoopByDay.get(key);
      if (whoop?.strain !== null && whoop?.strain !== undefined) {
        strain.push({ t, v: whoop.strain });
      }

      const eaten = calorieTotals?.[key];
      // Zero means "logged nothing", not "ate nothing" — plotting it would draw
      // a cliff to the floor on any day the user forgot to log.
      if (typeof eaten === 'number' && eaten > 0) {
        calories.push({ t, v: eaten });
      }

      const kg = weightByDay.get(key);
      if (typeof kg === 'number') {
        weight.push({ t, v: fromKg(kg, unit) });
      }
    }

    return { strain, calories, weight, window };
  }, [weightEntries, whoopDays, calorieTotals, unit, days]);

  const { strain, calories, weight, window } = series;

  // A single point cannot show a trend, and three empty series cannot show
  // anything at all.
  const drawable = [strain, calories, weight].filter((s) => s.length >= 2);
  if (drawable.length === 0) return null;

  const innerW = WIDTH - PADDING.left - PADDING.right;
  const innerH = HEIGHT - PADDING.top - PADDING.bottom;

  const minT = window[0]!.getTime();
  const maxT = window[window.length - 1]!.getTime();

  const x = (t: number) =>
    PADDING.left + (maxT === minT ? innerW / 2 : ((t - minT) / (maxT - minT)) * innerW);

  /** Each series gets the full height, scaled to its own min and max. */
  const pathFor = (points: Point[]): string | null => {
    if (points.length < 2) return null;

    const values = points.map((p) => p.v);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || 1;

    return points
      .map((p, i) => {
        const y = PADDING.top + innerH - ((p.v - lo) / span) * innerH;
        return `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y.toFixed(1)}`;
      })
      .join(' ');
  };

  const dotsFor = (points: Point[]) => {
    const values = points.map((p) => p.v);
    const lo = Math.min(...values);
    const hi = Math.max(...values);
    const span = hi - lo || 1;
    return points.map((p) => ({
      cx: x(p.t),
      cy: PADDING.top + innerH - ((p.v - lo) / span) * innerH,
    }));
  };

  const latest = <T,>(points: { v: T }[]): T | null =>
    points.length > 0 ? points[points.length - 1]!.v : null;

  const legend = [
    { key: 'strain' as const, label: 'Strain', value: latest(strain)?.toFixed(1) ?? '—' },
    {
      key: 'calories' as const,
      label: 'Calories',
      value: latest(calories) !== null ? Math.round(latest(calories)!).toLocaleString() : '—',
    },
    {
      key: 'weight' as const,
      label: 'Weight',
      value: latest(weight) !== null ? `${latest(weight)!.toFixed(1)} ${unit}` : '—',
    },
  ];

  const paths = [
    { key: 'strain' as const, d: pathFor(strain), points: strain },
    { key: 'calories' as const, d: pathFor(calories), points: calories },
    { key: 'weight' as const, d: pathFor(weight), points: weight },
  ];

  return (
    <View style={styles.container}>
      <Text variant="overline" color="secondary">
        Last {days} days
      </Text>

      <Svg width="100%" height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`}>
        {paths.map(({ key, d, points }) =>
          d ? (
            <Path
              key={key}
              d={d}
              stroke={SERIES_COLOR[key]}
              strokeWidth={2}
              fill="none"
              strokeLinejoin="round"
              strokeLinecap="round"
              // Weight is the context, not the subject — drawn lighter so the
              // two behavioural series stay readable over it.
              opacity={key === 'weight' ? 0.45 : 1}
            />
          ) : points.length === 1 ? (
            // One reading still deserves to appear, as a dot rather than a line.
            <Circle
              key={key}
              cx={x(points[0]!.t)}
              cy={PADDING.top + innerH / 2}
              r={3}
              fill={SERIES_COLOR[key]}
            />
          ) : null,
        )}

        {paths.map(({ key, d, points }) =>
          d && points.length <= 30
            ? dotsFor(points).map((dot, i) => (
                <Circle
                  key={`${key}-${i}`}
                  cx={dot.cx}
                  cy={dot.cy}
                  r={2}
                  fill={colors.surface}
                  stroke={SERIES_COLOR[key]}
                  strokeWidth={1.5}
                  opacity={key === 'weight' ? 0.45 : 1}
                />
              ))
            : null,
        )}
      </Svg>

      <View style={styles.legend}>
        {legend.map((item) => (
          <View key={item.key} style={styles.legendItem}>
            <View style={[styles.swatch, { backgroundColor: SERIES_COLOR[item.key] }]} />
            <View>
              <Text variant="caption" color="tertiary">
                {item.label}
              </Text>
              <Text variant="captionMedium">{item.value}</Text>
            </View>
          </View>
        ))}
      </View>

      <Text variant="caption" color="tertiary">
        Each line is scaled to its own range, so heights are not comparable — the
        shapes are.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swatch: {
    width: 10,
    height: 10,
    borderRadius: radius.full,
  },
});
