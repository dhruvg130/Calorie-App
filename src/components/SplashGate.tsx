import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';

import { Text } from '@/components/ui';
import { colors, spacing } from '@/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

const SIZE = 132;
const STROKE = 6;
const RADIUS = (SIZE - STROKE) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * Held on screen while the persisted session is read out of secure storage.
 * Without it, every cold start would flash the sign-in screen before the
 * restored session arrives.
 *
 * The animation is the app's own idea of itself: the same goal ring the
 * calendar and the summary card draw, sweeping closed once. Reusing the motif
 * rather than inventing a logo animation means the first thing you see is the
 * thing the app is about.
 *
 * NOTHING HERE DELAYS STARTUP
 *
 * Every value animates on its own timeline and this component is unmounted the
 * instant auth resolves. On a warm start you may only catch the first third of
 * the sweep, and that is correct — an animation that holds the app back to show
 * itself off has its priorities backwards. The looping pulse only becomes
 * visible on a genuinely slow start, where there is something to wait for.
 */
export function SplashGate() {
  // 1 = empty ring, 0 = closed. Matches strokeDashoffset's own direction.
  const sweep = useSharedValue(1);
  const markScale = useSharedValue(0.6);
  const markOpacity = useSharedValue(0);
  const wordmark = useSharedValue(0);
  const breathe = useSharedValue(1);

  useEffect(() => {
    sweep.value = withTiming(0, {
      duration: 900,
      // Fast out of the gate, easing into the close — a linear sweep reads
      // mechanical, like a progress bar rather than a flourish.
      easing: Easing.out(Easing.cubic),
    });

    markOpacity.value = withDelay(120, withTiming(1, { duration: 400 }));
    markScale.value = withDelay(
      120,
      withSequence(
        // Slight overshoot, then settle: the difference between "appeared" and
        // "arrived".
        withTiming(1.08, { duration: 320, easing: Easing.out(Easing.quad) }),
        withTiming(1, { duration: 180, easing: Easing.inOut(Easing.quad) }),
      ),
    );

    wordmark.value = withDelay(380, withTiming(1, { duration: 420 }));

    // Only ever seen if the session read is slow. Starts after the sweep would
    // have finished, so a fast start never shows a half-formed pulse.
    breathe.value = withDelay(
      1000,
      withRepeat(
        withTiming(1.04, { duration: 1100, easing: Easing.inOut(Easing.ease) }),
        -1,
        true,
      ),
    );
  }, [sweep, markScale, markOpacity, wordmark, breathe]);

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * sweep.value,
  }));

  const markStyle = useAnimatedStyle(() => ({
    opacity: markOpacity.value,
    transform: [{ scale: markScale.value }],
  }));

  const wordmarkStyle = useAnimatedStyle(() => ({
    opacity: wordmark.value,
    // Rises as it fades in; 10pt is enough to feel like motion without drawing
    // attention to itself.
    transform: [{ translateY: (1 - wordmark.value) * 10 }],
  }));

  const breatheStyle = useAnimatedStyle(() => ({
    transform: [{ scale: breathe.value }],
  }));

  return (
    <View style={styles.container}>
      <Animated.View style={breatheStyle}>
        <View style={styles.ringWrap}>
          <Svg width={SIZE} height={SIZE}>
            {/* Track the sweep runs over, so the ring reads as filling rather
                than as a line appearing from nowhere. */}
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={colors.border}
              strokeWidth={STROKE}
              fill="none"
            />
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={colors.primary}
              strokeWidth={STROKE}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              animatedProps={ringProps}
              // Start at 12 o'clock rather than 3, matching DayRing.
              transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
            />
          </Svg>

          <Animated.View style={[styles.mark, markStyle]}>
            <Ionicons name="flame" size={44} color={colors.primary} />
          </Animated.View>
        </View>
      </Animated.View>

      <Animated.View style={wordmarkStyle}>
        <Text variant="bodyMedium" color="secondary">
          Calorie Tracker
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.xl,
  },
  ringWrap: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mark: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
