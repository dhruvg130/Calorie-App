import { useEffect } from 'react';
import { View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { useColors } from '@/providers/ThemeProvider';
import { makeStyles, radius, spacing } from '@/theme';

type SkeletonProps = {
  width?: number | `${number}%`;
  height?: number;
  style?: ViewStyle;
};

/** Pulsing placeholder used while a query is loading. */
export function Skeleton({ width = '100%', height = 16, style }: SkeletonProps) {
  const colors = useColors();
  const opacity = useSharedValue(0.4);

  useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.85, { duration: 800, easing: Easing.inOut(Easing.ease) }),
      -1,
      true,
    );
  }, [opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      style={[
        { width, height, borderRadius: radius.sm, backgroundColor: colors.surfaceMuted },
        animatedStyle,
        style,
      ]}
    />
  );
}

/** Matches the shape of `FoodEntryRow` so the list does not jump on load. */
export function EntryListSkeleton({ rows = 3 }: { rows?: number }) {
  const styles = useStyles();

  return (
    <View style={styles.list}>
      {Array.from({ length: rows }, (_, index) => (
        <View key={index} style={styles.row}>
          <Skeleton width={44} height={44} style={styles.avatar} />
          <View style={styles.rowText}>
            <Skeleton width="60%" height={15} />
            <Skeleton width="35%" height={12} />
          </View>
          <Skeleton width={52} height={18} />
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((colors) => ({
  list: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    padding: spacing.lg,
  },
  avatar: {
    borderRadius: radius.md,
  },
  rowText: {
    flex: 1,
    gap: spacing.sm,
  },
}));
