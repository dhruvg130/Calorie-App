import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';

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

const ROW_WIDTH = 320;
const ROW_HEIGHT = 48;
const ROW_PAD = 6;

type Point = { t: number; v: number };

type Row = {
  key: string;
  label: string;
  color: string;
  points: Point[];
  format: (value: number) => string;
};

/**
 * Strain, calories and weight over the same stretch of days.
 *
 * WHY THREE STACKED CHARTS AND NOT ONE
 *
 * These quantities share no units and no magnitude — strain caps at 21,
 * calories run to thousands, weight sits near 80. Overlaying them means either
 * squashing two into flat lines, or normalising each to its own hidden scale,
 * which produces a picture where no height means anything and nothing can
 * honestly be compared.
 *
 * Stacked rows fix that: each keeps its own scale and prints its own real
 * numbers, while a shared date axis means you can still read down a column and
 * see that a strain spike lines up with a low-calorie day. Same question
 * answered, without a chart that quietly lies about magnitude.
 */
export function CombinedTrendChart({
  weightEntries,
  whoopDays,
  calorieTotals,
  unit,
  days = 30,
}: CombinedTrendChartProps) {
  const { rows, window } = useMemo(() => {
    const today = new Date();
    const win = Array.from({ length: days }, (_, i) => addDays(today, -(days - 1 - i)));

    const weightByDay = new Map((weightEntries ?? []).map((e) => [e.recordedOn, e.weightKg]));
    const whoopByDay = new Map((whoopDays ?? []).map((d) => [d.day, d]));

    const strain: Point[] = [];
    const calories: Point[] = [];
    const weight: Point[] = [];

    for (const date of win) {
      const key = localDayKey(date);
      const t = date.getTime();

      const whoop = whoopByDay.get(key);
      if (typeof whoop?.strain === 'number') strain.push({ t, v: whoop.strain });

      // Zero means "logged nothing", not "ate nothing" — plotting it would draw
      // a cliff to the floor on any day the user forgot to log.
      const eaten = calorieTotals?.[key];
      if (typeof eaten === 'number' && eaten > 0) calories.push({ t, v: eaten });

      const kg = weightByDay.get(key);
      if (typeof kg === 'number') weight.push({ t, v: fromKg(kg, unit) });
    }

    const built: Row[] = [
      {
        key: 'strain',
        label: 'Strain',
        color: colors.primary,
        points: strain,
        format: (v) => v.toFixed(1),
      },
      {
        key: 'calories',
        label: 'Calories eaten',
        color: colors.warning,
        points: calories,
        format: (v) => Math.round(v).toLocaleString(),
      },
      {
        key: 'weight',
        label: 'Weight',
        color: colors.textSecondary,
        points: weight,
        format: (v) => `${v.toFixed(1)} ${unit}`,
      },
    ];

    return { rows: built, window: win };
  }, [weightEntries, whoopDays, calorieTotals, unit, days]);

  const minT = window[0]!.getTime();
  const maxT = window[window.length - 1]!.getTime();

  const axisLabel = (date: Date) =>
    date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return (
    <View style={styles.container}>
      <Text variant="overline" color="secondary">
        Last {days} days
      </Text>

      {rows.map((row) => (
        <TrendRow key={row.key} row={row} minT={minT} maxT={maxT} />
      ))}

      <View style={styles.axis}>
        <Text variant="caption" color="tertiary">
          {axisLabel(window[0]!)}
        </Text>
        <Text variant="caption" color="tertiary">
          {axisLabel(window[window.length - 1]!)}
        </Text>
      </View>

      <Text variant="caption" color="tertiary">
        Each row has its own scale. Read down a column to see which days line up.
      </Text>
    </View>
  );
}

function TrendRow({ row, minT, maxT }: { row: Row; minT: number; maxT: number }) {
  const { points, color, label, format } = row;

  const latest = points.length > 0 ? points[points.length - 1]!.v : null;

  if (points.length < 2) {
    return (
      <View style={styles.row}>
        <View style={styles.rowHeader}>
          <View style={styles.labelGroup}>
            <View style={[styles.swatch, { backgroundColor: color }]} />
            <Text variant="captionMedium">{label}</Text>
          </View>
          <Text variant="captionMedium" color="secondary">
            {latest !== null ? format(latest) : '—'}
          </Text>
        </View>
        <Text variant="caption" color="tertiary">
          {points.length === 1
            ? 'One reading so far — a line needs two.'
            : 'Nothing logged yet.'}
        </Text>
      </View>
    );
  }

  const values = points.map((p) => p.v);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;

  const innerW = ROW_WIDTH - ROW_PAD * 2;
  const innerH = ROW_HEIGHT - ROW_PAD * 2;

  const x = (t: number) =>
    ROW_PAD + (maxT === minT ? innerW / 2 : ((t - minT) / (maxT - minT)) * innerW);
  const y = (v: number) => ROW_PAD + innerH - ((v - lo) / span) * innerH;

  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t).toFixed(1)},${y(p.v).toFixed(1)}`)
    .join(' ');

  return (
    <View style={styles.row}>
      <View style={styles.rowHeader}>
        <View style={styles.labelGroup}>
          <View style={[styles.swatch, { backgroundColor: color }]} />
          <Text variant="captionMedium">{label}</Text>
        </View>
        <Text variant="captionMedium" color="secondary">
          {latest !== null ? format(latest) : '—'}
        </Text>
      </View>

      <Svg width="100%" height={ROW_HEIGHT} viewBox={`0 0 ${ROW_WIDTH} ${ROW_HEIGHT}`}>
        {/* Floor of this row's own range, so the line has something to sit against. */}
        <Line
          x1={ROW_PAD}
          y1={ROW_HEIGHT - ROW_PAD}
          x2={ROW_WIDTH - ROW_PAD}
          y2={ROW_HEIGHT - ROW_PAD}
          stroke={colors.border}
          strokeWidth={1}
        />

        <Path d={d} stroke={color} strokeWidth={2} fill="none" strokeLinejoin="round"
          strokeLinecap="round" />

        {points.length <= 31
          ? points.map((p) => (
              <Circle
                key={p.t}
                cx={x(p.t)}
                cy={y(p.v)}
                r={2.5}
                fill={colors.surface}
                stroke={color}
                strokeWidth={1.5}
              />
            ))
          : null}
      </Svg>

      {/* Real numbers for the top and bottom of this row's line. */}
      <View style={styles.rangeRow}>
        <Text variant="caption" color="tertiary">
          low {format(lo)}
        </Text>
        <Text variant="caption" color="tertiary">
          high {format(hi)}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.lg,
  },
  row: {
    gap: spacing.xs,
  },
  rowHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  labelGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  swatch: {
    width: 8,
    height: 8,
    borderRadius: radius.full,
  },
  rangeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
  },
});
