import { useEffect } from 'react';
import { View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { useColors } from '@/providers/ThemeProvider';
import { makeStyles, radius } from '@/theme';

type ProgressBarProps = {
  /** Fraction of the goal consumed. Values above 1 clamp the bar but recolour it. */
  progress: number;
  height?: number;
  trackColor?: string;
  accessibilityLabel?: string;
};

export function ProgressBar({
  progress,
  height = 12,
  trackColor,
  accessibilityLabel,
}: ProgressBarProps) {
  const colors = useColors();
  const styles = useStyles();
  const clamped = Number.isFinite(progress) ? Math.min(Math.max(progress, 0), 1) : 0;
  const isOver = progress > 1;

  const width = useSharedValue(0);

  useEffect(() => {
    width.value = withTiming(clamped, {
      duration: 550,
      easing: Easing.out(Easing.cubic),
    });
  }, [clamped, width]);

  const fillStyle = useAnimatedStyle(() => ({
    width: `${width.value * 100}%`,
  }));

  return (
    <View
      style={[
        styles.track,
        { height, borderRadius: height / 2, backgroundColor: trackColor ?? colors.surfaceMuted },
      ]}
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
    >
      <Animated.View
        style={[
          styles.fill,
          fillStyle,
          {
            height,
            borderRadius: height / 2,
            backgroundColor: isOver ? colors.over : colors.primary,
          },
        ]}
      />
    </View>
  );
}

const useStyles = makeStyles(() => ({
  track: {
    width: '100%',
    overflow: 'hidden',
    borderRadius: radius.full,
  },
  fill: {
    // minWidth keeps a sliver visible for very small non-zero values, so the
    // bar reads as "started" rather than "empty".
    minWidth: 4,
  },
}));
