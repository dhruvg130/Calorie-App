import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Circle, Path, Line as SvgLine } from 'react-native-svg';

import { fromKg, type WeightEntry } from '@/api/weight';
import { Text } from '@/components/ui';
import type { WeightUnit } from '@/lib/database.types';
import { useColors } from '@/providers/ThemeProvider';
import { makeStyles, radius, spacing } from '@/theme';

type WeightChartProps = {
  /** Newest-first, as the API returns them. */
  entries: WeightEntry[];
  unit: WeightUnit;
  height?: number;
};

const PADDING = { top: 12, right: 8, bottom: 20, left: 8 };

/**
 * Weight over time.
 *
 * Plotted against the *date* rather than against the entry's index, so a gap in
 * weigh-ins reads as a gap. Spacing points evenly would quietly compress a
 * three-week break into the same width as three consecutive days and make the
 * slope a lie.
 */
export function WeightChart({ entries, unit, height = 160 }: WeightChartProps) {
  const colors = useColors();
  const styles = useStyles();

  // Chronological for drawing; the list elsewhere stays newest-first.
  const points = useMemo(
    () => [...entries].reverse().map((e) => ({
      t: new Date(`${e.recordedOn}T12:00:00`).getTime(),
      v: fromKg(e.weightKg, unit),
    })),
    [entries, unit],
  );

  // A single point has no line to draw and no range to scale against.
  if (points.length < 2) return null;

  const width = 320; // viewBox units; the SVG scales to its container.
  const innerW = width - PADDING.left - PADDING.right;
  const innerH = height - PADDING.top - PADDING.bottom;

  const times = points.map((p) => p.t);
  const values = points.map((p) => p.v);
  const minT = Math.min(...times);
  const maxT = Math.max(...times);
  const minV = Math.min(...values);
  const maxV = Math.max(...values);

  // Pad the value axis so the line never sits flat against an edge, and so a
  // perfectly flat series still renders through the middle.
  const span = maxV - minV;
  const pad = span === 0 ? 1 : span * 0.15;
  const lo = minV - pad;
  const hi = maxV + pad;

  const x = (t: number) =>
    PADDING.left + (maxT === minT ? innerW / 2 : ((t - minT) / (maxT - minT)) * innerW);
  const y = (v: number) => PADDING.top + innerH - ((v - lo) / (hi - lo)) * innerH;

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.t)},${y(p.v)}`).join(' ');

  const first = points[0]!;
  const last = points[points.length - 1]!;
  const change = last.v - first.v;
  const gained = change > 0;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="overline" color="secondary">
          Trend
        </Text>
        <Text variant="captionMedium" color={Math.abs(change) < 0.05 ? 'secondary' : 'default'}>
          {change === 0
            ? 'No change'
            : `${gained ? '+' : '−'}${Math.abs(change).toFixed(1)} ${unit}`}
        </Text>
      </View>

      <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
        {/* Baseline at the lowest plotted value, for a sense of scale. */}
        <SvgLine
          x1={PADDING.left}
          y1={y(minV)}
          x2={width - PADDING.right}
          y2={y(minV)}
          stroke={colors.border}
          strokeWidth={1}
          strokeDasharray="3 4"
        />

        <Path d={d} stroke={colors.primary} strokeWidth={2.5} fill="none"
          strokeLinejoin="round" strokeLinecap="round" />

        {points.map((p) => (
          <Circle
            key={p.t}
            cx={x(p.t)}
            cy={y(p.v)}
            r={points.length > 30 ? 1.5 : 3}
            fill={colors.surface}
            stroke={colors.primary}
            strokeWidth={2}
          />
        ))}
      </Svg>

      <View style={styles.axis}>
        <Text variant="caption" color="tertiary">
          {new Date(first.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </Text>
        <Text variant="caption" color="tertiary">
          {new Date(last.t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
        </Text>
      </View>
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  container: {
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  axis: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.xs,
  },
}));
