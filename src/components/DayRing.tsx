import { StyleSheet, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { Text } from '@/components/ui';
import { useColors } from '@/providers/ThemeProvider';

type DayRingProps = {
  /** Day-of-month number shown in the middle. */
  label: string;
  /** Fraction of the daily goal consumed. Above 1 recolours rather than overflows. */
  progress: number;
  selected: boolean;
  isToday: boolean;
  disabled: boolean;
  size?: number;
};

/**
 * A day cell: the date sits inside a ring whose sweep is how much of the goal
 * was eaten. An SVG arc is the only way to draw a partial ring — a bordered
 * View can only ever be all-or-nothing.
 */
export function DayRing({
  label,
  progress,
  selected,
  isToday,
  disabled,
  size = 38,
}: DayRingProps) {
  const colors = useColors();
  const stroke = 3;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;

  const clamped = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0;
  const isOver = progress > 1;
  const hasData = progress > 0;

  const ringColor = isOver ? colors.over : colors.primary;

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Track — only drawn when there is progress to contrast against. */}
        {hasData ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={colors.border}
            strokeWidth={stroke}
            fill="none"
          />
        ) : null}

        {hasData ? (
          <Circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={ringColor}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference * clamped} ${circumference}`}
            // Start the sweep at 12 o'clock rather than 3.
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </Svg>

      {/* Selection is a filled disc behind the number, so it reads clearly even
          when a ring is also present. */}
      <View
        style={[
          styles.center,
          selected && { backgroundColor: colors.primary, borderRadius: size / 2 },
        ]}
      >
        <Text
          variant={selected || isToday ? 'captionMedium' : 'caption'}
          color={selected ? 'inverse' : disabled ? 'tertiary' : isToday ? 'primary' : 'default'}
        >
          {label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    margin: 5,
  },
});
